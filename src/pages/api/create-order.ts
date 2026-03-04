import type { APIRoute } from 'astro';
import { createOrder, getRazorpayKeyId } from '../../lib/razorpay';
import { createBooking } from '../../lib/supabase';
import { notionService } from '../../lib/notion';

// Package pricing configuration (in paise)
const PACKAGES = {
  starter: { sessions: 1, price: 79900, name: 'STARTER' },    // ₹799
  popular: { sessions: 3, price: 164700, name: 'POPULAR' },   // ₹1,647
  premium: { sessions: 5, price: 249500, name: 'PREMIUM' }    // ₹2,495
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
      'appointment_date',
      'appointment_time',
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

    // Normalize package data (always fallback to single package if client sends stale/invalid values)
    const requestedPackageId = typeof data.package_id === 'string' ? data.package_id : 'starter';
    const normalizedPackageId = requestedPackageId in PACKAGES
      ? (requestedPackageId as keyof typeof PACKAGES)
      : 'starter';
    const packageInfo = PACKAGES[normalizedPackageId];
    const normalizedSessionCount = packageInfo.sessions;
    const normalizedPackageName = packageInfo.name;

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
        package_id: normalizedPackageId,
        package_name: normalizedPackageName,
        session_count: normalizedSessionCount,
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
      package_id: normalizedPackageId,
      session_count: normalizedSessionCount,
      package_name: normalizedPackageName,
      page_source: data.page_source
    });

    if (bookingError || !booking) {
      console.error('Failed to create booking:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Failed to create booking record' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Push lead to Notion CRM (fire-and-forget — never blocks the booking response)
    notionService.createEntry({
      customer_name: data.customer_name,
      customer_email: data.customer_email,
      customer_phone: data.customer_phone,
      city: data.city,
      problem: data.problem,
      circumstances: data.circumstances,
      appointment_date: data.appointment_date,
      appointment_time: data.appointment_time,
      package_name: normalizedPackageName,
      session_count: normalizedSessionCount,
      amount_paid: amount / 100,
      razorpay_order_id: order.id,
      booking_ref: booking.booking_ref,
      page_source: data.page_source,
    }).catch(err => console.error('[Notion] createEntry error:', err));

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
