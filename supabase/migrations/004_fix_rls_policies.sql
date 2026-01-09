-- Fix RLS policies to allow bot (service role) and web app (anon) access to all tables
-- Service role bypasses RLS by default, but we need policies for anon key (web app)

-- Players table: Enable RLS if not already enabled
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Players: Read by everyone (web app), write by service role only (bot uses service role)
DROP POLICY IF EXISTS "Players are viewable by everyone" ON players;
CREATE POLICY "Players are viewable by everyone" 
    ON players FOR SELECT 
    USING (true);

-- Players: Allow updates for service role (bot operations)
-- Service role bypasses RLS, but we add this for clarity
DROP POLICY IF EXISTS "Service role can modify players" ON players;
CREATE POLICY "Service role can modify players" 
    ON players FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Matches table: Enable RLS if not already enabled
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON matches;
CREATE POLICY "Matches are viewable by everyone" 
    ON matches FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service role can modify matches" ON matches;
CREATE POLICY "Service role can modify matches" 
    ON matches FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Match player stats: Enable RLS if not already enabled
ALTER TABLE match_player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Match player stats are viewable by everyone" ON match_player_stats;
CREATE POLICY "Match player stats are viewable by everyone" 
    ON match_player_stats FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service role can modify match_player_stats" ON match_player_stats;
CREATE POLICY "Service role can modify match_player_stats" 
    ON match_player_stats FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Rank history: Enable RLS if not already enabled
ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rank history is viewable by everyone" ON rank_history;
CREATE POLICY "Rank history is viewable by everyone" 
    ON rank_history FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service role can modify rank_history" ON rank_history;
CREATE POLICY "Service role can modify rank_history" 
    ON rank_history FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Queue: Enable RLS if not already enabled
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Queue is viewable by everyone" ON queue;
CREATE POLICY "Queue is viewable by everyone" 
    ON queue FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Service role can modify queue" ON queue;
CREATE POLICY "Service role can modify queue" 
    ON queue FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Rank thresholds: Enable RLS if not already enabled
ALTER TABLE rank_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rank thresholds are viewable by everyone" ON rank_thresholds;
CREATE POLICY "Rank thresholds are viewable by everyone" 
    ON rank_thresholds FOR SELECT 
    USING (true);

-- Seasons, activity_feed, comments already have policies from migration 003
-- But let's ensure service role can modify them too

-- Seasons: Allow service role to modify
DROP POLICY IF EXISTS "Service role can modify seasons" ON seasons;
CREATE POLICY "Service role can modify seasons" 
    ON seasons FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Activity feed: Allow service role to modify (triggers create entries)
DROP POLICY IF EXISTS "Service role can modify activity_feed" ON activity_feed;
CREATE POLICY "Service role can modify activity_feed" 
    ON activity_feed FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Note: Service role (used by the Discord bot) bypasses RLS by default
-- These policies are primarily for the anon key (web app) and for explicit clarity
-- The bot should continue working as it uses service_role which bypasses RLS automatically
