/**
 * Tests for plugin validation
 */

const fs = require('fs');
const path = require('path');

describe('Plugin Validation', () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const jsonPluginPath = path.join(distDir, 'cloudflare-saver-plugin.json');

  let plugin;

  beforeAll(() => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    plugin = JSON.parse(content);
  });

  describe('Plugin Structure', () => {
    test('has tiddlers object', () => {
      expect(plugin).toHaveProperty('tiddlers');
      expect(typeof plugin.tiddlers).toBe('object');
    });

    test('tiddlers object is not empty', () => {
      expect(Object.keys(plugin.tiddlers).length).toBeGreaterThan(0);
    });
  });

  describe('Required Tiddlers', () => {
    test('plugin.info exists', () => {
      expect('$:/plugins/BenSweaterVest/cloudflare-saver/plugin.info' in plugin.tiddlers).toBe(true);
    });

    test('saver.js exists', () => {
      expect('$:/plugins/BenSweaterVest/cloudflare-saver/saver.js' in plugin.tiddlers).toBe(true);
    });

    test('startup.js exists', () => {
      expect('$:/plugins/BenSweaterVest/cloudflare-saver/startup.js' in plugin.tiddlers).toBe(true);
    });
  });

  describe('Plugin Info Validation', () => {
    let pluginInfo;

    beforeAll(() => {
      const infoTiddler = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/plugin.info'];
      pluginInfo = JSON.parse(infoTiddler.text);
    });

    test('has required fields', () => {
      expect(pluginInfo).toHaveProperty('title');
      expect(pluginInfo).toHaveProperty('description');
      expect(pluginInfo).toHaveProperty('author');
      expect(pluginInfo).toHaveProperty('version');
      expect(pluginInfo).toHaveProperty('plugin-type');
    });

    test('plugin-type is "plugin"', () => {
      expect(pluginInfo['plugin-type']).toBe('plugin');
    });

    test('title starts with $:/plugins/', () => {
      expect(pluginInfo.title).toMatch(/^\$:\/plugins\//);
    });

    test('version follows semantic versioning', () => {
      expect(pluginInfo.version).toMatch(/^\d+\.\d+\.\d+/);
    });

    test('author is defined and not empty', () => {
      expect(pluginInfo.author).toBeDefined();
      expect(pluginInfo.author.length).toBeGreaterThan(0);
    });

    test('description is defined and not empty', () => {
      expect(pluginInfo.description).toBeDefined();
      expect(pluginInfo.description.length).toBeGreaterThan(0);
    });
  });

  describe('Saver Module Validation', () => {
    let saverTiddler;

    beforeAll(() => {
      saverTiddler = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/saver.js'];
    });

    test('has correct type', () => {
      expect(saverTiddler.type).toBe('application/javascript');
    });

    test('has correct module-type', () => {
      expect(saverTiddler['module-type']).toBe('saver');
    });

    test('contains required exports', () => {
      expect(saverTiddler.text).toContain('exports.info');
      expect(saverTiddler.text).toContain('exports.canSave');
      expect(saverTiddler.text).toContain('exports.create');
    });

    test('uses modern JavaScript (const/let)', () => {
      // Check that we're using modern const/let instead of var
      const constCount = (saverTiddler.text.match(/\bconst\b/g) || []).length;
      const letCount = (saverTiddler.text.match(/\blet\b/g) || []).length;
      const varCount = (saverTiddler.text.match(/\bvar\b/g) || []).length;

      // Should have more const/let than var (modern JavaScript)
      expect(constCount + letCount).toBeGreaterThan(varCount);
    });

    test('uses Fetch API instead of XMLHttpRequest', () => {
      expect(saverTiddler.text).toContain('fetch(');
      expect(saverTiddler.text).not.toContain('new XMLHttpRequest');
    });
  });

  describe('Startup Module Validation', () => {
    let startupTiddler;

    beforeAll(() => {
      startupTiddler = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/startup.js'];
    });

    test('has correct type', () => {
      expect(startupTiddler.type).toBe('application/javascript');
    });

    test('has correct module-type', () => {
      expect(startupTiddler['module-type']).toBe('startup');
    });

    test('contains startup function', () => {
      expect(startupTiddler.text).toContain('exports.startup');
    });

    test('sets configuration defaults', () => {
      expect(startupTiddler.text).toContain('$:/config/cloudflare-saver/endpoint');
      expect(startupTiddler.text).toContain('$:/config/cloudflare-saver/timeout');
      expect(startupTiddler.text).toContain('$:/config/cloudflare-saver/enabled');
    });
  });

  describe('Settings UI Validation', () => {
    let settingsTiddler;

    beforeAll(() => {
      settingsTiddler = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];
    });

    test('exists', () => {
      expect(settingsTiddler).toBeDefined();
    });

    test('has control panel tag', () => {
      expect(settingsTiddler.tags).toContain('$:/tags/ControlPanel/Saving');
    });

    test('uses single-line input for URL (not textarea)', () => {
      // Should use tc-edit-text class for single-line input
      expect(settingsTiddler.text).toContain('tc-edit-text');
      // Should use tag="input" for proper input rendering
      expect(settingsTiddler.text).toContain('tag="input"');
      // Should have type="url" for URL field
      expect(settingsTiddler.text).toContain('type="url"');
    });

    test('uses number input for timeout field', () => {
      expect(settingsTiddler.text).toContain('type="number"');
    });

    test('contains configuration options', () => {
      expect(settingsTiddler.text).toContain('endpoint');
      expect(settingsTiddler.text).toContain('notifications');
      expect(settingsTiddler.text).toContain('auto-retry');
      expect(settingsTiddler.text).toContain('remember-password');
      expect(settingsTiddler.text).toContain('debug');
    });
  });

  describe('Notification Tiddlers Validation', () => {
    test('saving notification exists', () => {
      const notification = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/notifications/saving'];
      expect(notification).toBeDefined();
      expect(notification.text).toBeDefined();
    });

    test('success notification exists', () => {
      const notification = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/notifications/success'];
      expect(notification).toBeDefined();
      expect(notification.text).toBeDefined();
    });

    test('failure notification exists', () => {
      const notification = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/notifications/failure'];
      expect(notification).toBeDefined();
      expect(notification.text).toBeDefined();
    });
  });
});
