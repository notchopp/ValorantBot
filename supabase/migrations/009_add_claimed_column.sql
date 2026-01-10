-- Migration 009: Add claimed column to players table
-- This column tracks whether a profile has been claimed by a user
-- All new entries start with claimed = false, and it flips to true when claim profile is clicked

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS claimed BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_claimed ON players(claimed);

-- Set any existing NULL values to FALSE (shouldn't happen with NOT NULL, but safety check)
UPDATE players
SET claimed = FALSE
WHERE claimed IS NULL;

-- Update existing players where id is a UUID (already claimed) to set claimed = true
-- These are profiles that were claimed before the claimed column existed
UPDATE players
SET claimed = true
WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND id::text != discord_user_id;

COMMENT ON COLUMN players.claimed IS 'Whether this profile has been claimed by a user via the web app. Starts as false for all new entries, flips to true when claim profile is clicked.';
