/**
 * Vercel Cloud Agent: Rank Calculation Service
 * 
 * Calculates MMR changes and rank updates after match reporting.
 * Called by Fly.io bot after /match report command.
 * 
 * Follows guardrails: error handling, input validation, logging, type safety
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Types
interface CalculateRankRequest {
  matchId: string;
  webhookUrl?: string; // Fly.io webhook endpoint for callbacks
}

export interface CalculateRankResponse {
  success: boolean;
  results?: Array<{
    playerId: string;
    oldMMR: number;
    newMMR: number;
    oldRank: string;
    newRank: string;
    rankChanged: boolean;
    pointsEarned: number;
  }>;
  error?: string;
}

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Rank thresholds (same as verify-account.ts)
const RANK_THRESHOLDS = [
  { rank: 'GRNDS I', min: 0, max: 199 },
  { rank: 'GRNDS II', min: 200, max: 399 },
  { rank: 'GRNDS III', min: 400, max: 599 },
  { rank: 'GRNDS IV', min: 600, max: 799 },
  { rank: 'GRNDS V', min: 800, max: 999 },
  { rank: 'BREAKPOINT I', min: 1000, max: 1199 },
  { rank: 'BREAKPOINT II', min: 1200, max: 1399 },
  { rank: 'BREAKPOINT III', min: 1400, max: 1599 },
  { rank: 'BREAKPOINT IV', min: 1600, max: 1799 },
  { rank: 'BREAKPOINT V', min: 1800, max: 1999 },
  { rank: 'CHALLENGER I', min: 2000, max: 2199 },
  { rank: 'CHALLENGER II', min: 2200, max: 2399 },
  { rank: 'CHALLENGER III', min: 2400, max: 2599 },
  { rank: 'CHALLENGER IV', min: 2600, max: 2799 },
  { rank: 'CHALLENGER V', min: 2800, max: 2999 },
  { rank: 'X', min: 3000, max: 99999 },
];

function getRankFromMMR(mmr: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (mmr >= threshold.min && mmr <= threshold.max) {
      return threshold.rank;
    }
  }
  return 'GRNDS I';
}

/**
 * Calculate points earned based on match performance (sticky system)
 */
function calculateMatchPoints(
  won: boolean,
  kills: number,
  deaths: number,
  _assists: number,
  mvp: boolean,
  currentMMR: number
): number {
  try {
    let basePoints = won ? 15 : -8; // Reduced for stickiness
    let mvpBonus = 0;

    const kd = deaths > 0 ? kills / deaths : kills;
    let performanceMultiplier = 1.0;

    if (won) {
      if (kd > 2.0) performanceMultiplier = 1.3;
      else if (kd > 1.5) performanceMultiplier = 1.2;
      else if (kd > 1.0) performanceMultiplier = 1.1;
      else if (kd < 0.7) performanceMultiplier = 0.9;
    } else {
      if (kd > 1.5) performanceMultiplier = 0.95; // Less penalty for good performance
      else if (kd < 0.5) performanceMultiplier = 1.1; // More penalty for poor performance
    }

    if (mvp && won) mvpBonus = 8;
    else if (mvp && !won) mvpBonus = 3;

    const rawPoints = Math.round(basePoints * performanceMultiplier) + mvpBonus;
    
    // Sticky multiplier - harder to gain MMR at higher ranks, easier to lose
    let stickyMultiplier = 1.0;
    if (rawPoints > 0) {
      // Gains are reduced at higher MMR
      if (currentMMR > 2500) stickyMultiplier = 0.7;
      else if (currentMMR > 2000) stickyMultiplier = 0.8;
      else if (currentMMR > 1500) stickyMultiplier = 0.9;
    } else {
      // Losses are amplified at higher MMR
      if (currentMMR > 2500) stickyMultiplier = 1.2;
      else if (currentMMR > 2000) stickyMultiplier = 1.1;
    }

    return Math.round(rawPoints * stickyMultiplier);
  } catch (error) {
    console.error('Error calculating match points', { error });
    return won ? 15 : -8; // Fallback
  }
}

