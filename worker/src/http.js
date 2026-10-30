/**
 * Response helpers shared by the router and pages.
 */

export const SECURITY_HEADERS = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'SAMEORIGIN'
});

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers
    }
  });
}

/**
 * JSON error body: { error: <machine-readable code>, message: <human text> }
 */
export function error(status, code, message, headers = {}) {
  return json({ error: code, message }, status, headers);
}

export function html(body, { status = 200, nonce, headers = {} } = {}) {
  const csp = [
    "default-src 'self'",
    nonce ? `script-src 'nonce-${nonce}'` : "script-src 'none'",
    `style-src ${nonce ? `'nonce-${nonce}'` : "'unsafe-inline'"}`,
    "img-src 'self' data:",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ].join('; ');
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': csp,
      ...headers
    }
  });
}

export function redirect(location, status = 302) {
  return new Response(null, { status, headers: { ...SECURITY_HEADERS, Location: location, 'Cache-Control': 'no-store' } });
}

export function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, '');
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Only allow same-site relative redirect targets like "/" or "/#Tiddler".
 */
export function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : '/';
}

export async function readSmallJson(request, maxBytes = 4096) {
  const length = Number(request.headers.get('Content-Length') || '0');
  if (length > maxBytes) {
    return null;
  }
  const text = await request.text();
  if (text.length > maxBytes) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}
