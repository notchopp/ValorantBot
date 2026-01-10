-- Migration 010: Fix update_player_id function to properly handle foreign key constraints
-- The issue is that PostgreSQL can't update a primary key that's referenced by foreign keys
-- We need to use a different approach: temporarily set foreign keys to NULL, update primary key, then restore them

DROP FUNCTION IF EXISTS update_player_id(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS update_player_id_with_auth_uid(UUID, UUID, TEXT, TEXT);

-- Create a better function that handles the primary key update correctly
-- Approach: Use a temporary UUID, update all foreign keys to temp, update primary key, then update foreign keys to new ID
CREATE OR REPLACE FUNCTION update_player_id_with_auth_uid(
    p_old_player_id UUID,
    p_new_auth_uid UUID,
    p_discord_user_id TEXT,
    p_display_name TEXT
)
RETURNS void AS $$
DECLARE
    temp_uuid UUID;
BEGIN
    -- Check if player exists with the old_id
    IF NOT EXISTS(SELECT 1 FROM players WHERE id = p_old_player_id) THEN
        RAISE EXCEPTION 'Player with id % does not exist', p_old_player_id;
    END IF;
    
    -- Check if new_id already exists (can't have duplicate primary keys)
    IF EXISTS(SELECT 1 FROM players WHERE id = p_new_auth_uid AND id != p_old_player_id) THEN
        RAISE EXCEPTION 'Player with id % already exists', p_new_auth_uid;
    END IF;
    
    -- Generate a temporary UUID for the transition
    temp_uuid := gen_random_uuid();
    
    -- Step 1: Update all foreign key references to temporary UUID
    -- This allows us to update the primary key without constraint violations
    UPDATE matches SET host_id = temp_uuid WHERE host_id = p_old_player_id;
    UPDATE match_player_stats SET player_id = temp_uuid WHERE player_id = p_old_player_id;
    UPDATE rank_history SET player_id = temp_uuid WHERE player_id = p_old_player_id;
    UPDATE queue SET player_id = temp_uuid WHERE player_id = p_old_player_id;
    UPDATE activity_feed SET player_id = temp_uuid WHERE player_id = p_old_player_id;
    UPDATE comments SET author_id = temp_uuid WHERE author_id = p_old_player_id;
    
    -- Step 2: Update the primary key (now safe since no foreign keys reference it)
    UPDATE players SET id = p_new_auth_uid WHERE id = p_old_player_id;
    
    -- Step 3: Update all foreign key references from temp UUID to new UUID
    UPDATE matches SET host_id = p_new_auth_uid WHERE host_id = temp_uuid;
    UPDATE match_player_stats SET player_id = p_new_auth_uid WHERE player_id = temp_uuid;
    UPDATE rank_history SET player_id = p_new_auth_uid WHERE player_id = temp_uuid;
    UPDATE queue SET player_id = p_new_auth_uid WHERE player_id = temp_uuid;
    UPDATE activity_feed SET player_id = p_new_auth_uid WHERE player_id = temp_uuid;
    UPDATE comments SET author_id = p_new_auth_uid WHERE author_id = temp_uuid;
    
    -- Step 4: Update user_profiles if needed
    INSERT INTO user_profiles (discord_user_id, display_name, updated_at)
    VALUES (p_discord_user_id, p_display_name, NOW())
    ON CONFLICT (discord_user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_id_with_auth_uid IS 'Atomically updates a player id from old UUID to new auth UID. Handles all foreign key references by using a temporary UUID during transition.';
