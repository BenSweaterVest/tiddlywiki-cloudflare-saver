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
            { file: 'saver.js', type: 'application/javascript', 'module-type': 'saver' },
            { file: 'startup.js', type: 'application/javascript', 'module-type': 'startup' },
            { file: 'settings.tid', type: 'text/vnd.tiddlywiki', tags: '$:/tags/ControlPanel/SettingsTab', caption: 'Cloudflare Saver' },
            { file: 'readme.tid', type: 'text/vnd.tiddlywiki' }
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
        files.forEach(({ file, type, ...fields }) => {
            const filePath = path.join(srcDir, file);
            
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                const name = file.replace(/\.(js|tid)$/, '');
                const title = `$:/plugins/${namespace}/${name}`;
                
                tiddlers[title] = {
                    title,
                    type,
                    text: content,
                    ...fields
                };
                
                console.log(`✓ Added ${title}`);
            } else {
                console.warn(`⚠️  File not found: ${file}`);
            }
        });

        // Write plugin JSON
        const plugin = { tiddlers };
        const pluginJsonPath = path.join(distDir, 'cloudflare-saver-plugin.json');
        fs.writeFileSync(pluginJsonPath, JSON.stringify(plugin, null, 2));

        // Write plugin TID
        const tidLines = [];
        Object.entries(tiddlers).forEach(([title, tiddler]) => {
            const fields = [];
            Object.entries(tiddler).forEach(([key, value]) => {
                if (key !== 'text') {
                    fields.push(`${key}: ${value}`);
                }
            });
            tidLines.push(fields.join('\n') + '\n\n' + tiddler.text);
        });
        
        const pluginTidPath = path.join(distDir, 'cloudflare-saver-plugin.tid');
        fs.writeFileSync(pluginTidPath, tidLines.join('\n\n---\n\n'));

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

