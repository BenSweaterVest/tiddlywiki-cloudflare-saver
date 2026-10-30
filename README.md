# TiddlyWiki Cloudflare Saver

Keep a single-file [TiddlyWiki](https://tiddlywiki.com) in a GitHub repository and edit it from any browser. A small Cloudflare Worker that you deploy to your own account serves the wiki, and every save becomes a commit.

Everything runs on the free plans of Cloudflare and GitHub. Nothing asks for a payment method.

- **Save from anywhere.** Open your wiki's address, edit, save. No app, no local server.
- **Full history.** Every save is a Git commit, so any old version can be restored.
- **Safe across devices.** If the wiki was saved somewhere else since you opened it, you are asked before anything is overwritten.
- **Sign in once.** A secure session cookie lasts 30 days (configurable). The GitHub token never reaches the browser.
- **Public or private.** Let anyone read the wiki, or require sign-in to view it too.
- **Gentle on autosave.** Autosaves are spaced out (15 seconds by default) so editing doesn't flood the history.

## Contents

- [How it works](#how-it-works)
- [What it costs](#what-it-costs)
- [Setup](#setup)
- [Everyday use](#everyday-use)
- [Settings](#settings)
- [Updating](#updating)
- [Upgrading from version 1](#upgrading-from-version-1)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Development](#development)

## How it works

```
 Browser                      Your Cloudflare Worker                 GitHub
 ───────                      ──────────────────────                 ──────
 GET /            ─────────▶  look up index.html, stream it  ◀────  repository
                  ◀─────────  wiki + version header
 edit, save
 PUT /_saver/api/wiki ─────▶  check session, commit         ─────▶  new commit
                  ◀─────────  new version
```

1. The Worker reads the wiki file from your repository and streams it to the browser. A response header tells the plugin which version of the file it loaded.
2. When you save, the plugin sends the new wiki together with that version. GitHub only accepts the commit if the file has not changed since, which is how conflicts are caught.
3. Nothing is rebuilt or redeployed on save. The next page load simply reads the new commit.

The plugin switches itself on only when the wiki was loaded from your Worker. The same file opened from disk or another host uses TiddlyWiki's usual savers.

## What it costs

Nothing, as long as you stay on the free plans. The free plans don't bill you for going over; requests just fail until the limit resets.

| Service | Free allowance | What this project uses |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests per day, 10 ms CPU per request | 1 request per page load, 1 per save. The Worker streams the wiki without decoding it, so CPU use stays far below the limit. |
| Cloudflare Durable Objects (SQLite) | Included in Workers Free | One small object that counts failed sign-ins. |
| Cloudflare request size | 100 MB per request | Caps the wiki at about 74 MB (default limit 50 MB). |
| GitHub | Free private repositories; 5,000 API calls per hour per token | About 2 API calls per page load, 1 per save. |

Unlike version 1, nothing is built or deployed on save, so the Cloudflare Pages limit of 500 builds per month no longer applies.

## Setup

You need a GitHub account, a Cloudflare account, and a TiddlyWiki file (5.3 or later). If you don't have a wiki yet, download [empty.html](https://tiddlywiki.com/empty.html). Setup takes about 10 minutes.

### 1. Create a repository for the wiki

Create a new repository on GitHub, for example `my-wiki`. Private is recommended. It can be empty; you will upload the wiki in step 5.

### 2. Create a GitHub token

1. Go to [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. **Repository access:** Only select repositories, then pick your wiki repository.
3. **Permissions:** Repository permissions > **Contents: Read and write**. (Metadata: Read is added automatically.)
4. Choose an expiration date. The Worker's status page shows when the token expires, so you know when to replace it.
5. Generate the token and copy it.

### 3. Deploy the Worker

**Option A: Deploy button.** This copies the Worker into a new repository in your GitHub account and deploys it to your Cloudflare account.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/tree/main/worker)

When asked, set `GITHUB_REPO` to your wiki repository (for example `your-name/my-wiki`), and fill in the two secrets from step 4.

**Option B: Command line.** Needs [Node.js](https://nodejs.org) 20 or later.

```bash
git clone https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver.git
```

```bash
cd tiddlywiki-cloudflare-saver/worker
```

Edit `wrangler.jsonc` and set `GITHUB_REPO` to your wiki repository, then deploy:

```bash
npm install
```

```bash
npx wrangler deploy
```

The first deploy asks you to log in to Cloudflare and prints your Worker's address, such as `https://tiddlywiki.your-name.workers.dev`.

### 4. Add the secrets

The Worker needs two secrets. Set them in the Cloudflare dashboard (Workers & Pages > your Worker > Settings > Variables and Secrets, type **Secret**), or from the `worker` folder:

```bash
npx wrangler secret put GITHUB_TOKEN
```

```bash
npx wrangler secret put WIKI_PASSWORD
```

- `GITHUB_TOKEN`: the token from step 2.
- `WIKI_PASSWORD`: the password you will sign in with. At least 12 characters; a long passphrase is best.

### 5. Upload your wiki

1. Open `https://<your-worker-address>/_saver/` and sign in with your password.
2. The status box should say **GitHub access: OK**. If it doesn't, see [Troubleshooting](#troubleshooting).
3. Under **Upload your wiki**, choose your TiddlyWiki file. Leave **Install or update the saver plugin** ticked.
4. Click **Upload**.

### 6. Use it

Open `https://<your-worker-address>/`. Make a change and click the save button. The first time, you are asked for your password. The change is now a commit in your repository.

Optional: to use your own domain, add it under your Worker > Settings > Domains & Routes. This is free for domains already on Cloudflare.

## Everyday use

**Saving.** Use TiddlyWiki's save button as usual, or turn on autosave (Control Panel > Saving > General). Autosaves wait at least 15 seconds after the previous save; clicking save is never delayed. A change made while a save is uploading stays marked as unsaved, so it is never lost.

**Signing in.** You are asked for the password the first time you save in a browser. The session lasts `SESSION_DAYS` (30 by default). Autosave never interrupts you with a password prompt; it shows a notice instead. To sign out, use Control Panel > Saving > Cloudflare Saver, or the `/_saver/` page. Changing `WIKI_PASSWORD` signs out every browser.

**Editing on more than one device.** If the wiki was saved somewhere else after you opened it, saving shows a dialog:

- **Overwrite with this version** replaces the other version. It stays in the GitHub history.
- **Download a copy** saves your version to your computer, so you can reload and merge by hand.
- **Cancel** leaves everything as it is. Your changes stay unsaved in the page.

**History and restoring.** Every save is a commit. The `/_saver/` page links to the file's history on GitHub. To restore an old version, download it from GitHub (open the commit, view the file, Download raw file) and upload it on the `/_saver/` page.

**Private wikis.** Set `READ_ACCESS` to `private` and redeploy. Visitors are sent to the sign-in page before they see anything.

**Plugin settings.** Control Panel > Saving > Cloudflare Saver shows whether you are signed in, the last save with a link to its commit, and a **Check connection** button that verifies the token, the repository and whether this copy is up to date. You can also change the autosave gap, turn the saver off, or turn on console logging there.

## Settings

Variables go in `worker/wrangler.jsonc` (under `vars`). Keep them there rather than in the dashboard, because a deploy resets dashboard variables to the file's values. Secrets are never stored in the file and are not changed by deploys.

| Name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Secret | (required) | Fine-grained token with Contents: Read and write on the wiki repository. |
| `WIKI_PASSWORD` | Secret | (required) | Password for signing in. At least 12 characters. |
| `GITHUB_REPO` | Variable | (required) | Wiki repository, as `owner/repo`. |
| `GITHUB_BRANCH` | Variable | repository default | Branch to read and write. |
| `WIKI_PATH` | Variable | `index.html` | Path of the wiki file in the repository, such as `wiki/index.html`. |
| `READ_ACCESS` | Variable | `public` | `public`: anyone with the link can view. `private`: sign-in needed to view. |
| `SESSION_DAYS` | Variable | `30` | How long a sign-in lasts. |
| `COMMIT_MESSAGE` | Variable | `Update wiki` | Commit message. Autosaves add ` (autosave)`. |
| `MAX_WIKI_MB` | Variable | `50` | Largest wiki accepted, in MB. At most 74. |
| `GITHUB_API_URL` | Variable | `https://api.github.com` | Only change this for GitHub Enterprise Server. |

### Addresses served by the Worker

| Path | What it is |
| --- | --- |
| `/` | The wiki. |
| `/_saver/` | Sign-in, status, upload and history link. |
| `/_saver/plugin.json`, `/_saver/plugin.tid` | The plugin, for installing by hand. |
| `/_saver/api/...` | The API used by the plugin and the status page. |

## Updating

1. Get the new Worker code. With the deploy button, pull this repository's `worker` folder into the repository it created for you; Cloudflare redeploys when you push. With the command line, `git pull` and run `npx wrangler deploy` in `worker`.
2. Open your wiki. Control Panel > Saving > Cloudflare Saver offers **Update and reload** when the Worker has a newer plugin. Click it; the wiki saves itself with the new plugin and reloads.

## Upgrading from version 1

Version 2 replaces the Cloudflare Pages Function with a Worker that serves the wiki itself. Old setups need these steps:

1. **Stop Pages from rebuilding on every save.** In the Cloudflare dashboard, open your Pages project and either delete it or disconnect its Git repository. Otherwise each save still triggers a Pages build.
2. **Deploy the Worker** as in [Setup](#setup) steps 3 and 4, pointing `GITHUB_REPO` at your existing wiki repository. Some names changed:
   - `SAVE_PASSWORD` is now `WIKI_PASSWORD` (12 characters minimum).
   - `FILE_PATH` is now `WIKI_PATH`.
   - `ALLOWED_ORIGINS` and `MAX_CONTENT_SIZE` are gone. There is no cross-origin access any more; use `MAX_WIKI_MB` for the size limit.
3. **Replace the plugin.** Open `/_saver/`, sign in, and upload your current wiki file (download it from your repository first) with **Install or update the saver plugin** ticked.
4. Open the wiki from the Worker's address. Old settings and statistics from version 1 are removed automatically and disappear with your next save.
5. You can delete `functions/save.js` from the wiki repository.

Saving from a wiki opened as a local file (`file://`) or hosted elsewhere is no longer supported; open it from the Worker's address instead.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `/_saver/` says **Setup needed** | A secret or variable is missing or invalid. The page lists which. Fix it and reload. |
| **GitHub access: Problem: Bad credentials** | The token is wrong, expired or revoked. Create a new one and update `GITHUB_TOKEN`. |
| **Repository or branch not found** | Check `GITHUB_REPO` and `GITHUB_BRANCH`, and that the token was given access to that repository. |
| **Read only: token cannot push** | Give the token **Contents: Read and write**. |
| **Too many failed sign-in attempts** | Wait for the time shown (15 minutes per address, up to an hour after many failures anywhere). Browsers that are already signed in keep working. |
| Saving says the wiki **was changed somewhere else**, but you didn't change it | Another tab or device saved it. See [Editing on more than one device](#everyday-use). |
| The save button does nothing special and the plugin settings say the wiki was **not loaded from a Cloudflare Saver Worker** | You opened the wiki some other way. Use the Worker's address. |
| **The wiki is about N MB, over the limit** | Raise `MAX_WIKI_MB` (up to 74), or move large images out of the wiki. |
| **GitHub rate limit reached** | Wait a few minutes. This only happens with very heavy use. |
| Anything else | Turn on "Log details to the browser console" in the plugin settings and check the browser console, and the Worker's logs in the Cloudflare dashboard. |

## Limitations

- Needs TiddlyWiki 5.3 or later, as a single HTML file.
- Saving only works from the Worker's own address.
- The upload page cannot add the plugin to an encrypted wiki. For an encrypted wiki: upload it without the plugin box ticked, open it from the Worker, drag in `/_saver/plugin.tid`, download the wiki, and upload that file.
- Each save stores the whole file as a commit. Git compresses well, but a very large wiki saved very often will grow the repository over time.

## Development

```bash
npm ci
```

```bash
npm test
```

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the plugin from `plugin/` into `dist/` and `worker/src/generated/plugin.js`. Commit the generated file. |
| `npm run check` | Lint, check the generated file is current, run unit tests. |
| `npm run test:e2e` | Runs the Worker in `wrangler dev` against a fake GitHub and drives a real TiddlyWiki in Chromium. Run `npm ci` in `worker/` first. |
| `npx wrangler dev` (in `worker/`) | Runs the Worker locally. Put secrets in `worker/.dev.vars` (see `.dev.vars.example`). |

```
plugin/      TiddlyWiki plugin source (saver, dialogs, settings UI)
worker/      Cloudflare Worker (deployable on its own)
scripts/     Build script
test/        Unit tests, fake GitHub, end-to-end test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details and [SECURITY.md](SECURITY.md) for the security model.

## License

MIT. See [LICENSE](LICENSE).
