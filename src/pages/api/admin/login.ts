import type { APIRoute } from 'astro';
import crypto from 'crypto';

// Generate HMAC-signed session token
function createSessionToken(secret: string): string {
  const timestamp = Date.now().toString();
  const randomData = crypto.randomBytes(16).toString('hex');
  const data = `${timestamp}.${randomData}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${data}.${signature}`;
}

// Verify HMAC-signed session token
export function verifySessionToken(token: string, secret: string): boolean {
  try {
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
  } catch {
    return false;
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const { password } = data;

    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const adminPassword = import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Admin password not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (password !== adminPassword) {
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate HMAC-signed session token using admin password as secret
    const sessionToken = createSessionToken(adminPassword);

    // Set session cookie (expires in 24 hours)
    cookies.set('admin_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login successful',
        redirect: '/admin'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin login API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Logout endpoint
export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete('admin_session', { path: '/' });

  return new Response(
    JSON.stringify({ success: true, message: 'Logged out' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
