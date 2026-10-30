/*\
title: $:/plugins/BenSweaterVest/cloudflare-saver/core.js
type: application/javascript
module-type: library

Talks to the Cloudflare Saver Worker and coordinates saves.

The Worker that serves this wiki announces itself, and the blob SHA of the
file it served, in a Server-Timing header. Saves send that SHA as the parent
so GitHub rejects the commit if the file changed elsewhere in the meantime.

\*/

'use strict';

const STATUS = '$:/temp/cloudflare-saver/status';
const CONFIG = '$:/config/cloudflare-saver/';
const PLUGIN_TITLE = '$:/plugins/BenSweaterVest/cloudflare-saver';
const API = '/_saver/api';
const TRANSIENT = new Set(['network', 'github_unreachable', 'github_unavailable', 'github_rate_limited', 'http_500', 'http_502', 'http_503', 'http_504']);
const RETRY_DELAYS = [2000, 5000];

class SaverError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details || {};
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Read the Worker's Server-Timing entries from the navigation that loaded
 * this page. Returns {} when the page was not served by the Worker.
 */
function readServerTiming(perf) {
  try {
    const nav = perf && perf.getEntriesByType && perf.getEntriesByType('navigation')[0];
    const entries = (nav && nav.serverTiming) || [];
    const find = name => {
      const entry = entries.find(e => e.name === name);
      return entry ? entry.description : '';
    };
    return { sha: find('saver'), version: find('saver-version') };
  } catch (_e) {
    return {};
  }
}

function bytesToBase64(bytes) {
  if (typeof FileReader === 'function') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(new Blob([bytes], { type: 'application/octet-stream' }));
    });
  }
  // Non-browser environments (tests).
  return Promise.resolve(Buffer.from(bytes).toString('base64'));
}

/**
 * Git blob SHA-1: sha1("blob <length>\0" + content). Lets us recognise our
 * own commit when a save succeeded but its response was lost.
 */
async function gitBlobSha(bytes) {
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const data = new Uint8Array(header.length + bytes.length);
  data.set(header, 0);
  data.set(bytes, header.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', data));
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}

function compareVersions(a, b) {
  const pa = String(a || '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const pb = String(b || '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) {
      return d > 0 ? 1 : -1;
    }
  }
  return 0;
}

/**
 * HTTP client for the Worker's API. Stateless apart from the known blob SHA.
 */
class Client {
  constructor({ fetchImpl, perf, log, retryDelays } = {}) {
    this.fetch = fetchImpl || ((...args) => fetch(...args));
    this.log = log || (() => {});
    this.retryDelays = retryDelays || RETRY_DELAYS;
    const timing = readServerTiming(perf);
    this.sha = timing.sha || null;
    this.serverVersion = timing.version || null;
    this.detected = Boolean(timing.sha);
  }

  async request(path, init = {}) {
    init.headers = Object.assign({ 'X-Saver-Request': '1' }, init.headers || {});
    init.credentials = 'same-origin';
    let response;
    try {
      response = await this.fetch(`${API}${path}`, init);
    } catch (error) {
      throw new SaverError('network', `Could not reach the saver: ${error.message}`);
    }
    let data = {};
    try {
      data = await response.json();
    } catch (_e) {
      // Not JSON.
    }
    if (!response.ok) {
      throw new SaverError(data.error || `http_${response.status}`, data.message || `HTTP ${response.status}`, data);
    }
    return data;
  }

  status() {
    return this.request('/status');
  }

