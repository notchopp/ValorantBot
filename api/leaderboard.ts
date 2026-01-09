/**
 * Vercel API: Leaderboard Endpoint
 * 
 * Returns top players by MMR for display on the website
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { validateEnv } from './_shared/vercel-config';

interface LeaderboardPlayer {
  rank: number;
  username: string;
  rankName?: string;
  mmr: number;
  wins: number;
  losses: number;
  winRate: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers for web access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const env = validateEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    const limit = parseInt(req.query.limit as string) || 25;
    const validLimit = Math.min(Math.max(1, limit), 50); // Clamp between 1 and 50

    // Get top players by MMR
    const { data: players, error } = await supabase
      .from('players')
      .select('id, discord_user_id, discord_username, discord_rank, current_mmr, peak_mmr')
      .order('current_mmr', { ascending: false })
      .limit(validLimit);

    if (error) {
      console.error('Error fetching leaderboard:', error);
      return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }

    if (!players || players.length === 0) {
      return res.status(200).json({ players: [] });
    }

    // Get player database IDs
    const playerDbIds = players.map(p => p.id).filter(id => id) as string[];
    
    if (playerDbIds.length === 0) {
      return res.status(200).json({ players: [] });
    }

    // Get match stats
    const { data: matchStats } = await supabase
      .from('match_player_stats')
      .select('player_id, team, match_id')
      .in('player_id', playerDbIds);

    // Get completed matches with winners
    const matchIds = matchStats ? [...new Set(matchStats.map(s => s.match_id).filter(id => id))] : [];
    const { data: matches } = matchIds.length > 0 ? await supabase
      .from('matches')
      .select('id, winner')
      .in('id', matchIds)
      .eq('status', 'completed')
      .not('winner', 'is', null) : { data: [] };

    // Create match winner map
    const matchWinnerMap = new Map<string, string>();
    if (matches) {
      matches.forEach(m => {
        if (m.id && m.winner) {
          matchWinnerMap.set(m.id, m.winner);
        }
      });
    }

    // Calculate wins/losses per player
    const statsMap = new Map<string, { wins: number; losses: number }>();
    
    if (matchStats) {
      for (const stat of matchStats) {
        if (!stat.player_id || !stat.match_id) continue;
        const playerDbId = stat.player_id;
        const current = statsMap.get(playerDbId) || { wins: 0, losses: 0 };
        const winner = matchWinnerMap.get(stat.match_id);
        
        // Check if player's team won
        if (winner && stat.team === winner) {
          current.wins++;
        } else if (winner) {
          current.losses++;
        }
        statsMap.set(playerDbId, current);
      }
    }

    // Build leaderboard response
    const leaderboard: LeaderboardPlayer[] = players.map((player, index) => {
      const playerDbId = player.id || '';
      const stats = statsMap.get(playerDbId) || { wins: 0, losses: 0 };
      const totalGames = stats.wins + stats.losses;
      const winRate = totalGames > 0 ? (stats.wins / totalGames) * 100 : 0;

      return {
        rank: index + 1,
        username: player.discord_username || 'Unknown',
        rankName: player.discord_rank && player.discord_rank !== 'Unranked' ? player.discord_rank : undefined,
        mmr: player.current_mmr || 0,
        wins: stats.wins,
        losses: stats.losses,
        winRate: Math.round(winRate * 10) / 10, // Round to 1 decimal
      };
    });

    return res.status(200).json({
      success: true,
      players: leaderboard,
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}