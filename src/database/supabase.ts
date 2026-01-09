import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabaseUrl = process.env.SUPABASE_URL || '';
// Use SERVICE_ROLE_KEY for bot operations to bypass RLS policies
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. Some features will be disabled.');
  console.warn('   Expected: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY as fallback)');
}

// Use service role key with RLS bypass for bot operations
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Database types
export interface DatabasePlayer {
  id: string;
  discord_user_id: string;
  discord_username: string;
  riot_name?: string | null;
  riot_tag?: string | null;
  riot_puuid?: string | null;
  riot_region?: string | null;
  discord_rank: string;
  discord_rank_value: number;
  discord_mmr: number;
  current_mmr: number;
  peak_mmr: number;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMatch {
  id: string;
  match_id: string;
  match_type: 'custom' | 'valorant';
  match_date: string;
  map?: string | null;
  host_id?: string | null;
  host_user_id?: string | null;
  host_invite_code?: string | null;
  host_confirmed?: boolean | null;
  host_selected_at?: string | null;
  team_a: string[]; // Array of player IDs
  team_b: string[]; // Array of player IDs
  winner?: 'A' | 'B' | null;
  score?: { teamA: number; teamB: number } | null;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string | null;
}

export interface DatabaseMatchPlayerStats {
  id: string;
  match_id: string;
  player_id: string;
  team: 'A' | 'B';
  kills: number;
  deaths: number;
  assists: number;
  mvp: boolean;
  damage: number;
  score: number;
  points_earned: number;
  mmr_before: number;
  mmr_after: number;
  created_at: string;
}

export interface DatabaseRankHistory {
  id: string;
  player_id: string;
  old_rank?: string | null;
  new_rank: string;
  old_mmr: number;
  new_mmr: number;
  reason: 'match' | 'verification' | 'adjustment';
  match_id?: string | null;
  created_at: string;
}

export interface DatabaseRankThreshold {
  rank: string;
  min_mmr: number;
  max_mmr: number;
  role_id?: string | null;
  created_at: string;
}

export interface DatabaseQueue {
  id: string;
  player_id: string;
  joined_at: string;
  expires_at?: string | null;
}
