/**
 * In-memory stand-in for the parts of the GitHub REST API the Worker uses.
 * Usable as a fetch function (unit tests) or an HTTP server (end-to-end).
 */

import { createHash } from 'node:crypto';
import http from 'node:http';

export function gitBlobSha(buffer) {
  return createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');
}

export class FakeGitHub {
  constructor({ repo = 'owner/wiki', token = 'test-token', files = {} } = {}) {
    this.repo = repo;
    this.token = token;
    this.files = new Map();
    this.commits = [];
    this.requests = [];
    this.failNext = null;
    for (const [path, content] of Object.entries(files)) {
      this.setFile(path, content);
    }
  }

  setFile(path, content) {
    const buffer = Buffer.from(content);
    const sha = gitBlobSha(buffer);
    this.files.set(path, { sha, buffer });
    return sha;
  }

  getFile(path) {
    const file = this.files.get(path);
    return file ? file.buffer.toString('utf8') : null;
  }

  /** Make the next matching request fail with the given status. */
  failNextRequest(method, status, body = { message: 'Injected failure' }) {
    this.failNext = { method, status, body };
  }

  get fetch() {
    return (input, init) => this.handle(new Request(input, init));
  }

  async handle(request) {
    const url = new URL(request.url);
    this.requests.push({ method: request.method, path: url.pathname + url.search });

    if (request.headers.get('Authorization') !== `Bearer ${this.token}`) {
      return Response.json({ message: 'Bad credentials' }, { status: 401 });
    }
    if (this.failNext && this.failNext.method === request.method) {
      const { status, body } = this.failNext;
      this.failNext = null;
      return Response.json(body, { status });
    }

    const prefix = `/repos/${this.repo}`;
    if (!url.pathname.startsWith(prefix)) {
      return Response.json({ message: 'Not Found' }, { status: 404 });
    }
    const rest = url.pathname.slice(prefix.length);
    const meta = {
      'github-authentication-token-expiration': '2027-01-01 00:00:00 UTC',
      'x-ratelimit-remaining': '4999'
    };

    if (rest === '' && request.method === 'GET') {
      return Response.json({
        full_name: this.repo,
        private: true,
        html_url: `https://github.com/${this.repo}`,
        default_branch: 'main',
        permissions: { push: true }
      }, { headers: meta });
    }

    if (rest.startsWith('/contents') && request.method === 'GET') {
      const dir = decodeURIComponent(rest.slice('/contents'.length).replace(/^\//, ''));
      const entries = [];
      for (const [path, file] of this.files) {
        const slash = path.lastIndexOf('/');
        if ((slash === -1 ? '' : path.slice(0, slash)) === dir) {
          entries.push({ type: 'file', name: path.slice(slash + 1), path, sha: file.sha, size: file.buffer.length });
        }
      }
      if (entries.length === 0) {
        return Response.json({ message: 'This repository is empty.' }, { status: 404 });
      }
      const etag = `"${createHash('sha1').update(JSON.stringify(entries)).digest('hex')}"`;
      if (request.headers.get('If-None-Match') === etag) {
        return new Response(null, { status: 304, headers: { etag } });
      }
      return Response.json(entries, { headers: { etag } });
    }

    if (rest.startsWith('/git/blobs/') && request.method === 'GET') {
      const sha = rest.slice('/git/blobs/'.length);
      const file = [...this.files.values()].find(f => f.sha === sha);
      if (!file) {
        return Response.json({ message: 'Not Found' }, { status: 404 });
      }
      return new Response(file.buffer, { headers: { 'content-length': String(file.buffer.length) } });
    }

    if (rest.startsWith('/contents/') && request.method === 'PUT') {
      const path = decodeURIComponent(rest.slice('/contents/'.length));
      let body;
      try {
        body = JSON.parse(await request.text());
      } catch (_e) {
        return Response.json({ message: 'Problems parsing JSON' }, { status: 400 });
      }
      if (typeof body.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.content)) {
        return Response.json({ message: 'content is not valid Base64' }, { status: 422 });
      }
      const existing = this.files.get(path);
      if (existing && !body.sha) {
        return Response.json({ message: 'Invalid request.\n\n"sha" wasn\'t supplied.' }, { status: 422 });
      }
      if (existing && body.sha !== existing.sha) {
        return Response.json({ message: `${path} does not match ${body.sha}` }, { status: 409 });
      }
      const buffer = Buffer.from(body.content, 'base64');
      const sha = this.setFile(path, buffer);
      const commit = createHash('sha1').update(`commit ${this.commits.length} ${sha}`).digest('hex');
      this.commits.push({ path, sha, commit, message: body.message, branch: body.branch || null });
      return Response.json({
        content: { path, sha },
        commit: { sha: commit, html_url: `https://github.com/${this.repo}/commit/${commit}` }
      }, { status: existing ? 200 : 201 });
    }

    return Response.json({ message: 'Not Found' }, { status: 404 });
  }

  /** Serve over HTTP. Resolves to { url, close }. */
  listen(port = 0) {
    const server = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const init = { method: req.method, headers: req.headers };
      if (chunks.length > 0) {
        init.body = Buffer.concat(chunks);
      }
      const response = await this.handle(new Request(`http://localhost${req.url}`, init));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    });
    return new Promise(resolve => {
      server.listen(port, '127.0.0.1', () => {
        resolve({
          url: `http://127.0.0.1:${server.address().port}`,
          close: () => new Promise(done => server.close(done))
        });
      });
    });
  }
}
