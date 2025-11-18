# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-18

### Added
- **Interactive Setup Wizard:** 6-step guided setup process for first-time users
  - Walks through GitHub repo creation, Cloudflare Pages setup, token generation, and plugin configuration
  - Auto-configure button automatically sets endpoint URL
  - Progress tracking with checkboxes for each step
  - Integrated help with detailed instructions and links
- **Connection Status Indicator:** Real-time visual status of last save operation
  - Green dot for successful saves (with timestamp)
  - Red dot for failed saves (with error message)
  - Gray dot when no saves have been performed yet
  - Helps quickly verify configuration is working
- **Save Statistics Tracking:** Comprehensive save history tracking
  - Successful saves counter
  - Failed saves counter
  - Last save status with timestamp and error details
  - Reset button to clear statistics
- **Password Management Widget:** Clear password button for session password
  - Manually clear remembered password
  - Shows confirmation notification
  - Appears when "Remember password during session" is enabled
- **Test Connection Feature:** Dedicated test button with detailed feedback
  - Test configuration without making actual wiki changes
  - Formatted modal dialogs with color-coded status
  - Specific error messages with troubleshooting tips
  - Safe testing that doesn't trigger other save methods
- **Testing:** Comprehensive unit test suite with 60 tests across 3 test files
  - Build script validation tests
  - Plugin structure and metadata tests
  - Code quality and modernization verification tests
  - Cloudflare Function helper function tests
  - 100% test pass rate

### Changed
- **Settings UI Complete Redesign:** Modern, informative interface
  - Visual status indicators with color-coded dots
  - Statistics display prominently shown
  - Wizard launch button for easy setup
  - Better organization and readability
- **Code Modernization:** Migrated from XMLHttpRequest to modern Fetch API with AbortController for proper timeout handling
- **Code Quality:** Modernized variable declarations from `var` to `const`/`let` throughout codebase
- **UI Improvement:** Fixed input field formatting in settings to use single-line inputs instead of multi-line textareas
  - URL endpoint field now uses `type="url"` with proper single-line input
  - Timeout field now uses `type="number"` with min validation
  - Matches styling and behavior of other TiddlyWiki savers (GitHub, GitLab, etc.)
- **Code Organization:** Extracted and consolidated CORS logic into reusable helper functions
  - Added `getCorsOrigin()` function to centralize origin determination logic
  - Added `getCorsHeaders()` function to generate consistent CORS headers
  - Eliminated code duplication between POST and OPTIONS handlers
- **Maintainability:** Added VERSION constant to Cloudflare Function, replacing hardcoded version strings
  - Easier version updates across User-Agent headers
  - Single source of truth for version tracking
- **Documentation:** Comprehensive README updates
  - New "Plugin Features" section documenting all UI features
  - Updated setup instructions with wizard and manual options
  - Updated project structure reflecting new files

### Technical Improvements
- Modern async/await syntax in saver module for cleaner error handling
- Proper timeout implementation using AbortController
- Better error handling with granular error types (timeout, network, HTTP errors)
- Event-driven architecture for password clearing
- Statistics stored in tiddler fields for persistence
- Improved code readability and maintainability
- Debug logging respects debug mode setting (reduces console noise)

### Files Added
- `src/wizard.tid` - Interactive 6-step setup wizard
- `src/clear-password-action.js` - Password clearing widget
- `src/test-action.js` - Test connection widget with formatted feedback

### Files Removed
- Removed `PROJECT_CONTEXT.md` (outdated development notes)
- Removed `RELEASE_NOTES_v1.1.0.md` (temporary file)
- Removed `templates/TEMPLATE_README.md` (redundant)

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
