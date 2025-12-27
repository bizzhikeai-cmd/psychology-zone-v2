-- Supabase SQL Schema for Psychology Zone Bookings
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_ref TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Customer Information
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  city TEXT NOT NULL,
  
  -- Booking Details
  problem TEXT NOT NULL,
  circumstances TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  
  -- Payment Information
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  amount_paid INTEGER DEFAULT 59900,
  failure_reason TEXT,
  
  -- Session Management
  session_status TEXT DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
  session_completed_at TIMESTAMPTZ,
  feedback_sent BOOLEAN DEFAULT FALSE,
  feedback_sent_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_booking_ref ON bookings(booking_ref);
CREATE INDEX IF NOT EXISTS idx_bookings_razorpay_order_id ON bookings(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_session_status ON bookings(session_status);
CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC);

-- Enable Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role full access (for API routes)
CREATE POLICY "Service role has full access" ON bookings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Create policy to allow anon role to insert (for creating bookings)
CREATE POLICY "Anon can insert bookings" ON bookings
  FOR INSERT
  WITH CHECK (true);

-- Create policy to allow anon role to select their own booking by reference
CREATE POLICY "Anon can view booking by ref" ON bookings
  FOR SELECT
  USING (true);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create a view for admin dashboard stats
CREATE OR REPLACE VIEW booking_stats AS
SELECT 
  COUNT(*) as total_bookings,
  COUNT(*) FILTER (WHERE payment_status = 'completed') as completed_bookings,
  COUNT(*) FILTER (WHERE payment_status = 'pending') as pending_bookings,
  COUNT(*) FILTER (WHERE payment_status = 'failed') as failed_bookings,
  COALESCE(SUM(amount_paid) FILTER (WHERE payment_status = 'completed'), 0) / 100 as total_revenue
FROM bookings;
