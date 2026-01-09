-- Users table to link Supabase auth IDs to Discord user IDs
-- This allows us to match authenticated web users to their Discord player data
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE NOT NULL, -- Supabase auth.users.id (UUID)
    discord_user_id TEXT NOT NULL, -- Discord snowflake ID (references players.discord_user_id)
    email TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_discord_user FOREIGN KEY (discord_user_id) REFERENCES players(discord_user_id) ON DELETE CASCADE
);

-- Create unique index on discord_user_id to ensure one auth per Discord account
-- But allow multiple auth accounts if needed (removed UNIQUE constraint from column)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord_unique ON users(discord_user_id);

-- Index for fast lookups by auth_id
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_discord_user_id ON users(discord_user_id);

-- Function to automatically create a user record when a player is created
-- This can be called manually or via a trigger if needed
CREATE OR REPLACE FUNCTION create_user_for_player()
RETURNS TRIGGER AS $$
BEGIN
    -- This function can be called manually when linking auth to player
    -- We don't auto-create here since we need the auth_id from Supabase
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Disable RLS for users table to allow bot access
-- The bot needs to read/write users table to link Discord accounts
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE users IS 'Links Supabase auth IDs to Discord user IDs for web app authentication';
COMMENT ON COLUMN users.auth_id IS 'Supabase auth.users.id (UUID from authentication)';
COMMENT ON COLUMN users.discord_user_id IS 'Discord snowflake ID (references players.discord_user_id)';
