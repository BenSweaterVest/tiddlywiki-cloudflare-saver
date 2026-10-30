# TiddlyWiki Cloudflare Saver: Worker

This folder is the Cloudflare Worker for [TiddlyWiki Cloudflare Saver](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver). It serves a single-file TiddlyWiki from a GitHub repository and commits every save back to it. It runs on the Workers Free plan.

## Configure

1. Set `GITHUB_REPO` (and any other settings you want) under `vars` in `wrangler.jsonc`.
2. Add two secrets, in the Cloudflare dashboard (Worker > Settings > Variables and Secrets) or with Wrangler:

```bash
npx wrangler secret put GITHUB_TOKEN
```

```bash
npx wrangler secret put WIKI_PASSWORD
```

3. Deploy:

```bash
npx wrangler deploy
```

4. Open `https://<your-worker-address>/_saver/`, sign in, and upload your wiki.

The full guide, settings reference and troubleshooting are in the [main README](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver#readme).

`src/generated/plugin.js` is built from the main repository's `plugin/` folder. Don't edit it here.
