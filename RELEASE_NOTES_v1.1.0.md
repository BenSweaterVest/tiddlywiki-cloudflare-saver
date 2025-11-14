# Release Notes for v1.1.0

## TiddlyWiki Cloudflare Saver v1.1.0 - Code Modernization Release

This release includes comprehensive code improvements, better UI formatting, and a full test suite.

## What's New

### Code Modernization
- **Modern Fetch API** - Migrated from XMLHttpRequest to Fetch API with AbortController for proper timeout handling
- **ES2015+ Standards** - Converted all `var` declarations to `const`/`let` throughout the codebase
- **Async/Await** - Cleaner error handling with modern async patterns

### UI Improvements
- **Fixed Input Formatting** - Settings now use proper single-line inputs instead of multi-line textareas
  - URL endpoint field uses `type="url"`
  - Timeout field uses `type="number"` with min validation
  - Matches styling of other TiddlyWiki savers (GitHub, GitLab, etc.)

### Code Quality
- **Refactored CORS Logic** - Extracted into reusable `getCorsOrigin()` and `getCorsHeaders()` functions
- **Version Management** - Added VERSION constant to Cloudflare Function for easier updates
- **Smart Logging** - Console logging now respects debug mode setting

### Testing
- **Comprehensive Test Suite** - 60 tests across 3 test files
  - Build script validation
  - Plugin structure and metadata verification
  - Code quality checks
  - Cloudflare Function helper tests
  - **100% test pass rate**

## Installation

### For Node.js TiddlyWiki
Download `cloudflare-saver-plugin.json` and place it in your plugins directory.

### For Browser TiddlyWiki
Drag and drop `cloudflare-saver-plugin.tid` into your wiki.

## Files

- **cloudflare-saver-plugin.json** - Plugin file for Node.js TiddlyWiki installations
- **cloudflare-saver-plugin.tid** - Plugin file for browser drag-and-drop installation
- **demo/functions/save.js** - Cloudflare Function implementation (copy to your repository)

## Upgrade Instructions

1. Download the appropriate plugin file for your TiddlyWiki installation
2. Replace your existing plugin file
3. If using the Cloudflare Function, update `demo/functions/save.js` in your repository
4. Reload your TiddlyWiki

## Full Changelog

See [CHANGELOG.md](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/blob/main/CHANGELOG.md#110---2025-11-14) for complete details.

## Technical Details

- All changes are backward compatible
- No breaking changes
- Improved error handling and debugging
- Better code maintainability

---

**Full Changelog**: https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/compare/v1.0.1...v1.1.0
