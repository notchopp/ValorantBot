-- Migration 008: Replace players.id with Supabase auth UID and remove users table
-- This simplifies the data model by using auth.uid() directly as the primary key

-- Step 1: Add auth_id column to players table (temporary, will become the new id)
ALTER TABLE players ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- Step 2: Migrate existing data from users table to players table
-- Link players to their auth accounts
UPDATE players p
SET auth_id = u.auth_id
FROM users u
WHERE p.discord_user_id = u.discord_user_id
AND u.auth_id IS NOT NULL;

-- Step 2.5: For players without auth_id, keep their existing id
-- This ensures all players have a value before we drop the old id column
UPDATE players
SET auth_id = id
WHERE auth_id IS NULL;

-- Step 3: Drop all foreign key constraints that reference players(id)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_host_id_fkey;
ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_player_id_fkey;
ALTER TABLE match_player_stats DROP CONSTRAINT IF EXISTS match_player_stats_match_id_fkey;
ALTER TABLE rank_history DROP CONSTRAINT IF EXISTS rank_history_player_id_fkey;
ALTER TABLE rank_history DROP CONSTRAINT IF EXISTS rank_history_match_id_fkey;
ALTER TABLE queue DROP CONSTRAINT IF EXISTS queue_player_id_fkey;
ALTER TABLE activity_feed DROP CONSTRAINT IF EXISTS activity_feed_player_id_fkey;
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;

-- Step 4: Create a mapping table to track old_id -> new_id during migration
CREATE TEMP TABLE player_id_mapping AS
SELECT 
    id as old_id,
    COALESCE(auth_id, id) as new_id
FROM players;

-- Step 5: Update all foreign key references to use auth_id (or keep old id if no auth_id)
UPDATE matches m
SET host_id = pm.new_id
FROM player_id_mapping pm
WHERE m.host_id = pm.old_id;

UPDATE match_player_stats mps
SET player_id = pm.new_id
FROM player_id_mapping pm
WHERE mps.player_id = pm.old_id;

UPDATE rank_history rh
SET player_id = pm.new_id
FROM player_id_mapping pm
WHERE rh.player_id = pm.old_id;

UPDATE queue q
SET player_id = pm.new_id
FROM player_id_mapping pm
WHERE q.player_id = pm.old_id;

UPDATE activity_feed af
SET player_id = pm.new_id
FROM player_id_mapping pm
WHERE af.player_id = pm.old_id;

UPDATE comments c
SET author_id = pm.new_id
FROM player_id_mapping pm
WHERE c.author_id = pm.old_id;

-- Step 6: Drop the old id column and rename auth_id to id
-- First, ensure all players have a value in auth_id (use old id if no auth_id)
-- This was already done in Step 2.5, but we verify here
UPDATE players
SET auth_id = COALESCE(auth_id, id)
WHERE auth_id IS NULL;

-- Drop foreign keys that depend on players_discord_user_id_key before dropping the constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_discord_user;
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_discord_user_id_fkey;

-- Now drop constraints and rename
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_pkey;
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_discord_user_id_key; -- Drop unique constraint
ALTER TABLE players DROP COLUMN IF EXISTS id;
ALTER TABLE players RENAME COLUMN auth_id TO id;
ALTER TABLE players ALTER COLUMN id SET NOT NULL;
ALTER TABLE players ADD PRIMARY KEY (id);
ALTER TABLE players ADD CONSTRAINT players_discord_user_id_key UNIQUE (discord_user_id); -- Re-add unique constraint

-- Step 7: Recreate all foreign key constraints
ALTER TABLE matches 
    ADD CONSTRAINT matches_host_id_fkey 
    FOREIGN KEY (host_id) REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE match_player_stats 
    ADD CONSTRAINT match_player_stats_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE match_player_stats 
    ADD CONSTRAINT match_player_stats_match_id_fkey 
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE;

