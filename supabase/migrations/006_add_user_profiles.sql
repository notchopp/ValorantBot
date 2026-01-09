-- User profiles table for profile customization
-- Links to players table via discord_user_id
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_user_id TEXT UNIQUE NOT NULL REFERENCES players(discord_user_id) ON DELETE CASCADE,
    bio TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    favorite_agent TEXT,
    favorite_map TEXT,
    display_name TEXT, -- Custom display name (optional, defaults to discord_username)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_user_id ON user_profiles(discord_user_id);

-- Function to update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Disable RLS for bot access (bot needs to read profiles)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE user_profiles IS 'User-customizable profiles for GRNDS players';
COMMENT ON COLUMN user_profiles.display_name IS 'Custom display name shown in hub (defaults to discord_username if null)';