  login(password) {
    return this.request('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
  }

  logout() {
    return this.request('/logout', { method: 'POST' });
  }

  async currentRemoteSha() {
    const status = await this.status();
    if (!status.signedIn) {
      throw new SaverError('signed_out', 'Sign in to save.');
    }
    return status.wiki && status.wiki.exists ? status.wiki.sha : null;
  }

  /**
   * Save the wiki text.
   * @param {string} text - full HTML
   * @param {object} options - { reason: 'save'|'autosave'|'plugin-update', overwrite: boolean }
   * @returns {Promise<{sha, commit, commitUrl, recovered?}>}
   */
  async save(text, { reason = 'save', overwrite = false } = {}) {
    let parent = this.sha;
    if (overwrite || !parent) {
      if (!parent) {
        this.log('No known parent SHA; asking the Worker for the current one. Conflict detection is off for this save.');
      }
      parent = await this.currentRemoteSha();
    }

    const bytes = new TextEncoder().encode(text);
    const [body, blobSha] = await Promise.all([bytesToBase64(bytes), gitBlobSha(bytes)]);

    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.request('/wiki', {
          method: 'PUT',
          headers: {
            'Content-Type': 'text/plain',
            'X-Wiki-Parent': parent || 'none',
            'X-Save-Reason': reason
          },
          body
        });
        this.sha = result.sha;
        return result;
      } catch (error) {
        if (error.code === 'conflict') {
          // If an earlier attempt actually landed, the remote file is ours.
          const remote = await this.currentRemoteSha().catch(() => null);
          if (remote && remote === blobSha) {
            this.sha = remote;
            return { sha: remote, commit: null, commitUrl: null, recovered: true };
          }
          throw new SaverError('conflict', error.message, { remoteSha: remote });
        }
        if (TRANSIENT.has(error.code) && attempt < this.retryDelays.length) {
          this.log(`Save failed (${error.code}), retrying in ${this.retryDelays[attempt] / 1000}s`);
          await sleep(this.retryDelays[attempt]);
          continue;
        }
        throw error;
      }
    }
  }

  async fetchPlugin() {
    const response = await this.fetch('/_saver/plugin.json', { credentials: 'same-origin' });
    if (!response.ok) {
      throw new SaverError(`http_${response.status}`, `Could not download the plugin (HTTP ${response.status})`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || !data[0] || data[0].title !== PLUGIN_TITLE) {
      throw new SaverError('bad_plugin', 'The Worker returned an unexpected plugin file.');
    }
    return data[0];
  }
}

/**
 * Coordinates saves for one wiki: serialises them, throttles autosaves,
 * handles sign-in and conflicts, and keeps the status tiddler up to date.
 */
class Controller {
  /**
   * saverHandler, rootWidget and notifier may be given as functions: the
   * saver is created while TiddlyWiki is still constructing its saver
   * handler, so they are looked up when first needed.
   */
  constructor({ wiki, client, dialogs, saverHandler, rootWidget, notifier, now }) {
    const lazy = value => (typeof value === 'function' ? value : () => value || null);
    this.wiki = wiki;
    this.client = client;
    this.dialogs = dialogs;
    this.getSaverHandler = lazy(saverHandler);
    this.getRootWidget = lazy(rootWidget);
    this.getNotifier = lazy(notifier);
    this.now = now || (() => Date.now());
    this.inFlight = false;
    this.pending = null;
    this.lastAttemptAt = 0;
    this.autosaveTimer = null;
    this.nextReason = null;
  }

  config(name, fallback) {
    return this.wiki.getTiddlerText(CONFIG + name, fallback).trim();
  }

  isEnabled() {
    return this.config('enabled', 'yes') !== 'no';
  }

  isActive() {
    return this.client.detected && this.isEnabled();
  }

  autosaveInterval() {
    const seconds = parseFloat(this.config('autosave-interval', '15'));
    return (Number.isFinite(seconds) && seconds >= 0 ? seconds : 15) * 1000;
  }

  debug(...args) {
    if (this.config('debug', 'no') === 'yes') {
      console.log('[CloudflareSaver]', ...args);
    }
  }

  setStatus(fields) {
    const existing = this.wiki.getTiddler(STATUS);
    this.wiki.addTiddler(new $tw.Tiddler(existing, { title: STATUS }, fields));
  }

  getStatus(field) {
    const tiddler = this.wiki.getTiddler(STATUS);
    return tiddler ? tiddler.fields[field] : undefined;
  }

  notify(text) {
    this.setStatus({ notice: text });
    const notifier = this.getNotifier();
    if (notifier) {
      notifier.display('$:/plugins/BenSweaterVest/cloudflare-saver/notice');
    }
  }

  initStatus() {
    this.setStatus({
      'detected': this.client.detected ? 'yes' : 'no',
      'server-version': this.client.serverVersion || '',
      'sha': this.client.sha || '',
      'state': 'idle',
      'signed-in': this.getStatus('signed-in') || 'unknown',
      'saves': this.getStatus('saves') || '0',
      'failures': this.getStatus('failures') || '0'
    });
    this.updatePluginVersionInfo();
  }

  updatePluginVersionInfo() {
    const plugin = this.wiki.getTiddler(PLUGIN_TITLE);
    const installed = plugin ? plugin.fields.version : '';
    const available = this.client.serverVersion || '';
    this.setStatus({
      'plugin-version': installed || '',
      'update-available': available && installed && compareVersions(available, installed) > 0 ? 'yes' : 'no'
    });
  }

  /**
   * Entry point from the TiddlyWiki saver module.
   * @returns {boolean} true if this saver handled the request
   */
  save(text, method, callback) {
    if (!this.isActive() || (method !== 'save' && method !== 'autosave')) {
      return false;
    }
    const snapshot = this.snapshotChanges();

    if (method === 'autosave') {
      const wait = this.lastAttemptAt + this.autosaveInterval() - this.now();
      if (this.inFlight || wait > 0) {
        this.scheduleAutosave(Math.max(wait, 1000));
        return true;
      }
    } else if (this.inFlight) {
      // A manual save while one is running: run it (with the newest text) next.
      this.pending = { text, method, callback, snapshot };
      return true;
    }

    this.run(text, method, callback, snapshot);
    return true;
  }

