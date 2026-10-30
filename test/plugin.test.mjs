/**
 * Tests for the TiddlyWiki plugin. Boots the real TiddlyWiki core in Node so
 * tiddlers, filters and change events behave as in the browser, and talks to
 * the real Worker code backed by a fake GitHub.
 */

import { test, describe, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { handleRequest } from '../worker/src/index.js';
import { FakeGitHub, gitBlobSha as referenceBlobSha } from './helpers/fake-github.mjs';

const require = createRequire(import.meta.url);
const ORIGIN = 'https://wiki.example';
const PASSWORD = 'correct horse battery staple';
const WIKI = '<!doctype html><html><body>original</body></html>';
const PLUGIN_DIR = new URL('../plugin/', import.meta.url);

let $tw;
let core;
let startup;

function loadModule(name, requires = {}) {
  const code = fs.readFileSync(new URL(name, PLUGIN_DIR), 'utf8');
  const module = { exports: {} };
  const localRequire = title => {
    if (title in requires) {
      return requires[title];
    }
    throw new Error(`Unexpected require: ${title}`);
  };
  new Function('module', 'exports', 'require', '$tw', code)(module, module.exports, localRequire, $tw);
  return module.exports;
}

before(async () => {
  const { TiddlyWiki } = require('tiddlywiki');
  $tw = TiddlyWiki();
  $tw.boot.argv = ['--version'];
  const log = console.log;
  console.log = () => {};
  await new Promise(resolve => $tw.boot.boot(resolve));
  console.log = log;
  core = loadModule('core.js');
  startup = loadModule('startup.js');
});

/** Same dirty tracking as TiddlyWiki's SaverHandler. */
function fakeSaverHandler(wiki) {
  const handler = {
    numChanges: 0,
    filterFn: wiki.compileFilter($tw.wiki.getTiddlerText('$:/config/SaverFilter')),
    updateDirtyStatus() {}
  };
  wiki.addEventListener('change', changes => {
    handler.numChanges += handler.filterFn.call(wiki, iterator => {
      for (const title of Object.keys(changes)) {
        if (changes[title].normal) {
          iterator(wiki.getTiddler(title), title);
        }
      }
    }).length;
  });
  return handler;
}

/** A fetch that routes the plugin's requests into the Worker, with a cookie jar. */
function workerFetch(github, env) {
  let cookie = '';
  const fetchImpl = async (path, init = {}) => {
    const headers = new Headers(init.headers);
    if (cookie) {
      headers.set('Cookie', cookie);
    }
    headers.set('CF-Connecting-IP', '10.0.0.1');
    if (typeof init.body === 'string') {
      headers.set('Content-Length', String(Buffer.byteLength(init.body)));
    }
    const response = await handleRequest(new Request(ORIGIN + path, { ...init, headers }), env, { fetch: github.fetch });
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) {
      cookie = /Max-Age=0/.test(setCookie) ? '' : setCookie.split(';')[0];
    }
    return response;
  };
  fetchImpl.signOut = () => { cookie = ''; };
  return fetchImpl;
}

function perfFor(sha, version = '2.0.0') {
  return {
    getEntriesByType: () => [{ serverTiming: [{ name: 'saver', description: sha }, { name: 'saver-version', description: version }] }]
  };
}

function setup({ signedIn = true, sha, dialogs = {}, env = {} } = {}) {
  const github = new FakeGitHub({ files: { 'index.html': WIKI } });
  const workerEnv = { GITHUB_TOKEN: 'test-token', WIKI_PASSWORD: PASSWORD, GITHUB_REPO: 'owner/wiki', ...env };
  const fetchImpl = workerFetch(github, workerEnv);
  const wiki = new $tw.Wiki();
  const handler = fakeSaverHandler(wiki);
  const events = [];
  const client = new core.Client({
    fetchImpl,
    perf: perfFor(sha === undefined ? github.files.get('index.html').sha : sha),
    retryDelays: [1, 1]
  });
  const controller = new core.Controller({
    wiki,
    client,
    dialogs: {
      askPassword: async () => false,
      choose: async () => 'cancel',
      ...dialogs
    },
    saverHandler: handler,
    rootWidget: { dispatchEvent: event => events.push(event.type) },
    notifier: { display: () => {} }
  });
  controller.initStatus();
  const ready = signedIn ? client.login(PASSWORD) : Promise.resolve();
  return { github, wiki, handler, client, controller, events, fetchImpl, ready };
}

function saveAndWait(controller, text, method = 'save') {
  return new Promise((resolve, reject) => {
    const handled = controller.save(text, method, err => (err ? reject(new Error(err)) : resolve()));
    if (!handled) {
      reject(new Error('save not handled'));
    }
  });
}

