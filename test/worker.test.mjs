import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest } from '../worker/src/index.js';
import { loadConfig, ConfigError, cleanPath, HARD_MAX_WIKI_MB } from '../worker/src/config.js';
import { passwordMatches, createSession, verifySession, requireSameOrigin } from '../worker/src/auth.js';
import { emptyState, checkAttempt, recordFailure, recordSuccess, POLICY, LoginLimiter } from '../worker/src/limiter.js';
import { framedStream } from '../worker/src/github.js';
import { safeNext } from '../worker/src/http.js';
import { VERSION } from '../worker/src/generated/plugin.js';
import { FakeGitHub, gitBlobSha } from './helpers/fake-github.mjs';

const ORIGIN = 'https://wiki.example';
const PASSWORD = 'correct horse battery staple';
const WIKI = '<!doctype html><html><body>wiki v1</body></html>';

function setup({ env = {}, files = { 'index.html': WIKI } } = {}) {
  const github = new FakeGitHub({ files });
  const fullEnv = {
    GITHUB_TOKEN: 'test-token',
    WIKI_PASSWORD: PASSWORD,
    GITHUB_REPO: 'owner/wiki',
    ...env
  };
  const call = (path, init = {}) => handleRequest(new Request(ORIGIN + path, init), fullEnv, { fetch: github.fetch });
  return { github, env: fullEnv, call };
}

async function signIn(call, ip = '203.0.113.1') {
  const response = await call('/_saver/api/login', {
    method: 'POST',
    headers: { 'X-Saver-Request': '1', 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ password: PASSWORD })
  });
  assert.equal(response.status, 200);
  return response.headers.get('Set-Cookie').split(';')[0];
}

function saveRequest(cookie, content, parent, extraHeaders = {}) {
  const body = Buffer.from(content).toString('base64');
  return {
    method: 'PUT',
    headers: {
      'Cookie': cookie,
      'X-Saver-Request': '1',
      'Content-Type': 'text/plain',
      'Content-Length': String(body.length),
      'X-Wiki-Parent': parent,
      ...extraHeaders
    },
    body
  };
}

describe('config', () => {
  test('accepts a minimal valid environment and applies defaults', () => {
    const config = loadConfig({ GITHUB_TOKEN: 't', WIKI_PASSWORD: PASSWORD, GITHUB_REPO: 'a/b' });
    assert.equal(config.wikiPath, 'index.html');
    assert.equal(config.readAccess, 'public');
    assert.equal(config.apiUrl, 'https://api.github.com');
    assert.equal(config.sessionSeconds, 30 * 86400);
    assert.equal(config.maxWikiBytes, 50 * 1024 * 1024);
  });

  test('reports every problem at once', () => {
    assert.throws(() => loadConfig({ WIKI_PASSWORD: 'short', GITHUB_REPO: 'not a repo', READ_ACCESS: 'secret' }), error => {
      assert.ok(error instanceof ConfigError);
      assert.equal(error.problems.length, 4);
      return true;
    });
  });

  test('caps the wiki size at the free-plan ceiling', () => {
    const config = loadConfig({ GITHUB_TOKEN: 't', WIKI_PASSWORD: PASSWORD, GITHUB_REPO: 'a/b', MAX_WIKI_MB: '500' });
    assert.equal(config.maxWikiBytes, HARD_MAX_WIKI_MB * 1024 * 1024);
  });

  test('rejects unsafe paths and plain-http API URLs', () => {
    assert.equal(cleanPath('wiki/index.html'), 'wiki/index.html');
    assert.equal(cleanPath('/wiki/index.html/'), 'wiki/index.html');
    assert.equal(cleanPath('../secrets'), null);
    assert.equal(cleanPath('a//b'), null);
    assert.throws(() => loadConfig({ GITHUB_TOKEN: 't', WIKI_PASSWORD: PASSWORD, GITHUB_REPO: 'a/b', GITHUB_API_URL: 'http://evil.example' }));
    assert.doesNotThrow(() => loadConfig({ GITHUB_TOKEN: 't', WIKI_PASSWORD: PASSWORD, GITHUB_REPO: 'a/b', GITHUB_API_URL: 'http://127.0.0.1:8787' }));
  });
});

