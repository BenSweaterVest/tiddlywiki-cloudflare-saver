# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-01-08

### Fixed
- **Critical:** Fixed CORS preflight OPTIONS handler failing with undefined environment variables
  - Added try-catch wrapper to ensure OPTIONS handler always returns HTTP 200
  - Added optional chaining for safer environment variable access
  - Prevents "Response to preflight request doesn't pass access control check" errors

### Changed
- Corrected endpoint URLs in all documentation from `/functions/save` to `/save`
  - Cloudflare Pages mounts functions at base route path, not `/functions/{name}`
  - Updated README, templates, plugin settings, and examples
- Cleaned up documentation style
  - Removed emoji usage from user-facing documentation
  - Removed AI-style writing patterns for more professional tone
  - Simplified language throughout documentation
- Removed internal analysis files (BUG_ANALYSIS.md, CODE_REVIEW_SUMMARY.md)

## [1.0.0] - 2025-01-06

### Changed
- **UI Improvement:** Moved settings from separate Control Panel tab to Saving section alongside other savers (GitHub, GitLab, etc.)
- Simplified settings UI to match TiddlyWiki saver conventions - more compact and consistent layout
- Settings now appear in Control Panel → Saving tab under "CloudFlare Saver" section
- Removed custom CSS styling in favor of standard TiddlyWiki control panel styles

### Fixed
- **Critical:** Fixed saver not being invoked - added module-level `exports.info`, increased priority to 2000, and added endpoint validation to `canSave()` so saver is properly triggered when enabled and configured
- **Critical:** Fixed textboxes not editable - added explicit `field="text"` attribute to all `$edit-text` widgets (TiddlyWiki requires explicit field specification in some contexts)
- **Critical:** Fixed timeout configuration validation - now handles non-numeric input gracefully (defaults to 30s, minimum 5s)
- **Critical:** Fixed base64 encoding for large files - chunked processing prevents "Maximum call stack size exceeded" errors on wikis >1MB
- Fixed display name in Saving tab - added caption field so it shows "CloudFlare Saver" instead of full tiddler path
- Fixed textbox styling - removed excessive size attribute to match GitHub/GitLab saver appearance
- Fixed build script .tid file parsing - now correctly extracts caption and tags from file headers
- Fixed tiddler title mismatch - JavaScript modules now correctly include .js extension in titles
- Fixed build script to fail on missing required files instead of silently continuing
- Corrected priority comment - now accurately states high priority (2000) to ensure proper invocation
- Added defensive checks for `$tw` global before accessing `$tw.notifier` to prevent potential ReferenceErrors
- Support for both "save" and "autosave" methods (was only handling "save")

### Added
- Initial release of TiddlyWiki Cloudflare Saver plugin
- Additional saver option (works alongside existing savers)
- Comprehensive setup guide with expandable documentation
- Visual status indicators and configuration validation
- Built-in connection testing functionality
- Auto-retry logic with exponential backoff (up to 3 attempts)
- Session-based password memory option
- Debug mode with detailed logging
- Visual save notifications
- Complete Cloudflare Function implementation with production-grade features:
  - Rate limiting (30 requests/minute per IP)
  - Content size validation (50MB default, configurable)
  - Proper UTF-8 encoding for all Unicode characters including emoji
  - Conflict resolution for concurrent saves
  - Configurable CORS origins for security
  - Configurable file path support
  - Bearer token authentication (modern GitHub API)
  - Comprehensive error handling and logging

### Security
- Password-protected saves with environment variable storage
- Rate limiting protection against brute force attacks
- Content validation prevents abuse
- Configurable CORS origins (not just wildcard)
- Uses Bearer token instead of deprecated `token` prefix
- Environment variables properly marked as encrypted/secret
- No sensitive data exposed in browser code

### Fixed
- Corrected saver enabling mechanism (removed non-standard SaverFilter)
- Fixed Base64 encoding to properly handle UTF-8 characters
- Updated settings.tid with correct, production-ready function code
- Improved error messages with actionable information
- Enhanced documentation with security best practices
