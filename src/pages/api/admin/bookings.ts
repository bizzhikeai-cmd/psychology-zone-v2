import type { APIRoute } from 'astro';
import { getBookings, getBookingStats } from '../../../lib/supabase';
import { verifySessionToken } from '../../../lib/auth';
import { getAdminSession } from '../../../lib/cookies';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check admin authentication using raw cookie header
    const adminSession = getAdminSession(request);
    const adminPassword = (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();

    if (!adminSession || !adminPassword || !verifySessionToken(adminSession, adminPassword)) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'pending' | 'completed' | 'failed' | null;
    const includeStats = url.searchParams.get('stats') === 'true';

    // Fetch bookings
    const { data: bookings, error: bookingsError } = await getBookings(status || undefined);

    if (bookingsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bookings' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optionally fetch stats
    let stats = null;
    if (includeStats) {
      const { data: statsData } = await getBookingStats();
      stats = statsData;
    }

    return new Response(
      JSON.stringify({
        success: true,
        bookings,
        stats,
        count: bookings?.length || 0
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Admin bookings API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
