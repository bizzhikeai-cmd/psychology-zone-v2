-- Add payment timestamp column to track when payment is completed

ALTER TABLE bookings ADD COLUMN payment_completed_at TIMESTAMPTZ;
