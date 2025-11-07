# My TiddlyWiki

This repository contains my personal TiddlyWiki, hosted on Cloudflare Pages with automatic saving via the Cloudflare Saver plugin.

## Live Wiki

Access the wiki at: `https://your-wiki-name.pages.dev`

## How It Works

- **Hosted on**: Cloudflare Pages (auto-deploys on every commit)
- **Saved to**: This GitHub repository
- **Plugin**: [TiddlyWiki Cloudflare Saver](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver)

Every time you click "Save" in the wiki, the plugin commits the changes to this repository, and Cloudflare Pages automatically redeploys the updated wiki.

## Repository Structure

```
.
├── index.html          # The TiddlyWiki file
├── functions/
│   └── save.js         # Cloudflare Function for saving
└── README.md           # This file
```

## Manual Backup

While the repository itself is the backup (every save creates a commit), you can also:

1. Download the wiki locally: Visit your wiki and click the download button (💾)
2. Clone this repository: `git clone https://github.com/yourusername/your-wiki-repo.git`

## Reverting to a Previous Version

To restore an older version:

1. Go to the commit history of `index.html`
2. Find the version you want to restore
3. Click "View" → Click "Raw" → Save the file
4. Upload it back to this repository as `index.html`
5. Cloudflare will automatically redeploy

Or use Git:
```bash
git checkout COMMIT_HASH index.html
git commit -m "Restore wiki to previous version"
git push
```

## License

This is my personal wiki. The content is mine. The TiddlyWiki software is licensed under BSD 3-Clause License.