  scheduleAutosave(delay) {
    if (this.autosaveTimer) {
      return;
    }
    this.debug(`Autosave deferred for ${Math.round(delay / 1000)}s`);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      const root = this.getRootWidget();
      if (root) {
        root.dispatchEvent({ type: 'tm-auto-save-wiki' });
      }
    }, delay);
  }

  /**
   * Record TiddlyWiki's per-tiddler change counters at the moment the wiki
   * text was rendered for saving.
   */
  snapshotChanges() {
    return Object.assign({}, this.wiki.changeCount || {});
  }

  /**
   * TiddlyWiki marks the whole wiki clean when a save succeeds, forgetting
   * edits made while the save was uploading. Put those back.
   */
  restoreDirty(snapshot) {
    const handler = this.getSaverHandler();
    const counts = this.wiki.changeCount || {};
    if (!handler || typeof handler.filterFn !== 'function') {
      return;
    }
    const changed = Object.keys(counts).filter(title => counts[title] > (snapshot[title] || 0));
    if (changed.length === 0) {
      return;
    }
    const relevant = handler.filterFn.call(this.wiki, iterator => {
      changed.forEach(title => iterator(this.wiki.getTiddler(title), title));
    });
    if (relevant.length > 0) {
      handler.numChanges += relevant.length;
      handler.updateDirtyStatus();
      this.debug(`${relevant.length} change(s) made during the save are still unsaved`);
    }
  }

  async run(text, method, callback, snapshot) {
    this.inFlight = true;
    this.lastAttemptAt = this.now();
    const reason = this.nextReason || method;
    this.nextReason = null;
    this.setStatus({ state: 'saving' });
    // Only mention slow saves; quick ones just get TiddlyWiki's "Saved wiki".
    const slowNotice = method === 'save' ? setTimeout(() => {
      const notifier = this.getNotifier();
      if (notifier) {
        notifier.display('$:/plugins/BenSweaterVest/cloudflare-saver/saving');
      }
    }, 1000) : null;

    try {
      await this.attempt(text, method, reason, callback, snapshot);
    } finally {
      clearTimeout(slowNotice);
      this.inFlight = false;
      this.setStatus({ state: 'idle' });
      if (this.pending) {
        const next = this.pending;
        this.pending = null;
        this.run(next.text, next.method, next.callback, next.snapshot);
      }
    }
  }

  async attempt(text, method, reason, callback, snapshot, overwrite = false) {
    try {
      const result = await this.client.save(text, { reason, overwrite });
      const savedAt = this.now();
      this.setStatus({
        'signed-in': 'yes',
        'sha': result.sha,
        'last-result': 'success',
        'last-time': new Date(savedAt).toLocaleString(),
        'last-message': result.recovered ? 'Saved (confirmed after a dropped connection)' : 'Saved',
        'last-commit': result.commit || '',
        'last-commit-url': result.commitUrl || '',
        'saves': String(parseInt(this.getStatus('saves') || '0', 10) + 1)
      });
      this.debug('Saved', result);
      callback(null);
      this.restoreDirty(snapshot);
    } catch (error) {
      await this.handleError(error, text, method, reason, callback, snapshot);
    }
  }

  recordFailure(result, message) {
    this.setStatus({
      'last-result': result,
      'last-time': new Date(this.now()).toLocaleString(),
      'last-message': message,
      'failures': String(parseInt(this.getStatus('failures') || '0', 10) + 1)
    });
  }

  async handleError(error, text, method, reason, callback, snapshot) {
    this.debug('Save failed', error.code, error.message);

    if (error.code === 'signed_out') {
      this.setStatus({ 'signed-in': 'no' });
      if (method === 'autosave') {
        // Never pop a dialog in the middle of typing; the wiki stays dirty.
        this.recordFailure('signed-out', 'Not signed in. Changes are not saved yet.');
        this.notify('Sign in to save your changes (Control Panel > Saving > Cloudflare Saver, or click the save button).');
        return;
      }
      if (await this.signIn('Sign in to save this wiki.')) {
        return this.attempt(text, method, reason, callback, snapshot);
      }
      this.recordFailure('signed-out', 'Save cancelled: not signed in.');
      return;
    }

    if (error.code === 'conflict') {
      this.recordFailure('conflict', 'The wiki was changed somewhere else.');
      const choice = await this.dialogs.choose({
        title: 'This wiki was changed somewhere else',
        message: 'Someone (maybe you, on another device or tab) saved a newer version of this wiki after this copy was loaded. ' +
          'Overwriting replaces that version with this one; the other version stays in the GitHub history. ' +
          'Or download a copy of this version, then reload to get the newer one.',
        buttons: [
          { id: 'overwrite', label: 'Overwrite with this version' },
          { id: 'download', label: 'Download a copy' },
          { id: 'cancel', label: 'Cancel', primary: true }
        ]
      });
      if (choice === 'overwrite') {
        return this.attempt(text, method, reason, callback, snapshot, true);
      }
      const root = this.getRootWidget();
      if (choice === 'download' && root) {
        root.dispatchEvent({ type: 'tm-download-file', param: '$:/core/save/all', paramObject: { filename: 'wiki-backup.html' } });
      }
      return;
    }

    const message = error.message || 'Unknown error';
    this.recordFailure('failure', message);
    if (method === 'autosave') {
      this.notify(`Autosave failed: ${message}`);
    } else {
      callback(`Cloudflare Saver: ${message}`);
    }
  }

  /**
   * Show the sign-in dialog until the user signs in or gives up.
   * @returns {Promise<boolean>} true when signed in
   */
  async signIn(message) {
    const ok = await this.dialogs.askPassword({
      title: 'Sign in',
      message: message || 'Enter the wiki password.',
      submit: async password => {
        try {
          await this.client.login(password);
          return null;
        } catch (error) {
          return error.message;
        }
      }
    });
    this.setStatus({ 'signed-in': ok ? 'yes' : this.getStatus('signed-in') || 'unknown' });
    return Boolean(ok);
  }

  async signOut() {
    try {
      await this.client.logout();
      this.setStatus({ 'signed-in': 'no' });
      this.notify('Signed out.');
    } catch (error) {
      this.notify(`Sign-out failed: ${error.message}`);
    }
  }

  /**
   * Refresh the diagnostics shown in the settings tab.
   */
  async check() {
    this.setStatus({ 'check-state': 'checking' });
    try {
      const status = await this.client.status();
      const gh = status.github || {};
      this.client.serverVersion = status.version || this.client.serverVersion;
      const remote = status.wiki && status.wiki.exists ? status.wiki.sha : '';
      this.setStatus({
        'check-state': 'done',
        'check-time': new Date(this.now()).toLocaleString(),
        'signed-in': status.signedIn ? 'yes' : 'no',
        'server-version': status.version || '',
        'repo': status.repo || '',
        'repo-url': gh.htmlUrl || '',
        'branch': status.branch || gh.defaultBranch || '',
        'wiki-path': status.wikiPath || '',
        'github': status.signedIn ? (gh.ok ? (gh.canPush === false ? 'read-only' : 'ok') : `error: ${gh.message || gh.error}`) : '',
        'token-expires': gh.tokenExpires || '',
        'remote-sha': remote,
        'up-to-date': !status.signedIn || !remote ? '' : (remote === this.client.sha ? 'yes' : 'no')
      });
      this.updatePluginVersionInfo();
    } catch (error) {
      this.setStatus({ 'check-state': 'failed', 'check-error': error.message });
    }
  }

  async updatePlugin() {
    try {
      const plugin = await this.client.fetchPlugin();
      this.wiki.addTiddler(new $tw.Tiddler(plugin));
      this.nextReason = 'plugin-update';
      this.notify(`Plugin v${plugin.version} installed. Saving, then the page will reload.`);
      const handler = this.getSaverHandler();
      if (handler) {
        handler.saveWiki({ method: 'save', callback: () => window.location.reload() });
      }
    } catch (error) {
      this.notify(`Plugin update failed: ${error.message}`);
    }
  }
}

let instance = null;

/**
 * The shared controller for this page, created on first use.
 */
function get() {
  if (!instance) {
    const dialogs = require('$:/plugins/BenSweaterVest/cloudflare-saver/dialogs.js');
    let controller = null;
    const client = new Client({
      perf: typeof performance !== 'undefined' ? performance : null,
      log: (...args) => controller && controller.debug(...args)
    });
    controller = new Controller({
      wiki: $tw.wiki,
      client,
      dialogs,
      saverHandler: () => $tw.saverHandler,
      rootWidget: () => $tw.rootWidget,
      notifier: () => $tw.notifier
    });
    instance = controller;
  }
  return instance;
}

exports.get = get;
exports.Client = Client;
exports.Controller = Controller;
exports.SaverError = SaverError;
exports.readServerTiming = readServerTiming;
exports.gitBlobSha = gitBlobSha;
exports.compareVersions = compareVersions;
exports.STATUS = STATUS;
