
# TiddlyWiki Cloudflare Saver Plugin

## Overview

This plugin adds Cloudflare Functions as an **additional save option** for TiddlyWiki, working alongside your existing save methods (download, GitHub, etc.). Save your TiddlyWiki directly to a GitHub repository via Cloudflare Functions with secure password authentication.

## Key Features

* 🔐 **Secure**: Password-protected saves with environment variable storage
* ⚡ **Fast**: Serverless architecture via Cloudflare Functions  
* 🔄 **Reliable**: Built-in retry logic and comprehensive error handling
* 📱 **User-Friendly**: Visual notifications and comprehensive setup guide
* 🛠️ **Configurable**: Extensive settings panel with debug mode
* 🤝 **Compatible**: Works alongside existing TiddlyWiki save methods

## How It Works

1. **Additional Saver**: Adds to your existing save options rather than replacing them
2. **User Choice**: Enable/disable via settings panel as needed
3. **Seamless Integration**: Uses standard TiddlyWiki save button with password prompt
4. **Cloudflare Functions**: Serverless backend handles GitHub API calls securely

## Setup Requirements

You'll need to set up these components (detailed guide included in the plugin):

1. **Cloudflare Pages** site hosting your TiddlyWiki
2. **GitHub Repository** with Personal Access Token
3. **Cloudflare Function** deployed at `/functions/save`
4. **Environment Variables** configured in Cloudflare Pages

## Installation

### Method 1: Download Plugin File
1. Download the plugin JSON from the [releases page](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/releases)
2. Open TiddlyWiki → Control Panel → Plugins → Import
3. Drag and drop the JSON file
4. Click "Import" and save/reload your TiddlyWiki

### Method 2: Manual Installation
Follow the detailed manual installation guide in `manual-plugin-installation.md`

## Configuration

After installation:

1. **Go to Settings**: Control Panel → Settings → Cloudflare Saver
2. **Follow Setup Guide**: Click "Complete Setup Instructions" for step-by-step guidance
3. **Enable the Saver**: Check "Enable Cloudflare Saver as an additional save option"
4. **Configure Endpoint**: Enter your Cloudflare Function URL
5. **Test Connection**: Use the test button to verify everything works

## Usage

Once configured:

1. **Multiple Options**: Your existing save methods continue to work normally
2. **Cloudflare Saving**: Click the standard save button, enter your password when prompted
3. **Status Notifications**: Visual feedback shows save progress and results
4. **Flexible Control**: Enable/disable the saver as needed via settings

## Environment Variables

Set these in Cloudflare Pages → Settings → Environment Variables → **Production**:

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `GITHUB_TOKEN` | **🔐 Encrypted** | `ghp_xxxxxxxxxxxx` | GitHub Personal Access Token with `repo` scope |
| `GITHUB_REPO` | **📝 Plaintext** | `username/my-tiddlywiki` | Your GitHub repository (username/repo-name) |
| `SAVE_PASSWORD` | **🔐 Encrypted** | `my-secure-password-123` | Password for authenticating saves |

### Important Security Notes:
- **🔐 Encrypted variables**: `GITHUB_TOKEN` and `SAVE_PASSWORD` should be set as **encrypted/secret** variables
- **📝 Plaintext variables**: `GITHUB_REPO` can be plaintext (it's not sensitive)
- **Production Environment**: Always set these for the **Production** environment, not Preview
- **Token Permissions**: GitHub token only needs `repo` scope - don't give it broader permissions

## Cloudflare Function

Create `functions/save.js` in your repository root. The complete function code is provided in the plugin documentation and setup guide.

## Configuration Options

| Setting | Default | Description |
|---------|---------|-------------|
| **Enabled** | No | Enable/disable Cloudflare saving |
| **Endpoint URL** | (empty) | Full URL to your Cloudflare Function |
| **Timeout** | 30 seconds | Request timeout duration |
| **Notifications** | Yes | Show save status notifications |
| **Auto-retry** | Yes | Retry failed saves automatically |
| **Remember Password** | No | Remember password during session |
| **Debug Mode** | No | Enable detailed console logging |

## Troubleshooting

### Common Issues

1. **"Cloudflare saver not configured"**
   - Solution: Enter your Cloudflare Function URL in settings

2. **"Invalid password" errors**
   - Solution: Check `SAVE_PASSWORD` environment variable in Cloudflare Pages

3. **"Function not found" (404 errors)**
   - Solution: Ensure `functions/save.js` exists and is deployed

4. **"Authentication failed" (401 errors)**
   - Solution: Verify `GITHUB_TOKEN` has correct permissions and isn't expired

5. **Timeout errors**
   - Solution: Increase timeout in settings or check Cloudflare Function performance

### Debug Mode

Enable debug mode in settings to see detailed logs in your browser console:

```javascript
// Example debug output
[CloudflareSaver] Starting save process
[CloudflareSaver] Save successful
```

### Testing Your Setup

1. Enable the saver in settings
2. Configure your endpoint URL
3. Click "Test Cloudflare Save" button
4. Enter your password when prompted
5. Check for success notification

## Security Considerations

* **Password Storage**: Passwords are only stored in memory during browser session
* **Environment Variables**: Sensitive data (tokens, passwords) stored securely in Cloudflare
* **HTTPS Only**: All communication encrypted via HTTPS
* **Token Permissions**: GitHub token only needs `repo` scope
* **No Client Secrets**: No sensitive data exposed in browser/plugin code

## Multiple Saver Support

This plugin works as an **additional** save option:

* **Existing Savers**: Download, GitHub, Dropbox, etc. continue working
* **User Choice**: Enable/disable Cloudflare saver as needed
* **Flexible Usage**: Switch between save methods based on your needs
* **No Conflicts**: Doesn't interfere with other save functionality

## Development

### Building from Source

```bash
git clone https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver.git
cd tiddlywiki-cloudflare-saver
npm install
npm run build
```

### Testing

```bash
npm test
npm run validate
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `npm run build` and `npm test`
6. Submit a pull request

## Support

* **GitHub Issues**: [Report bugs or request features](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/issues)
* **Documentation**: Complete setup guide included in plugin settings
* **Examples**: Sample Cloudflare Function and configuration provided

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

---

**Made with ❤️ for the TiddlyWiki community**