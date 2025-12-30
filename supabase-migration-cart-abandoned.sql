-- Migration: Add cart abandonment tracking fields to bookings table
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/YOUR_PROJECT/sql

-- Add new columns for cart abandonment tracking
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS cart_reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cart_reminder_sent_at TIMESTAMPTZ;

-- Create index for faster abandoned cart queries
CREATE INDEX IF NOT EXISTS idx_bookings_cart_reminder ON bookings(cart_reminder_sent) 
WHERE payment_status IN ('failed', 'pending');

-- Add comments for documentation
COMMENT ON COLUMN bookings.cart_reminder_sent IS 'Whether abandoned cart reminder was sent to customer';
COMMENT ON COLUMN bookings.cart_reminder_sent_at IS 'Timestamp when abandoned cart reminder was sent';

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
  AND column_name IN ('cart_reminder_sent', 'cart_reminder_sent_at')
ORDER BY column_name;
