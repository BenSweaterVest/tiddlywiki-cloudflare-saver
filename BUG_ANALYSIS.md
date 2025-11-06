# Deep Code Review - Bug Analysis

## Critical Issues (Require Fixing)

### 1. **Timeout Validation Missing** - `src/saver.js:49`
**Severity:** HIGH - Can cause runtime errors

```javascript
timeout: parseInt(self.wiki.getTiddlerText("$:/config/cloudflare-saver/timeout", "30")) * 1000,
```

**Problem:** If user enters non-numeric value (e.g., "abc"), `parseInt("abc")` returns `NaN`, resulting in `timeout: NaN`.

**Impact:** XMLHttpRequest with `xhr.timeout = NaN` may cause undefined behavior or fail silently.

**Fix:** Add validation:
```javascript
timeout: Math.max(5, parseInt(self.wiki.getTiddlerText("$:/config/cloudflare-saver/timeout", "30")) || 30) * 1000,
```

---

### 2. **Large File Base64 Encoding Failure** - `demo/functions/save.js:158-162`
**Severity:** HIGH - Breaks functionality for large wikis

```javascript
const utf8Bytes = new TextEncoder().encode(content);
const binaryString = String.fromCharCode(...utf8Bytes);
const encodedContent = btoa(binaryString);
```

**Problem:** Spread operator `...utf8Bytes` has argument limit (~65k-100k depending on JS engine). For TiddlyWiki files >1MB, this will throw "Maximum call stack size exceeded" or "too many arguments".

**Impact:** Cannot save large TiddlyWiki files (common for wikis with many tiddlers).

**Fix:** Process in chunks:
```javascript
function encodeBase64(content) {
  const utf8Bytes = new TextEncoder().encode(content);
  let binaryString = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
    const chunk = utf8Bytes.subarray(i, i + chunkSize);
    binaryString += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binaryString);
}
```

---

### 3. **Tiddler Title Mismatch** - `scripts/build.js:64-65`
**Severity:** MEDIUM - Causes confusion, potential loading issues

```javascript
const name = file.replace(/\.(js|tid)$/, '');
const title = `$:/plugins/${namespace}/${name}`;
```

**Problem:**
- JavaScript files have `.js` extension in their source header comment (`title: .../saver.js`)
- But built tiddler title omits extension (`.../saver`)
- TiddlyWiki JavaScript modules should include `.js` extension in title

**Impact:** Inconsistency may cause module loading issues or confusion.

**Fix:** Preserve `.js` for JavaScript files:
```javascript
const name = file.endsWith('.tid') ? file.replace(/\.tid$/, '') : file;
const title = `$:/plugins/${namespace}/${name}`;
```

---

## Medium Issues (Should Fix)

### 4. **Misleading Priority Comment** - `src/saver.js:201`
**Severity:** LOW - Documentation issue

```javascript
priority: 1000, // Lower priority so it doesn't override other savers
```

**Problem:** Comment says "lower priority" but 1000 is actually medium-high priority. In TiddlyWiki:
- Higher numbers = higher priority
- Download saver = 100 (low)
- TiddlyFox = 1000 (medium)
- Upload = 2000 (high)

**Fix:** Correct comment:
```javascript
priority: 1000, // Medium priority (same as TiddlyFox)
```

---

### 5. **Build Script Doesn't Fail on Missing Files** - `scripts/build.js:76-77`
**Severity:** MEDIUM - Silent failures

```javascript
} else {
    console.warn(`⚠️  File not found: ${file}`);
}
```

**Problem:** Missing files just warn but build continues. Could produce incomplete/broken plugin.

**Fix:** Distinguish between required and optional files, exit with error for missing required files.

---

### 6. **Rate Limit Map Memory Leak** - `demo/functions/save.js:15`
**Severity:** LOW - Only in high-traffic scenarios

```javascript
const rateLimitMap = new Map();
```

**Problem:** Map grows unbounded. Old entries only removed when same IP makes new request after window expires. With many unique IPs, this could accumulate memory.

**Impact:** Minimal for personal wikis, but could be issue in shared/high-traffic scenarios.

**Fix:** Add periodic cleanup or use LRU cache.

---

## Minor Issues (Consider Fixing)

### 7. **Retry Count Documentation** - `src/saver.js:90` & `settings.tid`
**Severity:** LOW - Documentation accuracy

```javascript
var maxRetries = config.autoRetry ? 3 : 0;
```

Settings say "up to 3 attempts", but code gives:
- Initial attempt (retryCount=0)
- Retry 1 (retryCount=1)
- Retry 2 (retryCount=2)
- Retry 3 (retryCount=3)
- Total: 4 attempts

**Fix:** Either change maxRetries to 2, or update docs to say "up to 4 attempts total (3 retries)".

---

### 8. **Missing $tw Global Check** - `src/saver.js:80, 104, 194`
**Severity:** LOW - Edge case

```javascript
if(config.notifications && $tw.notifier) {
```

**Problem:** Checks `$tw.notifier` but not `$tw` itself. Would throw ReferenceError if `$tw` undefined.

**Impact:** Minimal (TiddlyWiki always has $tw), but less defensive.

**Fix:** Add global check: `typeof $tw !== 'undefined' && $tw.notifier`

---

### 9. **Cloudflare Function Retry Logging** - `demo/functions/save.js:201`
**Severity:** LOW - Confusing logs

```javascript
console.log(`Conflict detected, retrying (attempt ${attempt + 1}/${maxRetries})`);
```

**Problem:** If attempt was just incremented to 1, this logs "attempt 2/3" which is confusing (we're about to start attempt 2, not attempt 3).

**Fix:** Log before incrementing, or clarify message.

---

## Observations (Not Bugs)

### 10. **Using $tw.wiki Global Instead of Parameter**
`src/saver.js:208`

```javascript
exports.canSave = function(wiki) {
    var enabled = $tw.wiki.getTiddlerText(...);
    return enabled;
};
```

This is intentional per comment "during initialization" - not a bug, but worth noting.

---

### 11. **Prompt() for Password Entry**
`src/saver.js:70`

Using `prompt()` is not ideal UX (blocking, browser-specific styling), but acceptable for this use case and keeps plugin simple. Not a bug.

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| HIGH | 2 | Timeout validation, Base64 encoding |
| MEDIUM | 2 | Title mismatch, Build failures |
| LOW | 5 | Priority comment, Rate limit, Retry docs, $tw check, Retry logging |

**Recommended Action:**
- FIX: Issues #1 and #2 (critical functionality)
- FIX: Issues #3, #4, #5 (quality/consistency)
- CONSIDER: Issues #6-#9 (minor improvements)
