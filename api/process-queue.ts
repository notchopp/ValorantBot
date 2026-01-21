/**
 * Vercel Cloud Agent: Queue Processor
 * 
 * Processes queue when it hits 10 players - balances teams and creates match.
 * Called by Fly.io bot when queue becomes full.
 * 
 * Follows guardrails: error handling, input validation, logging, type safety
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Types
interface ProcessQueueRequest {
  queueId?: string; // Optional queue identifier
  balancingMode?: 'auto' | 'captain';
  game?: 'valorant' | 'marvel_rivals';
  webhookUrl?: string; // Fly.io webhook endpoint
}

export interface ProcessQueueResponse {
  success: boolean;
  match?: {
    matchId: string;
    map: string;
    hostUserId: string;
    teamA: string[];
    teamB: string[];
  };
  error?: string;
}

// Initialize Supabase with SERVICE_ROLE_KEY for writes (bypasses RLS)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Maps for random selection
const MAPS = [
  'Bind', 'Haven', 'Split', 'Ascent', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss',
];

/**
 * Snake draft team balancing algorithm
 */
function balanceTeamsAuto(players: Array<{ userId: string; mmr: number }>): { teamA: string[]; teamB: string[] } {
  // Sort by MMR (highest first)
  const sorted = [...players].sort((a, b) => b.mmr - a.mmr);

  const teamA: string[] = [];
  const teamB: string[] = [];

  // Snake draft: A, B, B, A, A, B, B, A, A, B
  for (let i = 0; i < sorted.length; i++) {
    if (i % 4 === 0 || i % 4 === 3) {
      teamA.push(sorted[i].userId);
    } else {
      teamB.push(sorted[i].userId);
    }
  }

  return { teamA, teamB };
}

/**
 * Main queue processing handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Log all incoming requests for debugging
  console.log('=== PROCESS QUEUE API CALLED ===', {
    timestamp: new Date().toISOString(),
    method: req.method,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent'],
    bodyKeys: req.body ? Object.keys(req.body) : [],
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { balancingMode = 'auto', game = 'valorant' } = req.body as ProcessQueueRequest;

    console.log('Processing queue', { balancingMode, game });

    // Get all queued players
    const { data: queueEntries, error: queueError } = await supabase
      .from('queue')
      .select('player_id, joined_at, game')
      .eq('game', game)
      .order('joined_at', { ascending: true });

    if (queueError) {
      console.error('Error fetching queue', { error: queueError });
      res.status(500).json({ success: false, error: 'Failed to fetch queue' });
      return;
    }

    if (!queueEntries || queueEntries.length < 10) {
      res.status(400).json({ success: false, error: `Queue has ${queueEntries?.length || 0} players, need 10` });
      return;
    }

    // Get player data with MMR
    const playerIds = queueEntries.map(q => q.player_id);
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('id, discord_user_id, current_mmr, valorant_mmr, marvel_rivals_mmr, preferred_game')
      .in('id', playerIds);

    if (playersError || !players || players.length !== 10) {
      console.error('Error fetching players', { error: playersError, count: players?.length });
      res.status(500).json({ success: false, error: 'Failed to fetch player data' });
      return;
    }

    // Balance teams
    const playersWithMMR = players.map(p => ({
      userId: p.discord_user_id,
      mmr: game === 'marvel_rivals'
        ? (p.marvel_rivals_mmr || 0)
        : (p.valorant_mmr || p.current_mmr || 0),
    }));

    const { teamA, teamB } = balanceTeamsAuto(playersWithMMR);

    // Select random map
    const selectedMap = MAPS[Math.floor(Math.random() * MAPS.length)];

    // Select random host from team A
    const hostUserId = teamA[Math.floor(Math.random() * teamA.length)];

    // Generate match ID
    const matchId = `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create match in database
    const matchType = game === 'marvel_rivals' ? 'marvel_rivals' : 'custom';
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        match_id: matchId,
        map: selectedMap,
        host_user_id: hostUserId,
        host_selected_at: new Date().toISOString(),
        host_confirmed: false,
        team_a: teamA,
        team_b: teamB,
        match_type: matchType,
        status: 'pending',
      })
      .select()
      .single();

    if (matchError || !match) {
      console.error('Error creating match', { error: matchError });
      res.status(500).json({ success: false, error: 'Failed to create match' });
      return;
    }

    // Clear queue
    const { error: clearError } = await supabase
      .from('queue')
      .delete()
      .in('player_id', playerIds)
      .eq('game', game);

    if (clearError) {
      console.warn('Error clearing queue', { error: clearError });
      // Continue anyway - match is created
    }

    console.log('Queue processed successfully', { matchId, teamASize: teamA.length, teamBSize: teamB.length });

    const successResponse = {
      success: true,
      match: {
        matchId,
        map: selectedMap,
        hostUserId,
        teamA,
        teamB,
      },
    };
    
    console.log('=== PROCESS QUEUE API SUCCESS ===', {
      timestamp: new Date().toISOString(),
      matchId,
      map: selectedMap,
    });

    res.status(200).json(successResponse);
  } catch (error) {
    console.error('=== PROCESS QUEUE API ERROR ===', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during queue processing',
    });
  }
}
