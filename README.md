
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

### Method 1: Download Plugin File (Recommended)

**Option A: Download from Repository**
1. Download the plugin JSON directly: [cloudflare-saver-plugin.json](https://raw.githubusercontent.com/BenSweaterVest/tiddlywiki-cloudflare-saver/main/dist/cloudflare-saver-plugin.json)
2. Open TiddlyWiki → Control Panel → Plugins → Import
3. Drag and drop the JSON file
4. Click "Import" and save/reload your TiddlyWiki

**Option B: From Releases** (Coming Soon)
- Official releases will be published at: [Releases Page](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/releases)

### Method 2: Build from Source
```bash
git clone https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver.git
cd tiddlywiki-cloudflare-saver
npm install
npm run build
# Plugin will be in dist/cloudflare-saver-plugin.json
```

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

### Required Variables

| Variable | Type | Example | Description |
|----------|------|---------|-------------|
| `GITHUB_TOKEN` | **🔐 Encrypted** | `ghp_xxxxxxxxxxxx` | GitHub Personal Access Token with `repo` scope |
| `GITHUB_REPO` | **📝 Plaintext** | `username/my-tiddlywiki` | Your GitHub repository (username/repo-name) |
| `SAVE_PASSWORD` | **🔐 Encrypted** | `my-secure-password-123` | Password for authenticating saves |

### Optional Variables (New in v1.0+)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FILE_PATH` | **📝 Plaintext** | `index.html` | Path to your TiddlyWiki file in the repository |
| `MAX_CONTENT_SIZE` | **📝 Plaintext** | `52428800` | Maximum file size in bytes (50MB default) |
| `ALLOWED_ORIGINS` | **📝 Plaintext** | `*` | Comma-separated allowed origins for CORS (e.g., `https://my-wiki.pages.dev`) |

### Important Security Notes:
- **🔐 Encrypted variables**: `GITHUB_TOKEN` and `SAVE_PASSWORD` should be set as **encrypted/secret** variables
- **📝 Plaintext variables**: `GITHUB_REPO`, `FILE_PATH`, `MAX_CONTENT_SIZE`, and `ALLOWED_ORIGINS` can be plaintext
- **Production Environment**: Always set these for the **Production** environment, not Preview
- **Token Permissions**: GitHub token only needs `repo` scope - don't give it broader permissions
- **CORS Security**: Set `ALLOWED_ORIGINS` to your specific domain(s) instead of `*` for better security
- **Rate Limiting**: Built-in rate limiting of 30 requests per minute per IP address

## Cloudflare Function

Create `functions/save.js` in your repository root. The complete, production-ready function code is available in `demo/functions/save.js` in this repository.

### Key Features:
* **Robust UTF-8 Encoding**: Proper handling of all Unicode characters including emoji
* **Rate Limiting**: 30 requests per minute per IP address
* **Content Validation**: Size limits and empty content detection
* **Conflict Resolution**: Automatic retry with exponential backoff for concurrent saves
* **Configurable CORS**: Restrict to specific origins for enhanced security
* **Bearer Token Auth**: Modern GitHub API authentication
* **Flexible Configuration**: All paths and limits configurable via environment variables

Simply copy the file from `demo/functions/save.js` to `functions/save.js` in your repository root.

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
   - Verify the saver is enabled in Control Panel → Settings → Cloudflare Saver

2. **"Invalid password" errors**
   - Solution: Check `SAVE_PASSWORD` environment variable in Cloudflare Pages
   - Ensure it's set for the **Production** environment, not Preview
   - Verify it's marked as encrypted/secret

3. **"Function not found" (404 errors)**
   - Solution: Ensure `functions/save.js` exists in repository root and is deployed
   - Check Cloudflare Pages deployment logs for function deployment status

4. **"Authentication failed" (401 errors)**
   - Solution: Verify `GITHUB_TOKEN` has correct permissions and isn't expired
   - Ensure token has `repo` scope
   - Try regenerating the token if it's old

5. **"Rate limit exceeded" (429 errors)**
   - Solution: Wait 60 seconds before trying again
   - Default limit is 30 requests per minute per IP
   - This protects against brute force attacks

6. **Timeout errors**
   - Solution: Increase timeout in settings or check Cloudflare Function performance
   - Check GitHub API status at https://www.githubstatus.com/

7. **"Content too large" (413 errors)**
   - Solution: Your TiddlyWiki exceeds the size limit (default 50MB)
   - Increase `MAX_CONTENT_SIZE` environment variable if needed
   - Consider archiving old content to reduce file size

8. **CORS errors in browser console**
   - Solution: Check `ALLOWED_ORIGINS` environment variable
   - Ensure your TiddlyWiki URL is in the allowed origins list
   - Use `*` for testing (less secure) or specific domains for production

9. **Unicode/emoji rendering incorrectly**
   - Solution: Ensure you're using the updated `demo/functions/save.js` code
   - The new version has proper UTF-8 encoding support

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

* **Password Storage**: Passwords are only stored in memory during browser session (never persisted)
* **Environment Variables**: Sensitive data (tokens, passwords) stored securely in Cloudflare as encrypted secrets
* **HTTPS Only**: All communication encrypted via HTTPS
* **Token Permissions**: GitHub token only needs `repo` scope (principle of least privilege)
* **No Client Secrets**: No sensitive data exposed in browser/plugin code
* **Rate Limiting**: Built-in protection against brute force attacks (30 requests/minute per IP)
* **Content Validation**: File size limits and content validation prevent abuse
* **CORS Protection**: Configurable origin restrictions prevent unauthorized access
* **Conflict Resolution**: Automatic handling of concurrent save attempts
* **Bearer Token Auth**: Uses modern GitHub API authentication (not deprecated `token` prefix)

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
