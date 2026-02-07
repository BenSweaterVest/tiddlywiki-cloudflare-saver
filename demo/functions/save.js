/**
 * Cloudflare Function for TiddlyWiki Saver Plugin
 * Save at: functions/save.js in your Cloudflare Pages repository
 *
 * Required Environment Variables:
 * - GITHUB_TOKEN: GitHub Personal Access Token (required)
 *     Fine-grained token (recommended): starts with github_pat_
 *       Permissions: Contents (read/write), Metadata (read)
 *     Classic token: starts with ghp_
 *       Scope: repo
 * - GITHUB_REPO: Repository in format "owner/repo" (required)
 * - SAVE_PASSWORD: Password for authentication (required)
 * - ALLOWED_ORIGINS: Comma-separated allowed origins (optional, defaults to *)
 * - FILE_PATH: Path to save file (optional, defaults to index.html)
 * - MAX_CONTENT_SIZE: Max content size in bytes (optional, defaults to 50MB)
 */

// Version constant - update when package.json version changes
const VERSION = '1.1.1';

// Simple in-memory rate limiter (resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 requests per minute

function checkRateLimit(identifier) {
  cleanupRateLimitMap(Date.now());
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

function cleanupRateLimitMap(now) {
  if (rateLimitMap.size <= 1000) {
    return;
  }

  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }

  while (rateLimitMap.size > 1000) {
    const oldestKey = rateLimitMap.keys().next().value;
    if (!oldestKey) {
      break;
    }
    rateLimitMap.delete(oldestKey);
  }
}

/**
 * Parse allowed origins from environment variable string
 * @param {string|undefined} allowOriginString - Comma-separated allowed origins
 * @returns {string[]} Array of allowed origins
 */
function parseAllowedOrigins(allowOriginString) {
  if (!allowOriginString || allowOriginString.trim().length === 0) {
    return ['*'];
  }

  const parsed = allowOriginString
    .split(',')
    .map(o => o.trim())
    .filter(o => o.length > 0);

  return parsed.length > 0 ? parsed : ['*'];
}

/**
 * Determine the appropriate CORS origin based on allowed origins and request origin
 * @param {string[]} allowedOrigins - Array of allowed origins
 * @param {string|null} requestOrigin - The origin from the request headers
 * @returns {string} The origin to use in Access-Control-Allow-Origin header
 */
