import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay instance
// Use both import.meta.env and process.env fallback for Vercel serverless compatibility
// Also trim to handle any newline corruption in environment variables
const razorpayKeyId = (import.meta.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '').trim();
const razorpayKeySecret = (import.meta.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '').trim();

if (!razorpayKeyId || !razorpayKeySecret) {
  console.warn('Razorpay credentials not configured');
}

const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret,
});

// Types
export interface CreateOrderInput {
  amount: number; // Amount in paise (599 INR = 59900 paise)
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface PaymentVerificationInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Create a new Razorpay order
export async function createOrder(input: CreateOrderInput): Promise<{ data: RazorpayOrder | null; error: Error | null }> {
  // Check credentials before attempting
  if (!razorpayKeyId || !razorpayKeySecret) {
    const error = new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
    console.error(error.message);
    return { data: null, error };
  }

  try {
    const options = {
      amount: input.amount,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      notes: input.notes || {},
    };

    console.log('Creating Razorpay order with options:', JSON.stringify(options, null, 2));
    const order = await razorpay.orders.create(options);
    console.log('Razorpay order created successfully:', order.id);
    return { data: order as RazorpayOrder, error: null };
  } catch (error: any) {
    console.error('Error creating Razorpay order:', error);
    console.error('Error details:', {
      message: error?.message,
      statusCode: error?.statusCode,
      error: error?.error,
    });
    return { data: null, error: error as Error };
  }
}

// Verify payment signature
export function verifyPaymentSignature(input: PaymentVerificationInput): boolean {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

    // Generate expected signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret || '')
      .update(body)
      .digest('hex');

    // Compare signatures
    return expectedSignature === razorpay_signature;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
}

// Get Razorpay key ID for frontend
export function getRazorpayKeyId(): string {
  return razorpayKeyId || '';
}

// Fetch order details from Razorpay
export async function getOrder(orderId: string): Promise<{ data: RazorpayOrder | null; error: Error | null }> {
  try {
    const order = await razorpay.orders.fetch(orderId);
    return { data: order as RazorpayOrder, error: null };
  } catch (error) {
    console.error('Error fetching Razorpay order:', error);
    return { data: null, error: error as Error };
  }
}

// Fetch payment details from Razorpay
export async function getPayment(paymentId: string): Promise<{ data: any | null; error: Error | null }> {
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return { data: payment, error: null };
  } catch (error) {
    console.error('Error fetching Razorpay payment:', error);
    return { data: null, error: error as Error };
  }
}
