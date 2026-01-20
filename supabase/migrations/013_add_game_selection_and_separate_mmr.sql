-- Migration 013: Add game selection and separate MMR tracking for multi-game support
-- This migration adds support for Marvel Rivals alongside Valorant

-- Add game selection columns
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS preferred_game TEXT DEFAULT 'valorant' 
  CHECK (preferred_game IN ('valorant', 'marvel_rivals'));

ALTER TABLE players
ADD COLUMN IF NOT EXISTS primary_game TEXT DEFAULT 'valorant'
  CHECK (primary_game IN ('valorant', 'marvel_rivals'));

ALTER TABLE players
ADD COLUMN IF NOT EXISTS role_mode TEXT DEFAULT 'highest'
  CHECK (role_mode IN ('highest', 'primary'));

-- Marvel Rivals account info
ALTER TABLE players
ADD COLUMN IF NOT EXISTS marvel_rivals_uid TEXT,
ADD COLUMN IF NOT EXISTS marvel_rivals_username TEXT;

-- Separate MMR/rank tracking per game
-- Valorant-specific fields (keeping existing fields for backward compatibility)
-- Existing fields (discord_rank, current_mmr, etc.) remain for Valorant

-- Add Marvel Rivals specific MMR/rank
ALTER TABLE players
ADD COLUMN IF NOT EXISTS valorant_rank TEXT,
ADD COLUMN IF NOT EXISTS valorant_rank_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS valorant_mmr INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS valorant_peak_mmr INTEGER DEFAULT 0;

ALTER TABLE players
ADD COLUMN IF NOT EXISTS marvel_rivals_rank TEXT DEFAULT 'Unranked',
ADD COLUMN IF NOT EXISTS marvel_rivals_rank_value INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS marvel_rivals_mmr INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS marvel_rivals_peak_mmr INTEGER DEFAULT 0;

-- Migrate existing data: Copy current rank/MMR to Valorant-specific fields
-- This ensures backward compatibility
UPDATE players
SET 
  valorant_rank = COALESCE(discord_rank, 'Unranked'),
  valorant_rank_value = COALESCE(discord_rank_value, 0),
  valorant_mmr = COALESCE(current_mmr, 0),
  valorant_peak_mmr = COALESCE(peak_mmr, 0),
  preferred_game = 'valorant',
  primary_game = 'valorant',
  role_mode = 'highest'
WHERE valorant_rank IS NULL;

-- Indexes for game-based queries
CREATE INDEX IF NOT EXISTS idx_players_preferred_game ON players(preferred_game);
CREATE INDEX IF NOT EXISTS idx_players_marvel_rivals_uid ON players(marvel_rivals_uid) WHERE marvel_rivals_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_marvel_rivals_mmr ON players(marvel_rivals_mmr DESC) WHERE marvel_rivals_mmr > 0;
CREATE INDEX IF NOT EXISTS idx_players_primary_game ON players(primary_game);
CREATE INDEX IF NOT EXISTS idx_players_valorant_mmr ON players(valorant_mmr DESC) WHERE valorant_mmr > 0;

-- Update matches table to support Marvel Rivals
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS matches_match_type_check;

ALTER TABLE matches
ADD CONSTRAINT matches_match_type_check 
  CHECK (match_type IN ('custom', 'valorant', 'marvel_rivals'));

-- Comments for documentation
COMMENT ON COLUMN players.preferred_game IS 'Game the player prefers to queue for (valorant or marvel_rivals)';
COMMENT ON COLUMN players.primary_game IS 'Game whose rank is used for Discord role (if role_mode is primary)';
COMMENT ON COLUMN players.role_mode IS 'How Discord role is determined: highest (default) or primary';
COMMENT ON COLUMN players.marvel_rivals_uid IS 'Marvel Rivals player UID (unique identifier, preferred over username)';
COMMENT ON COLUMN players.marvel_rivals_username IS 'Marvel Rivals username';
COMMENT ON COLUMN players.valorant_rank IS 'Valorant-specific Discord rank (GRNDS, BREAKPOINT, CHALLENGER, X)';
COMMENT ON COLUMN players.marvel_rivals_rank IS 'Marvel Rivals-specific Discord rank (GRNDS, BREAKPOINT, CHALLENGER, X)';
