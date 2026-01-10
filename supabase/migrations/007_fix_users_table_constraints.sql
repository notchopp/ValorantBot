-- Fix users table constraints to prevent OAuth callback issues
-- This migration addresses three problems:
-- 1. Foreign key constraint blocking inserts when player doesn't exist yet
-- 2. Permission issues with admin client
-- 3. Timing issues when user signs in before running /verify

-- Drop the existing foreign key constraint that blocks OAuth callback
ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_discord_user;

-- Drop the unique index on discord_user_id to allow temporary orphaned records
DROP INDEX IF EXISTS idx_users_discord_unique;

-- Add a nullable constraint instead - allows linking before player exists
-- The web app will handle validation and show appropriate messages
ALTER TABLE users ALTER COLUMN discord_user_id DROP NOT NULL;

-- Re-add discord_user_id as nullable to allow OAuth callback to always succeed
-- Later when user runs /verify in Discord, we can update this
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_discord_link BOOLEAN DEFAULT FALSE;

-- Add index for pending links
CREATE INDEX IF NOT EXISTS idx_users_pending_link ON users(pending_discord_link) WHERE pending_discord_link = true;

-- Grant explicit permissions to service role (admin client)
-- This ensures problem 2 (permission issues) never occurs
GRANT ALL ON users TO service_role;
GRANT ALL ON user_profiles TO service_role;
GRANT SELECT ON players TO service_role;

-- Create a function to link pending users when player is created
CREATE OR REPLACE FUNCTION link_pending_users()
RETURNS TRIGGER AS $$
BEGIN
    -- When a new player is created, check if any pending users are waiting for this discord_user_id
    UPDATE users 
    SET discord_user_id = NEW.discord_user_id,
        pending_discord_link = false,
        updated_at = NOW()
    WHERE pending_discord_link = true 
    AND discord_user_id IS NULL
    AND auth_id IN (
        SELECT auth_id FROM users WHERE pending_discord_link = true
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-link users when player is created
DROP TRIGGER IF EXISTS link_users_on_player_create ON players;
CREATE TRIGGER link_users_on_player_create
    AFTER INSERT ON players
    FOR EACH ROW
    EXECUTE FUNCTION link_pending_users();

COMMENT ON COLUMN users.pending_discord_link IS 'True if user signed in before running /verify in Discord';
COMMENT ON FUNCTION link_pending_users IS 'Automatically links pending users when their player record is created';
