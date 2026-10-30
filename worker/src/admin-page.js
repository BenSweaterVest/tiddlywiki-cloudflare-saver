/**
 * The Worker's own page at /_saver/. It handles sign-in (also used to view a
 * private wiki), shows diagnostics, and uploads or replaces the wiki file,
 * optionally installing the saver plugin into it on the way.
 */

import { escapeHtml } from './http.js';

const STYLE = `
:root { --bg: #f6f7f9; --card: #fff; --text: #1d2330; --muted: #5b6475; --border: #d8dce3;
  --accent: #2f6fde; --accent-text: #fff; --ok: #1f7a3d; --bad: #b42318; color-scheme: light dark; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #14161a; --card: #1d2026; --text: #e7e9ee; --muted: #a0a7b4; --border: #333844;
    --accent: #6c9bff; --accent-text: #0d1117; --ok: #5cc98a; --bad: #ff8a80; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 640px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 0 0 12px; }
p { margin: 0 0 12px; }
.sub { color: var(--muted); margin-bottom: 24px; }
section { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 16px; }
label { display: block; font-weight: 600; margin-bottom: 6px; }
input[type=password], input[type=file] { width: 100%; padding: 10px; border: 1px solid var(--border);
  border-radius: 6px; background: var(--bg); color: var(--text); font: inherit; }
.check { display: flex; gap: 8px; align-items: flex-start; font-weight: 400; margin: 12px 0; }
.check input { margin-top: 5px; }
button, .button { display: inline-block; padding: 10px 16px; border: 0; border-radius: 6px; background: var(--accent);
  color: var(--accent-text); font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; }
button.secondary { background: transparent; color: var(--accent); border: 1px solid var(--border); }
button:disabled { opacity: .6; cursor: progress; }
.row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.msg { margin-top: 12px; min-height: 1.5em; }
.msg.ok { color: var(--ok); } .msg.bad { color: var(--bad); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
dt { color: var(--muted); } dd { margin: 0; overflow-wrap: anywhere; }
a { color: var(--accent); }
[hidden] { display: none !important; }
`;

const SCRIPT = `
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const next = (p => p && p.startsWith('/') && !p.startsWith('//') ? p : null)(params.get('next'));
let status = null;

function say(id, text, kind) { const el = $(id); el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }

async function api(path, init = {}) {
  init.headers = Object.assign({ 'X-Saver-Request': '1' }, init.headers || {});
  const response = await fetch(path, init);
  let data = {};
  try { data = await response.json(); } catch (e) { /* empty body */ }
  if (!response.ok) { const err = new Error(data.message || ('HTTP ' + response.status)); err.code = data.error; throw err; }
  return data;
}

function row(dl, label, value) {
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd');
  if (value instanceof Node) { dd.appendChild(value); } else { dd.textContent = value; }
  dl.append(dt, dd);
}

function link(href, text) { const a = document.createElement('a'); a.href = href; a.textContent = text; a.target = '_blank'; a.rel = 'noopener'; return a; }

function render() {
  $('signed-out').hidden = status.signedIn;
  $('signed-in').hidden = !status.signedIn;
  if (!status.signedIn) { $('password').focus(); return; }
  const dl = $('details'); dl.textContent = '';
  const gh = status.github || {};
  row(dl, 'Saver version', status.version);
  row(dl, 'Repository', gh.htmlUrl ? link(gh.htmlUrl, status.repo) : status.repo);
  row(dl, 'Branch', status.branch || (gh.defaultBranch ? gh.defaultBranch + ' (default)' : 'default'));
  row(dl, 'Wiki file', status.wikiPath);
  row(dl, 'Wiki', status.wiki.exists ? (Math.round(status.wiki.size / 1024) + ' KB, blob ' + status.wiki.sha.slice(0, 7)) : 'not uploaded yet');
  row(dl, 'Viewing', status.readAccess === 'private' ? 'Private (sign-in required)' : 'Public (anyone with the link)');
  row(dl, 'GitHub access', gh.ok ? (gh.canPush === false ? 'Read only: token cannot push' : 'OK') : ('Problem: ' + (gh.message || gh.error)));
  row(dl, 'Token expires', gh.tokenExpires || 'Never or unknown');
  row(dl, 'Login protection', status.limiter === 'durable-object' ? 'Shared (Durable Object)' : 'Basic (in-memory only)');
  $('history').hidden = !gh.htmlUrl;
  if (gh.htmlUrl) { $('history').href = gh.htmlUrl + '/commits/' + encodeURIComponent(status.branch || gh.defaultBranch || 'HEAD') + '/' + status.wikiPath; }
  $('open-wiki').hidden = !status.wiki.exists;
  $('upload-title').textContent = status.wiki.exists ? 'Replace the wiki file' : 'Upload your wiki';
  if (next && status.wiki.exists) { location.replace(next); }
}

async function refresh() {
  status = await api('/_saver/api/status');
  render();
}

$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter || $('login-button');
  button.disabled = true; say('login-msg', 'Signing in...');
  try {
    await api('/_saver/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('password').value }) });
    $('password').value = '';
    say('login-msg', '');
    await refresh();
  } catch (err) {
    say('login-msg', err.message, 'bad');
  } finally { button.disabled = false; }
});

$('logout').addEventListener('click', async () => {
  await api('/_saver/api/logout', { method: 'POST' });
  await refresh();
});

function injectPlugin(text, plugin) {
  const marker = 'class="tiddlywiki-tiddler-store"';
  const start = text.lastIndexOf(marker);
  const end = start === -1 ? -1 : text.indexOf('<\\/script>', start);
  if (end === -1) {
    throw new Error('This file does not look like a TiddlyWiki 5.3 or later wiki (no tiddler store found). Encrypted wikis are not supported here; install the plugin from inside the wiki instead.');
  }
  const at = end + '<\\/script>'.length;
  const block = '\\n<script class="tiddlywiki-tiddler-store" type="application/json">[' +
    JSON.stringify(plugin).replace(/</g, '\\\\u003C') + ']<\\/script>';
  return text.slice(0, at) + block + text.slice(at);
}

function toBase64(text) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([text], { type: 'application/octet-stream' }));
  });
}

$('upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const file = $('file').files[0];
  if (!file) { say('upload-msg', 'Choose a file first.', 'bad'); return; }
  if (status.wiki.exists && !confirm('Replace the current wiki? The old version stays in the GitHub history.')) { return; }
  const button = $('upload-button');
  button.disabled = true;
  try {
    say('upload-msg', 'Reading file...');
    let text = await file.text();
    if (!/<html/i.test(text.slice(0, 2048))) { throw new Error('That file is not an HTML file.'); }
    if ($('install-plugin').checked) {
      const plugin = await api('/_saver/plugin.json');
      text = injectPlugin(text, plugin[0]);
    }
    say('upload-msg', 'Uploading...');
    const latest = await api('/_saver/api/status');
    const result = await api('/_saver/api/wiki', { method: 'PUT',
      headers: { 'Content-Type': 'text/plain', 'X-Wiki-Parent': latest.wiki.exists ? latest.wiki.sha : 'none', 'X-Save-Reason': 'setup' },
      body: await toBase64(text) });
    say('upload-msg', 'Uploaded. Commit ' + result.commit.slice(0, 7) + '.', 'ok');
    $('file').value = '';
    await refresh();
  } catch (err) {
    say('upload-msg', err.message, 'bad');
  } finally { button.disabled = false; }
});

refresh().catch(err => say('login-msg', 'Could not load status: ' + err.message, 'bad'));
`;

