/**
 * Password checks and signed session cookies.
 *
 * A session token is "v1.<expiry>.<nonce>.<signature>", where the signature is
 * an HMAC-SHA256 over the first three parts. The HMAC key is derived from
 * WIKI_PASSWORD, so changing the password signs everyone out.
 */

export const COOKIE_NAME = '__Host-saver-session';

const encoder = new TextEncoder();
const keyCache = new Map();

function base64url(bytes) {
  let binary = '';
  for (const b of new Uint8Array(bytes)) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/**
 * Compare a submitted password with the configured one without leaking
 * timing information about where they differ. Both sides are hashed first so
 * the comparison always covers 32 bytes regardless of input length.
 */
export async function passwordMatches(submitted, expected) {
  if (typeof submitted !== 'string' || submitted.length === 0 || submitted.length > 1024) {
    return false;
  }
  const [a, b] = await Promise.all([sha256(submitted), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function signingKey(password) {
  let key = keyCache.get(password);
  if (!key) {
    const raw = await sha256(`tiddlywiki-cloudflare-saver/session/v1\n${password}`);
    key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keyCache.clear();
    keyCache.set(password, key);
  }
  return key;
}

export async function createSession(password, lifetimeSeconds, now = Date.now()) {
  const expiry = Math.floor(now / 1000) + lifetimeSeconds;
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const body = `v1.${expiry}.${nonce}`;
  const signature = await crypto.subtle.sign('HMAC', await signingKey(password), encoder.encode(body));
  return `${body}.${base64url(signature)}`;
}

export async function verifySession(token, password, now = Date.now()) {
  if (typeof token !== 'string') {
    return false;
  }
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return false;
  }
  const expiry = Number(parts[1]);
  if (!Number.isInteger(expiry) || expiry <= Math.floor(now / 1000)) {
    return false;
  }
  let signature;
  try {
    signature = fromBase64url(parts[3]);
  } catch (_e) {
    return false;
  }
  const body = parts.slice(0, 3).join('.');
  return crypto.subtle.verify('HMAC', await signingKey(password), signature, encoder.encode(body));
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim();
    }
  }
  return null;
}

/**
 * SameSite=Lax (not Strict) so that following a link to a private wiki from
 * another site still sends the cookie. State-changing requests are protected
 * separately by requireSameOrigin().
 */
export function sessionCookie(token, maxAgeSeconds) {
  return `${COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearedSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function isSignedIn(request, config) {
  return verifySession(readCookie(request), config.password);
}

/**
 * Guard for state-changing requests. Browsers never let another site send a
 * custom header without a CORS preflight, and this Worker never answers
 * preflights, so requiring X-Saver-Request blocks cross-site requests. The
 * Origin check is a second layer for browsers that send it.
 */
export function requireSameOrigin(request) {
  if (request.headers.get('X-Saver-Request') !== '1') {
    return false;
  }
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}
