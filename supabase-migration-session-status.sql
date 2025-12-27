-- Migration: Add session management fields to bookings table
-- Run this in your Supabase SQL Editor to update existing table

-- Add new columns
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'completed', 'cancelled', 'no-show')),
ADD COLUMN IF NOT EXISTS session_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS feedback_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_bookings_session_status ON bookings(session_status);
CREATE INDEX IF NOT EXISTS idx_bookings_appointment_date ON bookings(appointment_date);

-- Update existing records to have default session_status
UPDATE bookings 
SET session_status = 'scheduled' 
WHERE session_status IS NULL;

COMMENT ON COLUMN bookings.session_status IS 'Status of the therapy session: scheduled, completed, cancelled, no-show';
COMMENT ON COLUMN bookings.session_completed_at IS 'Timestamp when admin marked session as complete';
COMMENT ON COLUMN bookings.feedback_sent IS 'Whether feedback message was sent to customer';
COMMENT ON COLUMN bookings.feedback_sent_at IS 'Timestamp when feedback message was sent';
COMMENT ON COLUMN bookings.admin_notes IS 'Internal notes about the session';
