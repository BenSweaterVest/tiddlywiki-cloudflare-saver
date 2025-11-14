/**
 * Tests for the build script
 */

const fs = require('fs');
const path = require('path');

describe('Build Script', () => {
  const distDir = path.join(__dirname, '..', 'dist');
  const jsonPluginPath = path.join(distDir, 'cloudflare-saver-plugin.json');
  const tidPluginPath = path.join(distDir, 'cloudflare-saver-plugin.tid');

  test('dist directory exists', () => {
    expect(fs.existsSync(distDir)).toBe(true);
  });

  test('JSON plugin file exists', () => {
    expect(fs.existsSync(jsonPluginPath)).toBe(true);
  });

  test('TID plugin file exists', () => {
    expect(fs.existsSync(tidPluginPath)).toBe(true);
  });

  test('JSON plugin has valid structure', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);

    expect(plugin).toHaveProperty('tiddlers');
    expect(typeof plugin.tiddlers).toBe('object');
    expect(Object.keys(plugin.tiddlers).length).toBeGreaterThan(0);
  });

  test('JSON plugin contains required tiddlers', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);

    const requiredTiddlers = [
      '$:/plugins/BenSweaterVest/cloudflare-saver/plugin.info',
      '$:/plugins/BenSweaterVest/cloudflare-saver/saver.js',
      '$:/plugins/BenSweaterVest/cloudflare-saver/startup.js'
    ];

    requiredTiddlers.forEach(tiddler => {
      expect(tiddler in plugin.tiddlers).toBe(true);
    });
  });

  test('plugin.info has correct metadata', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);
    const pluginInfo = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/plugin.info'];

    expect(pluginInfo).toBeDefined();
    const info = JSON.parse(pluginInfo.text);

    expect(info).toHaveProperty('title');
    expect(info).toHaveProperty('description');
    expect(info).toHaveProperty('author');
    expect(info).toHaveProperty('version');
    expect(info).toHaveProperty('plugin-type');
    expect(info['plugin-type']).toBe('plugin');
  });

  test('saver.js is included and has content', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);
    const saver = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/saver.js'];

    expect(saver).toBeDefined();
    expect(saver.text).toBeDefined();
    expect(saver.text.length).toBeGreaterThan(0);
    expect(saver.type).toBe('application/javascript');
    expect(saver['module-type']).toBe('saver');
  });

  test('startup.js is included and has content', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);
    const startup = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/startup.js'];

    expect(startup).toBeDefined();
    expect(startup.text).toBeDefined();
    expect(startup.text.length).toBeGreaterThan(0);
    expect(startup.type).toBe('application/javascript');
    expect(startup['module-type']).toBe('startup');
  });

  test('TID plugin has valid format', () => {
    const content = fs.readFileSync(tidPluginPath, 'utf8');

    // TID files should start with metadata headers
    expect(content).toMatch(/^title:/m);
    expect(content).toMatch(/^type:/m);

    // Should contain the plugin JSON
    expect(content).toContain('"tiddlers"');
  });

  test('notification tiddlers are included', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);

    const notificationTiddlers = [
      '$:/plugins/BenSweaterVest/cloudflare-saver/notifications/saving',
      '$:/plugins/BenSweaterVest/cloudflare-saver/notifications/success',
      '$:/plugins/BenSweaterVest/cloudflare-saver/notifications/failure'
    ];

    notificationTiddlers.forEach(tiddler => {
      expect(plugin.tiddlers).toHaveProperty(tiddler);
    });
  });

  test('settings is included', () => {
    const content = fs.readFileSync(jsonPluginPath, 'utf8');
    const plugin = JSON.parse(content);
    const settings = plugin.tiddlers['$:/plugins/BenSweaterVest/cloudflare-saver/settings'];

    expect(settings).toBeDefined();
    expect(settings.text).toBeDefined();
    expect(settings.text).toContain('CloudFlare Saver');
  });
});
