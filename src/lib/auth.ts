import crypto from 'crypto';

/**
 * Server-side authentication utilities
 * HMAC-signed session tokens for serverless environments
 */

// Generate HMAC-signed session token
export function createSessionToken(secret: string): string {
  const timestamp = Date.now().toString();
  const randomData = crypto.randomBytes(16).toString('hex');
  const data = `${timestamp}.${randomData}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${signature}`;
}

// Verify HMAC-signed session token
export function verifySessionToken(token: string, secret: string): boolean {
  try {
    if (!token || !secret) return false;

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const [timestamp, randomData, signature] = parts;
    const data = `${timestamp}.${randomData}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (signature !== expectedSignature) return false;

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp, 10);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    return tokenAge < maxAge;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}
