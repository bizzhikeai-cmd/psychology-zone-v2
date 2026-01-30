import crypto from 'crypto';

/**
 * Simple, bulletproof authentication
 * Uses a static hash approach - no time-based tokens, no complex verification
 */

const AUTH_SALT = 'psychologyzone-admin-2025';

// Generate a simple session hash from the password
export function generateSessionHash(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + AUTH_SALT)
    .digest('hex');
}

// Verify session - just check if the cookie matches the expected hash
export function verifySession(sessionCookie: string | undefined, password: string): boolean {
  if (!sessionCookie || !password) {
    console.log('verifySession: missing cookie or password', {
      hasCookie: !!sessionCookie,
      hasPassword: !!password
    });
    return false;
  }

  const expectedHash = generateSessionHash(password);
  const isValid = sessionCookie === expectedHash;

  console.log('verifySession:', {
    isValid,
    cookieLength: sessionCookie.length,
    expectedLength: expectedHash.length
  });

  return isValid;
}

// Keep old exports for backward compatibility during transition
export const createSessionToken = generateSessionHash;
export const verifySessionToken = (token: string, secret: string) => verifySession(token, secret);
