/**
 * Minimal GitHub REST client for reading and writing one file.
 *
 * Everything here streams: the wiki body is never parsed, decoded or
 * re-encoded inside the Worker, which keeps CPU time per request tiny and
 * well inside the Workers Free plan's 10 ms budget.
 */

export class GitHubError extends Error {
  /**
   * @param {string} kind - auth | forbidden | rate_limited | not_found | conflict | unavailable | rejected | network
   */
  constructor(kind, status, message) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function errorFrom(response) {
  let message = `GitHub responded with HTTP ${response.status}`;
  try {
    const data = await response.json();
    if (data && data.message) {
      message = data.message;
    }
  } catch (_e) {
    // Body was not JSON; keep the generic message.
  }
  const status = response.status;
  let kind = 'rejected';
  if (status === 401) {
    kind = 'auth';
  } else if (status === 404) {
    kind = 'not_found';
  } else if (status === 409 || (status === 422 && /\bsha\b/i.test(message))) {
    kind = 'conflict';
  } else if (status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    kind = 'rate_limited';
  } else if (status === 403) {
    kind = 'forbidden';
  } else if (status >= 500) {
    kind = 'unavailable';
  }
  return new GitHubError(kind, status, message);
}

/**
 * Concatenate prefix + body stream + suffix into a stream of known length.
 * On Workers this uses FixedLengthStream so GitHub receives a normal
 * Content-Length upload. Elsewhere (tests, Node) it falls back to a plain
 * ReadableStream.
 */
export function framedStream(prefix, body, bodyLength, suffix) {
  const head = new TextEncoder().encode(prefix);
  const tail = new TextEncoder().encode(suffix);
  const total = head.length + bodyLength + tail.length;

  if (typeof FixedLengthStream === 'function') {
    const { readable, writable } = new FixedLengthStream(total);
    (async () => {
      let writer = writable.getWriter();
      await writer.write(head);
      writer.releaseLock();
      await body.pipeTo(writable, { preventClose: true });
      writer = writable.getWriter();
      await writer.write(tail);
      await writer.close();
    })().catch(error => writable.abort(error).catch(() => {}));
    return { stream: readable, length: total };
  }

  const reader = body.getReader();
  let stage = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (stage === 0) {
        stage = 1;
        controller.enqueue(head);
        return;
      }
      if (stage === 1) {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(value);
          return;
        }
        stage = 2;
        controller.enqueue(tail);
        return;
      }
      controller.close();
    }
  });
  return { stream, length: total };
}

export class GitHub {
  constructor(config, fetchImpl = (...args) => fetch(...args)) {
    this.config = config;
    this.fetch = fetchImpl;
    this.etagCache = new Map();
  }

  headers(extra = {}) {
    return {
      'Authorization': `Bearer ${this.config.githubToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tiddlywiki-cloudflare-saver',
      ...extra
    };
  }

  async request(path, init = {}) {
    try {
      return await this.fetch(`${this.config.apiUrl}${path}`, { ...init, headers: this.headers(init.headers) });
    } catch (error) {
      throw new GitHubError('network', 0, `Could not reach GitHub: ${error.message}`);
    }
  }

  refQuery() {
    return this.config.branch ? `?ref=${encodeURIComponent(this.config.branch)}` : '';
  }

  /**
   * Look up the wiki file's blob SHA and size without downloading it, by
   * listing its parent directory. Uses ETags so repeat lookups that find no
   * change return 304 and do not count against GitHub's rate limit.
   * @returns {Promise<{exists: boolean, sha?: string, size?: number}>}
   */
  async getWikiInfo() {
    const path = this.config.wikiPath;
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = path.slice(slash + 1);
    const url = `/repos/${this.config.repo}/contents/${encodePath(dir)}${this.refQuery()}`;

    const cached = this.etagCache.get(url);
    const response = await this.request(url, {
      headers: cached ? { 'If-None-Match': cached.etag } : {}
    });

    let entries;
    if (response.status === 304 && cached) {
      entries = cached.entries;
    } else if (response.status === 404) {
      // Missing directory, missing branch or empty repository: no wiki yet.
      return { exists: false };
    } else if (!response.ok) {
      throw await errorFrom(response);
    } else {
      const data = await response.json();
      entries = (Array.isArray(data) ? data : [data])
        .filter(entry => entry && entry.type === 'file')
        .map(entry => ({ name: entry.name, sha: entry.sha, size: entry.size }));
      const etag = response.headers.get('etag');
      if (etag) {
        this.etagCache.set(url, { etag, entries });
      }
    }

    const match = entries.find(entry => entry.name === name);
    return match ? { exists: true, sha: match.sha, size: match.size } : { exists: false };
  }

  /**
   * Stream a blob's raw bytes. Blobs are addressed by SHA, so the result is
   * always exactly the version getWikiInfo() reported. Supports up to 100 MB.
   * @returns {Promise<Response>}
   */
  async getBlob(sha) {
    const response = await this.request(`/repos/${this.config.repo}/git/blobs/${encodeURIComponent(sha)}`, {
      headers: { 'Accept': 'application/vnd.github.raw+json' }
    });
    if (!response.ok) {
      throw await errorFrom(response);
    }
    return response;
  }

  /**
   * Commit new wiki content.
   * @param {object} options
   * @param {ReadableStream} options.body - base64-encoded file content
   * @param {number} options.length - byte length of options.body
   * @param {string|null} options.parentSha - blob SHA the edit was based on, or null to create
   * @param {string} options.message - commit message
   * @returns {Promise<{sha: string, commit: string, commitUrl: string}>}
   */
  async putWiki({ body, length, parentSha, message }) {
    const fields = [`"message":${JSON.stringify(message)}`];
    if (this.config.branch) {
      fields.push(`"branch":${JSON.stringify(this.config.branch)}`);
    }
    if (parentSha) {
      fields.push(`"sha":${JSON.stringify(parentSha)}`);
    }
    const framed = framedStream(`{${fields.join(',')},"content":"`, body, length, '"}');

    const init = {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: framed.stream
    };
    if (typeof FixedLengthStream !== 'function') {
      init.duplex = 'half';
    }
    const response = await this.request(`/repos/${this.config.repo}/contents/${encodePath(this.config.wikiPath)}`, init);
    if (!response.ok) {
      throw await errorFrom(response);
    }
    this.etagCache.clear();
    const data = await response.json();
    return {
      sha: data.content.sha,
      commit: data.commit.sha,
      commitUrl: data.commit.html_url
    };
  }

  /**
   * Repository details plus token metadata, for diagnostics.
   */
  async getRepoStatus() {
    const response = await this.request(`/repos/${this.config.repo}`);
    const meta = {
      tokenExpires: response.headers.get('github-authentication-token-expiration') || null,
      rateLimitRemaining: Number(response.headers.get('x-ratelimit-remaining')) || null
    };
    if (!response.ok) {
      const error = await errorFrom(response);
      return { ok: false, error: error.kind, message: error.message, ...meta };
    }
    const repo = await response.json();
    return {
      ok: true,
      fullName: repo.full_name,
      private: repo.private,
      htmlUrl: repo.html_url,
      defaultBranch: repo.default_branch,
      canPush: repo.permissions ? Boolean(repo.permissions.push) : null,
      ...meta
    };
  }
}
