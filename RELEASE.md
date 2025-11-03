# Creating a Release

This guide explains how to create an official GitHub release for the TiddlyWiki Cloudflare Saver plugin.

## Prerequisites

- All changes merged to `main` branch
- Version number updated in `package.json` and `src/plugin.info`
- CHANGELOG.md updated with release notes
- All tests passing

## Release Process

### 1. Update Version Number

Update version in these files:
- `package.json` - version field
- `src/plugin.info` - version field
- `CHANGELOG.md` - change "Unreleased" to version number and date

### 2. Build the Plugin

```bash
npm run build
npm run validate
npm test
```

### 3. Commit Version Changes

```bash
git add package.json src/plugin.info CHANGELOG.md dist/
git commit -m "Release v1.0.0"
git push origin main
```

### 4. Create Git Tag

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 5. Create GitHub Release

**Via GitHub Web Interface:**

1. Go to: https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/releases/new
2. Click "Choose a tag" → Select `v1.0.0`
3. Release title: `v1.0.0 - Initial Release`
4. Description: Copy from CHANGELOG.md
5. Attach files:
   - `dist/cloudflare-saver-plugin.json` (main plugin file)
   - `dist/cloudflare-saver-plugin.tid` (alternative format)
6. Check "Set as the latest release"
7. Click "Publish release"

**Via GitHub CLI (if installed):**

```bash
gh release create v1.0.0 \
  --title "v1.0.0 - Initial Release" \
  --notes-file CHANGELOG.md \
  dist/cloudflare-saver-plugin.json \
  dist/cloudflare-saver-plugin.tid
```

## Release Checklist

- [ ] Version numbers updated in all files
- [ ] CHANGELOG.md updated
- [ ] Tests passing
- [ ] Plugin built and validated
- [ ] Changes committed to main
- [ ] Git tag created and pushed
- [ ] GitHub release created
- [ ] Release assets uploaded
- [ ] Release notes published
- [ ] README tested with new download links

## After Release

1. **Verify Downloads**: Test that the release download links work
2. **Update Documentation**: Ensure all docs reference the correct version
3. **Announce**: Share release on relevant channels (if applicable)
4. **Monitor**: Watch for issues or user feedback

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.x.x): Breaking changes
- **MINOR** (x.1.x): New features, backward compatible
- **PATCH** (x.x.1): Bug fixes, backward compatible

Examples:
- Initial release: `1.0.0`
- New feature: `1.1.0`
- Bug fix: `1.0.1`
- Breaking change: `2.0.0`

## Future Releases

For subsequent releases:

1. Create a new branch for changes
2. Update version number
3. Update CHANGELOG.md
4. Follow steps 2-5 above
5. Merge to main via PR if desired

## NPM Publishing (Optional)

If publishing to npm:

```bash
npm login
npm publish
```

Note: Currently not set up for npm publishing. If desired:
1. Update package.json with correct repository info
2. Ensure .npmignore or files field is configured
3. Run `npm publish --access public`
