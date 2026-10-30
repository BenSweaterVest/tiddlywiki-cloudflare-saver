/**
 * TiddlyWiki Cloudflare Saver: Worker entry point.
 *
 * Serves a single-file TiddlyWiki straight from a GitHub repository and
 * commits saves back to it. Nothing is rebuilt or redeployed on save.
 *
 *   GET  /                 the wiki (sign-in required when READ_ACCESS=private)
 *   GET  /_saver/          sign-in, status and upload page
 *   GET  /_saver/plugin.json, /_saver/plugin.tid   the bundled TiddlyWiki plugin
 *   GET  /_saver/api/status
 *   POST /_saver/api/login, /_saver/api/logout
 *   PUT  /_saver/api/wiki  save (body: base64 wiki, header X-Wiki-Parent)
 */

import { loadConfig, ConfigError } from './config.js';
import { GitHub, GitHubError } from './github.js';
import {
  passwordMatches, createSession, isSignedIn, sessionCookie, clearedSessionCookie, requireSameOrigin
} from './auth.js';
import { createLimiter, LoginLimiter } from './limiter.js';
import { json, error, html, redirect, newNonce, readSmallJson, SECURITY_HEADERS } from './http.js';
import { adminPage } from './admin-page.js';
import { VERSION, PLUGIN_TIDDLER } from './generated/plugin.js';

export { LoginLimiter };

const SHA_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SAVE_REASONS = new Set(['save', 'autosave', 'setup', 'plugin-update']);

// Reuse one GitHub client per isolate so its ETag cache survives between requests.
let clientCache = { key: null, client: null };

function githubFor(config, fetchImpl) {
  const key = [config.githubToken, config.repo, config.branch, config.wikiPath].join('\n');
  if (fetchImpl) {
    return new GitHub(config, fetchImpl);
  }
  if (clientCache.key !== key) {
    clientCache = { key, client: new GitHub(config) };
  }
  return clientCache.client;
}

function methodNotAllowed(allowed) {
  return error(405, 'method_not_allowed', `Use ${allowed.join(' or ')}.`, { Allow: allowed.join(', ') });
}

function githubFailure(e) {
  if (!(e instanceof GitHubError)) {
    throw e;
  }
  switch (e.kind) {
  case 'conflict':
    return error(409, 'conflict', 'The wiki was changed somewhere else since this copy was loaded.');
  case 'auth':
    return error(502, 'github_auth', 'GitHub rejected the token. It may have expired or been revoked.');
  case 'forbidden':
    return error(502, 'github_forbidden', 'The GitHub token is not allowed to write to this repository.');
  case 'not_found':
    return error(502, 'github_not_found', 'Repository or branch not found, or the token cannot see it.');
  case 'rate_limited':
    return error(503, 'github_rate_limited', 'GitHub rate limit reached. Try again in a few minutes.');
  case 'unavailable':
    return error(503, 'github_unavailable', `GitHub is having trouble (${e.message}). Try again shortly.`);
  case 'network':
    return error(502, 'github_unreachable', e.message);
  default:
    return error(502, 'github_rejected', `GitHub refused the save: ${e.message}`);
  }
}

function pluginTid() {
  const { text, ...fields } = PLUGIN_TIDDLER;
  const header = Object.keys(fields).sort().map(name => `${name}: ${fields[name]}`).join('\n');
  return `${header}\n\n${text}`;
}

