/**
 * End-to-end test: the Worker running in workerd (via `wrangler dev`), a fake
 * GitHub API, and a real TiddlyWiki in headless Chromium.
 *
 * Needs: `npm install` in the repo root and in worker/, plus Playwright with
 * Chromium available. Run with `npm run test:e2e`.
 * Set E2E_SCREENSHOTS=<dir> to save screenshots of the pages and dialogs.
 */

import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

import { FakeGitHub } from '../helpers/fake-github.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 8799;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = 'e2e-password-123';
const SHOTS = process.env.E2E_SCREENSHOTS;

function log(message) {
  console.log(`[e2e] ${message}`);
}

function buildEmptyWiki(dir) {
  execFileSync(process.execPath, [
    require.resolve('tiddlywiki/tiddlywiki.js'),
    path.join(path.dirname(require.resolve('tiddlywiki/package.json')), 'editions', 'empty'),
    '--output', dir,
    '--render', '$:/core/save/all', 'empty.html', 'text/plain'
  ], { stdio: 'ignore' });
  return path.join(dir, 'empty.html');
}

function startWorker(githubUrl) {
  const vars = {
    GITHUB_TOKEN: 'test-token',
    WIKI_PASSWORD: PASSWORD,
    GITHUB_REPO: 'owner/wiki',
    GITHUB_API_URL: githubUrl
  };
  const args = ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--log-level', 'warn'];
  for (const [key, value] of Object.entries(vars)) {
    args.push('--var', `${key}:${value}`);
  }
  const child = spawn('npx', args, {
    cwd: path.join(ROOT, 'worker'),
    env: { ...process.env, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost', WRANGLER_SEND_METRICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so stopping it also stops wrangler's workerd child.
    detached: true
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  child.output = () => output;
  return child;
}

async function waitFor(check, what, timeout = 60000) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await check();
      if (value) {
        return value;
      }
    } catch (_e) {
      // keep waiting
    }
    if (Date.now() - start > timeout) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function shot(page, name) {
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
  }
}

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'saver-e2e-'));
  const emptyWiki = buildEmptyWiki(temp);
  log(`built empty wiki (${Math.round(fs.statSync(emptyWiki).size / 1024)} KB)`);

  const github = new FakeGitHub();
  const server = await github.listen();
  const worker = startWorker(server.url);
  const { chromium } = require('playwright');
  let browser;

  try {
    const portBusy = await fetch(`${BASE}/`).then(() => true, () => false);
    if (portBusy) {
      throw new Error(`Port ${PORT} is already in use. Stop the other server first.`);
    }
    await waitFor(async () => (await fetch(`${BASE}/_saver/api/status`)).ok, 'wrangler dev');
    log('worker is up');

    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    // 1. No wiki yet: the root redirects to the saver page.
    await page.goto(`${BASE}/`);
    assert.equal(new URL(page.url()).pathname, '/_saver/');
    await shot(page, '01-sign-in');

    // 2. Sign in and upload an empty wiki with the plugin installed.
    await page.fill('#password', 'wrong-password');
    await page.click('#login-button');
    await page.waitForSelector('#login-msg.bad');
    await page.fill('#password', PASSWORD);
    await page.click('#login-button');
    await page.waitForSelector('#signed-in', { state: 'visible' });
    await page.setInputFiles('#file', emptyWiki);
    await page.click('#upload-button');
    await page.waitForSelector('#upload-msg.ok', { timeout: 60000 });
    assert.equal(github.commits.length, 1);
    assert.equal(github.commits[0].message, 'Update wiki (setup)');
    await shot(page, '02-status');
    log('uploaded wiki through the setup page');

    // 3. Open the wiki: plugin present, saver detected, signed in.
    await page.goto(`${BASE}/`);
    await page.waitForFunction(() => window.$tw && $tw.wiki && $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status'));
    await page.waitForFunction(() => $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status').fields['signed-in'] === 'yes');
    const info = await page.evaluate(() => ({
      plugin: $tw.wiki.getTiddler('$:/plugins/BenSweaterVest/cloudflare-saver').fields.version,
      detected: $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status').fields.detected,
      dirty: document.body.classList.contains('tc-dirty')
    }));
    assert.equal(info.detected, 'yes');
    assert.ok(info.plugin);
    assert.equal(info.dirty, false, 'a freshly loaded wiki must not be dirty');
    log(`wiki loaded with plugin v${info.plugin}`);

    // 4. Save a change.
    await page.evaluate(() => {
      $tw.wiki.addTiddler({ title: 'E2E Note', text: 'hello from the e2e test' });
      $tw.rootWidget.dispatchEvent({ type: 'tm-save-wiki' });
    });
    await waitFor(() => github.commits.length === 2, 'first save');
    assert.match(github.getFile('index.html'), /hello from the e2e test/);
    await page.waitForFunction(() => !document.body.classList.contains('tc-dirty'));
    await new Promise(resolve => setTimeout(resolve, 500));
    assert.equal(await page.evaluate(() => document.body.classList.contains('tc-dirty')), false, 'wiki must be clean after saving');
    log('saved, and the wiki is clean afterwards');

    // 5. Conflict: someone else saved in the meantime.
    github.setFile('index.html', `${github.getFile('index.html')}<!-- edited elsewhere -->`);
    await page.evaluate(() => {
      $tw.wiki.addTiddler({ title: 'E2E Conflict', text: 'made while stale' });
      $tw.rootWidget.dispatchEvent({ type: 'tm-save-wiki' });
    });
    await page.waitForSelector('.cfs-dialog');
    await shot(page, '03-conflict');
    assert.equal(github.commits.length, 2, 'nothing is written before the user decides');
    await page.click('.cfs-dialog button:has-text("Overwrite")');
    await waitFor(() => github.commits.length === 3, 'overwrite');
    assert.match(github.getFile('index.html'), /made while stale/);
    log('conflict detected and resolved by overwriting');

    // 6. Sign out, then save: the password dialog appears.
    await page.evaluate(() => $tw.rootWidget.dispatchEvent({ type: 'tm-cloudflare-saver-signout' }));
    await page.waitForFunction(() => $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status').fields['signed-in'] === 'no');
    await page.evaluate(() => {
      $tw.wiki.addTiddler({ title: 'E2E After Sign-in', text: 'saved after signing in again' });
      $tw.rootWidget.dispatchEvent({ type: 'tm-save-wiki' });
    });
    await page.waitForSelector('.cfs-dialog input[type=password]');
    await page.fill('.cfs-dialog input[type=password]', 'not-the-password');
    await page.click('.cfs-dialog button[type=submit]');
    await page.waitForSelector('.cfs-dialog-error:has-text("Wrong password")');
    await shot(page, '04-sign-in-dialog');
    await page.fill('.cfs-dialog input[type=password]', PASSWORD);
    await page.click('.cfs-dialog button[type=submit]');
    await waitFor(() => github.commits.length === 4, 'save after sign-in');
    log('signed out, prompted, signed back in and saved');

    // 7. Settings tab and connection check.
    await page.evaluate(() => $tw.rootWidget.dispatchEvent({ type: 'tm-cloudflare-saver-check' }));
    await page.waitForFunction(() => $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status').fields['check-state'] === 'done');
    const settings = await page.evaluate(() => $tw.wiki.renderTiddler('text/plain', '$:/plugins/BenSweaterVest/cloudflare-saver/settings'));
    assert.match(settings, /owner\/wiki/);
    assert.match(settings, /Up to date/);
    await page.evaluate(() => {
      $tw.wiki.addTiddler({ title: '$:/StoryList', list: '$:/plugins/BenSweaterVest/cloudflare-saver/settings' });
    });
    await page.waitForSelector('.cfs-settings');
    await page.waitForTimeout(1500);
    await shot(page, '05-settings');
    log('settings tab renders diagnostics');

    // 8. Reload: everything saved is there, and the wiki is clean.
    await page.reload();
    await page.waitForFunction(() => window.$tw && $tw.wiki && $tw.wiki.getTiddler('$:/temp/cloudflare-saver/status'));
    const after = await page.evaluate(() => ['E2E Note', 'E2E Conflict', 'E2E After Sign-in'].map(t => $tw.wiki.tiddlerExists(t)));
    assert.deepEqual(after, [true, true, true]);
    assert.doesNotMatch(github.getFile('index.html'), /"title":"\$:\/temp\/cloudflare-saver/, 'status tiddlers must not be saved into the wiki');
    assert.equal(await page.evaluate(() => document.body.classList.contains('tc-dirty')), false, 'reloaded wiki must be clean');
    log('reloaded: all changes present, no status tiddlers leaked into the file');

    assert.deepEqual(pageErrors, [], 'no JavaScript errors on the page');
    log('PASS');
  } catch (error) {
    console.error(worker.output());
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
    try {
      process.kill(-worker.pid, 'SIGTERM');
    } catch (_e) {
      // already gone
    }
    await server.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
