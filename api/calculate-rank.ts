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

// Rank thresholds (same as verify-account.ts)
const RANK_THRESHOLDS = [
  { rank: 'GRNDS I', min: 0, max: 299 },
  { rank: 'GRNDS II', min: 300, max: 599 },
  { rank: 'GRNDS III', min: 600, max: 899 },
  { rank: 'GRNDS IV', min: 900, max: 1199 },
  { rank: 'GRNDS V', min: 1200, max: 1499 },
  { rank: 'BREAKPOINT I', min: 1500, max: 1699 },
  { rank: 'BREAKPOINT II', min: 1700, max: 1899 },
  { rank: 'BREAKPOINT III', min: 1900, max: 2099 },
  { rank: 'BREAKPOINT IV', min: 2100, max: 2299 },
  { rank: 'BREAKPOINT V', min: 2300, max: 2399 },
  { rank: 'CHALLENGER I', min: 2400, max: 2499 },
  { rank: 'CHALLENGER II', min: 2500, max: 2599 },
  { rank: 'CHALLENGER III', min: 2600, max: 2999 },
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

function getRankValue(rank: string): number {
  const rankMap: Record<string, number> = {
    'Unranked': 0,
    'GRNDS I': 1,
    'GRNDS II': 2,
    'GRNDS III': 3,
    'GRNDS IV': 4,
    'GRNDS V': 5,
    'BREAKPOINT I': 6,
    'BREAKPOINT II': 7,
    'BREAKPOINT III': 8,
    'BREAKPOINT IV': 9,
    'BREAKPOINT V': 10,
    'CHALLENGER I': 11,
    'CHALLENGER II': 12,
    'CHALLENGER III': 13,
    'ABSOLUTE': 14,
    'X': 15,
  };
  return rankMap[rank] ?? 0;
}

function computeCombinedRank(params: {
  roleMode: 'highest' | 'primary';
  primaryGame: 'valorant' | 'marvel_rivals';
  valorantRank: string;
  valorantRankValue: number;
  valorantMMR: number;
  marvelRank: string;
  marvelRankValue: number;
  marvelMMR: number;
}): { discordRank: string; discordRankValue: number; currentMMR: number } {
  const {
    roleMode,
    primaryGame,
    valorantRank,
    valorantRankValue,
    valorantMMR,
    marvelRank,
    marvelRankValue,
    marvelMMR,
  } = params;

  if (roleMode === 'primary') {
    if (primaryGame === 'marvel_rivals') {
      return { discordRank: marvelRank, discordRankValue: marvelRankValue, currentMMR: marvelMMR };
    }
    return { discordRank: valorantRank, discordRankValue: valorantRankValue, currentMMR: valorantMMR };
  }

  if (marvelRankValue > valorantRankValue) {
    return { discordRank: marvelRank, discordRankValue: marvelRankValue, currentMMR: marvelMMR };
  }
  if (marvelRankValue === valorantRankValue && marvelMMR > valorantMMR) {
    return { discordRank: marvelRank, discordRankValue: marvelRankValue, currentMMR: marvelMMR };
  }
  return { discordRank: valorantRank, discordRankValue: valorantRankValue, currentMMR: valorantMMR };
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
  currentMMR: number,
  expectedScore: number
): number {
  try {
    let mvpBonus = 0;

    const clampedExpected = Math.min(Math.max(expectedScore, 0), 1);
    const resultScore = won ? 1 : 0;
    const kFactor = getKFactor(currentMMR);
    let basePoints = Math.round(kFactor * (resultScore - clampedExpected));

    const kd = deaths > 0 ? kills / deaths : kills;
    let performanceMultiplier = 1.0;

    if (won) {
      if (kd >= 2.0) performanceMultiplier = 1.3;
      else if (kd >= 1.5) performanceMultiplier = 1.15;
      else if (kd >= 1.0) performanceMultiplier = 1.0;
      else if (kd >= 0.7) performanceMultiplier = 0.9;
      else performanceMultiplier = 0.8;
    } else {
      if (kd >= 1.5) performanceMultiplier = 0.9;
      else if (kd >= 1.0) performanceMultiplier = 1.0;
      else if (kd >= 0.5) performanceMultiplier = 1.1;
      else performanceMultiplier = 1.2;
    }

    if (mvp && won) mvpBonus = 6;
    else if (mvp && !won) mvpBonus = 3;

    const rawPoints = Math.round(basePoints * performanceMultiplier) + mvpBonus;
    
    // Sticky multiplier - harder to gain MMR at higher ranks, easier to lose
    const stickyMultiplier = getStickyMultiplier(currentMMR, rawPoints > 0);

    return Math.round(rawPoints * stickyMultiplier);
  } catch (error) {
    console.error('Error calculating match points', { error });
    return won ? 15 : -8; // Fallback
  }
}

function getStickyMultiplier(currentMMR: number, isGain: boolean): number {
  if (isGain) {
    if (currentMMR >= 3000) return 0.8;
    if (currentMMR >= 2600) return 0.85;
    if (currentMMR >= 1500) return 0.9;
    return 1.0;
  }
  if (currentMMR >= 3000) return 0.9;
  if (currentMMR >= 2600) return 0.92;
  if (currentMMR >= 1500) return 0.95;
  return 1.0;
}

function getKFactor(currentMMR: number): number {
  if (currentMMR >= 3000) return 18;
  if (currentMMR >= 2600) return 22;
  if (currentMMR >= 2400) return 26;
  if (currentMMR >= 1500) return 30;
  return 36;
}

function getTeamAverageMMR(stats: Array<{ mmr_before?: number }>): number {
  if (!stats.length) return 0;
  const total = stats.reduce((sum, stat) => sum + (stat.mmr_before || 0), 0);
  return Math.round(total / stats.length);
}

function getExpectedScore(teamMMR: number, opponentMMR: number): number {
  const exponent = (opponentMMR - teamMMR) / 400;
  return 1 / (1 + Math.pow(10, exponent));
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

    const matchGame: 'valorant' | 'marvel_rivals' =
      match.match_type === 'marvel_rivals' ? 'marvel_rivals' : 'valorant';

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
    const teamAStats = playerStats.filter((stat) => stat.team === 'A');
    const teamBStats = playerStats.filter((stat) => stat.team === 'B');
    const teamAAvg = getTeamAverageMMR(teamAStats);
    const teamBAvg = getTeamAverageMMR(teamBStats);
    const expectedA = getExpectedScore(teamAAvg, teamBAvg);
    const expectedB = 1 - expectedA;

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

      const oldMMR = stat.mmr_before || (matchGame === 'marvel_rivals'
        ? (player.marvel_rivals_mmr || 0)
        : (player.valorant_mmr || player.current_mmr || 0));
      const won = match.winner === stat.team;
      const expectedScore = stat.team === 'A' ? expectedA : expectedB;

      // Calculate points earned
      const pointsEarned = calculateMatchPoints(
        won,
        stat.kills || 0,
        stat.deaths || 0,
        stat.assists || 0,
        stat.mvp || false,
        oldMMR,
        expectedScore
      );

      // Calculate new MMR
      const newMMR = Math.max(0, oldMMR + pointsEarned); // Ensure non-negative

      // Determine new rank
      const oldRank = matchGame === 'marvel_rivals'
        ? (player.marvel_rivals_rank || 'Unranked')
        : (player.valorant_rank || player.discord_rank || 'Unranked');
      const newRank = getRankFromMMR(newMMR);
      const rankChanged = oldRank !== newRank;
      const newRankValue = getRankValue(newRank);

      const updatedValorantRank = matchGame === 'valorant' ? newRank : (player.valorant_rank || player.discord_rank || 'Unranked');
      const updatedValorantRankValue = matchGame === 'valorant'
        ? newRankValue
        : (player.valorant_rank_value ?? player.discord_rank_value ?? getRankValue(updatedValorantRank));
      const updatedValorantMMR = matchGame === 'valorant'
        ? newMMR
        : (player.valorant_mmr ?? player.current_mmr ?? 0);
      const updatedMarvelRank = matchGame === 'marvel_rivals' ? newRank : (player.marvel_rivals_rank || 'Unranked');
      const updatedMarvelRankValue = matchGame === 'marvel_rivals'
        ? newRankValue
        : (player.marvel_rivals_rank_value ?? getRankValue(updatedMarvelRank));
      const updatedMarvelMMR = matchGame === 'marvel_rivals'
        ? newMMR
        : (player.marvel_rivals_mmr ?? 0);

      const combined = computeCombinedRank({
        roleMode: player.role_mode || 'highest',
        primaryGame: player.primary_game || 'valorant',
        valorantRank: updatedValorantRank,
        valorantRankValue: updatedValorantRankValue,
        valorantMMR: updatedValorantMMR,
        marvelRank: updatedMarvelRank,
        marvelRankValue: updatedMarvelRankValue,
        marvelMMR: updatedMarvelMMR,
      });

      const updatePayload: Record<string, unknown> =
        matchGame === 'marvel_rivals'
          ? {
              marvel_rivals_mmr: newMMR,
              marvel_rivals_rank: newRank,
              marvel_rivals_rank_value: newRankValue,
              marvel_rivals_peak_mmr: Math.max(player.marvel_rivals_peak_mmr || 0, newMMR),
              discord_rank: combined.discordRank,
              discord_rank_value: combined.discordRankValue,
              current_mmr: combined.currentMMR,
              peak_mmr: Math.max(player.peak_mmr || 0, combined.currentMMR),
            }
          : {
              valorant_mmr: newMMR,
              valorant_rank: newRank,
              valorant_rank_value: newRankValue,
              valorant_peak_mmr: Math.max(player.valorant_peak_mmr || 0, newMMR),
              discord_rank: combined.discordRank,
              discord_rank_value: combined.discordRankValue,
              current_mmr: combined.currentMMR,
              peak_mmr: Math.max(player.peak_mmr || 0, combined.currentMMR),
            };

      // Update player MMR and rank
      const { error: updateError } = await supabase
        .from('players')
        .update(updatePayload)
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