/**
 * Main rank calculation handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Log all incoming requests for debugging
  console.log('=== CALCULATE RANK API CALLED ===', {
    timestamp: new Date().toISOString(),
    method: req.method,
    headers: req.headers,
    body: req.body,
  });

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { matchId } = req.body as CalculateRankRequest;

    if (!matchId || typeof matchId !== 'string') {
      console.log('Invalid request - missing matchId', { body: req.body });
      res.status(400).json({ success: false, error: 'Missing or invalid matchId' });
      return;
    }

    console.log('Calculating rank changes for match', { matchId });

    // Get match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchId)
      .single();

    if (matchError || !match) {
      console.error('Match not found', { matchId, error: matchError });
      res.status(404).json({ success: false, error: 'Match not found' });
      return;
    }

    // Get all player stats for this match
    const { data: playerStats, error: statsError } = await supabase
      .from('match_player_stats')
      .select('*')
      .eq('match_id', match.id);

    if (statsError) {
      console.error('Error fetching player stats', { matchId, error: statsError });
      res.status(500).json({ success: false, error: 'Failed to fetch player stats' });
      return;
    }

    if (!playerStats || playerStats.length === 0) {
      res.status(400).json({ success: false, error: 'No player stats found for match' });
      return;
    }

    const results: CalculateRankResponse['results'] = [];

    // Calculate rank changes for each player
    for (const stat of playerStats) {
      // Get current player data
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('*')
        .eq('id', stat.player_id)
        .single();

      if (playerError || !player) {
        console.warn('Player not found', { playerId: stat.player_id });
        continue;
      }

      const oldMMR = stat.mmr_before || player.current_mmr;
      const won = match.winner === stat.team;

      // Calculate points earned
      const pointsEarned = calculateMatchPoints(
        won,
        stat.kills || 0,
        stat.deaths || 0,
        stat.assists || 0,
        stat.mvp || false,
        oldMMR
      );

      // Calculate new MMR
      const newMMR = Math.max(0, oldMMR + pointsEarned); // Ensure non-negative

      // Determine new rank
      const oldRank = player.discord_rank || 'Unranked';
      const newRank = getRankFromMMR(newMMR);
      const rankChanged = oldRank !== newRank;

      // Update player MMR and rank
      const { error: updateError } = await supabase
        .from('players')
        .update({
          current_mmr: newMMR,
          discord_rank: newRank,
          discord_rank_value: RANK_THRESHOLDS.findIndex(t => t.rank === newRank) + 1,
          peak_mmr: Math.max(player.peak_mmr || 0, newMMR),
        })
        .eq('id', player.id);

      if (updateError) {
        console.error('Error updating player MMR', { playerId: player.id, error: updateError });
        continue;
      }

      // Update match_player_stats with final MMR
      await supabase
        .from('match_player_stats')
        .update({
          mmr_after: newMMR,
          points_earned: pointsEarned,
        })
        .eq('id', stat.id);

      // Log rank change if rank changed
      if (rankChanged) {
        await supabase.from('rank_history').insert({
          player_id: player.id,
          old_rank: oldRank,
          new_rank: newRank,
          old_mmr: oldMMR,
          new_mmr: newMMR,
          reason: 'match',
          match_id: match.id,
        });
      }

      results.push({
        playerId: player.discord_user_id,
        oldMMR,
        newMMR,
        oldRank,
        newRank,
        rankChanged,
        pointsEarned,
      });
    }

    console.log('Rank calculation complete', { matchId, resultsCount: results.length });

    const successResponse = {
      success: true,
      results,
    };
    
    console.log('=== CALCULATE RANK API SUCCESS ===', {
      timestamp: new Date().toISOString(),
      matchId,
      resultsCount: results.length,
    });

    res.status(200).json(successResponse);
  } catch (error) {
    console.error('=== CALCULATE RANK API ERROR ===', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during rank calculation',
    });
  }
}
