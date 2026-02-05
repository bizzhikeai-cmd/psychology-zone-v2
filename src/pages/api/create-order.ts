import type { APIRoute } from 'astro';
import { createOrder, getRazorpayKeyId } from '../../lib/razorpay';
import { createBooking } from '../../lib/supabase';

// Package pricing configuration
const PACKAGES = {
  starter: { sessions: 1, price: 64900, name: 'STARTER' },    // ₹649
  popular: { sessions: 5, price: 259500, name: 'POPULAR' },   // ₹2,595
  premium: { sessions: 10, price: 487000, name: 'PREMIUM' }   // ₹4,870
} as const;

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
      'appointment_time',
      'package_id',
      'session_count',
      'package_name',
      'page_source'
    ];

    for (const field of required) {
      if (!data[field]) {
        return new Response(
          JSON.stringify({ error: `Missing required field: ${field}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate package_id and get pricing
    const packageId = data.package_id as keyof typeof PACKAGES;
    if (!PACKAGES[packageId]) {
      return new Response(
        JSON.stringify({ error: 'Invalid package_id. Must be: starter, popular, or premium' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const packageInfo = PACKAGES[packageId];

    // Validate session count matches package
    if (packageInfo.sessions !== data.session_count) {
      return new Response(
        JSON.stringify({ error: 'Session count does not match selected package' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Amount in paise
    const amount = packageInfo.price;

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
        appointment_time: data.appointment_time,
        package_id: data.package_id,
        package_name: data.package_name,
        session_count: data.session_count,
        page_source: data.page_source
      }
    });

    if (orderError || !order) {
      console.error('Failed to create Razorpay order:', orderError);
      const errorMessage = orderError?.message || 'Unknown error';
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment order',
          details: errorMessage,
          hint: 'Please check your Razorpay API credentials (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)'
        }),
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
      amount_paid: amount,
      package_id: data.package_id,
      session_count: data.session_count,
      package_name: data.package_name,
      page_source: data.page_source
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
