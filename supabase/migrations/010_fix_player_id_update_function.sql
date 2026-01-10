-- Migration 010: Fix update_player_id function to properly handle foreign key constraints
-- PostgreSQL can't update a primary key that's referenced by foreign keys
-- Solution: Create new row with new ID, update all foreign keys, delete old row

DROP FUNCTION IF EXISTS update_player_id(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS update_player_id_with_auth_uid(UUID, UUID, TEXT, TEXT);

-- Function to atomically update player.id by creating new row, updating foreign keys, then deleting old row
CREATE OR REPLACE FUNCTION update_player_id_with_auth_uid(
    p_old_player_id UUID,
    p_new_auth_uid UUID,
    p_discord_user_id TEXT,
    p_display_name TEXT
)
RETURNS void AS $$
DECLARE
    old_player_record RECORD;
    original_discord_user_id TEXT;
BEGIN
    -- Check if player exists with the old_id
    IF NOT EXISTS(SELECT 1 FROM players WHERE id = p_old_player_id) THEN
        RAISE EXCEPTION 'Player with id % does not exist', p_old_player_id;
    END IF;
    
    -- Check if new_id already exists (can't have duplicate primary keys)
    IF EXISTS(SELECT 1 FROM players WHERE id = p_new_auth_uid AND id != p_old_player_id) THEN
        RAISE EXCEPTION 'Player with id % already exists', p_new_auth_uid;
    END IF;
    
    -- Get the old player record data (before any modifications)
    SELECT * INTO old_player_record FROM players WHERE id = p_old_player_id;
    
    -- Store the original discord_user_id before we modify it
    original_discord_user_id := old_player_record.discord_user_id;
    
    -- Step 1: Delete any existing user_profiles row that references the old discord_user_id
    -- This breaks the foreign key reference before we modify the players table
    DELETE FROM user_profiles WHERE discord_user_id = original_discord_user_id;
    
    -- Step 2: Temporarily modify the old row's discord_user_id to avoid unique constraint violation
    UPDATE players 
    SET discord_user_id = discord_user_id || '_temp_' || p_old_player_id::text
    WHERE id = p_old_player_id;
    
    -- Step 3: Create new player row with new UUID and all old data
    INSERT INTO players (
        id,
        discord_user_id,
        discord_username,
        riot_name,
        riot_tag,
        riot_puuid,
        riot_region,
        discord_rank,
        discord_rank_value,
        discord_mmr,
        current_mmr,
        peak_mmr,
        verified_at,
        created_at,
        updated_at,
        claimed
    ) VALUES (
        p_new_auth_uid,
        original_discord_user_id, -- Restore original discord_user_id
        old_player_record.discord_username,
        old_player_record.riot_name,
        old_player_record.riot_tag,
        old_player_record.riot_puuid,
        old_player_record.riot_region,
        old_player_record.discord_rank,
        old_player_record.discord_rank_value,
        old_player_record.discord_mmr,
        old_player_record.current_mmr,
        old_player_record.peak_mmr,
        old_player_record.verified_at,
        old_player_record.created_at,
        NOW(),
        COALESCE(old_player_record.claimed, false)
    );
    
    -- Step 4: Update all foreign key references from old_id to new_id
    UPDATE matches SET host_id = p_new_auth_uid WHERE host_id = p_old_player_id;
    UPDATE match_player_stats SET player_id = p_new_auth_uid WHERE player_id = p_old_player_id;
    UPDATE rank_history SET player_id = p_new_auth_uid WHERE player_id = p_old_player_id;
    UPDATE queue SET player_id = p_new_auth_uid WHERE player_id = p_old_player_id;
    UPDATE activity_feed SET player_id = p_new_auth_uid WHERE player_id = p_old_player_id;
    UPDATE comments SET author_id = p_new_auth_uid WHERE author_id = p_old_player_id;
    
    -- Step 5: Delete the old player row (now safe - no user_profiles references it)
    DELETE FROM players WHERE id = p_old_player_id;
    
    -- Step 6: Create new user_profiles row referencing the new player row
    INSERT INTO user_profiles (discord_user_id, display_name, updated_at)
    VALUES (original_discord_user_id, p_display_name, NOW())
    ON CONFLICT (discord_user_id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = EXCLUDED.updated_at;
        
    -- Step 6: Set claimed = true if not already set
    UPDATE players SET claimed = true WHERE id = p_new_auth_uid AND (claimed IS NULL OR claimed = false);
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_id_with_auth_uid IS 'Atomically updates a player id from old UUID to new auth UID by creating a new row, updating all foreign keys, and deleting the old row.';
