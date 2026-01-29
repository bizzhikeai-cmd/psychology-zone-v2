import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import { interaktService } from '../../../lib/interakt';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Check admin authentication
    const adminSession = cookies.get('admin_session')?.value;

    if (!adminSession) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { booking_id, notes } = await request.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Booking ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get booking details
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update session status to completed
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        session_status: 'completed',
        session_completed_at: new Date().toISOString(),
        admin_notes: notes || null
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update booking' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send feedback request immediately
    // NOTE: In production, you should use a proper queue system (like Vercel Cron, 
    // AWS SQS, or a service like Inngest) to delay this by 2 hours.
    // setTimeout doesn't work in serverless - the function terminates after response.
    try {
      await interaktService.sendFeedbackRequest({
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        booking_ref: booking.booking_ref,
        appointment_date: booking.appointment_date
      });

      // Mark feedback as sent
      await supabase
        .from('bookings')
        .update({
          feedback_sent: true,
          feedback_sent_at: new Date().toISOString()
        })
        .eq('id', booking_id);

      console.log(`Feedback sent for booking ${booking.booking_ref}`);
    } catch (error) {
      console.error('Error sending feedback:', error);
      // Don't fail the request if feedback fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Session marked as completed and feedback request sent!'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Complete session API error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
