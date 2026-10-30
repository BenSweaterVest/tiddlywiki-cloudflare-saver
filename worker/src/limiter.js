/**
 * Login attempt limiting.
 *
 * Failed logins are counted per client IP and globally. When either limit is
 * reached, further login attempts are refused until the window expires.
 * Existing sessions keep working, so a lockout never stops a signed-in owner
 * from saving.
 *
 * The counts live in a SQLite-backed Durable Object (free on the Workers Free
 * plan) so they are shared by every Cloudflare location. If the binding is
 * missing, a per-isolate in-memory fallback is used, which is much weaker.
 */

export const POLICY = Object.freeze({
  perIp: { max: 5, windowMs: 15 * 60 * 1000 },
  global: { max: 50, windowMs: 60 * 60 * 1000 },
  maxTrackedIps: 2000
});

export function emptyState() {
  return { ips: {}, global: { count: 0, start: 0 } };
}

function active(bucket, windowMs, now) {
  return bucket && now - bucket.start < windowMs ? bucket : null;
}

/**
 * @returns {{allowed: boolean, retryAfter: number}} retryAfter in seconds
 */
export function checkAttempt(state, ip, now, policy = POLICY) {
  const checks = [
    [active(state.ips[ip], policy.perIp.windowMs, now), policy.perIp],
    [active(state.global, policy.global.windowMs, now), policy.global]
  ];
  let retryAfter = 0;
  for (const [bucket, limit] of checks) {
    if (bucket && bucket.count >= limit.max) {
      retryAfter = Math.max(retryAfter, Math.ceil((bucket.start + limit.windowMs - now) / 1000));
    }
  }
  return { allowed: retryAfter === 0, retryAfter };
}

export function recordFailure(state, ip, now, policy = POLICY) {
  const bump = (bucket, windowMs) =>
    active(bucket, windowMs, now) ? { count: bucket.count + 1, start: bucket.start } : { count: 1, start: now };

  state.global = bump(state.global, policy.global.windowMs);
  state.ips[ip] = bump(state.ips[ip], policy.perIp.windowMs);

  // Drop expired entries, then the oldest ones if we are still over the cap.
  for (const [key, bucket] of Object.entries(state.ips)) {
    if (!active(bucket, policy.perIp.windowMs, now)) {
      delete state.ips[key];
    }
  }
  const keys = Object.keys(state.ips);
  if (keys.length > policy.maxTrackedIps) {
    keys.sort((a, b) => state.ips[a].start - state.ips[b].start);
    for (const key of keys.slice(0, keys.length - policy.maxTrackedIps)) {
      delete state.ips[key];
    }
  }
  return state;
}

export function recordSuccess(state, ip) {
  delete state.ips[ip];
  return state;
}

/**
 * Durable Object holding the shared counters. It speaks plain HTTP so it
 * needs no runtime-specific imports.
 */
export class LoginLimiter {
  constructor(ctx, _env) {
    this.storage = ctx.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const ip = url.searchParams.get('ip') || 'unknown';
    const now = Date.now();
    const state = (await this.storage.get('state')) || emptyState();

    let result;
    switch (url.pathname) {
    case '/check':
      result = checkAttempt(state, ip, now);
      break;
    case '/failure':
      await this.storage.put('state', recordFailure(state, ip, now));
      result = { ok: true };
      break;
    case '/success':
      await this.storage.put('state', recordSuccess(state, ip));
      result = { ok: true };
      break;
    default:
      return new Response('Not found', { status: 404 });
    }
    return Response.json(result);
  }
}

const memoryState = emptyState();

/**
 * Small facade used by the router so it does not care which backend is used.
 */
export function createLimiter(env) {
  const namespace = env && env.LOGIN_LIMITER;
  if (namespace && typeof namespace.idFromName === 'function') {
    const stub = namespace.get(namespace.idFromName('global'));
    const call = async (action, ip) => {
      const response = await stub.fetch(`https://limiter/${action}?ip=${encodeURIComponent(ip)}`, { method: 'POST' });
      return response.json();
    };
    return {
      backend: 'durable-object',
      check: ip => call('check', ip),
      failure: ip => call('failure', ip),
      success: ip => call('success', ip)
    };
  }
  return {
    backend: 'memory',
    check: async ip => checkAttempt(memoryState, ip, Date.now()),
    failure: async ip => { recordFailure(memoryState, ip, Date.now()); },
    success: async ip => { recordSuccess(memoryState, ip); }
  };
}
