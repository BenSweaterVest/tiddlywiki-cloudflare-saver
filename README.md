# TiddlyWiki Cloudflare Saver Plugin

## Overview

This plugin enables **automatic saving** of your TiddlyWiki to GitHub via Cloudflare Functions. It works as an **additional save option** alongside existing methods (download, manual upload, etc.).

### How It Works

1. **Host** your TiddlyWiki on Cloudflare Pages
2. **Store** the TiddlyWiki file in a GitHub repository
3. **Edit** your wiki in the browser
4. **Click Save** → Plugin sends content to Cloudflare Function
5. **Function commits** to GitHub → Cloudflare auto-deploys the update

### Key Features

* **Secure**: Password-protected saves, environment variable storage
* **Fast**: Serverless architecture via Cloudflare Functions
* **Reliable**: Auto-retry logic, conflict resolution
* **User-Friendly**: Interactive setup wizard, status indicators, save statistics
* **Configurable**: Debug mode, timeout settings, password memory
* **Compatible**: Works alongside existing TiddlyWiki save methods
* **Transparent**: Real-time connection status and save tracking
* **Modern**: Built with Fetch API, modern JavaScript (ES2015+)

## Prerequisites

Before you begin, you'll need:

1. **A TiddlyWiki HTML file** - Get one from:
   - [Download empty TiddlyWiki](https://tiddlywiki.com/#GettingStarted) (recommended)
   - Or use an existing TiddlyWiki you already have

2. **Accounts**:
   - [GitHub account](https://github.com/signup) (free)
   - [Cloudflare account](https://dash.cloudflare.com/sign-up) (free)

3. **Basic understanding** of:
   - Git/GitHub repositories
   - Cloudflare Pages (we'll guide you through setup)

## Quick Start Guide

Follow these steps to set up the complete system from scratch.

**Want a checklist?** See [`templates/SETUP_CHECKLIST.md`](templates/SETUP_CHECKLIST.md) for a printable checklist to track your progress.

### Step 1: Create GitHub Repository

1. **Create a new GitHub repository** (can be public or private)
   - Go to https://github.com/new
   - Name it (e.g., `my-tiddlywiki`)
   - Choose public or private
   - Initialize with README (recommended)
   - Click "Create repository"

2. **Create the repository structure**:

   Your repository needs this structure:
   ```
   my-tiddlywiki/
   ├── index.html          ← Your TiddlyWiki file
   └── functions/
       └── save.js         ← Cloudflare Function
   ```

3. **Upload your TiddlyWiki file**:
   - Download an empty TiddlyWiki from https://tiddlywiki.com/#GettingStarted
   - In your GitHub repo, click "Add file" → "Upload files"
   - Upload the TiddlyWiki file and rename it to `index.html`
   - Commit the file

4. **Create the Cloudflare Function**:
   - In your GitHub repo, create a folder called `functions`
   - Inside `functions/`, create a file called `save.js`
   - Copy the complete code from: [`demo/functions/save.js`](demo/functions/save.js)
   - Paste it into your `save.js` file
   - Commit the file

Your repository should now have both `index.html` and `functions/save.js`.

**Optional but recommended**: Copy template files from this repository's `templates/` directory:
- [`.gitignore`](templates/.gitignore) - Prevents committing local backup files
- [`README.md`](templates/README.md) - Template for your wiki repository

### Step 2: Create GitHub Personal Access Token

The Cloudflare Function needs permission to commit to your repository. We recommend using **fine-grained tokens** for better security.

#### Option A: Fine-grained Personal Access Token (Recommended)

This is more secure because it limits access to only your TiddlyWiki repository.

1. **Generate a fine-grained token**:
   - Go to GitHub → Settings → Developer settings → [Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
   - Click "Generate new token"
   - Name: `TiddlyWiki Cloudflare Saver`
   - Expiration: Choose your preferred duration (90 days, 1 year, or custom)

2. **Configure repository access**:
   - Repository access: **Only select repositories**
   - Select your TiddlyWiki repository from the dropdown

3. **Set permissions**:
   - Under "Repository permissions":
     - **Contents**: Read and write
     - **Metadata**: Read-only (automatically selected)
   - All other permissions can remain as "No access"

4. **Generate token**:
   - Click "Generate token"
   - **IMPORTANT**: Copy the token immediately (starts with `github_pat_`). You won't be able to see it again

5. **Keep the token safe** - you'll use it in Step 4 (Environment Variables)

#### Option B: Classic Personal Access Token (Alternative)

If you prefer the classic token type (gives access to all your repositories):

1. **Generate a classic token**:
   - Go to GitHub → Settings → Developer settings → [Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
   - Click "Generate new token (classic)"
   - Name: `TiddlyWiki Cloudflare Saver`
   - Expiration: Choose your preferred duration
   - Select scope: **`repo`** (Full control of private repositories)
   - Click "Generate token"
   - **IMPORTANT**: Copy the token (starts with `ghp_`)

**Note**: Classic tokens have access to ALL your repositories. Fine-grained tokens are more secure.

### Step 3: Set Up Cloudflare Pages

Now deploy your TiddlyWiki to Cloudflare Pages.

1. **Connect to Cloudflare Pages**:
   - Go to https://dash.cloudflare.com/
   - Navigate to "Workers & Pages" → "Pages"
   - Click "Connect to Git"
   - Authorize Cloudflare to access your GitHub account
   - Select your TiddlyWiki repository

2. **Configure build settings**:
   ```
   Framework preset:     None
   Build command:        (leave empty)
   Build output directory: /
   Root directory:       (leave empty)
   ```

   These settings tell Cloudflare to serve your `index.html` as-is without building.

3. **Deploy**:
   - Click "Save and Deploy"
   - Wait for deployment to complete (~1-2 minutes)
   - You'll get a URL like: `https://my-tiddlywiki.pages.dev`

4. **Verify the deployment**:
   - Click the URL to open your TiddlyWiki
   - It should load successfully (it won't have the plugin yet)
   - **IMPORTANT**: Copy this URL - you'll need it for plugin configuration

5. **Verify the Function deployed**:
   - Go to your Cloudflare Pages project → "Functions" tab
   - You should see `/save` listed in the routing configuration
   - If you don't see it, check that `functions/save.js` exists in your GitHub repo

### Step 4: Configure Environment Variables

The Cloudflare Function needs these secrets to work.

1. **Go to Environment Variables**:
   - In your Cloudflare Pages project
   - Navigate to "Settings" → "Environment Variables"
   - **IMPORTANT**: Make sure you're in the **Production** environment (not Preview)

2. **Add required variables**:

   | Variable Name | Type | Value | Example |
   |---------------|------|-------|---------|
   | `GITHUB_TOKEN` | **Secret** | Your GitHub token from Step 2 | `github_pat_...` (fine-grained) or `ghp_...` (classic) |
   | `GITHUB_REPO` | Text | Your repo in `username/repo-name` format | `myusername/my-tiddlywiki` |
   | `SAVE_PASSWORD` | **Secret** | Create a strong password for saves | `MySecurePassword123!` |

   **For each variable:**
   - Click "Add variable"
   - Enter the name
   - Enter the value
   - For `GITHUB_TOKEN` and `SAVE_PASSWORD`: Check "Encrypt" to make them secret
   - Click "Save"

3. **Optional variables** (you can add these now or later):

   | Variable Name | Type | Default | Description |
   |---------------|------|---------|-------------|
   | `FILE_PATH` | Text | `index.html` | Path to your TiddlyWiki file if not `index.html` |
   | `MAX_CONTENT_SIZE` | Text | `52428800` | Max file size in bytes (50MB) |
   | `ALLOWED_ORIGINS` | Text | `*` | Comma-separated domains (e.g., `https://my-wiki.pages.dev`) |

4. **Redeploy** (required for environment variables to take effect):
   - Go to "Deployments" tab
   - Find the latest deployment
   - Click "⋯" → "Retry deployment"
   - Wait for completion

### Step 5: Install the Plugin in Your TiddlyWiki

Now you'll add the plugin to your TiddlyWiki. There are two methods.

#### Method A: Drag-and-Drop (Recommended)

This is the easiest way for most users.

1. **Download the plugin file**:
   - Download: [`cloudflare-saver-plugin.tid`](https://raw.githubusercontent.com/BenSweaterVest/tiddlywiki-cloudflare-saver/main/dist/cloudflare-saver-plugin.tid)
   - Right-click → "Save link as..." → Save to your computer

2. **Open your TiddlyWiki from Cloudflare**:
   - Go to your Cloudflare Pages URL (e.g., `https://my-tiddlywiki.pages.dev`)
   - Your wiki should load in the browser

3. **Import the plugin**:
   - **Drag** the downloaded `.tid` file onto your TiddlyWiki page
   - An import dialog will appear
   - Click "Import" button
   - **Note**: You'll see a warning that you can't save yet - this is expected

4. **Save locally** (temporary workaround):
   - Click the download button in TiddlyWiki to download a copy
   - This saves a local HTML file with the plugin installed

5. **Upload the updated file to GitHub**:
   - Go to your GitHub repository
   - Click on `index.html` → Click the pencil icon (Edit)
   - Delete all content
   - Open your downloaded TiddlyWiki file in a text editor
   - Copy ALL the content
   - Paste into GitHub editor
   - Commit changes: "Add Cloudflare Saver plugin"

6. **Wait for Cloudflare to redeploy**:
   - Cloudflare automatically detects the GitHub commit
   - Go to Cloudflare Pages → Deployments
   - Wait for the new deployment to complete (~1-2 minutes)

7. **Refresh your TiddlyWiki**:
   - Go back to your Cloudflare Pages URL
   - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - The plugin should now be installed

#### Method B: For Node.js TiddlyWiki Users

If you're running TiddlyWiki on Node.js locally:

1. **Download the plugin**:
   ```bash
   cd /path/to/your/tiddlywiki
   mkdir -p plugins
   cd plugins
   curl -O https://raw.githubusercontent.com/BenSweaterVest/tiddlywiki-cloudflare-saver/main/dist/cloudflare-saver-plugin.json
   ```

2. **Edit `tiddlywiki.info`** and add to plugins array:
   ```json
   {
     "plugins": [
       "./plugins/cloudflare-saver-plugin"
     ]
   }
   ```

3. **Restart your server**:
   ```bash
   tiddlywiki --server
   ```

4. **Save and upload to GitHub** as described in Method A

### Step 6: Configure the Plugin

Now configure the plugin to use your Cloudflare Function. You can use the interactive wizard or configure manually.

#### Option A: Interactive Setup Wizard (Recommended for First-Time Users)

1. **Open Control Panel**:
   - In your TiddlyWiki, click the gear icon
   - Go to the **"Saving"** tab
   - Scroll down to find **"CloudFlare Saver"** section

2. **Launch the Setup Wizard**:
   - Click the "Launch Setup Wizard" button
   - The wizard will guide you through all 6 setup steps interactively
   - At the final step, click "Auto-Configure Plugin" to automatically set your endpoint URL

3. **Save the configuration**:
   - Click the TiddlyWiki save button
   - You'll be prompted for your password
   - Enter the `SAVE_PASSWORD` you created in Step 4
   - The wiki should save to GitHub

#### Option B: Manual Configuration

1. **Open Control Panel**:
   - In your TiddlyWiki, click the gear icon
   - Go to the **"Saving"** tab
   - Scroll down to find **"CloudFlare Saver"** section

2. **Enable the saver**:
   - Check "Enable saving to Cloudflare Functions"

3. **Enter your Cloudflare Function URL**:
   - In the "Cloudflare Function Endpoint URL" field, enter:
     ```
     https://your-wiki-name.pages.dev/save
     ```
   - Replace `your-wiki-name` with your actual Cloudflare Pages subdomain

4. **Configure options** (recommended defaults):
   - Show save notifications (recommended)
   - Auto-retry failed saves (recommended)
   - Remember password during session (optional, only on trusted devices)
   - Enable debug logging (optional, for troubleshooting)

5. **Save the configuration**:
   - Click the TiddlyWiki save button
   - You'll be prompted for your password
   - Enter the `SAVE_PASSWORD` you created in Step 4
   - The wiki should save to GitHub

### Step 7: Test It Works

1. **Make a test edit**:
   - Create a new tiddler
   - Type some test content
   - Save the tiddler

2. **Save the wiki**:
   - Click the save button
   - Enter your password when prompted
   - You should see a "Saving..." notification
   - Then a "Save successful" notification

3. **Verify in GitHub**:
   - Go to your GitHub repository
   - Click on `index.html`
   - You should see a new commit: "Update TiddlyWiki via Cloudflare Saver"
   - The commit should be very recent (within the last minute)

4. **Verify auto-deployment**:
   - Go to Cloudflare Pages → Deployments
   - You should see a new deployment in progress or completed
   - Once complete, refresh your wiki URL
   - Your changes should appear

**Setup Complete**

Your TiddlyWiki is now configured for automatic cloud saving.

## How the System Works

Understanding the flow helps with troubleshooting:

1. **You click Save** in TiddlyWiki
2. **Plugin prompts** for password
3. **Plugin sends** TiddlyWiki HTML + password to Cloudflare Function endpoint
4. **Function validates** password against `SAVE_PASSWORD` environment variable
5. **Function commits** updated HTML to GitHub using `GITHUB_TOKEN`
6. **GitHub webhook** triggers Cloudflare Pages deployment
7. **Cloudflare Pages** rebuilds and deploys the updated wiki (~1-2 minutes)
8. **Changes are live** at your Cloudflare Pages URL

## Plugin Features

The plugin settings page (Control Panel → Saving → CloudFlare Saver) includes several helpful features:

### Interactive Setup Wizard

- **6-step guided setup**: Walks you through creating GitHub repo, Cloudflare Pages, tokens, and configuration
- **Auto-configuration**: Automatically sets endpoint URL at the end of the wizard
- **Progress tracking**: Checkboxes to track your setup progress
- **Integrated help**: Each step includes detailed instructions with links

### Connection Status Indicator

Real-time visual status of your last save:
- **Green dot**: Last save was successful (shows timestamp)
- **Red dot**: Last save failed (shows error message)
- **Gray dot**: No saves yet

This helps you quickly verify that your configuration is working correctly.

### Save Statistics

Track your wiki's save history:
- **Successful saves count**: Total number of successful saves
- **Failed saves count**: Total number of failed attempts
- **Last save status**: Details about the most recent save operation
- **Reset button**: Clear statistics and start fresh

### Test Connection

- **Test button**: Test your configuration without making actual changes to your wiki
- **Detailed feedback**: Shows success or specific error messages with troubleshooting tips
- **Safe testing**: Doesn't trigger other save methods or download files

### Password Management

When "Remember password during session" is enabled:
- **Clear password button**: Manually clear the remembered password
- **Session-only storage**: Password stored in memory only, cleared on page reload
- **Security notification**: Shows confirmation when password is cleared

## Configuration Options

Access via Control Panel → Saving → CloudFlare Saver

| Setting | Default | Description |
|---------|---------|-------------|
| **Enabled** | No | Enable/disable Cloudflare saving |
| **Endpoint URL** | (empty) | Full URL to your Cloudflare Function |
| **Notifications** | Yes | Show save status notifications |
| **Auto-retry** | Yes | Retry failed saves up to 3 times |
| **Remember Password** | No | Remember password during browser session (memory only) |
| **Debug Mode** | No | Enable detailed console logging |
| **Timeout** | 30 seconds | Request timeout (minimum 5 seconds) |

## Advanced Configuration

### Custom File Path

If your TiddlyWiki is not at `index.html`:

1. Add environment variable in Cloudflare Pages:
   - Name: `FILE_PATH`
   - Value: `path/to/your/wiki.html`

2. Redeploy your Cloudflare Pages project

### CORS Security

By default, the function accepts requests from any origin (`*`). For better security:

1. Add environment variable:
   - Name: `ALLOWED_ORIGINS`
   - Value: `https://your-wiki.pages.dev,https://custom-domain.com`

2. Redeploy

### Larger File Size Limit

Default maximum is 50MB. To increase:

1. Add environment variable:
   - Name: `MAX_CONTENT_SIZE`
   - Value: `104857600` (for 100MB, in bytes)

2. Redeploy

Note: GitHub has a 100MB file size limit.

## Troubleshooting

### Plugin Not Appearing

**Symptoms**: No "CloudFlare Saver" section in Control Panel → Saving

**Solutions**:
1. Verify plugin installed:
   - Control Panel → Plugins tab
   - Look for "BenSweaterVest/cloudflare-saver"
2. If missing:
   - Re-import the `.tid` file
   - Save wiki (download button)
   - Upload to GitHub
   - Wait for Cloudflare redeploy
   - Hard refresh browser

### "Cloudflare Saver Not Configured" Error

**Symptoms**: Error when trying to save

**Solutions**:
1. Check endpoint URL is configured:
   - Control Panel → Saving → CloudFlare Saver
   - Endpoint should be: `https://your-site.pages.dev/save`
2. Check "Enable saving" is checked
3. Verify URL matches your Cloudflare Pages domain exactly

### "Function Not Found" (404 Error)

**Symptoms**: Save fails with 404 error

**Solutions**:
1. Verify `functions/save.js` exists in GitHub repo root
2. Check Cloudflare Pages → Functions tab shows `/save` in routing configuration
3. If missing:
   - Add `functions/save.js` to your repo (copy from `demo/functions/save.js`)
   - Commit and push
   - Wait for Cloudflare redeploy
4. Try the endpoint directly in browser: `https://your-site.pages.dev/save`
   - Should return error (it requires POST) but confirms function exists

### "Invalid Password" (401 Error)

**Symptoms**: Save fails with authentication error

**Solutions**:
1. Verify `SAVE_PASSWORD` environment variable:
   - Cloudflare Pages → Settings → Environment Variables
   - Check it's set for **Production** environment
   - Check it's marked as encrypted
2. Try resetting the password:
   - Update `SAVE_PASSWORD` in environment variables
   - Retry deployment
   - Use new password when saving
3. Check for typos in password (passwords are case-sensitive)

### "Authentication Failed" (GitHub 401/403)

**Symptoms**: Function returns GitHub authentication error

**Solutions**:
1. Verify `GITHUB_TOKEN`:
   - Check it hasn't expired
   - For **fine-grained tokens**: Check it has "Contents: Read and write" permission for your repository
   - For **classic tokens**: Check it has `repo` scope
   - Verify the token has access to the correct repository
   - Try regenerating the token
2. Verify `GITHUB_REPO` format:
   - Should be: `username/repo-name`
   - Not: `https://github.com/username/repo-name`
3. Test token manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
   ```
   Should return your user info if token is valid

### "Rate Limit Exceeded" (429 Error)

**Symptoms**: Save fails after multiple attempts

**Solutions**:
1. Wait 60 seconds before trying again
2. Default limit: 30 requests per minute per IP
3. This is protection against brute force attacks
4. If you need higher limits, modify `MAX_REQUESTS_PER_WINDOW` in `functions/save.js`

### "Content Too Large" (413 Error)

**Symptoms**: Save fails for large wikis

**Solutions**:
1. Check your wiki size:
   - Save wiki locally
   - Check file size
2. If over 50MB:
   - Add `MAX_CONTENT_SIZE` environment variable (in bytes)
   - E.g., `104857600` for 100MB
   - Redeploy
3. Consider archiving old tiddlers to reduce size

### Saves Work But Changes Don't Appear

**Symptoms**: Save succeeds but refreshing wiki shows old content

**Solutions**:
1. Check GitHub commits:
   - Go to your repository
   - Check `index.html` has recent commits
2. Check Cloudflare deployment:
   - Cloudflare Pages → Deployments
   - Verify deployment succeeded
   - Check deployment timestamp
3. Clear browser cache:
   - Hard refresh: `Ctrl+Shift+R` or `Cmd+Shift+R`
4. Wait longer:
   - Cloudflare deployment can take 1-3 minutes
   - Check deployment status before refreshing

### Unicode/Emoji Not Saving Correctly

**Symptoms**: Special characters appear garbled after save

**Solutions**:
1. Ensure you're using the latest `functions/save.js`:
   - Copy from [`demo/functions/save.js`](demo/functions/save.js)
   - It has proper UTF-8 encoding (lines 159-168)
2. Commit and redeploy

### Enable Debug Mode

For detailed troubleshooting:

1. Control Panel → Saving → CloudFlare Saver
2. Enable debug logging to console
3. Open browser console (F12)
4. Try saving
5. Check console for detailed logs:
   ```
   [CloudflareSaver] Starting save process
   [CloudflareSaver] Save successful
   ```

## Security Considerations

### Password Security
- **Session memory**: Password stored in browser memory only (cleared on reload)
- **Never persisted**: Not saved to disk or TiddlyWiki file
- **Enable "Remember password"** only on trusted devices

### Token Security
- **Environment variables**: `GITHUB_TOKEN` and `SAVE_PASSWORD` stored as encrypted Cloudflare secrets
- **Not in code**: Never exposed in browser or repository code
- **Fine-grained tokens recommended**: Limit access to only your TiddlyWiki repository
  - Required permissions: Contents (read/write), Metadata (read)
  - Classic tokens give access to ALL repositories - use fine-grained for better security
- **Token expiration**: Set expiration dates and rotate tokens periodically
- **Minimum permissions**: Only grant what's needed (Contents: read/write)

### Network Security
- **HTTPS only**: All communication encrypted
- **CORS protection**: Configure `ALLOWED_ORIGINS` for production
- **Rate limiting**: 30 requests/minute per IP prevents brute force
- **Content validation**: File size limits prevent abuse

### GitHub Security
- **Private repos**: Use private repositories for sensitive wikis
- **Repository-scoped access**: Fine-grained tokens restrict access to specific repositories
- **Audit trail**: Every save creates a Git commit with full history

## Multiple Savers Support

This plugin works as an **additional** save option:

- **Existing savers continue working**: Download, manual upload, etc.
- **Enable/disable anytime**: Toggle in settings
- **Flexible usage**: Use different save methods for different scenarios
- **No conflicts**: Doesn't interfere with other TiddlyWiki functionality

## Development

### Building from Source

```bash
git clone https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver.git
cd tiddlywiki-cloudflare-saver
npm install
npm run build
```

Built files appear in `dist/`:
- `cloudflare-saver-plugin.tid` - For drag-and-drop installation
- `cloudflare-saver-plugin.json` - For Node.js TiddlyWiki

### Testing

```bash
npm test          # Run tests
npm run validate  # Validate build
npm run dev       # Build and validate
```

### Project Structure

```
tiddlywiki-cloudflare-saver/
├── src/                          # Source code
│   ├── plugin.info               # Plugin metadata
│   ├── saver.js                  # Main saver module with statistics
│   ├── startup.js                # Initialization
│   ├── test-action.js            # Test connection widget
│   ├── clear-password-action.js  # Clear password widget
│   ├── settings.tid              # Settings UI with status & stats
│   ├── wizard.tid                # Interactive setup wizard
│   ├── readme.tid                # Plugin documentation
│   └── notifications/            # Notification tiddlers
│       ├── saving.tid
│       ├── success.tid
│       └── failure.tid
├── demo/                         # Example files
│   └── functions/
│       └── save.js               # Cloudflare Function
├── templates/                    # Templates for your wiki repo
│   ├── .gitignore                # Git ignore template
│   ├── README.md                 # Wiki repo README template
│   └── SETUP_CHECKLIST.md        # Setup progress checklist
├── dist/                         # Built plugin files
│   ├── cloudflare-saver-plugin.tid
│   └── cloudflare-saver-plugin.json
├── scripts/                      # Build scripts
│   ├── build.js
│   └── validate.js
└── README.md                     # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests if applicable
5. Run `npm run build && npm test`
6. Commit: `git commit -am "Add feature"`
7. Push: `git push origin feature/my-feature`
8. Submit a pull request

## FAQ

**Q: Can I use this with a custom domain?**
A: Yes! Set up a custom domain in Cloudflare Pages, then update the endpoint URL in plugin settings.

**Q: Does this work with private GitHub repositories?**
A: Yes, as long as your GitHub token has access to the private repo.

**Q: Will this work if I edit the wiki on multiple devices?**
A: Yes, but refresh before editing to avoid conflicts. The function has conflict resolution, but it's best to work with the latest version.

**Q: Can I use this with GitHub Enterprise?**
A: You'd need to modify `functions/save.js` to use your GitHub Enterprise API URL instead of `api.github.com`.

**Q: How do I back up my TiddlyWiki?**
A: Your GitHub repository is your backup! Every save creates a commit. You can view history and revert if needed.

**Q: Does this cost money?**
A: Free tier of Cloudflare Pages and GitHub is sufficient for personal wikis. Cloudflare Pages includes 500 builds/month and unlimited requests on the free plan.

**Q: Can I host multiple TiddlyWikis?**
A: Yes, create separate repositories and Cloudflare Pages projects for each wiki.

**Q: What happens if I exceed the rate limit?**
A: Saves will fail with a 429 error. Wait 60 seconds before trying again.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/issues)
- **Documentation**: Complete setup guide included in plugin settings
- **Examples**: Sample Cloudflare Function provided in `demo/`

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## Acknowledgments

- Built for the TiddlyWiki community
- Uses Cloudflare Workers/Pages serverless platform
- Integrates with GitHub API for version control

---

Made for the TiddlyWiki community.
