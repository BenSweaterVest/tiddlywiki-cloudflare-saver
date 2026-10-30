/**
 * Reads and validates the Worker's environment.
 *
 * Required secrets: GITHUB_TOKEN, WIKI_PASSWORD
 * Required variable: GITHUB_REPO ("owner/repo")
 * Optional variables: GITHUB_BRANCH, WIKI_PATH, READ_ACCESS, SESSION_DAYS,
 *                     COMMIT_MESSAGE, MAX_WIKI_MB, GITHUB_API_URL
 */

// Workers on the free plan accept request bodies up to 100 MB. The wiki is
// sent base64-encoded (4/3 larger), so ~74 MB of HTML is the real ceiling.
export const HARD_MAX_WIKI_MB = 74;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export class ConfigError extends Error {
  constructor(problems) {
    super(`Worker is not configured: ${problems.join('; ')}`);
    this.problems = problems;
  }
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveNumber(value, fallback) {
  const n = Number(str(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Normalise a repository file path. Rejects empty segments and "..".
 * @returns {string|null} the cleaned path, or null if it is unsafe
 */
export function cleanPath(path) {
  const segments = str(path).replace(/^\/+|\/+$/g, '').split('/');
  if (segments.some(s => s === '' || s === '.' || s === '..')) {
    return null;
  }
  return segments.join('/');
}

/**
 * @param {object} env - Worker environment bindings
 * @returns {object} frozen config
 * @throws {ConfigError} when required values are missing or invalid
 */
export function loadConfig(env = {}) {
  const problems = [];

  const githubToken = str(env.GITHUB_TOKEN);
  const password = typeof env.WIKI_PASSWORD === 'string' ? env.WIKI_PASSWORD : '';
  const repo = str(env.GITHUB_REPO);
  const wikiPath = cleanPath(env.WIKI_PATH || 'index.html');
  const readAccess = (str(env.READ_ACCESS) || 'public').toLowerCase();
  const apiUrl = (str(env.GITHUB_API_URL) || 'https://api.github.com').replace(/\/+$/, '');

  if (!githubToken) {
    problems.push('GITHUB_TOKEN secret is missing');
  }
  if (!password) {
    problems.push('WIKI_PASSWORD secret is missing');
  } else if (password.length < 12) {
    problems.push('WIKI_PASSWORD must be at least 12 characters');
  }
  if (!repo) {
    problems.push('GITHUB_REPO variable is missing');
  } else if (!REPO_PATTERN.test(repo)) {
    problems.push('GITHUB_REPO must look like "owner/repo"');
  }
  if (!wikiPath) {
    problems.push('WIKI_PATH is not a valid file path');
  }
  if (readAccess !== 'public' && readAccess !== 'private') {
    problems.push('READ_ACCESS must be "public" or "private"');
  }

  if (!/^https:\/\/[^/]+/.test(apiUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(apiUrl)) {
    problems.push('GITHUB_API_URL must be an https:// URL');
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  const maxWikiMb = Math.min(positiveNumber(env.MAX_WIKI_MB, 50), HARD_MAX_WIKI_MB);

  return Object.freeze({
    githubToken,
    password,
    repo,
    branch: str(env.GITHUB_BRANCH),
    apiUrl,
    wikiPath,
    readAccess,
    sessionSeconds: Math.round(positiveNumber(env.SESSION_DAYS, 30) * 86400),
    commitMessage: str(env.COMMIT_MESSAGE) || 'Update wiki',
    maxWikiBytes: Math.floor(maxWikiMb * 1024 * 1024)
  });
}
