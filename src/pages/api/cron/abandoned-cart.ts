import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { interaktService } from '../../../lib/interakt';

/**
 * Abandoned Cart Recovery Cron Job
 * 
 * Two-stage funnel:
 * Stage 1: First reminder (payment_incomplete_notification) - 30 min after abandonment
 * Stage 2: Recovery offer with ₹50 discount (cart_recovery_offer) - 4 hours after Stage 1
 */

export const GET: APIRoute = async ({ request }) => {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = (import.meta.env.CRON_SECRET || process.env.CRON_SECRET || '').trim();
  
  // Allow calls from Vercel Cron (they use a different auth mechanism)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  
  if (!isVercelCron && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('Unauthorized cron attempt');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  console.log('🛒 Starting abandoned cart recovery cron job...');

  try {
    // Check if this is a test/manual trigger (skip time constraints)
    const url = new URL(request.url);
    const isTestMode = url.searchParams.get('test') === 'true';
    const stageOnly = url.searchParams.get('stage'); // '1' or '2' to test specific stage

    const siteUrl = (import.meta.env.SITE_URL || process.env.SITE_URL || 'https://book.psychologyzone.in').trim();
    const today = new Date().toISOString().split('T')[0];

    const results = {
      stage1: { sent: 0, failed: 0, details: [] as any[] },
      stage2: { sent: 0, failed: 0, details: [] as any[] }
    };

    // ==========================================
    // STAGE 1: First reminder (30 min - 24 hours after abandonment)
    // ==========================================
    if (!stageOnly || stageOnly === '1') {
      console.log('📤 Processing Stage 1: First cart reminder...');
      
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      let stage1Query = supabase
        .from('bookings')
        .select('*')
        .in('payment_status', ['failed', 'pending'])
        .or('cart_reminder_sent.is.null,cart_reminder_sent.eq.false')
        .gte('appointment_date', today);

      if (isTestMode) {
        console.log('🧪 TEST MODE: Finding any failed/pending bookings for Stage 1');
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        stage1Query = stage1Query.gte('created_at', oneHourAgo);
      } else {
        stage1Query = stage1Query
          .gte('created_at', oneDayAgo)
          .lte('created_at', thirtyMinutesAgo);
      }

      const { data: stage1Bookings, error: stage1Error } = await stage1Query;

      if (stage1Error) {
        console.error('Error fetching Stage 1 bookings:', stage1Error);
      } else if (stage1Bookings && stage1Bookings.length > 0) {
        console.log(`Found ${stage1Bookings.length} bookings for Stage 1`);

        for (const booking of stage1Bookings) {
          try {
            const retryLink = `${siteUrl}/retry-booking?ref=${booking.booking_ref}`;
            
            console.log(`Processing booking ${booking.booking_ref}:`, JSON.stringify({
              customer_name: booking.customer_name,
              customer_phone: booking.customer_phone,
              appointment_date: booking.appointment_date,
              appointment_time: booking.appointment_time,
              name_length: booking.customer_name?.length,
              has_newlines: /[\n\r\t]/.test(booking.customer_name || ''),
              has_double_space: /\s{2,}/.test(booking.customer_name || '')
            }));
            
            const result = await interaktService.sendCartAbandonedReminder({
              customer_name: booking.customer_name,
              customer_phone: booking.customer_phone,
              appointment_date: booking.appointment_date,
              appointment_time: booking.appointment_time,
              booking_ref: booking.booking_ref,
              retry_link: retryLink
            });

            if (result.success) {
              await supabase
                .from('bookings')
                .update({
                  cart_reminder_sent: true,
                  cart_reminder_sent_at: new Date().toISOString()
                })
                .eq('id', booking.id);

              results.stage1.sent++;
              results.stage1.details.push({ booking_ref: booking.booking_ref, status: 'sent' });
              console.log(`✅ Stage 1 sent: ${booking.booking_ref}`);
            } else {
              results.stage1.failed++;
              results.stage1.details.push({ booking_ref: booking.booking_ref, status: 'failed', error: result.error });
              console.error(`❌ Stage 1 failed: ${booking.booking_ref}`, result.error);
            }
          } catch (err) {
            results.stage1.failed++;
            results.stage1.details.push({ booking_ref: booking.booking_ref, status: 'error', error: String(err) });
          }
        }
      } else {
        console.log('No bookings found for Stage 1');
      }
    }

    // ==========================================
    // STAGE 2: Recovery offer with discount (4+ hours after Stage 1)
    // ==========================================
    if (!stageOnly || stageOnly === '2') {
      console.log('🎁 Processing Stage 2: Cart recovery offer with discount...');
      
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      let stage2Query = supabase
        .from('bookings')
        .select('*')
        .in('payment_status', ['failed', 'pending'])
        .eq('cart_reminder_sent', true)
        .or('cart_recovery_sent.is.null,cart_recovery_sent.eq.false')
        .gte('appointment_date', today);

      if (isTestMode) {
        console.log('🧪 TEST MODE: Finding any Stage 1 completed bookings for Stage 2');
        // In test mode, find bookings where Stage 1 was sent (regardless of when)
        stage2Query = stage2Query.not('cart_reminder_sent_at', 'is', null);
      } else {
        // Stage 1 was sent 4-48 hours ago
        stage2Query = stage2Query
          .gte('cart_reminder_sent_at', twoDaysAgo)
          .lte('cart_reminder_sent_at', fourHoursAgo);
      }

      const { data: stage2Bookings, error: stage2Error } = await stage2Query;

      if (stage2Error) {
        console.error('Error fetching Stage 2 bookings:', stage2Error);
      } else if (stage2Bookings && stage2Bookings.length > 0) {
        console.log(`Found ${stage2Bookings.length} bookings for Stage 2`);

        for (const booking of stage2Bookings) {
          try {
            const result = await interaktService.sendCartRecoveryOffer({
              customer_name: booking.customer_name,
              customer_phone: booking.customer_phone,
              appointment_date: booking.appointment_date,
              appointment_time: booking.appointment_time,
              booking_ref: booking.booking_ref
            });

            if (result.success) {
              await supabase
                .from('bookings')
                .update({
                  cart_recovery_sent: true,
                  cart_recovery_sent_at: new Date().toISOString()
                })
                .eq('id', booking.id);

              results.stage2.sent++;
              results.stage2.details.push({ booking_ref: booking.booking_ref, status: 'sent' });
              console.log(`✅ Stage 2 sent: ${booking.booking_ref}`);
            } else {
              results.stage2.failed++;
              results.stage2.details.push({ booking_ref: booking.booking_ref, status: 'failed', error: result.error });
              console.error(`❌ Stage 2 failed: ${booking.booking_ref}`, result.error);
            }
          } catch (err) {
            results.stage2.failed++;
            results.stage2.details.push({ booking_ref: booking.booking_ref, status: 'error', error: String(err) });
          }
        }
      } else {
        console.log('No bookings found for Stage 2');
      }
    }

    const summary = {
      message: 'Abandoned cart recovery processing complete',
      timestamp: new Date().toISOString(),
      testMode: isTestMode,
      stage1: {
        description: 'First reminder (payment_incomplete_notification)',
        sent: results.stage1.sent,
        failed: results.stage1.failed,
        details: results.stage1.details
      },
      stage2: {
        description: 'Recovery offer with ₹50 discount (cart_recovery_offer)',
        sent: results.stage2.sent,
        failed: results.stage2.failed,
        details: results.stage2.details
      },
      totalSent: results.stage1.sent + results.stage2.sent,
      totalFailed: results.stage1.failed + results.stage2.failed
    };

    console.log('🛒 Cron job completed:', JSON.stringify(summary, null, 2));

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