function getCorsOrigin(allowedOrigins, requestOrigin) {
  const fallbackOrigin = allowedOrigins.find(origin => origin !== 'null') || allowedOrigins[0];

  if (requestOrigin === 'null') {
    if (allowedOrigins.includes('*') || allowedOrigins.includes('null')) {
      return 'null';
    }
    return fallbackOrigin;
  }

  if (allowedOrigins.includes('*')) {
    return requestOrigin || '*';
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return fallbackOrigin;
}

/**
 * Get CORS headers for responses
 * @param {string} allowOrigin - The origin to allow
 * @param {boolean} includeContentType - Whether to include Content-Type header
 * @returns {Object} Headers object
 */
function getCorsHeaders(allowOrigin, includeContentType = true) {
  const headers = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

/**
 * Validate ISO 8601 date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid ISO 8601 date
 */
function isValidISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function isBlankContent(content) {
  for (let i = 0; i < content.length; i++) {
    if (!/\s/.test(content[i])) {
      return false;
    }
  }
  return true;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // Get configuration from environment variables with safe fallbacks
  const allowedOrigins = parseAllowedOrigins(env?.ALLOWED_ORIGINS);
  const filePath = env?.FILE_PATH || 'index.html';
  const maxContentSize = parseInt(env?.MAX_CONTENT_SIZE || '52428800'); // 50MB default

  // Determine CORS origin
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = getCorsOrigin(allowedOrigins, requestOrigin);
  const corsHeaders = getCorsHeaders(allowOrigin);

  try {
    // Parse request
    let payload;
    try {
      payload = await request.json();
    } catch (_error) {
      return new Response(JSON.stringify({
        error: 'Invalid JSON payload'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { content, password, timestamp, lastSavedAt } = payload;

    // Rate limiting check
    const clientId = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = checkRateLimit(clientId);

    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        resetIn: Math.ceil(rateCheck.resetIn / 1000)
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': Math.ceil(rateCheck.resetIn / 1000).toString()
        }
      });
    }

    // Validate required fields
    if (typeof content !== 'string' || typeof password !== 'string' || !content || !password) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: content and password'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate content size
    const contentSize = new Blob([content]).size;
    if (contentSize > maxContentSize) {
      return new Response(JSON.stringify({
        error: `Content too large: ${Math.round(contentSize / 1024 / 1024)}MB exceeds ${Math.round(maxContentSize / 1024 / 1024)}MB limit`
      }), {
        status: 413,
        headers: corsHeaders
      });
    }

    // Validate content is not empty
    if (isBlankContent(content)) {
      return new Response(JSON.stringify({
        error: 'Content cannot be empty'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Validate timestamp format if provided
    if (timestamp && !isValidISODate(timestamp)) {
      return new Response(JSON.stringify({
        error: 'Invalid timestamp format. Must be ISO 8601 (e.g., 2025-01-01T12:00:00.000Z)'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    if (lastSavedAt && !isValidISODate(lastSavedAt)) {
      return new Response(JSON.stringify({
        error: 'Invalid lastSavedAt format. Must be ISO 8601.'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Verify password
    if (password !== env.SAVE_PASSWORD) {
      return new Response(JSON.stringify({
        error: 'Invalid password'
      }), {
        status: 401,
        headers: corsHeaders
      });
    }

    // Validate environment variables
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({
        error: 'Server configuration error'
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Attempt to save with retry logic for conflicts
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      try {
        // Get current file info to retrieve SHA
        const currentFileResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`,
          {
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'User-Agent': `TiddlyWiki-Cloudflare-Saver/${VERSION}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        let sha = null;
        if (currentFileResponse.ok) {
          const currentFile = await currentFileResponse.json();
          sha = currentFile.sha;
        } else if (currentFileResponse.status !== 404) {
          // File exists but we got an error (not "not found")
          throw new Error(`Failed to access repository file: ${currentFileResponse.status}`);
        }

        // Optional stale check for multi-device edits
        if (lastSavedAt) {
          try {
            const commitsResponse = await fetch(
              `https://api.github.com/repos/${env.GITHUB_REPO}/commits?path=${encodeURIComponent(filePath)}&per_page=1`,
              {
                headers: {
                  'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                  'User-Agent': `TiddlyWiki-Cloudflare-Saver/${VERSION}`,
                  'Accept': 'application/vnd.github.v3+json'
                }
              }
            );

            if (commitsResponse.ok) {
              const commits = await commitsResponse.json();
              const latestCommitTime = commits?.[0]?.commit?.committer?.date;
              const latestCommitSha = commits?.[0]?.sha;

              if (latestCommitTime) {
                const clientTime = new Date(lastSavedAt).getTime();
                const serverTime = new Date(latestCommitTime).getTime();

                if (!isNaN(clientTime) && !isNaN(serverTime) && serverTime > clientTime + 1000) {
                  return new Response(JSON.stringify({
                    error: 'Stale wiki detected. Please refresh before saving.',
                    stale: true,
                    serverCommitTime: latestCommitTime,
                    serverCommitSha: latestCommitSha
                  }), {
                    status: 409,
                    headers: corsHeaders
                  });
                }
              }
            }
          } catch (_error) {
            // Ignore stale check failures to avoid blocking saves
          }
        }

        // Prepare content for GitHub (proper base64 encode with UTF-8 handling)
        // Using TextEncoder for proper UTF-8 encoding, then converting to base64
        // Optimized memory usage by building binary string directly instead of collecting chunks in array
        const utf8Bytes = new TextEncoder().encode(content);
        let binaryString = '';
        const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
        
        // Build binary string directly without intermediate array
        for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
          const chunkEnd = Math.min(i + chunkSize, utf8Bytes.length);
          const chunk = utf8Bytes.subarray(i, chunkEnd);
          // Use apply with smaller chunks to avoid call stack issues
          binaryString += String.fromCharCode.apply(null, chunk);
        }
        const encodedContent = btoa(binaryString);

        // Prepare commit data
        const commitData = {
          message: `Update TiddlyWiki via Cloudflare Saver - ${new Date(timestamp || Date.now()).toISOString()}`,
          content: encodedContent,
          committer: {
            name: 'TiddlyWiki Cloudflare Saver',
            email: 'noreply@cloudflare-saver.local'
          }
        };

        // Include SHA if file exists (for updates)
        if (sha) {
          commitData.sha = sha;
        }

        // Save to GitHub
        const saveResponse = await fetch(
          `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
              'User-Agent': `TiddlyWiki-Cloudflare-Saver/${VERSION}`,
              'Accept': 'application/vnd.github.v3+json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(commitData)
          }
        );

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}));

          // Handle conflict (409) - retry with new SHA
          if (saveResponse.status === 409) {
            attempt++;
            if (attempt < maxRetries) {
              console.log(`Conflict detected, retrying (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 500 * attempt)); // Exponential backoff
              continue;
            }
          }

          throw new Error(errorData.message || `GitHub API error: ${saveResponse.status}`);
        }

        // Success!
        const saveResult = await saveResponse.json();

        return new Response(JSON.stringify({
          success: true,
          message: 'TiddlyWiki saved successfully',
          commit: saveResult.commit.sha,
          timestamp: new Date().toISOString(),
          attempt: attempt + 1
        }), {
          status: 200,
          headers: corsHeaders
        });

      } catch (error) {
        lastError = error;
        attempt++;

        // If not max retries yet and it's a retryable error, continue
        if (attempt < maxRetries && (error.message.includes('conflict') || error.message.includes('409'))) {
          console.log(`Retry attempt ${attempt}/${maxRetries} after error:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          continue;
        }

        // Non-retryable error or max retries reached
        break;
      }
    }

    // If we got here, all retries failed
    console.error('Save function error after retries:', lastError);
    return new Response(JSON.stringify({
      error: `Failed to save after multiple attempts: ${  lastError?.message || 'Unknown error'}`,
      attempts: attempt
    }), {
      status: 500,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Save function error:', error);
    return new Response(JSON.stringify({
      error: `Internal server error: ${  error.message}`
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

// Handle CORS preflight requests
export async function onRequestOptions(context) {
  try {
    const { request, env } = context;

    // Get allowed origins from environment with safe fallback
    const allowedOrigins = parseAllowedOrigins(env?.ALLOWED_ORIGINS);
    const requestOrigin = request.headers.get('Origin');

    // Determine CORS origin
    const allowOrigin = getCorsOrigin(allowedOrigins, requestOrigin);

    return new Response(null, {
      status: 200,
      headers: {
        ...getCorsHeaders(allowOrigin, false),
        'Access-Control-Max-Age': '86400'
      }
    });
  } catch (error) {
    // Ensure we always return a valid CORS response, even if there's an error
    console.error('Error in OPTIONS handler:', error);
    const requestOrigin = context?.request?.headers?.get('Origin');
    return new Response(null, {
      status: 200,
      headers: {
        ...getCorsHeaders(requestOrigin || '*', false),
        'Access-Control-Max-Age': '86400'
      }
    });
  }
}

// Handle health check requests
export async function onRequestGet(context) {
  const { request, env } = context;

  // Get allowed origins from environment with safe fallback
  const allowedOrigins = parseAllowedOrigins(env?.ALLOWED_ORIGINS);
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = getCorsOrigin(allowedOrigins, requestOrigin);
  const corsHeaders = getCorsHeaders(allowOrigin);

  // Check configuration status
  const configStatus = {
    githubToken: !!env?.GITHUB_TOKEN,
    githubRepo: !!env?.GITHUB_REPO,
    savePassword: !!env?.SAVE_PASSWORD
  };

  const allConfigured = configStatus.githubToken && configStatus.githubRepo && configStatus.savePassword;

  return new Response(JSON.stringify({
    status: 'healthy',
    version: VERSION,
    timestamp: new Date().toISOString(),
    configuration: {
      githubToken: configStatus.githubToken ? 'configured' : 'missing',
      githubRepo: configStatus.githubRepo ? 'configured' : 'missing',
      savePassword: configStatus.savePassword ? 'configured' : 'missing',
      ready: allConfigured
    },
    rateLimiting: {
      window: `${RATE_LIMIT_WINDOW / 1000}s`,
      maxRequests: MAX_REQUESTS_PER_WINDOW
    }
  }), {
    status: allConfigured ? 200 : 503,
    headers: corsHeaders
  });
}