describe('auth', () => {
  test('passwordMatches', async () => {
    assert.equal(await passwordMatches(PASSWORD, PASSWORD), true);
    assert.equal(await passwordMatches('wrong', PASSWORD), false);
    assert.equal(await passwordMatches('', PASSWORD), false);
    assert.equal(await passwordMatches(undefined, PASSWORD), false);
    assert.equal(await passwordMatches('x'.repeat(5000), PASSWORD), false);
  });

  test('sessions verify, expire, and die when the password changes', async () => {
    const now = Date.UTC(2026, 0, 1);
    const token = await createSession(PASSWORD, 60, now);
    assert.equal(await verifySession(token, PASSWORD, now), true);
    assert.equal(await verifySession(token, PASSWORD, now + 61_000), false);
    assert.equal(await verifySession(token, 'a different password', now), false);
    const [v, exp, nonce, sig] = token.split('.');
    assert.equal(await verifySession([v, Number(exp) + 1000, nonce, sig].join('.'), PASSWORD, now), false);
    assert.equal(await verifySession('garbage', PASSWORD, now), false);
    assert.equal(await verifySession(null, PASSWORD, now), false);
  });

  test('requireSameOrigin needs the custom header and a matching Origin', () => {
    const make = headers => new Request(`${ORIGIN}/x`, { method: 'POST', headers });
    assert.equal(requireSameOrigin(make({})), false);
    assert.equal(requireSameOrigin(make({ 'X-Saver-Request': '1' })), true);
    assert.equal(requireSameOrigin(make({ 'X-Saver-Request': '1', 'Origin': ORIGIN })), true);
    assert.equal(requireSameOrigin(make({ 'X-Saver-Request': '1', 'Origin': 'https://evil.example' })), false);
  });

  test('safeNext only allows local paths', () => {
    assert.equal(safeNext('/'), '/');
    assert.equal(safeNext('/#Tiddler'), '/#Tiddler');
    assert.equal(safeNext('//evil.example'), '/');
    assert.equal(safeNext('https://evil.example'), '/');
    assert.equal(safeNext(null), '/');
  });
});

describe('login limiter policy', () => {
  test('locks an IP after repeated failures, then releases it', () => {
    const state = emptyState();
    const t0 = 1_000_000;
    for (let i = 0; i < POLICY.perIp.max; i++) {
      assert.equal(checkAttempt(state, 'a', t0).allowed, true);
      recordFailure(state, 'a', t0);
    }
    const blocked = checkAttempt(state, 'a', t0);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfter, POLICY.perIp.windowMs / 1000);
    assert.equal(checkAttempt(state, 'b', t0).allowed, true);
    assert.equal(checkAttempt(state, 'a', t0 + POLICY.perIp.windowMs).allowed, true);
  });

  test('success clears the IP counter', () => {
    const state = emptyState();
    recordFailure(state, 'a', 0);
    recordSuccess(state, 'a');
    assert.equal(state.ips.a, undefined);
  });

  test('global limit stops distributed guessing', () => {
    const state = emptyState();
    for (let i = 0; i < POLICY.global.max; i++) {
      recordFailure(state, `ip${i}`, 0);
    }
    assert.equal(checkAttempt(state, 'fresh-ip', 0).allowed, false);
  });

  test('tracked IPs are capped', () => {
    const state = emptyState();
    const policy = { ...POLICY, global: { max: 1e9, windowMs: 1e9 }, maxTrackedIps: 3 };
    for (let i = 0; i < 10; i++) {
      recordFailure(state, `ip${i}`, i, policy);
    }
    assert.deepEqual(Object.keys(state.ips).sort(), ['ip7', 'ip8', 'ip9']);
  });

  test('Durable Object class works over plain HTTP', async () => {
    const store = new Map();
    const limiter = new LoginLimiter({ storage: { get: async k => store.get(k), put: async (k, v) => store.set(k, v) } });
    for (let i = 0; i < POLICY.perIp.max; i++) {
      await limiter.fetch(new Request('https://limiter/failure?ip=x', { method: 'POST' }));
    }
    const result = await (await limiter.fetch(new Request('https://limiter/check?ip=x', { method: 'POST' }))).json();
    assert.equal(result.allowed, false);
  });
});

describe('framedStream', () => {
  test('wraps a body stream with a prefix and suffix', async () => {
    const body = new Blob(['QUJD']).stream();
    const { stream, length } = framedStream('{"content":"', body, 4, '"}');
    const text = await new Response(stream).text();
    assert.equal(text, '{"content":"QUJD"}');
    assert.equal(length, text.length);
  });
});

