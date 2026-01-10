-- Migration 011: Add accent_color column to user_profiles for UI customization
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#ef4444' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN user_profiles.accent_color IS 'Custom accent color for user profile UI (hex format, e.g., #ef4444 for red)';
