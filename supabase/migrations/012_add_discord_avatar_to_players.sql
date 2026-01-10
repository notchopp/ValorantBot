-- Migration 012: Add Discord avatar URL column to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS discord_avatar_url TEXT;

COMMENT ON COLUMN players.discord_avatar_url IS 'Discord profile picture URL for displaying in hub and leaderboards';