ALTER TABLE rank_history 
    ADD CONSTRAINT rank_history_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE rank_history 
    ADD CONSTRAINT rank_history_match_id_fkey 
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL;

ALTER TABLE queue 
    ADD CONSTRAINT queue_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE activity_feed 
    ADD CONSTRAINT activity_feed_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

ALTER TABLE comments 
    ADD CONSTRAINT comments_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES players(id) ON DELETE CASCADE;

-- Step 8: Drop the users table (no longer needed)
-- Note: We already dropped the fk_discord_user constraint in Step 6
DROP TABLE IF EXISTS users CASCADE;

-- Step 8.5: Re-add the foreign key constraint for user_profiles
-- This was dropped in Step 6 to allow dropping the unique constraint
ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_discord_user_id_fkey 
    FOREIGN KEY (discord_user_id) REFERENCES players(discord_user_id) ON DELETE CASCADE;

-- Step 9: Update RLS policies that reference the old structure
-- Drop old policies that used users table
DROP POLICY IF EXISTS "Users can view their own data" ON players;
DROP POLICY IF EXISTS "Users can update their own data" ON players;

-- Create new RLS policies using auth.uid() directly
CREATE POLICY "Users can view their own player data"
    ON players FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own player data"
    ON players FOR UPDATE
    USING (auth.uid() = id);

-- Update comments RLS policies
DROP POLICY IF EXISTS "Users can view comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;

CREATE POLICY "Users can view comments"
    ON comments FOR SELECT
    USING (true); -- Public read access

CREATE POLICY "Users can create comments"
    ON comments FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- Update activity_feed RLS policies
DROP POLICY IF EXISTS "Users can view activity feed" ON activity_feed;
CREATE POLICY "Users can view activity feed"
    ON activity_feed FOR SELECT
    USING (true); -- Public read access

-- Step 10: Add index on id for performance
CREATE INDEX IF NOT EXISTS idx_players_id ON players(id);

-- Step 11: Update comments to use auth.uid() directly in RLS
-- The RLS policies above already handle this, but ensure triggers work correctly
DROP TRIGGER IF EXISTS check_comment_author ON comments;
DROP FUNCTION IF EXISTS check_comment_author();

-- Step 12: Create function to update player id (for OAuth callback)
-- This function handles updating a player's id from old UUID to new auth UID
-- It updates all foreign key references atomically in a transaction
CREATE OR REPLACE FUNCTION update_player_id(
    old_id UUID,
    new_id UUID,
    discord_user_id_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    player_exists BOOLEAN;
BEGIN
    -- Check if player exists with the old_id and discord_user_id
    SELECT EXISTS(
        SELECT 1 FROM players 
        WHERE id = old_id AND discord_user_id = discord_user_id_param
    ) INTO player_exists;
    
    IF NOT player_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Check if new_id already exists (can't have duplicate primary keys)
    IF EXISTS(SELECT 1 FROM players WHERE id = new_id) THEN
        RETURN FALSE;
    END IF;
    
    -- Update all foreign key references atomically
    UPDATE matches SET host_id = new_id WHERE host_id = old_id;
    UPDATE match_player_stats SET player_id = new_id WHERE player_id = old_id;
    UPDATE rank_history SET player_id = new_id WHERE player_id = old_id;
    UPDATE queue SET player_id = new_id WHERE player_id = old_id;
    UPDATE activity_feed SET player_id = new_id WHERE player_id = old_id;
    UPDATE comments SET author_id = new_id WHERE author_id = old_id;
    
    -- Finally, update the primary key
    UPDATE players SET id = new_id WHERE id = old_id;
    
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- If anything fails, rollback (transaction is implicit in function)
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_id IS 'Atomically updates a player id and all foreign key references. Used by OAuth callback to link Discord accounts.';

-- Comments
COMMENT ON COLUMN players.id IS 'Supabase auth.uid() - primary key linking auth to player data';
COMMENT ON TABLE players IS 'Player data - id is now the Supabase auth UID directly';
