import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';
import { validateEnv } from './_shared/vercel-config';

interface RefreshRankRequest {
  userId: string;
  riotName: string;
  riotTag: string;
  region: string;
}

interface RefreshRankResponse {
  success: boolean;
  discordRank?: string;
  discordRankValue?: number;
  newMMR?: number;
  oldRank?: string;
  oldMMR?: number;
  valorantRank?: string;
  boosted?: boolean;
  message?: string;
  error?: string;
}

interface ValorantMMR {
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
}

// Custom rank thresholds (from CUSTOM_RANK_SYSTEM.md)
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

const GRNDS_V_MAX_MMR = 900; // Cap at GRNDS V

/**
 * Get rank from MMR
 */
function getRankFromMMR(mmr: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (mmr >= threshold.min && mmr <= threshold.max) {
      return threshold.rank;
    }
  }
  return 'GRNDS I'; // Default
}

/**
 * Get rank value (numeric)
 */
function getRankValue(rank: string): number {
  const index = RANK_THRESHOLDS.findIndex(t => t.rank === rank);
  return index >= 0 ? index + 1 : 1;
}

/**
 * Calculate MMR from Valorant rank and ELO (capped at GRNDS V)
 */
function calculateMMRFromValorantRank(valorantRank: string, valorantELO: number): number {
  try {
    const rankMMRMap: Record<string, { min: number; max: number }> = {
      'Iron 1': { min: 0, max: 100 }, 'Iron 2': { min: 100, max: 200 }, 'Iron 3': { min: 200, max: 300 },
      'Bronze 1': { min: 300, max: 400 }, 'Bronze 2': { min: 400, max: 500 }, 'Bronze 3': { min: 500, max: 600 },
      'Silver 1': { min: 600, max: 700 }, 'Silver 2': { min: 700, max: 800 }, 'Silver 3': { min: 800, max: 900 },
      'Gold 1': { min: 800, max: 900 }, 'Gold 2': { min: 800, max: 900 }, 'Gold 3': { min: 800, max: 900 },
      'Platinum 1': { min: 800, max: 900 }, 'Platinum 2': { min: 800, max: 900 }, 'Platinum 3': { min: 800, max: 900 },
      'Diamond 1': { min: 800, max: 900 }, 'Diamond 2': { min: 800, max: 900 }, 'Diamond 3': { min: 800, max: 900 },
      'Ascendant 1': { min: 800, max: 900 }, 'Ascendant 2': { min: 800, max: 900 }, 'Ascendant 3': { min: 800, max: 900 },
      'Immortal 1': { min: 800, max: 900 }, 'Immortal 2': { min: 800, max: 900 }, 'Immortal 3': { min: 800, max: 900 },
      'Radiant': { min: 800, max: 900 },
    };

    const range = rankMMRMap[valorantRank] || { min: 0, max: 200 };
    const normalizedELO = Math.min(Math.max(valorantELO, 0), 5000);
    const eloPercentage = normalizedELO / 5000;
    const baseMMR = range.min + Math.round((range.max - range.min) * eloPercentage);
    
    return Math.min(baseMMR, GRNDS_V_MAX_MMR);
  } catch (error) {
    console.error('Error calculating MMR from Valorant rank', { valorantRank, valorantELO, error });
    return 100; // Safe fallback
  }
}

