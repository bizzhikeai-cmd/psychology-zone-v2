/**
 * Reliable cookie utilities that work in Vercel serverless
 * Uses raw request headers instead of framework-specific APIs
 */

// Parse cookies from raw Cookie header string
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });

  return cookies;
}

// Get a specific cookie value from request
export function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');
  const cookies = parseCookies(cookieHeader);
  return cookies[name];
}

// Get admin session cookie from request
export function getAdminSession(request: Request): string | undefined {
  return getCookie(request, 'admin_session');
}