export function adminPage({ nonce, configProblems = null }) {
  const problems = configProblems
    ? `<section><h2>Setup needed</h2><p>The Worker is missing some settings. Add them in the Cloudflare dashboard under your Worker's <strong>Settings &gt; Variables and Secrets</strong>, then reload this page.</p><ul>${
      configProblems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></section>`
    : '';

  const content = configProblems ? '' : `
<section id="signed-out">
  <h2>Sign in</h2>
  <form id="login-form">
    <input type="text" name="username" autocomplete="username" value="wiki" hidden>
    <label for="password">Wiki password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <div class="row"><button id="login-button" type="submit">Sign in</button></div>
    <div id="login-msg" class="msg" role="status"></div>
  </form>
</section>
<div id="signed-in" hidden>
  <section>
    <h2>Status</h2>
    <dl id="details"></dl>
    <div class="row">
      <a id="open-wiki" class="button" href="/">Open wiki</a>
      <a id="history" class="button secondary" target="_blank" rel="noopener">Save history on GitHub</a>
      <button id="logout" class="secondary" type="button">Sign out</button>
    </div>
  </section>
  <section>
    <h2 id="upload-title">Upload your wiki</h2>
    <form id="upload-form">
      <p>Pick a TiddlyWiki HTML file (5.3 or later). Need one? Download <a href="https://tiddlywiki.com/empty.html" target="_blank" rel="noopener">empty.html</a> from tiddlywiki.com.</p>
      <label for="file">Wiki file</label>
      <input id="file" type="file" accept=".html,.htm,text/html">
      <label class="check"><input id="install-plugin" type="checkbox" checked>
        <span>Install or update the saver plugin in this file (recommended)</span></label>
      <div class="row"><button id="upload-button" type="submit">Upload</button></div>
      <div id="upload-msg" class="msg" role="status"></div>
    </form>
  </section>
</div>
<script nonce="${nonce}">${SCRIPT}</script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Wiki saver</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<main>
<h1>Wiki saver</h1>
<p class="sub">TiddlyWiki Cloudflare Saver</p>
${problems}${content}
</main>
</body>
</html>`;
}
