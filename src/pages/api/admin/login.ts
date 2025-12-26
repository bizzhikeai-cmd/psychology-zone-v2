import type { APIRoute } from 'astro';
import crypto from 'crypto';

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

    const adminPassword = import.meta.env.ADMIN_PASSWORD;

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

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    
    // Set session cookie (expires in 24 hours)
    cookies.set('admin_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    // Store session token in environment for verification
    // In production, you'd want to use a proper session store
    // For now, we'll use a simple approach with the token itself
    process.env.ADMIN_SESSION_TOKEN = sessionToken;

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
  process.env.ADMIN_SESSION_TOKEN = '';
  
  return new Response(
    JSON.stringify({ success: true, message: 'Logged out' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