describe('serving the wiki', () => {
  test('streams the file with ETag and Server-Timing', async () => {
    const { call, github } = setup();
    const response = await call('/');
    assert.equal(response.status, 200);
    assert.equal(await response.text(), WIKI);
    const sha = github.files.get('index.html').sha;
    assert.equal(response.headers.get('ETag'), `"${sha}"`);
    assert.match(response.headers.get('Server-Timing'), new RegExp(`saver;desc="${sha}"`));
    assert.match(response.headers.get('Server-Timing'), new RegExp(`saver-version;desc="${VERSION}"`));
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  });

  test('answers 304 when the browser copy is current, without fetching the blob', async () => {
    const { call, github } = setup();
    const sha = github.files.get('index.html').sha;
    github.requests = [];
    const response = await call('/', { headers: { 'If-None-Match': `"${sha}"` } });
    assert.equal(response.status, 304);
    assert.ok(!github.requests.some(r => r.path.includes('/git/blobs/')));
  });

  test('HEAD returns headers only', async () => {
    const { call } = setup();
    const response = await call('/', { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '');
  });

  test('redirects to the setup page when there is no wiki yet', async () => {
    const { call } = setup({ files: {} });
    const response = await call('/');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/_saver/');
  });

  test('private mode requires sign-in to view', async () => {
    const { call } = setup({ env: { READ_ACCESS: 'private' } });
    const anonymous = await call('/');
    assert.equal(anonymous.status, 302);
    assert.equal(anonymous.headers.get('Location'), '/_saver/?next=%2F');
    const cookie = await signIn(call);
    const signedIn = await call('/', { headers: { Cookie: cookie } });
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.headers.get('Cache-Control'), 'private, no-cache');
  });

  test('unconfigured Worker sends people to the setup page', async () => {
    const response = await handleRequest(new Request(`${ORIGIN}/`), {});
    assert.equal(response.status, 302);
    const page = await handleRequest(new Request(`${ORIGIN}/_saver/`), {});
    assert.equal(page.status, 503);
    assert.match(await page.text(), /GITHUB_TOKEN secret is missing/);
  });

  test('unknown paths are 404', async () => {
    const { call } = setup();
    assert.equal((await call('/nope')).status, 404);
  });
});

describe('sign-in', () => {
  test('wrong password is refused and counted; lockout follows', async () => {
    const { call } = setup();
    const attempt = () => call('/_saver/api/login', {
      method: 'POST',
      headers: { 'X-Saver-Request': '1', 'CF-Connecting-IP': '198.51.100.7' },
      body: JSON.stringify({ password: 'nope' })
    });
    for (let i = 0; i < POLICY.perIp.max; i++) {
      assert.equal((await attempt()).status, 401);
    }
    const locked = await attempt();
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('Retry-After')) > 0);
  });

  test('a cross-site login attempt is blocked', async () => {
    const { call } = setup();
    const response = await call('/_saver/api/login', { method: 'POST', body: JSON.stringify({ password: PASSWORD }) });
    assert.equal(response.status, 403);
  });

  test('session cookie is secure', async () => {
    const { call } = setup();
    const response = await call('/_saver/api/login', {
      method: 'POST',
      headers: { 'X-Saver-Request': '1', 'CF-Connecting-IP': '192.0.2.10' },
      body: JSON.stringify({ password: PASSWORD })
    });
    const cookie = response.headers.get('Set-Cookie');
    assert.match(cookie, /^__Host-saver-session=/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });

  test('logout clears the cookie', async () => {
    const { call } = setup();
    const response = await call('/_saver/api/logout', { method: 'POST', headers: { 'X-Saver-Request': '1' } });
    assert.match(response.headers.get('Set-Cookie'), /Max-Age=0/);
  });
});

describe('status', () => {
  test('anonymous status reveals nothing about the repository', async () => {
    const { call } = setup();
    const data = await (await call('/_saver/api/status')).json();
    assert.deepEqual(data, { version: VERSION, signedIn: false, readAccess: 'public' });
  });

  test('signed-in status includes diagnostics', async () => {
    const { call, github } = setup();
    const cookie = await signIn(call, '192.0.2.20');
    const data = await (await call('/_saver/api/status', { headers: { Cookie: cookie } })).json();
    assert.equal(data.signedIn, true);
    assert.equal(data.repo, 'owner/wiki');
    assert.equal(data.wiki.sha, github.files.get('index.html').sha);
    assert.equal(data.github.ok, true);
    assert.equal(data.github.canPush, true);
    assert.equal(data.github.tokenExpires, '2027-01-01 00:00:00 UTC');
    assert.equal(data.limiter, 'memory');
  });

  test('quick status skips GitHub', async () => {
    const { call, github } = setup();
    const cookie = await signIn(call, '192.0.2.21');
    github.requests = [];
    const data = await (await call('/_saver/api/status?quick=1', { headers: { Cookie: cookie } })).json();
    assert.equal(data.signedIn, true);
    assert.equal(github.requests.length, 0);
  });
});

