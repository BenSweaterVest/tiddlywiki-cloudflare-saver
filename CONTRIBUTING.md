# Contributing

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Reporting bugs and ideas

Use the issue templates. For bugs, include the saver version (shown on your Worker's `/_saver/` page), your TiddlyWiki version and browser, and any console errors. Remove passwords and tokens first. Security problems go through [private reporting](SECURITY.md), not issues.

For larger changes, open an issue first so we can agree on the approach.

## Project layout

```
plugin/          TiddlyWiki plugin source
  core.js        Talks to the Worker; queues, throttles and retries saves
  dialogs.js     Sign-in and conflict dialogs (plain DOM)
  saver.js       The saver module TiddlyWiki calls
  startup.js     Status setup, version 1 clean-up, settings buttons
  settings.tid   Control Panel > Saving > Cloudflare Saver
  config/        Default settings (shadow tiddlers)
worker/          Cloudflare Worker, deployable on its own
  src/index.js   Routes
  src/github.js  GitHub API client (streams the wiki, never decodes it)
  src/auth.js    Password check, session cookies, cross-site protection
  src/limiter.js Failed sign-in counting (Durable Object)
  src/admin-page.js  The /_saver/ page
  src/generated/plugin.js  Built from plugin/; do not edit
scripts/build.js Builds the plugin
test/            Unit tests, fake GitHub, end-to-end test
```

The version number lives only in `package.json`. The build copies it into the plugin and the Worker.

## Development

Needs Node.js 20 or later.

```bash
npm ci
```

```bash
npm run check
```

`npm run check` runs the linter, verifies `worker/src/generated/plugin.js` matches `plugin/`, and runs the unit tests. After changing anything in `plugin/`, run `npm run build` and commit the regenerated file.

### End-to-end test

The end-to-end test runs the real Worker in `wrangler dev`, a fake GitHub API, and a real TiddlyWiki in headless Chromium. It covers upload, sign-in, saving, conflicts and reloading.

```bash
npm ci --prefix worker
```

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Set `E2E_SCREENSHOTS=some-folder` to keep screenshots of each step.

### Trying it by hand

Copy `worker/.dev.vars.example` to `worker/.dev.vars`, fill in a real token and a password, set `GITHUB_REPO` in `wrangler.jsonc` (or pass `--var GITHUB_REPO:owner/repo`), then run `npx wrangler dev` in `worker/` and open `http://localhost:8787/_saver/`.

## Guidelines

- **Stay free.** Everything must keep working on the free plans of Cloudflare and GitHub with no payment method on file. Keep Worker CPU time low: stream, don't parse or re-encode the wiki.
- **Match the surrounding code.** Two-space indent, single quotes, semicolons; `npm run lint:fix` handles most of it.
- **Test behavior.** Add or update tests for anything you change. The plugin tests boot the real TiddlyWiki core, so prefer them over mocks.
- **Keep docs current.** Update the README and add a line under "Unreleased" in [CHANGELOG.md](CHANGELOG.md).
- **Commit messages** in the form `type: summary`, for example `fix: keep wiki dirty when a save fails`.

## Releasing (maintainers)

1. Set the new version in `package.json`, run `npm run build`, and move the "Unreleased" changelog entries under the new version.
2. Commit, then tag: `git tag vX.Y.Z` and push the tag.
3. The release workflow checks the tag matches `package.json`, runs the checks, and publishes a GitHub release with the plugin files.

## License

By contributing you agree that your contributions are licensed under the MIT License.
