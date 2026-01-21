-- Migration 015: Add game support to queue for separate Valorant/Marvel queues

ALTER TABLE queue
ADD COLUMN IF NOT EXISTS game TEXT NOT NULL DEFAULT 'valorant'
  CHECK (game IN ('valorant', 'marvel_rivals'));

CREATE INDEX IF NOT EXISTS idx_queue_game_joined_at ON queue(game, joined_at);
