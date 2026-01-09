-- Seasons table
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity feed table
CREATE TABLE IF NOT EXISTS activity_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('rank_up', 'rank_down', 'mvp', 'big_mmr_gain', 'big_mmr_loss', 'achievement')),
    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES players(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('profile', 'match', 'season')),
    target_id UUID NOT NULL,
    content TEXT NOT NULL,
    content_censored TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT content_length CHECK (char_length(content) <= 200)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seasons_is_active ON seasons(is_active);
CREATE INDEX IF NOT EXISTS idx_seasons_dates ON seasons(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_activity_feed_player_id ON activity_feed(player_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Function to censor banned words in comments
CREATE OR REPLACE FUNCTION censor_comment(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    censored_text TEXT := input_text;
    banned_words TEXT[] := ARRAY[
        'nigger', 'nigga', 'faggot', 'fag', 'retard', 'chink', 'spic', 
        'kike', 'tranny', 'cunt', 'whore', 'slut'
    ];
    word TEXT;
BEGIN
    FOREACH word IN ARRAY banned_words
    LOOP
        censored_text := regexp_replace(censored_text, word, '****', 'gi');
    END LOOP;
    RETURN censored_text;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-censor comments
CREATE OR REPLACE FUNCTION auto_censor_comment()
RETURNS TRIGGER AS $$
BEGIN
    NEW.content_censored := censor_comment(NEW.content);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER censor_comment_trigger
    BEFORE INSERT OR UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION auto_censor_comment();

-- Trigger to update updated_at on comments
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON comments
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on seasons
CREATE TRIGGER update_seasons_updated_at 
    BEFORE UPDATE ON seasons
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seasons (read-only for all)
CREATE POLICY "Seasons are viewable by everyone" 
    ON seasons FOR SELECT 
    USING (true);

-- RLS Policies for activity_feed (read-only for all)
CREATE POLICY "Activity feed is viewable by everyone" 
    ON activity_feed FOR SELECT 
    USING (true);

-- RLS Policies for comments (read by all, write by authenticated users)
CREATE POLICY "Comments are viewable by everyone" 
    ON comments FOR SELECT 
    USING (true);

CREATE POLICY "Authenticated users can create comments" 
    ON comments FOR INSERT 
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own comments" 
    ON comments FOR UPDATE 
    USING (auth.uid()::text = (SELECT discord_user_id FROM players WHERE id = author_id));

CREATE POLICY "Users can delete their own comments" 
    ON comments FOR DELETE 
    USING (auth.uid()::text = (SELECT discord_user_id FROM players WHERE id = author_id));

-- Function to create activity feed entry for rank changes
CREATE OR REPLACE FUNCTION create_rank_change_activity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if it's a rank up or down
    IF NEW.new_mmr > NEW.old_mmr THEN
        INSERT INTO activity_feed (player_id, activity_type, title, description, metadata)
        VALUES (
            NEW.player_id,
            'rank_up',
            'Rank Up!',
            NEW.old_rank || ' → ' || NEW.new_rank,
            jsonb_build_object(
                'old_rank', NEW.old_rank,
                'new_rank', NEW.new_rank,
                'old_mmr', NEW.old_mmr,
                'new_mmr', NEW.new_mmr,
                'mmr_change', NEW.new_mmr - NEW.old_mmr
            )
        );
    ELSIF NEW.new_mmr < NEW.old_mmr THEN
        INSERT INTO activity_feed (player_id, activity_type, title, description, metadata)
        VALUES (
            NEW.player_id,
            'rank_down',
            'Rank Down',
            NEW.old_rank || ' → ' || NEW.new_rank,
            jsonb_build_object(
                'old_rank', NEW.old_rank,
                'new_rank', NEW.new_rank,
                'old_mmr', NEW.old_mmr,
                'new_mmr', NEW.new_mmr,
                'mmr_change', NEW.new_mmr - NEW.old_mmr
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rank_change_activity_trigger
    AFTER INSERT ON rank_history
    FOR EACH ROW
    EXECUTE FUNCTION create_rank_change_activity();

-- Function to create activity feed entry for big MMR gains
CREATE OR REPLACE FUNCTION create_match_activity()
RETURNS TRIGGER AS $$
DECLARE
    mmr_change INTEGER;
BEGIN
    mmr_change := NEW.mmr_after - NEW.mmr_before;
    
    -- Big MMR gain (30+)
    IF mmr_change >= 30 THEN
        INSERT INTO activity_feed (player_id, activity_type, title, description, metadata)
        VALUES (
            NEW.player_id,
            'big_mmr_gain',
            'Huge Win!',
            '+' || mmr_change || ' MMR',
            jsonb_build_object(
                'mmr_change', mmr_change,
                'match_id', NEW.match_id,
                'mvp', NEW.mvp
            )
        );
    -- Big MMR loss (20+)
    ELSIF mmr_change <= -20 THEN
        INSERT INTO activity_feed (player_id, activity_type, title, description, metadata)
        VALUES (
            NEW.player_id,
            'big_mmr_loss',
            'Tough Loss',
            mmr_change || ' MMR',
            jsonb_build_object(
                'mmr_change', mmr_change,
                'match_id', NEW.match_id
            )
        );
    END IF;
    
    -- MVP achievement
    IF NEW.mvp = TRUE THEN
        INSERT INTO activity_feed (player_id, activity_type, title, description, metadata)
        VALUES (
            NEW.player_id,
            'mvp',
            'MVP Performance!',
            NEW.kills || '/' || NEW.deaths || '/' || NEW.assists,
            jsonb_build_object(
                'match_id', NEW.match_id,
                'kills', NEW.kills,
                'deaths', NEW.deaths,
                'assists', NEW.assists
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER match_activity_trigger
    AFTER INSERT ON match_player_stats
    FOR EACH ROW
    EXECUTE FUNCTION create_match_activity();

-- Insert a default season
INSERT INTO seasons (name, description, start_date, end_date, is_active)
VALUES (
    'Season 1: Ignition',
    'The first competitive season of GRNDS',
    NOW(),
    NOW() + INTERVAL '90 days',
    TRUE
) ON CONFLICT DO NOTHING;
