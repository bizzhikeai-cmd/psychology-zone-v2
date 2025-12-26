import type { APIRoute } from 'astro';
import { createOrder, getRazorpayKeyId } from '../../lib/razorpay';
import { createBooking } from '../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    // Validate required fields
    const required = [
      'customer_name',
      'customer_email', 
      'customer_phone',
      'city',
      'problem',
      'circumstances',
      'appointment_date',
      'appointment_time'
    ];

    for (const field of required) {
      if (!data[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Amount in paise (₹599 = 59900 paise)
    const amount = 59900;

    // Create Razorpay order
    const { data: order, error: orderError } = await createOrder({
      amount,
      currency: 'INR',
      receipt: `booking_${Date.now()}`,
      notes: {
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        problem: data.problem,
        appointment_date: data.appointment_date,
        appointment_time: data.appointment_time
      }
    });

    if (orderError || !order) {
      console.error('Failed to create Razorpay order:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment order' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create booking in Supabase with pending status
    const { data: booking, error: bookingError } = await createBooking({
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      city: data.city,
      problem: data.problem,
      circumstances: data.circumstances,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      razorpay_order_id: order.id,
      amount_paid: amount
    });

    if (bookingError || !booking) {
      console.error('Failed to create booking:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Failed to create booking record' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return order details for frontend
    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        booking_ref: booking.booking_ref,
        amount: order.amount,
        currency: order.currency,
        key_id: getRazorpayKeyId(),
        prefill: {
          name: data.customer_name,
          email: data.customer_email,
          contact: data.customer_phone
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create order API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
