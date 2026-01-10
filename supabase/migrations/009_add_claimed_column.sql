-- Migration 009: Add claimed column to players table
-- This column tracks whether a profile has been claimed by a user

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_players_claimed ON players(claimed);

-- Update existing players where id is a UUID (already claimed) to set claimed = true
UPDATE players
SET claimed = true
WHERE id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
AND id::text != discord_user_id;

COMMENT ON COLUMN players.claimed IS 'Whether this profile has been claimed by a user via the web app';
