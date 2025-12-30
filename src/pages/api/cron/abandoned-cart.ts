import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { interaktService } from '../../../lib/interakt';

export const GET: APIRoute = async ({ request }) => {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = import.meta.env.CRON_SECRET || process.env.CRON_SECRET;
  
  // Allow calls from Vercel Cron (they use a different auth mechanism)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('Unauthorized cron attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  console.log('Starting abandoned cart recovery cron job...');

  try {
    // Find abandoned bookings:
    // - payment_status is 'failed' or still 'pending' (never completed)
    // - created more than 30 minutes ago (give them time to come back)
    // - created within last 24 hours (don't spam old bookings)
    // - cart_reminder_sent is false or null
    // - appointment_date is still in the future
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().split('T')[0];

    const { data: abandonedBookings, error } = await supabase
      .from('bookings')
      .select('*')
      .in('payment_status', ['failed', 'pending'])
      .or('cart_reminder_sent.is.null,cart_reminder_sent.eq.false')
      .gte('created_at', oneDayAgo)
      .lte('created_at', thirtyMinutesAgo)
      .gte('appointment_date', today);

    if (error) {
      console.error('Error fetching abandoned bookings:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!abandonedBookings || abandonedBookings.length === 0) {
      console.log('No abandoned carts found');
      return new Response(
        JSON.stringify({ message: 'No abandoned carts found', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${abandonedBookings.length} abandoned bookings`);

    let sentCount = 0;
    let failedCount = 0;
    const results: { booking_ref: string; status: string; error?: string }[] = [];

    // Send reminders
    for (const booking of abandonedBookings) {
      try {
        console.log(`Processing abandoned booking: ${booking.booking_ref}`);
        
        const result = await interaktService.sendCartAbandonedReminder({
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time,
          booking_ref: booking.booking_ref
        });

        if (result.success) {
          // Mark reminder as sent
          const { error: updateError } = await supabase
            .from('bookings')
            .update({
              cart_reminder_sent: true,
              cart_reminder_sent_at: new Date().toISOString()
            })
            .eq('id', booking.id);

          if (updateError) {
            console.error(`Failed to update reminder status for ${booking.booking_ref}:`, updateError);
          }
          
          sentCount++;
          results.push({ booking_ref: booking.booking_ref, status: 'sent' });
          console.log(`✓ Cart reminder sent for ${booking.booking_ref}`);
        } else {
          failedCount++;
          results.push({ booking_ref: booking.booking_ref, status: 'failed', error: result.error });
          console.error(`✗ Failed to send reminder for ${booking.booking_ref}:`, result.error);
        }
      } catch (err) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ booking_ref: booking.booking_ref, status: 'error', error: errorMsg });
        console.error(`✗ Error processing ${booking.booking_ref}:`, err);
      }
    }

    const summary = {
      message: 'Abandoned cart processing complete',
      timestamp: new Date().toISOString(),
      total: abandonedBookings.length,
      sent: sentCount,
      failed: failedCount,
      results
    };

    console.log('Cron job completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Abandoned cart cron error:', error);
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
