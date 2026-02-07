/**
 * Integration tests for the complete plugin
 *
 * These tests verify the interaction between components
 */

const fs = require('fs');
const path = require('path');

describe('Plugin Integration', () => {
  let plugin;

  beforeAll(() => {
    const pluginPath = path.join(__dirname, '..', 'dist', 'cloudflare-saver-plugin.json');
    const content = fs.readFileSync(pluginPath, 'utf8');
    plugin = JSON.parse(content);
  });

  describe('Component Integration', () => {
    test('all required components are present', () => {
      const tiddlerKeys = Object.keys(plugin.tiddlers);

      const requiredComponents = [
        'plugin.info',
        'saver.js',
        'startup.js',
        'test-action.js',
        'health-check-action.js',
        'clear-password-action.js',
        'auto-detect-endpoint-action.js',
        'location-utils.js',
        'settings',
        'wizard',
        'readme'
      ];

      requiredComponents.forEach(component => {
        const fullPath = `$:/plugins/BenSweaterVest/cloudflare-saver/${component}`;
        expect(tiddlerKeys).toContain(fullPath);
      });
    });

    test('action widgets export correctly', () => {
      const testAction = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/test-action.js'];
      expect(testAction.text).toContain('exports[\'action-test-cloudflare\']');

      const healthAction = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/health-check-action.js'];
      expect(healthAction.text).toContain('exports[\'action-health-check-cloudflare\']');

      const clearAction = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/clear-password-action.js'];
      expect(clearAction.text).toContain('exports[\'action-clear-cloudflare-password\']');

      const autoDetectAction = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/auto-detect-endpoint-action.js'];
      expect(autoDetectAction.text).toContain('exports[\'action-auto-detect-cloudflare-endpoint\']');
    });

    test('settings references all action widgets', () => {
      const settings = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];

      expect(settings.text).toContain('action-test-cloudflare');
      expect(settings.text).toContain('action-health-check-cloudflare');
      expect(settings.text).toContain('action-clear-cloudflare-password');
      expect(settings.text).toContain('action-auto-detect-cloudflare-endpoint');
    });

    test('settings has correct control panel tag', () => {
      const settings = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];
      expect(settings.tags).toContain('$:/tags/ControlPanel/Saving');
      expect(settings.caption).toBe('Cloudflare Saver');
    });
  });

  describe('Configuration Defaults', () => {
    test('startup sets default configuration', () => {
      const startup = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/startup.js'];

      const expectedConfigs = [
        '$:/config/cloudflare-saver/endpoint',
        '$:/config/cloudflare-saver/timeout',
        '$:/config/cloudflare-saver/notifications',
        '$:/config/cloudflare-saver/auto-retry',
        '$:/config/cloudflare-saver/remember-password',
        '$:/config/cloudflare-saver/debug',
        '$:/config/cloudflare-saver/enabled'
      ];

      expectedConfigs.forEach(config => {
        expect(startup.text).toContain(config);
      });
    });

    test('default values are appropriate', () => {
      const startup = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/startup.js'];

      // Enabled should default to 'no' for security
      expect(startup.text).toMatch(/enabled.*'no'/);

      // Notifications should default to 'yes'
      expect(startup.text).toMatch(/notifications.*'yes'/);

      // Auto-retry should default to 'yes'
      expect(startup.text).toMatch(/auto-retry.*'yes'/);

      // Remember password should default to 'no' for security
      expect(startup.text).toMatch(/remember-password.*'no'/);

      // Debug should default to 'no'
      expect(startup.text).toMatch(/debug.*'no'/);
    });
  });

  describe('Saver Configuration', () => {
    test('saver has correct priority and capabilities', () => {
      const saver = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/saver.js'];

      // Priority should be 2000 (high)
      expect(saver.text).toContain('priority: 2000');

      // Should support save and autosave
      expect(saver.text).toContain('\'save\', \'autosave\'');
    });

    test('saver exports required functions', () => {
      const saver = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/saver.js'];

      expect(saver.text).toContain('exports.info');
      expect(saver.text).toContain('exports.canSave');
      expect(saver.text).toContain('exports.create');
    });
  });

  describe('Feature Integration', () => {
    test('wizard integrates with settings', () => {
      const wizard = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/wizard'];
      const settings = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];

      // Settings should link to wizard
      expect(settings.text).toContain('$:/plugins/BenSweaterVest/cloudflare-saver/wizard');

      // Wizard should set config values
      expect(wizard.text).toContain('$:/config/cloudflare-saver/enabled');
      expect(wizard.text).toContain('$:/config/cloudflare-saver/endpoint');
    });

    test('statistics tracking is integrated', () => {
      const saver = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/saver.js'];
      const settings = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];

      // Saver should track statistics
      expect(saver.text).toContain('successful-saves');
      expect(saver.text).toContain('failed-saves');
      expect(saver.text).toContain('last-save-status');
      expect(saver.text).toContain('_incrementStat');
      expect(saver.text).toContain('_updateLastSave');

      // Settings should display statistics
      expect(settings.text).toContain('Save Statistics');
      expect(settings.text).toContain('Successful Saves');
      expect(settings.text).toContain('Failed Saves');
    });
  });

  describe('Cloudflare Function Features', () => {
    test('health check endpoint exists', () => {
      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const functionCode = fs.readFileSync(functionPath, 'utf8');

      expect(functionCode).toContain('export async function onRequestGet');
      expect(functionCode).toContain('status: \'healthy\'');
      expect(functionCode).toContain('configuration');
    });

    test('input validation is implemented', () => {
      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const functionCode = fs.readFileSync(functionPath, 'utf8');

      expect(functionCode).toContain('function isValidISODate');
      expect(functionCode).toContain('Invalid timestamp format');
    });

    test('version matches package.json', () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const functionCode = fs.readFileSync(functionPath, 'utf8');

      const versionMatch = functionCode.match(/const VERSION = ['"](.+)['"]/);
      expect(versionMatch).toBeTruthy();
      expect(versionMatch[1]).toBe(packageJson.version);
    });
  });
});