async function serveWiki(request, config, github) {
  if (config.readAccess === 'private' && !(await isSignedIn(request, config))) {
    const url = new URL(request.url);
    return redirect(`/_saver/?next=${encodeURIComponent(url.pathname + url.search)}`);
  }

  let info;
  try {
    info = await github.getWikiInfo();
  } catch (e) {
    return wikiUnavailable(e);
  }
  if (!info.exists) {
    return redirect('/_saver/');
  }

  const etag = `"${info.sha}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': config.readAccess === 'private' ? 'private, no-cache' : 'no-cache',
    'ETag': etag,
    // The plugin reads this through the Performance API to learn which
    // version of the file it was loaded from, for conflict detection.
    'Server-Timing': `saver;desc="${info.sha}", saver-version;desc="${VERSION}"`
  };
  if (config.readAccess === 'private') {
    headers['Vary'] = 'Cookie';
  }

  const ifNoneMatch = request.headers.get('If-None-Match') || '';
  if (ifNoneMatch.split(',').some(tag => tag.trim() === etag)) {
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { headers });
  }

  let blob;
  try {
    blob = await github.getBlob(info.sha);
  } catch (e) {
    return wikiUnavailable(e);
  }
  const length = blob.headers.get('content-length');
  if (length) {
    headers['Content-Length'] = length;
  }
  return new Response(blob.body, { headers });
}

function wikiUnavailable(e) {
  if (!(e instanceof GitHubError)) {
    throw e;
  }
  const body = `The wiki could not be loaded from GitHub (${e.message}).\n\nOpen /_saver/ and sign in to see what is wrong.\n`;
  return new Response(body, {
    status: 502,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function status(request, env, config, github) {
  const signedIn = await isSignedIn(request, config);
  // ?quick=1 skips the GitHub calls; the plugin uses it on every page load.
  if (!signedIn || new URL(request.url).searchParams.has('quick')) {
    return json({ version: VERSION, signedIn, readAccess: config.readAccess });
  }
  const [wiki, repo] = await Promise.all([
    github.getWikiInfo().catch(e => ({ exists: false, error: e.kind, message: e.message })),
    github.getRepoStatus().catch(e => ({ ok: false, error: e.kind, message: e.message }))
  ]);
  return json({
    version: VERSION,
    signedIn: true,
    readAccess: config.readAccess,
    repo: config.repo,
    branch: config.branch || null,
    wikiPath: config.wikiPath,
    maxWikiBytes: config.maxWikiBytes,
    limiter: createLimiter(env).backend,
    wiki,
    github: repo
  });
}

/**
 * Wrap the limiter so an outage (for example an exhausted Durable Object
 * quota) degrades to the in-memory limiter instead of blocking sign-in.
 */
function resilientLimiter(env) {
  const primary = createLimiter(env);
  const fallback = createLimiter({});
  const guard = name => async ip => {
    try {
      return await primary[name](ip);
    } catch (e) {
      console.error(`Login limiter ${name} failed, using in-memory fallback:`, e.message);
      return fallback[name](ip);
    }
  };
  return { check: guard('check'), failure: guard('failure'), success: guard('success') };
}

async function login(request, env, config) {
  if (!requireSameOrigin(request)) {
    return error(403, 'cross_site', 'Request blocked.');
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limiter = resilientLimiter(env);
  const gate = await limiter.check(ip);
  if (!gate.allowed) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfter / 60));
    return error(429, 'locked', `Too many failed sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`, {
      'Retry-After': String(gate.retryAfter)
    });
  }
  const body = await readSmallJson(request);
  if (!body || !(await passwordMatches(body.password, config.password))) {
    await limiter.failure(ip);
    return error(401, 'bad_password', 'Wrong password.');
  }
  await limiter.success(ip);
  const token = await createSession(config.password, config.sessionSeconds);
  return json({ signedIn: true }, 200, { 'Set-Cookie': sessionCookie(token, config.sessionSeconds) });
}

function logout(request) {
  if (!requireSameOrigin(request)) {
    return error(403, 'cross_site', 'Request blocked.');
  }
  return json({ signedIn: false }, 200, { 'Set-Cookie': clearedSessionCookie() });
}

async function saveWiki(request, config, github) {
  if (!requireSameOrigin(request)) {
    return error(403, 'cross_site', 'Request blocked.');
  }
  if (!(await isSignedIn(request, config))) {
    return error(401, 'signed_out', 'Sign in to save.');
  }

  const parent = (request.headers.get('X-Wiki-Parent') || '').trim().toLowerCase();
  if (!parent) {
    return error(428, 'missing_parent', 'X-Wiki-Parent header is required.');
  }
  if (parent !== 'none' && !SHA_PATTERN.test(parent)) {
    return error(400, 'bad_parent', 'X-Wiki-Parent must be a blob SHA or "none".');
  }

  const length = Number(request.headers.get('Content-Length'));
  if (!Number.isInteger(length) || length <= 0 || !request.body) {
    return error(411, 'length_required', 'The request needs a body with a Content-Length.');
  }
  const maxEncoded = Math.ceil(config.maxWikiBytes / 3) * 4;
  if (length > maxEncoded) {
    const mb = n => (n / 1024 / 1024).toFixed(1);
    return error(413, 'too_large', `The wiki is about ${mb(length * 0.75)} MB, over the ${mb(config.maxWikiBytes)} MB limit (MAX_WIKI_MB).`);
  }

  const reason = request.headers.get('X-Save-Reason');
  const message = SAVE_REASONS.has(reason) && reason !== 'save'
    ? `${config.commitMessage} (${reason})`
    : config.commitMessage;

  try {
    const result = await github.putWiki({
      body: request.body,
      length,
      parentSha: parent === 'none' ? null : parent,
      message
    });
    return json({ saved: true, ...result });
  } catch (e) {
    return githubFailure(e);
  }
}

/**
 * @param {Request} request
 * @param {object} env - Worker bindings
 * @param {object} [deps] - test seams: { fetch } used for GitHub calls
 */
export async function handleRequest(request, env, deps = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/_saver') {
    return redirect('/_saver/', 301);
  }
  if (path === '/_saver/plugin.json') {
    return method === 'GET' ? json([PLUGIN_TIDDLER], 200, { 'Cache-Control': 'no-cache' }) : methodNotAllowed(['GET']);
  }
  if (path === '/_saver/plugin.tid') {
    if (method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    return new Response(pluginTid(), {
      headers: {
        ...SECURITY_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="cloudflare-saver-plugin.tid"',
        'Cache-Control': 'no-cache'
      }
    });
  }

  let config;
  try {
    config = loadConfig(env);
  } catch (e) {
    if (!(e instanceof ConfigError)) {
      throw e;
    }
    if (path === '/_saver/') {
      const nonce = newNonce();
      return html(adminPage({ nonce, configProblems: e.problems }), { nonce, status: 503 });
    }
    if (path.startsWith('/_saver/api/')) {
      return json({ error: 'not_configured', message: e.message, problems: e.problems }, 503);
    }
    return redirect('/_saver/');
  }

  const github = githubFor(config, deps.fetch);

  switch (path) {
  case '/':
  case '/index.html':
    return method === 'GET' || method === 'HEAD' ? serveWiki(request, config, github) : methodNotAllowed(['GET', 'HEAD']);
  case '/_saver/': {
    if (method !== 'GET') {
      return methodNotAllowed(['GET']);
    }
    const nonce = newNonce();
    return html(adminPage({ nonce }), { nonce });
  }
  case '/_saver/api/status':
    return method === 'GET' ? status(request, env, config, github) : methodNotAllowed(['GET']);
  case '/_saver/api/login':
    return method === 'POST' ? login(request, env, config) : methodNotAllowed(['POST']);
  case '/_saver/api/logout':
    return method === 'POST' ? logout(request) : methodNotAllowed(['POST']);
  case '/_saver/api/wiki':
    return method === 'PUT' ? saveWiki(request, config, github) : methodNotAllowed(['PUT']);
  default:
    return new Response('Not found\n', {
      status: 404,
      headers: { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      console.error('Unhandled error:', e);
      return error(500, 'internal', 'Unexpected server error. Check the Worker logs.');
    }
  }
};
