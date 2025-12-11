#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function validate() {
  console.log('🔍 Validating plugin...');
    
  const pluginPath = path.join(__dirname, '..', 'dist', 'cloudflare-saver-plugin.json');

  try {
    if (!fs.existsSync(pluginPath)) {
      throw new Error('Plugin file not found. Run `npm run build` first.');
    }

    const pluginContent = fs.readFileSync(pluginPath, 'utf8');
    const plugin = JSON.parse(pluginContent);

    if (!plugin.tiddlers) {
      throw new Error('Missing tiddlers object');
    }

    const tiddlerTitles = Object.keys(plugin.tiddlers);
    console.log(`Found ${tiddlerTitles.length} tiddlers`);

    // Check for required tiddlers
    const requiredTiddlers = ['plugin.info', 'saver', 'startup'];
    const missing = requiredTiddlers.filter(required => 
      !tiddlerTitles.some(title => title.includes(required))
    );

    if (missing.length > 0) {
      throw new Error(`Missing required tiddlers: ${missing.join(', ')}`);
    }

    // Validate plugin info
    const pluginInfoTiddler = tiddlerTitles.find(title => title.includes('plugin.info'));
    if (pluginInfoTiddler) {
      const pluginInfo = JSON.parse(plugin.tiddlers[pluginInfoTiddler].text);
            
      const required = ['title', 'version', 'author', 'description'];
      const missingFields = required.filter(field => !pluginInfo[field]);
            
      if (missingFields.length > 0) {
        throw new Error(`Missing plugin.info fields: ${missingFields.join(', ')}`);
      }

      console.log('✅ Validation passed!');
      console.log(`   Plugin: ${pluginInfo.title}`);
      console.log(`   Version: ${pluginInfo.version}`);
      console.log(`   Author: ${pluginInfo.author}`);
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validate();

