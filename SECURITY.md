# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. Do NOT Open a Public Issue

Please do not create a public GitHub issue for security vulnerabilities, as this could put users at risk.

### 2. Report Privately

Instead, please report security vulnerabilities by:

- **Email**: Create a security advisory on GitHub
  - Go to the [Security tab](https://github.com/BenSweaterVest/tiddlywiki-cloudflare-saver/security)
  - Click "Report a vulnerability"
  - Provide detailed information about the vulnerability

Or open a private issue in the repository's security tab.

### 3. Include These Details

When reporting a vulnerability, please include:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Affected versions** (if known)

### 4. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: Within 7 days
  - High: Within 14 days
  - Medium: Within 30 days
  - Low: Next regular release

## Security Best Practices

### For Plugin Users

1. **Protect Your Credentials**
   - Never commit `.env` files or expose `SAVE_PASSWORD` or `GITHUB_TOKEN`
   - Use GitHub's encrypted secrets for environment variables
   - Rotate tokens regularly

2. **Use Fine-Grained Tokens**
   - Prefer GitHub fine-grained personal access tokens over classic tokens
   - Grant only necessary permissions (Contents: read/write)
   - Set expiration dates on tokens

3. **Configure CORS Properly**
   - Don't use wildcard (`*`) for `ALLOWED_ORIGINS` in production
   - Specify exact origins: `https://your-site.pages.dev`
   - Review allowed origins regularly

4. **Keep Dependencies Updated**
   - Update the plugin when new versions are released
   - Monitor security advisories for Cloudflare and GitHub APIs

### For Contributors

1. **Code Review**
   - All PRs require review before merging
   - Security-related changes get extra scrutiny

2. **Dependency Management**
   - Keep npm dependencies up to date
   - Run `npm audit` before releasing
   - Address high/critical vulnerabilities immediately

3. **Secrets in Tests**
   - Never commit real credentials in test files
   - Use mocks and fixtures for testing

## Known Security Considerations

### Password Authentication

The plugin uses password-based authentication for saves. While this is simple and effective for personal wikis:

- **Passwords are transmitted over HTTPS** to the Cloudflare Function
- **Passwords are compared as plain strings** (not cryptographic hashes)
- **Rate limiting** prevents brute force attacks (30 requests/minute)

This is acceptable for this use case because:
- The password is stored as a Cloudflare environment secret
- TLS encryption protects in-transit data
- Rate limiting adds protection
- This is for personal wikis, not high-security applications

For higher security needs, consider:
- Using GitHub OAuth instead of password auth
- Implementing additional authentication layers
- Using Cloudflare Access for additional protection

### GitHub Token Storage

- **GITHUB_TOKEN** is stored as a Cloudflare environment variable (encrypted at rest)
- The token has write access to your repository
- If compromised, an attacker could modify repository content

**Mitigation**:
- Use fine-grained tokens with minimal scope
- Monitor repository activity for unauthorized commits
- Rotate tokens if compromise is suspected

### CORS Configuration

Default CORS setting allows all origins (`*`). For production:

```bash
ALLOWED_ORIGINS=https://your-site.pages.dev
```

This prevents other sites from using your save function.

## Disclosure Policy

- We will acknowledge security researchers in release notes (unless they prefer to remain anonymous)
- We follow responsible disclosure practices
- We will coordinate disclosure timing with reporters

## Security Updates

Security updates will be:
- Released as patch versions (e.g., 1.1.1)
- Documented in CHANGELOG.md
- Announced in GitHub releases
- Tagged with "security" label

## Questions?

If you have questions about this security policy, please open a discussion in the GitHub repository.

Thank you for helping keep TiddlyWiki Cloudflare Saver secure!
