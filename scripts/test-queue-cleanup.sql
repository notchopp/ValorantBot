-- CLEANUP SCRIPT: Run after testing to remove test data
-- Run this in Supabase SQL Editor

-- Delete test matches
DELETE FROM matches WHERE host_user_id IN (
    SELECT discord_user_id FROM players WHERE discord_user_id LIKE 'test_player_%'
);

-- Delete test players from queue
DELETE FROM queue WHERE player_id IN (
    SELECT id FROM players WHERE discord_user_id LIKE 'test_player_%'
);

-- Delete test players
DELETE FROM players WHERE discord_user_id LIKE 'test_player_%';

SELECT 'Cleanup complete!' as status;
