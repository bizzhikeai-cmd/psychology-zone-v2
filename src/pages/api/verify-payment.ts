import type { APIRoute } from 'astro';
import { verifyPaymentSignature } from '../../lib/razorpay';
import { completeBooking, failBooking, getBookingByOrderId } from '../../lib/supabase';
import { interaktService } from '../../lib/interakt';

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

      // Send admin notification
      const adminResult = await interaktService.sendAdminNotification({
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        customer_email: booking.customer_email,
        problem: booking.problem,
        appointment_date: booking.appointment_date,
        appointment_time: booking.appointment_time,
        booking_ref: booking.booking_ref,
        amount: booking.amount_paid / 100 // Convert paise to rupees
      });

      if (!adminResult.success) {
        console.error('Failed to send admin WhatsApp:', adminResult.error);
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
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
