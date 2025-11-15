# Contributing to TiddlyWiki Cloudflare Saver

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

Be respectful, inclusive, and professional. This is a welcoming community for everyone.

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report:
- **Check existing issues** to avoid duplicates
- **Test with the latest version** to see if the bug still exists

When creating a bug report, include:
- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs. actual behavior
- **Environment details**: Browser, TiddlyWiki version, plugin version
- **Error messages** or console logs (if applicable)
- **Screenshots** (if relevant)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please include:
- **Clear use case** explaining the need
- **Proposed solution** or implementation ideas
- **Alternatives considered**
- **Potential impact** on existing functionality

### Pull Requests

#### Before You Start

1. **Open an issue first** for significant changes to discuss the approach
2. **Check existing PRs** to avoid duplicate work
3. **Fork the repository** and create a feature branch

#### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/tiddlywiki-cloudflare-saver.git
cd tiddlywiki-cloudflare-saver

# Install dependencies
npm install

# Run tests
npm test

# Build the plugin
npm run build

# Validate the build
npm run validate
```

#### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Use modern JavaScript (const/let, async/await, Fetch API)

3. **Write/update tests**
   - Add tests for new features
   - Update tests for changed behavior
   - Ensure all tests pass: `npm test`

4. **Update documentation**
   - Update README.md if needed
   - Update CHANGELOG.md with your changes
   - Add JSDoc comments for new functions

5. **Build and validate**
   ```bash
   npm run build
   npm run validate
   npm test
   ```

6. **Commit your changes**
   - Use clear, descriptive commit messages
   - Follow the format: `type: description`
   - Examples:
     - `feat: add support for custom commit messages`
     - `fix: resolve timeout handling in saver.js`
     - `docs: update installation instructions`
     - `test: add tests for CORS helper functions`
     - `refactor: extract validation logic`
     - `chore: update dependencies`

7. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   - Create PR on GitHub
   - Fill out the PR template
   - Link related issues

#### PR Guidelines

- **One feature per PR** - Keep PRs focused and reviewable
- **Pass all tests** - CI must be green
- **Update tests** - Add/modify tests as needed
- **Update docs** - Keep documentation current
- **Clean history** - Squash trivial commits if needed
- **Respond to feedback** - Address review comments promptly

## Code Style

### JavaScript

- Use **const/let** instead of var
- Use **async/await** for asynchronous code
- Use **Fetch API** instead of XMLHttpRequest
- Prefer **arrow functions** for callbacks
- Use **template literals** for string interpolation
- Add **JSDoc comments** for functions

Example:
```javascript
/**
 * Validates save configuration
 * @param {Object} config - Configuration object
 * @returns {boolean} True if valid
 */
const validateConfig = (config) => {
  const { endpoint, timeout } = config;
  return endpoint && timeout >= 5;
};
```

### File Structure

```
tiddlywiki-cloudflare-saver/
├── src/               # Plugin source files
│   ├── saver.js       # Main saver module
│   ├── startup.js     # Startup/initialization
│   ├── settings.tid   # Settings UI
│   └── ...
├── demo/functions/    # Cloudflare Function example
│   └── save.js        # Reference implementation
├── scripts/           # Build and validation scripts
├── __tests__/         # Test files
├── dist/              # Built plugin files (generated)
└── templates/         # User-facing templates
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (during development)
npm test -- --watch

# Run specific test file
npm test __tests__/validation.test.js
```

### Writing Tests

- Place tests in `__tests__/` directory
- Name test files with `.test.js` suffix
- Group related tests with `describe()` blocks
- Use clear test descriptions

Example:
```javascript
describe('getCorsOrigin', () => {
  test('returns wildcard for wildcard allowed origins', () => {
    const result = getCorsOrigin(['*'], 'https://example.com');
    expect(result).toBe('https://example.com');
  });
});
```

## Building

The build process compiles source files into distributable plugin formats:

```bash
npm run build
```

This creates:
- `dist/cloudflare-saver-plugin.json` - For Node.js TiddlyWiki
- `dist/cloudflare-saver-plugin.tid` - For browser drag-and-drop

## Versioning

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Release Process

(For maintainers)

1. Update version in `package.json`
2. Update VERSION constant in `demo/functions/save.js`
3. Update CHANGELOG.md with release date
4. Build and test: `npm run build && npm test`
5. Commit: `git commit -m "chore: Bump version to X.Y.Z"`
6. Tag: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
7. Push: `git push && git push --tags`
8. Create GitHub release with built files

## Documentation

### README.md

- Keep setup instructions current
- Update examples when API changes
- Test all command examples

### CHANGELOG.md

Follow [Keep a Changelog](https://keepachangelog.com/) format:
- Add entries under "Unreleased" during development
- Use categories: Added, Changed, Deprecated, Removed, Fixed, Security
- Be specific and user-focused

### Code Comments

- Explain **why**, not what (code shows what)
- Document complex algorithms
- Note any workarounds or edge cases

## Questions?

- **General questions**: Open a GitHub Discussion
- **Bug reports**: Open an Issue
- **Security issues**: See [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
