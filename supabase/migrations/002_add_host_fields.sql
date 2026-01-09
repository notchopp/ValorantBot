-- Add host-related fields to matches table
-- Migration: 002_add_host_fields
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS host_user_id TEXT,
ADD COLUMN IF NOT EXISTS host_invite_code TEXT,
ADD COLUMN IF NOT EXISTS host_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS host_selected_at TIMESTAMP;

-- Add index for host queries
CREATE INDEX IF NOT EXISTS idx_matches_host_user_id ON matches(host_user_id);
