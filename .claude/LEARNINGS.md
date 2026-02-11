# Project Learnings & Anti-Patterns

> **AUTO-MAINTAINED:** This document is automatically updated by the `self-learning` skill during debugging sessions.
> **Read this FIRST** before making changes to authentication, cookies, or Vercel configuration.

---

## Authentication & Cookies in Vercel + Astro

### NEVER use `Astro.cookies.get()` in Vercel serverless

**Problem discovered**: `Astro.cookies.get()` does not reliably read cookies in Vercel serverless functions. The cookie is set correctly by the browser, but Astro's API returns `undefined`.

**Solution**: Always read cookies from raw request headers:

```typescript
// src/lib/cookies.ts - USE THIS
export function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return undefined;

  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(cookie => {
    const [key, ...rest] = cookie.trim().split('=');
    if (key) cookies[key] = rest.join('=');
  });

  return cookies[name];
}

// Usage in .astro or API route:
import { getAdminSession } from '../../lib/cookies';
const adminSession = getAdminSession(Astro.request); // or just `request` in API routes
```

**DO NOT**:
```typescript
// This is UNRELIABLE in Vercel:
const session = Astro.cookies.get('admin_session')?.value;
```

---

## Vercel Configuration

### NEVER use `trailingSlash: true` with cookie-based auth

**Problem discovered**: When `trailingSlash: true` is set in vercel.json, Vercel issues 301 redirects (e.g., `/admin` → `/admin/`). These redirects can break cookie flow:
1. Login sets cookie, returns redirect to `/admin`
2. Browser goes to `/admin`
3. Vercel 301 redirects to `/admin/`
4. Cookie may not be sent during this redirect chain
5. Auth fails

**Solution**: Remove `trailingSlash: true` from vercel.json, or ensure ALL redirect URLs include trailing slashes.

```json
// vercel.json - AVOID THIS:
{
  "trailingSlash": true  // REMOVE THIS
}
```

---

## Environment Variables in Vercel

### ALWAYS use both `import.meta.env` AND `process.env` fallback

**Problem discovered**: In Vercel serverless functions, sometimes `import.meta.env.VAR` works, sometimes `process.env.VAR` works. It's inconsistent across different function invocations.

**Solution**: Always use fallback pattern with `.trim()` to handle newline corruption:

```typescript
const adminPassword = (
  import.meta.env.ADMIN_PASSWORD ||
  process.env.ADMIN_PASSWORD ||
  ''
).trim();
```

**Also check for newline corruption**: Vercel environment variables sometimes get `\n` appended. Always `.trim()`.

---

## Session Token Design

### PREFER simple static hashes over time-based tokens (for simple admin panels)

**Problem discovered**: Complex HMAC tokens with timestamps (`timestamp.randomData.signature`) fail in serverless because:
1. Each function invocation generates different random data
2. Timestamps can drift between function cold starts
3. Token verification fails when different functions handle login vs. verification

**Current solution** (simple deterministic hashes):

```typescript
// Works in serverless: Same input = same output, always
function generateSessionHash(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + 'static-salt')
    .digest('hex');
}
```

**Security note**: This approach is simple and works reliably in serverless, but has limitations:
- Cannot invalidate individual sessions
- If password leaks, all sessions are compromised
- Same token every login (no rotation)

**For production systems with higher security needs**, implement proper session management:
- Generate random session tokens with `crypto.randomUUID()` or `crypto.randomBytes(32)`
- Store sessions server-side (Supabase, Redis, or Vercel KV)
- Implement session expiration and rotation
- See OWASP Session Management guidelines

**What DOESN'T work in serverless** (avoid these patterns):

```typescript
// BAD: Different output every time - verification fails
function createToken(secret: string): string {
  const timestamp = Date.now();  // Different each time!
  const random = crypto.randomBytes(16);  // Different each time!
  // ... verification will fail across function invocations
}
```

---

## Debugging Checklist

When admin login breaks, check in this order:

1. **Are cookies being set?** Check browser DevTools → Application → Cookies
2. **Are cookies being sent?** Check Network tab → Request Headers → Cookie
3. **Is the cookie being read?** Add `console.log(request.headers.get('cookie'))` to API
4. **Is ADMIN_PASSWORD available?** Add logging: `console.log({ hasPassword: !!adminPassword })`
5. **Does the hash match?** Log both expected and actual hash values
6. **Any redirects happening?** Check Network tab for 301/302 redirects

---

## Files That Handle Auth

When debugging auth issues, these are ALL the files to check:

| File                                       | Purpose                                      |
| ------------------------------------------ | -------------------------------------------- |
| `src/lib/auth.ts`                          | Token generation & verification              |
| `src/lib/cookies.ts`                       | Cookie reading from raw headers              |
| `src/pages/api/admin/login.ts`             | Login API - sets cookie                      |
| `src/pages/admin/index.astro`              | Dashboard - verifies cookie                  |
| `src/pages/admin/login.astro`              | Login page - checks if already logged in     |
| `src/pages/api/admin/bookings.ts`          | API - requires auth                          |
| `src/pages/api/admin/complete-session.ts`  | API - requires auth                          |
| `src/pages/api/admin/reports.ts`           | API - requires auth                          |
| `vercel.json`                              | Vercel config - can affect redirects/caching |

---

## Quick Fixes That DON'T Work

These were tried and failed:

| Attempted Fix                  | Why It Failed                                  |
| ------------------------------ | ---------------------------------------------- |
| Using `sameSite: 'strict'`     | Doesn't help with Vercel's internal redirects  |
| Using `Astro.cookies.set()`    | Cookie set correctly but reading fails         |
| Adding more logging            | Helps debug but doesn't fix root cause         |
| Changing token format          | If reading fails, format doesn't matter        |
| Multiple PRs with small fixes  | Need to fix root cause, not symptoms           |

---

## When All Else Fails

1. Clear ALL browser cookies for the site
2. Check Vercel Function logs for console output
3. Deploy a test endpoint that just echoes `request.headers.get('cookie')`
4. Verify ADMIN_PASSWORD is set correctly in Vercel dashboard
5. Re-read this document!

---

## Last Updated

January 2026 after 3-day debugging session