async function settle(controller) {
  while (controller.inFlight) {
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

const status = (wiki, field) => (wiki.getTiddler(core.STATUS) || { fields: {} }).fields[field];

describe('helpers', () => {
  test('gitBlobSha matches git', async () => {
    const text = 'hello é\u{1F600}';
    const bytes = new TextEncoder().encode(text);
    assert.equal(await core.gitBlobSha(bytes), referenceBlobSha(Buffer.from(text)));
  });

  test('readServerTiming', () => {
    assert.deepEqual(core.readServerTiming(perfFor('abc', '9.9.9')), { sha: 'abc', version: '9.9.9' });
    assert.deepEqual(core.readServerTiming({ getEntriesByType: () => [{}] }), { sha: '', version: '' });
    assert.deepEqual(core.readServerTiming(null), { sha: '', version: '' });
  });

  test('compareVersions', () => {
    assert.equal(core.compareVersions('2.0.1', '2.0.0'), 1);
    assert.equal(core.compareVersions('2.0.0', '2.0.0'), 0);
    assert.equal(core.compareVersions('1.9', '2.0.0'), -1);
    assert.equal(core.compareVersions('10.0.0', '9.0.0'), 1);
  });
});

describe('client', () => {
  test('saves with the parent SHA from Server-Timing and tracks the new one', async () => {
    const { github, client, ready } = setup();
    await ready;
    const result = await client.save('<html>v2</html>');
    assert.equal(github.getFile('index.html'), '<html>v2</html>');
    assert.equal(client.sha, result.sha);
    await client.save('<html>v3</html>', { reason: 'autosave' });
    assert.equal(github.getFile('index.html'), '<html>v3</html>');
    assert.equal(github.commits.at(-1).message, 'Update wiki (autosave)');
  });

  test('a change made elsewhere is reported as a conflict', async () => {
    const { github, client, ready } = setup();
    await ready;
    const remote = github.setFile('index.html', '<html>other device</html>');
    await assert.rejects(client.save('<html>mine</html>'), error => {
      assert.equal(error.code, 'conflict');
      assert.equal(error.details.remoteSha, remote);
      return true;
    });
    assert.equal(github.getFile('index.html'), '<html>other device</html>');
  });

  test('a save whose response was lost is recognised on retry', async () => {
    const { github, client, ready } = setup();
    await ready;
    const parent = client.sha;
    await client.save('<html>landed</html>');
    client.sha = parent; // pretend we never saw the response
    const result = await client.save('<html>landed</html>');
    assert.equal(result.recovered, true);
    assert.equal(github.commits.length, 1);
  });

  test('overwrite replaces a newer remote version', async () => {
    const { github, client, ready } = setup();
    await ready;
    github.setFile('index.html', '<html>other device</html>');
    await client.save('<html>mine</html>', { overwrite: true });
    assert.equal(github.getFile('index.html'), '<html>mine</html>');
  });

  test('retries transient failures', async () => {
    const { github, client, ready } = setup();
    await ready;
    github.failNextRequest('PUT', 503, { message: 'Service unavailable' });
    await client.save('<html>after retry</html>');
    assert.equal(github.getFile('index.html'), '<html>after retry</html>');
  });

  test('without a known SHA it asks the Worker for one', async () => {
    const { github, client, ready } = setup({ sha: '' });
    await ready;
    assert.equal(client.detected, false);
    await client.save('<html>v2</html>');
    assert.equal(github.getFile('index.html'), '<html>v2</html>');
  });

  test('signed out saves fail with signed_out', async () => {
    const { client } = setup({ signedIn: false });
    await assert.rejects(client.save('<html>x</html>'), { code: 'signed_out' });
  });
});

describe('controller', () => {
  test('does nothing when the page was not served by the Worker', () => {
    const { controller } = setup({ sha: '' });
    assert.equal(controller.save('x', 'save', () => {}), false);
  });

  test('can be switched off', () => {
    const { controller, wiki } = setup();
    wiki.addTiddler({ title: '$:/config/cloudflare-saver/enabled', text: 'no' });
    assert.equal(controller.save('x', 'save', () => {}), false);
  });

  test('ignores methods it does not handle', () => {
    const { controller } = setup();
    assert.equal(controller.save('x', 'download', () => {}), false);
  });

  test('a successful save records status only in $:/temp, so the wiki stays clean', async () => {
    const { controller, wiki, handler, ready } = setup();
    await ready;
    await saveAndWait(controller, '<html>v2</html>');
    handler.numChanges = 0; // what TiddlyWiki does in the save callback
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(status(wiki, 'last-result'), 'success');
    assert.equal(status(wiki, 'saves'), '1');
    assert.equal(handler.numChanges, 0);
  });

  test('changes made during a save stay dirty afterwards', async () => {
    const { controller, wiki, handler, ready } = setup();
    await ready;
    const done = new Promise(resolve => {
      controller.save('<html>v2</html>', 'save', () => {
        handler.numChanges = 0; // TiddlyWiki clears the count here
        resolve();
      });
    });
    wiki.addTiddler({ title: 'Edited during save', text: 'x' });
    await done;
    await settle(controller);
    assert.equal(handler.numChanges, 1);
  });

  test('autosaves are throttled and re-requested later', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
      const { controller, events, ready } = setup();
      controller.lastAttemptAt = Date.now();
      const callback = mock.fn();
      assert.equal(controller.save('x', 'autosave', callback), true);
      assert.equal(callback.mock.callCount(), 0);
      mock.timers.tick(15000);
      assert.deepEqual(events, ['tm-auto-save-wiki']);
      await ready;
    } finally {
      mock.timers.reset();
    }
  });

  test('a manual save during a save runs afterwards with the newer text', async () => {
    const { controller, github, ready } = setup();
    await ready;
    const first = saveAndWait(controller, '<html>first</html>');
    const second = saveAndWait(controller, '<html>second</html>');
    await Promise.all([first, second]);
    await settle(controller);
    assert.equal(github.getFile('index.html'), '<html>second</html>');
    assert.equal(github.commits.length, 2);
  });

  test('autosave while signed out does not open a dialog', async () => {
    const askPassword = mock.fn(async () => false);
    const { controller, wiki } = setup({ signedIn: false, dialogs: { askPassword } });
    const callback = mock.fn();
    controller.save('<html>x</html>', 'autosave', callback);
    await settle(controller);
    assert.equal(askPassword.mock.callCount(), 0);
    assert.equal(callback.mock.callCount(), 0);
    assert.equal(status(wiki, 'signed-in'), 'no');
  });

  test('manual save while signed out asks for the password, then saves', async () => {
    const askPassword = mock.fn(async ({ submit }) => {
      assert.equal(await submit('wrong password!'), 'Wrong password.');
      assert.equal(await submit(PASSWORD), null);
      return true;
    });
    const { controller, github } = setup({ signedIn: false, dialogs: { askPassword } });
    await saveAndWait(controller, '<html>after sign-in</html>');
    assert.equal(askPassword.mock.callCount(), 1);
    assert.equal(github.getFile('index.html'), '<html>after sign-in</html>');
  });

  test('conflict: overwrite saves this version', async () => {
    const choose = mock.fn(async () => 'overwrite');
    const { controller, github, ready } = setup({ dialogs: { choose } });
    await ready;
    github.setFile('index.html', '<html>other device</html>');
    await saveAndWait(controller, '<html>mine</html>');
    assert.equal(choose.mock.callCount(), 1);
    assert.equal(github.getFile('index.html'), '<html>mine</html>');
  });

  test('conflict: cancel leaves the remote alone and the wiki dirty', async () => {
    const { controller, github, wiki, ready } = setup();
    await ready;
    github.setFile('index.html', '<html>other device</html>');
    const callback = mock.fn();
    controller.save('<html>mine</html>', 'save', callback);
    await settle(controller);
    assert.equal(callback.mock.callCount(), 0);
    assert.equal(status(wiki, 'last-result'), 'conflict');
    assert.equal(github.getFile('index.html'), '<html>other device</html>');
  });

  test('other failures on a manual save are reported through the callback', async () => {
    const { controller, github, ready } = setup();
    await ready;
    github.failNextRequest('PUT', 403);
    await assert.rejects(saveAndWait(controller, '<html>x</html>'), /not allowed to write/);
  });

  test('check() fills in diagnostics', async () => {
    const { controller, wiki, ready } = setup();
    await ready;
    await controller.check();
    assert.equal(status(wiki, 'check-state'), 'done');
    assert.equal(status(wiki, 'repo'), 'owner/wiki');
    assert.equal(status(wiki, 'github'), 'ok');
    assert.equal(status(wiki, 'up-to-date'), 'yes');
  });

  test('flags a plugin update when the Worker is newer', () => {
    const { controller, wiki } = setup();
    wiki.addTiddler({ title: '$:/plugins/BenSweaterVest/cloudflare-saver', version: '1.1.1', text: '{}' });
    controller.updatePluginVersionInfo();
    assert.equal(status(wiki, 'update-available'), 'yes');
  });
});

describe('startup', () => {
  test('removes version 1 settings and statistics', () => {
    const wiki = new $tw.Wiki();
    const v1 = ['endpoint', 'timeout', 'enabled', 'stats/successful-saves', 'stats/last-save-status'];
    for (const name of v1) {
      wiki.addTiddler({ title: `$:/config/cloudflare-saver/${name}`, text: 'x' });
    }
    wiki.addTiddler({ title: '$:/config/cloudflare-saver/autosave-interval', text: '30' });
    startup.removeVersionOneSettings(wiki);
    for (const name of v1) {
      assert.equal(wiki.tiddlerExists(`$:/config/cloudflare-saver/${name}`), false, name);
    }
    assert.equal(wiki.getTiddlerText('$:/config/cloudflare-saver/autosave-interval'), '30');
  });

  test('leaves a version 2 wiki alone', () => {
    const wiki = new $tw.Wiki();
    wiki.addTiddler({ title: '$:/config/cloudflare-saver/enabled', text: 'no' });
    startup.removeVersionOneSettings(wiki);
    assert.equal(wiki.getTiddlerText('$:/config/cloudflare-saver/enabled'), 'no');
  });
});
