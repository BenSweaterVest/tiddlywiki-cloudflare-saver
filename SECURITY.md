# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| 1.x     | No. Version 1 sent the password with every save, compared it in a way that leaked timing, and had a rate limit that only applied within one server instance. Please upgrade. |

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting instead: go to the [Security tab](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/security) and click **Report a vulnerability**.

Include what you found, how to reproduce it, the impact you expect, and the affected version. You should get a first response within a week. Fixes are released as patch versions and noted in the [changelog](CHANGELOG.md).

## Security model

This project is meant for personal wikis: one owner, one password.

### What protects what

| Asset | Protection |
| --- | --- |
| GitHub token | Stored only as a Worker secret. It never reaches the browser and is never logged. Use a fine-grained token limited to the wiki repository with **Contents: Read and write** only. |
| Wiki password | Stored only as a Worker secret. Sent once, at sign-in, over HTTPS. Compared by hashing both sides with SHA-256 and comparing the digests in constant time. Must be at least 12 characters. |
| Session | An HMAC-SHA256 signed token with an expiry, in a `__Host-` cookie marked `Secure`, `HttpOnly` and `SameSite=Lax`. Page scripts cannot read it. The signing key is derived from the password, so changing the password ends every session. |
| Saves and sign-in | Every state-changing request must carry a custom `X-Saver-Request` header. Browsers will not send that header from another site without a CORS preflight, and the Worker never approves preflights. Requests with a foreign `Origin` header are also refused. |
| Password guessing | Failed sign-ins are counted in a Durable Object shared by every Cloudflare location: 5 failures per IP address locks that address for 15 minutes, and 50 failures in an hour locks sign-in for everyone for up to an hour. Signed-in browsers keep working during a lockout. |
| Overwrites | Saves name the version they were based on. GitHub refuses the commit if the file changed since, and the user decides what to do. Every version stays in the Git history. |
| Private wikis | With `READ_ACCESS=private`, the wiki is only served to signed-in browsers, with `Cache-Control: private`. |

### Things to be aware of

- **A public wiki is public.** With `READ_ACCESS=public` (the default) anyone who knows the address can read the whole wiki, including tiddlers you consider hidden. A private GitHub repository does not change this.
- **The repository holds everything.** Anyone with access to the GitHub repository can read the wiki and its full history. Deleting a tiddler does not remove it from old commits.
- **The wiki page has no Content Security Policy.** TiddlyWiki needs inline scripts and `eval`, and plugins you install run with full access to the page. Only install plugins you trust. The Worker's own `/_saver/` page does use a strict policy.
- **A signed-in browser can save anything.** Sign out on shared computers. Sessions last `SESSION_DAYS` (30 by default).
- **Lockouts can be triggered by others.** Someone who keeps guessing can stop new sign-ins for up to an hour. Existing sessions are not affected.
- **Free plan limits are a ceiling, not a bill.** If someone floods the Worker past the free daily request allowance, it stops answering until the next day. You are not charged.
- **Token expiry.** Fine-grained tokens expire. The `/_saver/` page and the plugin's **Check connection** show the expiry date. Replace the token before then.

### If something leaks

- **Token:** revoke it on GitHub, create a new one, and update the `GITHUB_TOKEN` secret. Check the repository history for commits you did not make.
- **Password:** change the `WIKI_PASSWORD` secret. Every existing session stops working immediately.

## For contributors

- Never commit real tokens or passwords, including in tests. Use the fake GitHub in `test/helpers/`.
- Any change to authentication, sessions or request handling needs tests in `test/worker.test.mjs`.
- Keep dependencies current; Dependabot opens update PRs weekly.