describe('saving', () => {
  test('commits new content when the parent matches', async () => {
    const { call, github } = setup({ env: { COMMIT_MESSAGE: 'Wiki update' } });
    const cookie = await signIn(call, '192.0.2.30');
    const parent = github.files.get('index.html').sha;
    const next = '<!doctype html><html><body>wiki v2 é\u{1F600}</body></html>';
    const response = await call('/_saver/api/wiki', saveRequest(cookie, next, parent, { 'X-Save-Reason': 'autosave' }));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.sha, gitBlobSha(Buffer.from(next)));
    assert.equal(github.getFile('index.html'), next);
    assert.equal(github.commits.at(-1).message, 'Wiki update (autosave)');
  });

  test('a stale parent is a conflict and nothing is written', async () => {
    const { call, github } = setup();
    const cookie = await signIn(call, '192.0.2.31');
    const stale = 'a'.repeat(40);
    const response = await call('/_saver/api/wiki', saveRequest(cookie, 'new', stale));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, 'conflict');
    assert.equal(github.getFile('index.html'), WIKI);
  });

  test('"none" creates the file, and is a conflict if it already exists', async () => {
    const { call, github } = setup({ files: {} });
    const cookie = await signIn(call, '192.0.2.32');
    assert.equal((await call('/_saver/api/wiki', saveRequest(cookie, WIKI, 'none'))).status, 200);
    assert.equal(github.getFile('index.html'), WIKI);
    assert.equal((await call('/_saver/api/wiki', saveRequest(cookie, WIKI, 'none'))).status, 409);
  });

  test('writes to a configured branch and nested path', async () => {
    const { call, github } = setup({ env: { GITHUB_BRANCH: 'wiki', WIKI_PATH: 'site/index.html' }, files: {} });
    const cookie = await signIn(call, '192.0.2.33');
    assert.equal((await call('/_saver/api/wiki', saveRequest(cookie, WIKI, 'none'))).status, 200);
    assert.equal(github.getFile('site/index.html'), WIKI);
    assert.equal(github.commits.at(-1).branch, 'wiki');
  });

  test('refuses unauthenticated, cross-site and malformed saves', async () => {
    const { call, github } = setup();
    const cookie = await signIn(call, '192.0.2.34');
    const parent = github.files.get('index.html').sha;

    assert.equal((await call('/_saver/api/wiki', saveRequest('x=y', 'new', parent))).status, 401);

    const crossSite = saveRequest(cookie, 'new', parent);
    delete crossSite.headers['X-Saver-Request'];
    assert.equal((await call('/_saver/api/wiki', crossSite)).status, 403);

    const noParent = saveRequest(cookie, 'new', parent);
    delete noParent.headers['X-Wiki-Parent'];
    assert.equal((await call('/_saver/api/wiki', noParent)).status, 428);

    assert.equal((await call('/_saver/api/wiki', saveRequest(cookie, 'new', 'not-a-sha'))).status, 400);
    assert.equal(github.getFile('index.html'), WIKI);
  });

  test('enforces MAX_WIKI_MB from Content-Length before reading the body', async () => {
    const { call, github } = setup({ env: { MAX_WIKI_MB: '0.001' } });
    const cookie = await signIn(call, '192.0.2.35');
    const parent = github.files.get('index.html').sha;
    const response = await call('/_saver/api/wiki', saveRequest(cookie, 'x'.repeat(2000), parent));
    assert.equal(response.status, 413);
  });

  test('maps GitHub failures to clear errors', async () => {
    const { call, github } = setup();
    const cookie = await signIn(call, '192.0.2.36');
    const parent = github.files.get('index.html').sha;
    const cases = [
      [401, 'github_auth'],
      [404, 'github_not_found'],
      [403, 'github_forbidden'],
      [422, 'github_rejected']
    ];
    for (const [status, code] of cases) {
      github.failNextRequest('PUT', status);
      const response = await call('/_saver/api/wiki', saveRequest(cookie, 'new', parent));
      assert.equal((await response.json()).error, code, `GitHub ${status}`);
    }
  });

  test('wrong methods get 405', async () => {
    const { call } = setup();
    assert.equal((await call('/_saver/api/wiki')).status, 405);
    assert.equal((await call('/', { method: 'POST' })).status, 405);
  });
});

describe('plugin downloads', () => {
  test('plugin.json is a one-tiddler array with the current version', async () => {
    const { call } = setup();
    const data = await (await call('/_saver/plugin.json')).json();
    assert.equal(data.length, 1);
    assert.equal(data[0].title, '$:/plugins/BenSweaterVest/cloudflare-saver');
    assert.equal(data[0].version, VERSION);
  });

  test('plugin.tid has a header and JSON body', async () => {
    const { call } = setup();
    const text = await (await call('/_saver/plugin.tid')).text();
    const [header, body] = text.split('\n\n');
    assert.match(header, /^plugin-type: plugin$/m);
    assert.ok(JSON.parse(body).tiddlers);
  });
});
