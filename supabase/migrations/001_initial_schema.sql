-- Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_user_id TEXT UNIQUE NOT NULL,
    discord_username TEXT NOT NULL,
    riot_name TEXT,
    riot_tag TEXT,
    riot_puuid TEXT,
    riot_region TEXT DEFAULT 'na',
    discord_rank TEXT DEFAULT 'Unranked',
    discord_rank_value INTEGER DEFAULT 0,
    discord_mmr INTEGER DEFAULT 0,
    current_mmr INTEGER DEFAULT 0,
    peak_mmr INTEGER DEFAULT 0,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Rank thresholds table
CREATE TABLE IF NOT EXISTS rank_thresholds (
    rank TEXT PRIMARY KEY,
    min_mmr INTEGER NOT NULL,
    max_mmr INTEGER NOT NULL,
    role_id TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert custom rank thresholds (GRNDS, BREAKPOINT, CHALLENGER, X)
-- X rank is special - top 10 players only, handled separately
INSERT INTO rank_thresholds (rank, min_mmr, max_mmr) VALUES
    ('GRNDS I', 0, 199),
    ('GRNDS II', 200, 399),
    ('GRNDS III', 400, 599),
    ('GRNDS IV', 600, 799),
    ('GRNDS V', 800, 999),
    ('BREAKPOINT I', 1000, 1199),
    ('BREAKPOINT II', 1200, 1399),
    ('BREAKPOINT III', 1400, 1599),
    ('BREAKPOINT IV', 1600, 1799),
    ('BREAKPOINT V', 1800, 1999),
    ('CHALLENGER I', 2000, 2199),
    ('CHALLENGER II', 2200, 2399),
    ('CHALLENGER III', 2400, 2599),
    ('CHALLENGER IV', 2600, 2799),
    ('CHALLENGER V', 2800, 9999),
    ('X', 3000, 9999)
ON CONFLICT (rank) DO NOTHING;

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id TEXT UNIQUE NOT NULL,
    match_type TEXT DEFAULT 'custom' CHECK (match_type IN ('custom', 'valorant')),
    match_date TIMESTAMP DEFAULT NOW(),
    map TEXT,
    host_id UUID REFERENCES players(id),
    team_a JSONB NOT NULL,
    team_b JSONB NOT NULL,
    winner TEXT CHECK (winner IN ('A', 'B')),
    score JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Match player stats table
CREATE TABLE IF NOT EXISTS match_player_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team TEXT NOT NULL CHECK (team IN ('A', 'B')),
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    mvp BOOLEAN DEFAULT FALSE,
    damage INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    mmr_before INTEGER NOT NULL,
    mmr_after INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(match_id, player_id)
);

-- Rank history table
CREATE TABLE IF NOT EXISTS rank_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    old_rank TEXT,
    new_rank TEXT NOT NULL,
    old_mmr INTEGER NOT NULL,
    new_mmr INTEGER NOT NULL,
    reason TEXT DEFAULT 'match' CHECK (reason IN ('match', 'verification', 'adjustment')),
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Queue table
CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(player_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_discord_user_id ON players(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_players_current_mmr ON players(current_mmr DESC);
CREATE INDEX IF NOT EXISTS idx_players_discord_rank ON players(discord_rank);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_match_id ON matches(match_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_match_id ON match_player_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_player_id ON match_player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_rank_history_player_id ON rank_history(player_id);
CREATE INDEX IF NOT EXISTS idx_queue_joined_at ON queue(joined_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
