import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { interaktService } from '../../../lib/interakt';

export const GET: APIRoute = async ({ request }) => {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = import.meta.env.CRON_SECRET || process.env.CRON_SECRET;
  
  // Allow calls from Vercel Cron
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('Unauthorized cron attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  console.log('🔔 Starting 24h session reminder cron job...');

  try {
    // Check if this is a test/manual trigger
    const url = new URL(request.url);
    const isTestMode = url.searchParams.get('test') === 'true';

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];

    // For test mode, also check today's bookings
    const today = new Date().toISOString().split('T')[0];

    // Find bookings that need 24h reminder:
    // - payment_status = 'completed'
    // - session_status = 'scheduled'
    // - appointment_date is tomorrow (or today in test mode)
    // - reminder_24h_sent is false or null
    let query = supabase
      .from('bookings')
      .select('*')
      .eq('payment_status', 'completed')
      .eq('session_status', 'scheduled')
      .or('reminder_24h_sent.is.null,reminder_24h_sent.eq.false');

    if (isTestMode) {
      console.log('🧪 TEST MODE: Checking today and tomorrow bookings');
      query = query.or(`appointment_date.eq.${today},appointment_date.eq.${tomorrowDate}`);
    } else {
      query = query.eq('appointment_date', tomorrowDate);
    }

    const { data: upcomingBookings, error } = await query;

    if (error) {
      console.error('Error fetching upcoming bookings:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!upcomingBookings || upcomingBookings.length === 0) {
      console.log('No sessions need 24h reminders');
      return new Response(
        JSON.stringify({ 
          message: 'No sessions need 24h reminders', 
          count: 0,
          checkDate: isTestMode ? `${today} or ${tomorrowDate}` : tomorrowDate
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${upcomingBookings.length} bookings needing 24h reminders`);

    let sentCount = 0;
    let failedCount = 0;
    const results: { booking_ref: string; status: string; error?: string }[] = [];

    for (const booking of upcomingBookings) {
      try {
        console.log(`📱 Sending 24h reminder for: ${booking.booking_ref}`);
        
        const result = await interaktService.send24hReminder({
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          booking_ref: booking.booking_ref,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time
        });

        if (result.success) {
          // Mark reminder as sent
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              reminder_24h_sent: true,
              reminder_24h_sent_at: new Date().toISOString()
            })
            .eq('id', booking.id);

          if (updateError) {
            console.error(`Failed to update reminder status for ${booking.booking_ref}:`, updateError);
          }
          
          sentCount++;
          results.push({ booking_ref: booking.booking_ref, status: 'sent' });
          console.log(`✅ 24h reminder sent for ${booking.booking_ref}`);
        } else {
          failedCount++;
          results.push({ booking_ref: booking.booking_ref, status: 'failed', error: result.error });
          console.error(`❌ Failed to send 24h reminder for ${booking.booking_ref}:`, result.error);
        }
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ booking_ref: booking.booking_ref, status: 'error', error: errorMsg });
        console.error(`❌ Error processing ${booking.booking_ref}:`, err);
      }
    }

    const summary = {
      message: '24h session reminder processing complete',
      timestamp: new Date().toISOString(),
      checkDate: isTestMode ? `${today} or ${tomorrowDate}` : tomorrowDate,
      total: upcomingBookings.length,
      sent: sentCount,
      failed: failedCount,
      results
    };

    console.log('🔔 Cron job completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session reminder cron error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Also support POST for manual triggering
export const POST: APIRoute = GET;
