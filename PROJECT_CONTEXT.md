# TiddlyWiki Cloudflare Saver - Project Context

## Quick Overview

This is a TiddlyWiki plugin that enables saving to GitHub via Cloudflare Functions. Users can edit their wiki in the browser and save directly to GitHub, which triggers automatic deployment via Cloudflare Pages.

**Current Status:** v1.0.1 - Production ready, all major issues resolved

## Architecture

```
User's TiddlyWiki (browser)
    ↓ POST /save
Cloudflare Pages Function (demo/functions/save.js)
    ↓ GitHub API
GitHub Repository (user's wiki)
    ↓ Webhook
Cloudflare Pages Auto-Deploy
```

## Critical Information

### 1. Endpoint URL Pattern
**IMPORTANT:** Cloudflare Pages mounts functions at their base route path:
- File location: `functions/save.js` in repository
- Deployed endpoint: `https://site.pages.dev/save` (NOT `/functions/save`)
- All documentation reflects this

### 2. CORS Handling
The OPTIONS handler MUST be wrapped in try-catch and always return 200:
```javascript
export async function onRequestOptions(context) {
  try {
    // ... CORS logic
  } catch (error) {
    // ALWAYS return valid CORS response
    return new Response(null, { status: 200, headers: {...} });
  }
}
```

**Why:** Environment variables can be undefined during preflight, causing failures. The try-catch ensures the preflight always succeeds.

### 3. Local File Access
TiddlyWiki can be opened as `file://` URLs, which send `Origin: null`:
- Must explicitly handle `'null'` as a string in CORS logic
- Default `ALLOWED_ORIGINS: '*'` handles this automatically

## Project Structure

```
tiddlywiki-cloudflare-saver/
├── src/                          # Plugin source
│   ├── plugin.info               # Plugin metadata
│   ├── saver.js                  # Main saver logic (226 lines)
│   ├── startup.js                # Plugin initialization
│   ├── settings.tid              # Settings UI
│   ├── readme.tid                # Plugin documentation
│   └── notifications/            # Toast notifications
├── demo/functions/save.js        # Cloudflare Function (333 lines)
├── dist/                         # Built plugin files
│   ├── cloudflare-saver-plugin.json
│   └── cloudflare-saver-plugin.tid
├── scripts/                      # Build tooling
│   ├── build.js
│   └── validate.js
└── templates/                    # Templates for user repos
```

## Key Files

### `demo/functions/save.js`
Production-ready Cloudflare Function with:
- Password authentication via `env.SAVE_PASSWORD`
- Rate limiting (30 req/min per IP)
- Retry logic for GitHub conflicts
- Chunked base64 encoding (handles large files >1MB)
- Proper UTF-8 support
- **MUST have try-catch on OPTIONS handler**

### `src/saver.js`
TiddlyWiki saver module:
- Priority 2000 (high priority when enabled)
- Only claims saves when enabled AND endpoint configured
- Password prompt with optional session memory
- Auto-retry with exponential backoff
- Visual notifications

### `src/plugin.info`
Version is here, but `package.json` is source of truth for npm version.

## Build Process

```bash
npm run build       # Builds dist/ files
npm run validate    # Validates plugin structure
npm test           # Runs tests (currently just passes)
```

**Important:** `dist/` is committed to repo (plugin distribution)

## Documentation Style

**Do NOT use:**
- Emojis (removed in v1.0.1)
- Em-dashes (—)
- AI-style enthusiasm ("Congratulations!", "Amazing!", etc.)
- Checkbox emojis (✅)

**Do use:**
- Clear, direct language
- Professional tone
- Checkboxes: `- [ ]` in markdown
- Plain "IMPORTANT" (not with multiple !!!)

## Environment Variables (Cloudflare Pages)

Required:
- `GITHUB_TOKEN` (encrypted) - Fine-grained or classic PAT
- `GITHUB_REPO` (text) - Format: `owner/repo`
- `SAVE_PASSWORD` (encrypted) - For authentication

Optional:
- `ALLOWED_ORIGINS` - Default: `*`
- `FILE_PATH` - Default: `index.html`
- `MAX_CONTENT_SIZE` - Default: `52428800` (50MB)

## Common Issues & Solutions

### Issue: CORS preflight fails
**Cause:** OPTIONS handler not returning 200
**Fix:** Wrap in try-catch, ensure always returns 200

### Issue: 405 Method Not Allowed
**Cause:** Wrong endpoint URL
**Fix:** Use `/save` not `/functions/save`

### Issue: Large file encoding fails
**Cause:** Spread operator on large Uint8Array
**Fix:** Chunked processing (already implemented in demo/functions/save.js:178-185)

### Issue: Password prompt on every save
**Cause:** User hasn't enabled "Remember password during session"
**Fix:** User setting in Control Panel → Saving → CloudFlare Saver

## Version Release Process

```bash
# Update CHANGELOG.md first
npm version patch    # Bumps version, runs tests, builds, commits
# Then manually merge to main and tag
```

**Note:** `npm version` will fail to push tags in this environment (403 error). This is expected - tag manually after merge.

## Testing Checklist

When making changes:
- [ ] Run `npm run build`
- [ ] Run `npm run validate`
- [ ] Check endpoint URLs are `/save` not `/functions/save`
- [ ] Verify CORS headers include proper origin handling
- [ ] Test with `Origin: null` for local file support
- [ ] No emojis in user-facing documentation

## Current State (v1.0.1)

**Working:**
- CORS preflight handling (with try-catch wrapper)
- Local file (`file://`) support
- Large file encoding (chunked processing)
- Password authentication
- Rate limiting
- Conflict resolution
- All documentation cleaned up

**Ready for:**
- Merge to main
- Tag v1.0.1
- Optional: GitHub Release

**Branch:** `claude/fix-password-prompt-save-011CUuS8gUZVz57MDDRBdTfu`

## Related Repository

User's actual TiddlyWiki deployment:
- Repo: `BenSweaterVest/capitolfoodtrucks`
- Branch: `main`
- Deployed: `capitolfoodtrucks.work` and `capitolfoodtrucks.pages.dev`
- Uses this plugin successfully with endpoint: `https://capitolfoodtrucks.work/save`

## Key Lessons Learned

1. **Always test CORS with `Origin: null`** - Local file access is a common use case
2. **Cloudflare Pages routing is NOT `/functions/*`** - It's just `/*`
3. **Environment variables can be undefined** - Always use optional chaining or try-catch
4. **Large files need chunked encoding** - Don't use spread operator on large arrays
5. **Documentation matters** - Professional tone without AI patterns builds trust

## Contact Points

- Issues: https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/issues
- License: MIT
- Author: BenSweaterVest

---

Last updated: 2025-01-08 (v1.0.1)
