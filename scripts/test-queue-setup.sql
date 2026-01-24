-- TEST QUEUE SETUP SCRIPT
-- Run this in Supabase SQL Editor to test the queue flow
-- This creates 9 test players and adds them to the Valorant queue (5v5)
-- YOU will be the 10th player who triggers the pop via /queue join

-- Step 1: Clear existing test players first
DELETE FROM queue WHERE player_id IN (
    SELECT id FROM players WHERE discord_user_id LIKE 'test_player_%'
);
DELETE FROM players WHERE discord_user_id LIKE 'test_player_%';

-- Step 2: Create 9 test players with varying MMR (you'll be #10)
INSERT INTO players (id, discord_user_id, discord_username, current_mmr, valorant_mmr, marvel_rivals_mmr, verified_at)
VALUES
    (gen_random_uuid(), 'test_player_1', 'TestPlayer1', 2500, 2500, 2500, NOW()),
    (gen_random_uuid(), 'test_player_2', 'TestPlayer2', 2300, 2300, 2300, NOW()),
    (gen_random_uuid(), 'test_player_3', 'TestPlayer3', 2100, 2100, 2100, NOW()),
    (gen_random_uuid(), 'test_player_4', 'TestPlayer4', 1900, 1900, 1900, NOW()),
    (gen_random_uuid(), 'test_player_5', 'TestPlayer5', 1700, 1700, 1700, NOW()),
    (gen_random_uuid(), 'test_player_6', 'TestPlayer6', 1500, 1500, 1500, NOW()),
    (gen_random_uuid(), 'test_player_7', 'TestPlayer7', 1300, 1300, 1300, NOW()),
    (gen_random_uuid(), 'test_player_8', 'TestPlayer8', 1100, 1100, 1100, NOW()),
    (gen_random_uuid(), 'test_player_9', 'TestPlayer9', 900, 900, 900, NOW())
ON CONFLICT (discord_user_id) DO UPDATE SET
    current_mmr = EXCLUDED.current_mmr,
    valorant_mmr = EXCLUDED.valorant_mmr,
    marvel_rivals_mmr = EXCLUDED.marvel_rivals_mmr,
    verified_at = EXCLUDED.verified_at;

-- Step 2: Clear any existing test entries from queue
DELETE FROM queue WHERE player_id IN (
    SELECT id FROM players WHERE discord_user_id LIKE 'test_player_%'
);

-- Step 3: Add all 9 test players to Valorant queue
INSERT INTO queue (player_id, game, joined_at)
SELECT id, 'valorant', NOW() - (ROW_NUMBER() OVER () * INTERVAL '1 minute')
FROM players 
WHERE discord_user_id LIKE 'test_player_%'
ORDER BY discord_user_id;

-- Verify: Check queue status (should show 9 players - you'll be #10)
SELECT 
    p.discord_username,
    p.valorant_mmr as mmr,
    q.game,
    q.joined_at
FROM queue q
JOIN players p ON q.player_id = p.id
WHERE p.discord_user_id LIKE 'test_player_%'
ORDER BY q.joined_at;

-- Result: You should see 9 players in Valorant queue
-- NOW RUN IN DISCORD: /queue join game:Valorant
-- This will make you the 10th player and trigger the match!
