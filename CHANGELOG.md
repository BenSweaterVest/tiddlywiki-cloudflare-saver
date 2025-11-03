# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

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
