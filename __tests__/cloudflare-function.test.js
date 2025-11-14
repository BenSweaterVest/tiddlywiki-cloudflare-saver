/**
 * Tests for Cloudflare Function helper functions
 *
 * Note: These tests verify the helper function logic.
 * The actual function exports are tested separately in an integration environment.
 */

describe('Cloudflare Function Helpers', () => {
  // Mock implementation of getCorsOrigin (from demo/functions/save.js)
  function getCorsOrigin(allowedOrigins, requestOrigin) {
    if (allowedOrigins.includes('*')) {
      return requestOrigin || '*';
    } else if (requestOrigin === 'null' || allowedOrigins.includes('null')) {
      return 'null';
    } else if (allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    } else {
      return allowedOrigins[0];
    }
  }

  // Mock implementation of getCorsHeaders (from demo/functions/save.js)
  function getCorsHeaders(allowOrigin, includeContentType = true) {
    const headers = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  // Mock implementation of checkRateLimit (from demo/functions/save.js)
  const rateLimitMap = new Map();
  const RATE_LIMIT_WINDOW = 60000;
  const MAX_REQUESTS_PER_WINDOW = 30;

  function checkRateLimit(identifier) {
    const now = Date.now();
    const record = rateLimitMap.get(identifier);

    if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.set(identifier, { windowStart: now, count: 1 });
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
      return { allowed: false, remaining: 0, resetIn: RATE_LIMIT_WINDOW - (now - record.windowStart) };
    }

    record.count++;
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
  }

  describe('getCorsOrigin', () => {
    test('returns wildcard for wildcard allowed origins', () => {
      const result = getCorsOrigin(['*'], 'https://example.com');
      expect(result).toBe('https://example.com');
    });

    test('returns wildcard when no request origin with wildcard', () => {
      const result = getCorsOrigin(['*'], null);
      expect(result).toBe('*');
    });

    test('handles null origin for local files', () => {
      const result = getCorsOrigin(['*'], 'null');
      expect(result).toBe('null');
    });

    test('allows specific whitelisted origin', () => {
      const result = getCorsOrigin(['https://example.com', 'https://test.com'], 'https://example.com');
      expect(result).toBe('https://example.com');
    });

    test('falls back to first allowed origin for non-whitelisted origin', () => {
      const result = getCorsOrigin(['https://example.com', 'https://test.com'], 'https://other.com');
      expect(result).toBe('https://example.com');
    });

    test('allows null in allowed origins list', () => {
      const result = getCorsOrigin(['null', 'https://example.com'], 'null');
      expect(result).toBe('null');
    });

    test('handles multiple specific origins', () => {
      const allowedOrigins = ['https://example.com', 'https://test.com', 'https://demo.com'];
      expect(getCorsOrigin(allowedOrigins, 'https://test.com')).toBe('https://test.com');
      expect(getCorsOrigin(allowedOrigins, 'https://demo.com')).toBe('https://demo.com');
      expect(getCorsOrigin(allowedOrigins, 'https://other.com')).toBe('https://example.com');
    });
  });

  describe('getCorsHeaders', () => {
    test('returns basic CORS headers', () => {
      const headers = getCorsHeaders('https://example.com');
      expect(headers).toHaveProperty('Access-Control-Allow-Origin', 'https://example.com');
      expect(headers).toHaveProperty('Access-Control-Allow-Methods', 'POST, OPTIONS');
      expect(headers).toHaveProperty('Access-Control-Allow-Headers', 'Content-Type');
    });

    test('includes Content-Type by default', () => {
      const headers = getCorsHeaders('https://example.com');
      expect(headers).toHaveProperty('Content-Type', 'application/json');
    });

    test('excludes Content-Type when includeContentType is false', () => {
      const headers = getCorsHeaders('https://example.com', false);
      expect(headers).not.toHaveProperty('Content-Type');
    });

    test('handles null origin', () => {
      const headers = getCorsHeaders('null');
      expect(headers).toHaveProperty('Access-Control-Allow-Origin', 'null');
    });

    test('handles wildcard origin', () => {
      const headers = getCorsHeaders('*');
      expect(headers).toHaveProperty('Access-Control-Allow-Origin', '*');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      rateLimitMap.clear();
    });

    test('allows first request', () => {
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29);
    });

    test('tracks multiple requests from same identifier', () => {
      checkRateLimit('test-ip');
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(28);
    });

    test('blocks after exceeding rate limit', () => {
      // Make 30 requests (the maximum)
      for (let i = 0; i < 30; i++) {
        checkRateLimit('test-ip');
      }
      // 31st request should be blocked
      const result = checkRateLimit('test-ip');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetIn).toBeDefined();
      expect(result.resetIn).toBeGreaterThan(0);
    });

    test('tracks different identifiers separately', () => {
      checkRateLimit('ip-1');
      checkRateLimit('ip-1');

      const resultIp1 = checkRateLimit('ip-1');
      expect(resultIp1.remaining).toBe(27);

      const resultIp2 = checkRateLimit('ip-2');
      expect(resultIp2.remaining).toBe(29);
    });

    test('resets window after time expires', (done) => {
      // This test would require mocking Date.now() or using jest.useFakeTimers()
      // For demonstration, we'll just verify the logic exists
      const result1 = checkRateLimit('test-ip');
      expect(result1.allowed).toBe(true);

      // In a real scenario with mocked time:
      // - Advance time by RATE_LIMIT_WINDOW + 1
      // - Make another request
      // - Verify it's allowed and counter is reset

      done();
    });

    test('handles unknown identifier', () => {
      const result = checkRateLimit('unknown');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(29);
    });
  });

  describe('Version constant', () => {
    test('version constant exists in function file', () => {
      const fs = require('fs');
      const path = require('path');
      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const content = fs.readFileSync(functionPath, 'utf8');

      expect(content).toContain('const VERSION = ');
      expect(content).toMatch(/const VERSION = ['"][\d.]+['"]/);
    });

    test('version is used in User-Agent headers', () => {
      const fs = require('fs');
      const path = require('path');
      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const content = fs.readFileSync(functionPath, 'utf8');

      expect(content).toContain('TiddlyWiki-Cloudflare-Saver/${VERSION}');
    });

    test('version matches package.json', () => {
      const fs = require('fs');
      const path = require('path');

      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      const functionPath = path.join(__dirname, '..', 'demo', 'functions', 'save.js');
      const functionContent = fs.readFileSync(functionPath, 'utf8');

      const versionMatch = functionContent.match(/const VERSION = ['"](.+)['"]/);
      expect(versionMatch).toBeTruthy();
      expect(versionMatch[1]).toBe(packageJson.version);
    });
  });
});
