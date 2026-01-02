import type { APIRoute } from 'astro';
import { verifyPaymentSignature } from '../../lib/razorpay';
import { completeBooking, failBooking, getBookingByOrderId } from '../../lib/supabase';
import { interaktService } from '../../lib/interakt';
import { emailService } from '../../lib/email';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Validate required fields
    const required = ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'];
    for (const field of required) {
      if (!data[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    // Verify payment signature
    const isValid = verifyPaymentSignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });

    if (!isValid) {
      // Mark booking as failed due to invalid signature
      await failBooking(razorpay_order_id, 'Invalid payment signature');
      
      return new Response(
        JSON.stringify({ error: 'Payment verification failed - invalid signature' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update booking status to completed
    const { data: booking, error: updateError } = await completeBooking(
      razorpay_order_id,
      razorpay_payment_id
    );

    if (updateError || !booking) {
      console.error('Failed to update booking:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to confirm booking' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send WhatsApp notifications (don't fail the request if these fail)
    try {
      // Send customer confirmation
      const customerResult = await interaktService.sendCustomerConfirmation({
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        appointment_date: booking.appointment_date,
        appointment_time: booking.appointment_time,
        booking_ref: booking.booking_ref
      });

      if (!customerResult.success) {
        console.error('Failed to send customer WhatsApp:', customerResult.error);
      }

      // Send email notification to admin
      const emailResult = await emailService.sendNewBookingAlert(booking);
      if (!emailResult.success) {
        console.error('Failed to send admin email:', emailResult.error);
      }
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Continue - don't fail the booking confirmation
    }

    // Return success with booking reference for redirect
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment verified and booking confirmed',
        booking_ref: booking.booking_ref,
        booking: {
          id: booking.id,
          customer_name: booking.customer_name,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time,
          amount_paid: booking.amount_paid / 100
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verify payment API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Handle payment failure
export const PUT: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    if (!data.razorpay_order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing razorpay_order_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const reason = data.reason || 'Payment failed or cancelled by user';

    // Update booking status to failed
    const { data: booking, error } = await failBooking(data.razorpay_order_id, reason);

    if (error) {
      console.error('Failed to update booking status:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update booking status' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Send payment failed notification via WhatsApp (don't fail the request if this fails)
    if (booking) {
      try {
        const alertResult = await interaktService.sendPaymentFailedAlert({
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          booking_ref: booking.booking_ref,
          appointment_date: booking.appointment_date,
          appointment_time: booking.appointment_time
        });

        if (!alertResult.success) {
          console.error('Failed to send payment failed WhatsApp alert:', alertResult.error);
        } else {
          console.log(`Payment failed alert sent for booking ${booking.booking_ref}`);
          
          // Mark as notified in database (optional - if you want to track this)
          // This prevents duplicate alerts if the user retries
        }
      } catch (notificationError) {
        console.error('Payment failed notification error:', notificationError);
        // Continue - don't fail the response
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Booking marked as failed',
        booking_ref: booking?.booking_ref
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Payment failure API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