/**
 * Main refresh rank handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  console.log('=== REFRESH RANK API CALLED ===', {
    timestamp: new Date().toISOString(),
    method: req.method,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent'],
    bodyKeys: req.body ? Object.keys(req.body) : [],
  });

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Validate environment variables
    const env = validateEnv();
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Initialize Valorant API
    const valorantAPI = axios.create({
      baseURL: 'https://api.henrikdev.xyz/valorant/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValorantBot-Vercel/1.0',
        ...(env.VALORANT_API_KEY ? { 
          'Authorization': env.VALORANT_API_KEY,
        } : {}),
      },
    });

    // Log API key status (don't log the actual key)
    if (env.VALORANT_API_KEY) {
      console.log('✅ Valorant API key is configured for refresh-rank');
    } else {
      console.warn('⚠️  VALORANT_API_KEY is not set - API calls may be rate limited (30 req/min without key)');
    }

    // Input validation
    const { userId, riotName, riotTag, region } = req.body as RefreshRankRequest;

    if (!userId || !riotName || !riotTag || !region) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, riotName, riotTag, region',
      });
      return;
    }

    // Validate format
    if (typeof userId !== 'string' || !/^\d{17,19}$/.test(userId)) {
      res.status(400).json({ success: false, error: 'Invalid userId format' });
      return;
    }

    console.log('Refreshing rank', { userId, riotName, riotTag, region });

    // Get current player from database
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, discord_rank, current_mmr, discord_rank_value')
      .eq('discord_user_id', userId)
      .single();

    if (fetchError || !player) {
      console.error('Player not found in database', { userId, error: fetchError });
      res.status(404).json({
        success: false,
        error: 'Player not found. Please use /verify first to get placed.',
      });
      return;
    }

    const oldRank = player.discord_rank || 'Unranked';
    const oldMMR = player.current_mmr || 0;

    // Get current Valorant rank
    console.log('Fetching current Valorant rank', { riotName, riotTag, region });
    
    let mmr: ValorantMMR | null = null;
    try {
      const mmrUrl = `/mmr/${region}/${encodeURIComponent(riotName)}/${encodeURIComponent(riotTag)}`;
      console.log('Calling Valorant MMR API', { url: mmrUrl });
      
      const mmrResponse = await valorantAPI.get<{ status: number; data: ValorantMMR }>(mmrUrl);
      mmr = mmrResponse.data.data;
      
      console.log('Valorant MMR response received', {
        riotName,
        riotTag,
        currentTier: mmr?.currenttier,
        currentTierPatched: mmr?.currenttierpatched,
        elo: mmr?.elo,
      });
    } catch (error: any) {
      console.error('Error fetching current MMR', {
        riotName,
        riotTag,
        region,
        status: error.response?.status,
        message: error.message,
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Valorant rank. Please check your Riot ID and try again.',
      });
      return;
    }

    // Check if unrated
    const isUnrated = !mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated');
    
    let valorantRank: string;
    let valorantELO: number;
    let newMMR: number;
    let discordRank: string;
    let discordRankValue: number;
    let boosted = false;

    if (isUnrated) {
      // If unrated, keep current Discord rank (don't downgrade)
      console.log('User is unrated, keeping current Discord rank', {
        userId,
        currentRank: oldRank,
        currentMMR: oldMMR,
      });
      valorantRank = 'Unrated';
      valorantELO = 0;
      newMMR = oldMMR; // Keep current MMR
      discordRank = oldRank;
      discordRankValue = player.discord_rank_value || getRankValue(oldRank);
    } else {
      // User is ranked - calculate MMR from Valorant rank
      valorantRank = mmr!.currenttierpatched;
      valorantELO = mmr!.elo;
      const valorantMMR = calculateMMRFromValorantRank(valorantRank, valorantELO);
      const valorantDiscordRank = getRankFromMMR(valorantMMR);
      const valorantDiscordRankValue = getRankValue(valorantDiscordRank);
      
      // Get current Discord rank values
      const currentDiscordRankValue = player.discord_rank_value || getRankValue(oldRank);
      
      // Use the HIGHER of the two (Valorant rank or current Discord rank), but capped at GRNDS V
      if (valorantDiscordRankValue > currentDiscordRankValue) {
        // Valorant rank is higher - boost to it (but cap at GRNDS V)
        newMMR = valorantMMR;
        discordRank = valorantDiscordRank;
        discordRankValue = valorantDiscordRankValue;
        boosted = true;
        console.log('Boosting player from Valorant rank', {
          userId,
          oldRank,
          oldMMR,
          newRank: discordRank,
          newMMR,
          valorantRank,
        });
      } else {
        // Current Discord rank is higher or equal - keep it
        newMMR = oldMMR;
        discordRank = oldRank;
        discordRankValue = currentDiscordRankValue;
        console.log('Keeping current Discord rank (higher than Valorant rank)', {
          userId,
          currentRank: discordRank,
          currentMMR: newMMR,
          valorantRank,
          valorantDiscordRank,
        });
      }
    }

    // Update player in database
    const { error: updateError } = await supabase
      .from('players')
      .update({
        discord_rank: discordRank,
        discord_rank_value: discordRankValue,
        current_mmr: newMMR,
        peak_mmr: Math.max(player.peak_mmr || 0, newMMR),
        updated_at: new Date().toISOString(),
      })
      .eq('discord_user_id', userId);

    if (updateError) {
      console.error('Database error updating player', { userId, error: updateError });
      res.status(500).json({ success: false, error: 'Failed to update player data' });
      return;
    }

    // Log rank history if rank changed
    if (discordRank !== oldRank || newMMR !== oldMMR) {
      await supabase.from('rank_history').insert({
        player_id: player.id,
        old_rank: oldRank,
        new_rank: discordRank,
        old_mmr: oldMMR,
        new_mmr: newMMR,
        reason: boosted ? 'valorant_refresh_boost' : 'valorant_refresh',
      });
    }

    console.log('Rank refreshed successfully', {
      userId,
      oldRank,
      newRank: discordRank,
      oldMMR,
      newMMR,
      valorantRank,
      boosted,
    });

    // Return success
    const successResponse: RefreshRankResponse = {
      success: true,
      discordRank,
      discordRankValue,
      newMMR,
      oldRank,
      oldMMR,
      valorantRank,
      boosted,
      message: boosted
        ? `Rank boosted to ${discordRank} (${newMMR} MMR) based on your Valorant rank (${valorantRank}). Your Discord rank can still go higher through customs!`
        : isUnrated
        ? `Still unrated in Valorant. Your Discord rank remains ${discordRank} (${newMMR} MMR).`
        : `Current Discord rank ${discordRank} (${newMMR} MMR) is higher than your Valorant rank (${valorantRank}). Keep playing customs to rank up!`,
    };
    
    console.log('=== REFRESH RANK API SUCCESS ===', {
      timestamp: new Date().toISOString(),
      response: successResponse,
    });
    
    res.status(200).json(successResponse);
  } catch (error) {
    console.error('=== REFRESH RANK API ERROR ===', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during rank refresh',
    });
  }
}
