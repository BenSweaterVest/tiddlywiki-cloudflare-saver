import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { VERSION, PLUGIN_TIDDLER } from '../worker/src/generated/plugin.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const tiddlers = JSON.parse(PLUGIN_TIDDLER.text).tiddlers;

test('the bundled plugin is up to date with plugin/', () => {
  execFileSync(process.execPath, ['scripts/build.js', '--check'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

test('version comes from package.json', () => {
  assert.equal(VERSION, pkg.version);
  assert.equal(PLUGIN_TIDDLER.version, pkg.version);
});

test('plugin tiddler has the fields TiddlyWiki needs', () => {
  assert.equal(PLUGIN_TIDDLER.title, '$:/plugins/BenSweaterVest/cloudflare-saver');
  assert.equal(PLUGIN_TIDDLER.type, 'application/json');
  assert.equal(PLUGIN_TIDDLER['plugin-type'], 'plugin');
  assert.match(PLUGIN_TIDDLER['core-version'], /^>=5\.3/);
});

test('every JavaScript tiddler declares a module type', () => {
  const modules = Object.values(tiddlers).filter(t => t.type === 'application/javascript');
  assert.ok(modules.length >= 4);
  for (const tiddler of modules) {
    assert.ok(tiddler['module-type'], tiddler.title);
  }
});

test('config defaults are exact values with no trailing newline', () => {
  assert.equal(tiddlers['$:/config/cloudflare-saver/enabled'].text, 'yes');
  assert.equal(tiddlers['$:/config/cloudflare-saver/debug'].text, 'no');
  assert.equal(tiddlers['$:/config/cloudflare-saver/autosave-interval'].text, '15');
});

test('settings appear in the Saving tab of the Control Panel', () => {
  assert.equal(tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'].tags, '$:/tags/ControlPanel/Saving');
});

test('the plugin never stores state in tiddlers that get saved', () => {
  const source = Object.values(tiddlers).map(t => t.text).join('\n');
  assert.doesNotMatch(source, /\$:\/config\/cloudflare-saver\/stats/);
});
