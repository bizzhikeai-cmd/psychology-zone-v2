-- WhatsApp Automation Tracking Fields Migration
-- Run this in Supabase SQL Editor
-- Created: December 30, 2024

-- Add 24h session reminder tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

-- Add payment failed notification tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_failed_notified BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_failed_notified_at TIMESTAMPTZ;

-- Add cart recovery offer tracking (2nd abandoned cart message with discount)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cart_recovery_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cart_recovery_sent_at TIMESTAMPTZ;

-- Add index for efficient cron queries
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_24h 
ON bookings (appointment_date, payment_status, session_status, reminder_24h_sent) 
WHERE payment_status = 'completed' AND session_status = 'scheduled' AND reminder_24h_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_cart_reminder 
ON bookings (created_at, payment_status, cart_reminder_sent) 
WHERE payment_status IN ('pending', 'failed') AND (cart_reminder_sent IS NULL OR cart_reminder_sent = FALSE);

CREATE INDEX IF NOT EXISTS idx_bookings_cart_recovery 
ON bookings (cart_reminder_sent_at, payment_status, cart_recovery_sent) 
WHERE payment_status IN ('pending', 'failed') AND cart_reminder_sent = TRUE AND (cart_recovery_sent IS NULL OR cart_recovery_sent = FALSE);

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
AND column_name IN ('reminder_24h_sent', 'reminder_24h_sent_at', 'payment_failed_notified', 'payment_failed_notified_at', 'cart_recovery_sent', 'cart_recovery_sent_at');
