#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function build() {
  console.log('🔨 Building TiddlyWiki Cloudflare Saver Plugin...');
    
  const srcDir = path.join(__dirname, '..', 'src');
  const distDir = path.join(__dirname, '..', 'dist');

  // Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  try {
    // Read plugin.info
    const pluginInfoPath = path.join(srcDir, 'plugin.info');
    const pluginInfoContent = fs.readFileSync(pluginInfoPath, 'utf8');
    const pluginInfo = JSON.parse(pluginInfoContent);
        
    console.log(`Building ${pluginInfo.title} v${pluginInfo.version}`);

    // Initialize tiddlers
    const tiddlers = {};
    const namespace = 'BenSweaterVest/cloudflare-saver';

    // Add plugin.info
    tiddlers[`$:/plugins/${namespace}/plugin.info`] = {
      title: `$:/plugins/${namespace}/plugin.info`,
      type: 'application/json',
      text: JSON.stringify(pluginInfo, null, 2)
    };

    // Source files to process
    const files = [
      { file: 'saver.js', type: 'application/javascript', 'module-type': 'saver', required: true },
      { file: 'startup.js', type: 'application/javascript', 'module-type': 'startup', required: true },
      { file: 'test-action.js', type: 'application/javascript', 'module-type': 'widget', required: true },
      { file: 'clear-password-action.js', type: 'application/javascript', 'module-type': 'widget', required: true },
      { file: 'settings.tid', type: 'text/vnd.tiddlywiki', required: true },
      { file: 'wizard.tid', type: 'text/vnd.tiddlywiki', required: true },
      { file: 'readme.tid', type: 'text/vnd.tiddlywiki', required: true }
    ];

    // Add notifications
    const notificationsDir = path.join(srcDir, 'notifications');
    if (fs.existsSync(notificationsDir)) {
      const notificationFiles = fs.readdirSync(notificationsDir);
      notificationFiles.forEach(file => {
        if (file.endsWith('.tid')) {
          files.push({
            file: `notifications/${file}`,
            type: 'text/vnd.tiddlywiki'
          });
        }
      });
    }

    // Process files
    const missingRequired = [];
    files.forEach(({ file, type, required, ...fields }) => {
      const filePath = path.join(srcDir, file);

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Preserve .js extension for JavaScript files, remove .tid for tiddler files
        const name = file.endsWith('.tid') ? file.replace(/\.tid$/, '') : file;
        const title = `$:/plugins/${namespace}/${name}`;

        const tiddlerFields = {
          title,
          type,
          ...fields
        };

        // Parse .tid file format (metadata headers separated from content by blank line)
        if (file.endsWith('.tid')) {
          // Find the first blank line (two consecutive newlines)
          const match = content.match(/^((?:.*\r?\n)*?)\r?\n([\s\S]*)$/);
          if (match && match[1]) {
            // Parse metadata headers
            const headers = match[1];
            const body = match[2] || '';

            headers.split(/\r?\n/).forEach(line => {
              const fieldMatch = line.match(/^([^:]+):\s*(.*)$/);
              if (fieldMatch) {
                const fieldName = fieldMatch[1].trim();
                const fieldValue = fieldMatch[2].trim();
                // Don't override type if already set
                if (fieldName !== 'type' || !tiddlerFields.type) {
                  tiddlerFields[fieldName] = fieldValue;
                }
              }
            });

            tiddlerFields.text = body;
          } else {
            tiddlerFields.text = content;
          }
        } else {
          tiddlerFields.text = content;
        }

        tiddlers[title] = tiddlerFields;

        console.log(`✓ Added ${title}`);
      } else {
        if (required) {
          missingRequired.push(file);
        }
        console.warn(`⚠️  File not found: ${file}`);
      }
    });

    // Fail build if required files are missing
    if (missingRequired.length > 0) {
      throw new Error(`Required files missing: ${missingRequired.join(', ')}`);
    }

    // Write plugin JSON
    const plugin = { tiddlers };
    const pluginJsonPath = path.join(distDir, 'cloudflare-saver-plugin.json');
    fs.writeFileSync(pluginJsonPath, JSON.stringify(plugin, null, 2));

    // Write plugin TID - proper TiddlyWiki plugin format
    // This creates a single tiddler with metadata fields and JSON content
    const tidFields = [
      `author: ${pluginInfo.author}`,
      `core-version: ${pluginInfo['core-version']}`,
      `description: ${pluginInfo.description}`,
      `list: ${pluginInfo.list}`,
      'name: Cloudflare Saver',
      `plugin-type: ${pluginInfo['plugin-type']}`,
      `source: ${pluginInfo.source}`,
      `title: ${pluginInfo.title}`,
      'type: application/json',
      `version: ${pluginInfo.version}`
    ];

    const pluginTidContent = `${tidFields.join('\n')  }\n\n${  JSON.stringify(plugin, null, 2)}`;
    const pluginTidPath = path.join(distDir, 'cloudflare-saver-plugin.tid');
    fs.writeFileSync(pluginTidPath, pluginTidContent);

    console.log('✅ Build complete!');
    console.log(`   JSON: ${pluginJsonPath}`);
    console.log(`   TID: ${pluginTidPath}`);
    console.log(`   Tiddlers: ${Object.keys(tiddlers).length}`);

  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();

