import { createClient } from '@supabase/supabase-js';
import { customAlphabet } from 'nanoid';

// Initialize Supabase client
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase credentials not configured');
}

export const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// Generate booking reference number (PZ-2025-XXXX format)
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 4);

export function generateBookingRef(): string {
  const year = new Date().getFullYear();
  const uniqueId = nanoid();
  return `PZ-${year}-${uniqueId}`;
}

// Types
export interface Booking {
  id?: string;
  booking_ref: string;
  created_at?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  problem: string;
  circumstances: string;
  appointment_date: string;
  appointment_time: string;
  payment_status: 'pending' | 'completed' | 'failed';
  razorpay_order_id: string;
  razorpay_payment_id?: string;
  amount_paid: number;
  failure_reason?: string;
}

export interface BookingInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  city: string;
  problem: string;
  circumstances: string;
  appointment_date: string;
  appointment_time: string;
  razorpay_order_id: string;
  amount_paid: number;
}

// Create a new booking with pending status
export async function createBooking(input: BookingInput): Promise<{ data: Booking | null; error: Error | null }> {
  try {
    const booking: Omit<Booking, 'id' | 'created_at'> = {
      booking_ref: generateBookingRef(),
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      city: input.city,
      problem: input.problem,
      circumstances: input.circumstances,
      appointment_date: input.appointment_date,
      appointment_time: input.appointment_time,
      payment_status: 'pending',
      razorpay_order_id: input.razorpay_order_id,
      amount_paid: input.amount_paid,
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert([booking])
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error creating booking:', error);
    return { data: null, error: error as Error };
  }
}

// Update booking payment status to completed
export async function completeBooking(
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<{ data: Booking | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'completed',
        razorpay_payment_id: razorpayPaymentId,
      })
      .eq('razorpay_order_id', razorpayOrderId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error completing booking:', error);
    return { data: null, error: error as Error };
  }
}

// Update booking payment status to failed
export async function failBooking(
  razorpayOrderId: string,
  reason: string
): Promise<{ data: Booking | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        payment_status: 'failed',
        failure_reason: reason,
      })
      .eq('razorpay_order_id', razorpayOrderId)
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error failing booking:', error);
    return { data: null, error: error as Error };
  }
}

// Get booking by reference number
export async function getBookingByRef(bookingRef: string): Promise<{ data: Booking | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('booking_ref', bookingRef)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching booking:', error);
    return { data: null, error: error as Error };
  }
}

// Get booking by Razorpay order ID
export async function getBookingByOrderId(orderId: string): Promise<{ data: Booking | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('razorpay_order_id', orderId)
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching booking by order ID:', error);
    return { data: null, error: error as Error };
  }
}

// Get all bookings with optional status filter (for admin)
export async function getBookings(
  status?: 'pending' | 'completed' | 'failed'
): Promise<{ data: Booking[] | null; error: Error | null }> {
  try {
    let query = supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('payment_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return { data: null, error: error as Error };
  }
}

// Get booking statistics (for admin dashboard)
export async function getBookingStats(): Promise<{
  data: { total: number; completed: number; pending: number; failed: number; revenue: number } | null;
  error: Error | null;
}> {
  try {
    const { data: bookings, error } = await supabase.from('bookings').select('payment_status, amount_paid');

    if (error) throw error;

    const stats = {
      total: bookings?.length || 0,
      completed: bookings?.filter((b) => b.payment_status === 'completed').length || 0,
      pending: bookings?.filter((b) => b.payment_status === 'pending').length || 0,
      failed: bookings?.filter((b) => b.payment_status === 'failed').length || 0,
      revenue: bookings?.filter((b) => b.payment_status === 'completed').reduce((sum, b) => sum + (b.amount_paid / 100), 0) || 0,
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    return { data: null, error: error as Error };
  }
}
