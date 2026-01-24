-- Add resync tracking columns for auto-sync feature
-- This allows the bot to automatically retry rank verification for players with invalid data

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS needs_resync BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS resync_requested_at TIMESTAMPTZ;

-- Create index for efficient querying of players needing resync
CREATE INDEX IF NOT EXISTS idx_players_needs_resync 
ON players (needs_resync, resync_requested_at) 
WHERE needs_resync = true;

-- Comment explaining the columns
COMMENT ON COLUMN players.needs_resync IS 'True if player needs automatic rank re-verification';
COMMENT ON COLUMN players.resync_requested_at IS 'When the resync was requested (for rate limiting)';
