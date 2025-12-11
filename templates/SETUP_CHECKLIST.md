# TiddlyWiki Cloudflare Saver Setup Checklist

Use this checklist to ensure you've completed all setup steps correctly.

## Step 1: GitHub Repository

- [ ] Created GitHub repository (public or private)
- [ ] Uploaded `index.html` (empty TiddlyWiki)
- [ ] Created `functions/` directory
- [ ] Created `functions/save.js` (copied from demo)
- [ ] Verified repository structure:
  ```
  your-repo/
  ├── index.html
  └── functions/
      └── save.js
  ```

## Step 2: GitHub Personal Access Token

**Recommended: Fine-grained token (more secure)**
- [ ] Created fine-grained Personal Access Token
- [ ] Set repository access to "Only select repositories"
- [ ] Selected your TiddlyWiki repository
- [ ] Set permissions: Contents (Read and write), Metadata (Read-only)
- [ ] Copied token securely (starts with `github_pat_`)

**Alternative: Classic token**
- [ ] Created classic Personal Access Token
- [ ] Token has `repo` scope
- [ ] Copied token securely (starts with `ghp_`)

**Both options:**
- [ ] Noted token for Step 4

## Step 3: Cloudflare Pages

- [ ] Created Cloudflare Pages project
- [ ] Connected to GitHub repository
- [ ] Build settings configured:
  - [ ] Framework preset: None
  - [ ] Build command: (empty)
  - [ ] Build output directory: /
  - [ ] Root directory: (empty)
- [ ] Deployed successfully
- [ ] Copied Cloudflare Pages URL (e.g., `https://my-wiki.pages.dev`)
- [ ] Verified Function deployed (Functions tab shows `/save` in routing configuration)
- [ ] Verified wiki loads at URL

## Step 4: Environment Variables

In Cloudflare Pages → Settings → Environment Variables → **Production**:

- [ ] Added `GITHUB_TOKEN` (encrypted)
  - Value: `github_pat_...` (fine-grained) or `ghp_...` (classic)
- [ ] Added `GITHUB_REPO` (text)
  - Value: `username/repo-name`
- [ ] Added `SAVE_PASSWORD` (encrypted)
  - Value: `your-secure-password`
- [ ] Optional: Added `FILE_PATH` if not using `index.html`
- [ ] Optional: Added `MAX_CONTENT_SIZE` if needed
- [ ] Optional: Added `ALLOWED_ORIGINS` for CORS security
- [ ] Redeployed after adding variables (Deployments → Retry deployment)
- [ ] Waited for deployment to complete

## Step 5: Install Plugin

- [ ] Downloaded `cloudflare-saver-plugin.tid`
- [ ] Opened wiki from Cloudflare Pages URL
- [ ] Dragged `.tid` file onto wiki
- [ ] Clicked "Import"
- [ ] Downloaded wiki locally (download button)
- [ ] Uploaded updated file to GitHub `index.html`
- [ ] Waited for Cloudflare redeploy
- [ ] Hard refreshed browser (`Ctrl+Shift+R`)
- [ ] Verified plugin appears in Control Panel → Plugins

## Step 6: Configure Plugin

In TiddlyWiki Control Panel → Saving → CloudFlare Saver:

- [ ] Enabled "Enable saving to Cloudflare Functions"
- [ ] Entered endpoint URL: `https://your-wiki.pages.dev/save`
- [ ] Configured options:
  - [ ] Show save notifications (recommended)
  - [ ] Auto-retry failed saves (recommended)
  - [ ] Remember password (optional)
  - [ ] Debug mode (optional)
- [ ] Saved configuration

## Step 7: Test

- [ ] Created test tiddler
- [ ] Clicked save button
- [ ] Entered password (the `SAVE_PASSWORD` from Step 4)
- [ ] Saw "Saving..." notification
- [ ] Saw "Save successful" notification
- [ ] Verified commit in GitHub repository
- [ ] Verified Cloudflare deployment triggered
- [ ] Waited for deployment to complete
- [ ] Hard refreshed wiki
- [ ] Verified changes appear

## Troubleshooting

If any step failed, refer to the Troubleshooting section in the main README:
https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver#troubleshooting

Common issues:
- **404 error**: Function not deployed (check `functions/save.js` exists)
- **401 error**: Wrong password or GitHub token issue
- **No plugin**: Forgot to redeploy after uploading
- **Changes don't appear**: Wait for Cloudflare deployment, then hard refresh

## Notes

Record your setup details here:

- **Cloudflare Pages URL**: `https://_____________________.pages.dev`
- **GitHub Repository**: `https://github.com/_____/_____`
- **SAVE_PASSWORD**: (keep this secret, store in password manager)
- **Date Configured**: `____________________`

---

Keep this checklist for reference and future troubleshooting!
