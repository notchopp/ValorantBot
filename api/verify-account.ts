/**
 * Vercel Cloud Agent: Rank Verification Service
 * 
 * Handles account verification and initial rank placement.
 * Called by Fly.io bot when user runs /verify command.
 * 
 * Follows guardrails: error handling, input validation, logging, type safety
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';

// Types
interface VerifyRequest {
  userId: string;
  username: string;
  riotName: string;
  riotTag: string;
  region: string;
  interactionToken?: string; // For webhook callback
  webhookUrl?: string; // Fly.io webhook endpoint
}

interface VerifyResponse {
  success: boolean;
  discordRank?: string;
  discordRankValue?: number;
  startingMMR?: number;
  valorantRank?: string;
  valorantELO?: number;
  message?: string;
  error?: string;
}

interface ValorantMMR {
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  name: string;
  tag: string;
  old: boolean;
}

interface ValorantMMRHistory {
  name: string;
  tag: string;
  region: string;
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  date: string;
  date_raw: number;
}

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Valorant API client
const valorantAPI: AxiosInstance = axios.create({
  baseURL: 'https://api.henrikdev.xyz/valorant/v1',
  timeout: 10000,
  headers: {
    'User-Agent': 'ValorantBot-Vercel/1.0',
    ...(process.env.VALORANT_API_KEY && {
      'Authorization': process.env.VALORANT_API_KEY,
    }),
  },
});

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

const GRNDS_V_MAX_MMR = 900; // Cap for initial placement

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
 * Calculate initial MMR based on Valorant rank and ELO (capped at GRNDS V)
 */
function calculateInitialMMR(valorantRank: string, valorantELO: number): number {
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
    console.error('Error calculating initial MMR', { valorantRank, valorantELO, error });
    return 100; // Safe fallback
  }
}

/**
 * Get last ranked rank from MMR history (optimized - stops early)
 */
async function getLastRankedRank(name: string, tag: string): Promise<{ rank: string; elo: number; date: string } | null> {
  try {
    const response = await valorantAPI.get<{ status: number; data: ValorantMMRHistory[] }>(
      `/mmr-history/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
    );
    
    if (!response.data.data || response.data.data.length === 0) {
      return null;
    }

    // Find first ranked entry (history is sorted by date, most recent first)
    for (const entry of response.data.data) {
      if (
        entry.currenttierpatched &&
        !entry.currenttierpatched.toLowerCase().includes('unrated') &&
        entry.currenttier > 0
      ) {
        return {
          rank: entry.currenttierpatched,
          elo: entry.elo,
          date: entry.date,
        };
      }
    }

    return null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`Error fetching last ranked rank for ${name}#${tag}:`, error.message);
    return null;
  }
}

/**
 * Main verification handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Input validation
    const { userId, username, riotName, riotTag, region } = req.body as VerifyRequest;

    if (!userId || !username || !riotName || !riotTag || !region) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, username, riotName, riotTag, region',
      });
      return;
    }

    // Validate format
    if (typeof userId !== 'string' || !/^\d{17,19}$/.test(userId)) {
      res.status(400).json({ success: false, error: 'Invalid userId format' });
      return;
    }

    if (typeof riotName !== 'string' || riotName.length < 1 || riotName.length > 50) {
      res.status(400).json({ success: false, error: 'Invalid riotName format' });
      return;
    }

    if (typeof riotTag !== 'string' || riotTag.length < 1 || riotTag.length > 10) {
      res.status(400).json({ success: false, error: 'Invalid riotTag format' });
      return;
    }

    const validRegions = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];
    if (!validRegions.includes(region.toLowerCase())) {
      res.status(400).json({ success: false, error: 'Invalid region' });
      return;
    }

    console.log('Verifying account', { userId, username, riotName, riotTag, region });

    // Check if player already exists and is verified
    const { data: existingPlayer, error: fetchError } = await supabase
      .from('players')
      .select('id, discord_rank, current_mmr')
      .eq('discord_user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Database error fetching player', { userId, error: fetchError });
      res.status(500).json({ success: false, error: 'Database error' });
      return;
    }

    if (existingPlayer && existingPlayer.discord_rank && existingPlayer.discord_rank !== 'Unranked' && existingPlayer.current_mmr > 0) {
      res.status(400).json({
        success: false,
        error: `Already placed at ${existingPlayer.discord_rank} (${existingPlayer.current_mmr} MMR)`,
      });
      return;
    }

    // Step 1: Get current Valorant rank
    let mmr: ValorantMMR | null = null;
    try {
      const mmrResponse = await valorantAPI.get<{ status: number; data: ValorantMMR }>(
        `/mmr/${region}/${encodeURIComponent(riotName)}/${encodeURIComponent(riotTag)}`
      );
      mmr = mmrResponse.data.data;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error fetching MMR', { riotName, riotTag, region, error: error.message });
      }
    }

    let valorantRank: string;
    let valorantELO: number;

    // Check if unrated
    if (!mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated')) {
      const lastRanked = await getLastRankedRank(riotName, riotTag);
      
      if (!lastRanked) {
        res.status(404).json({
          success: false,
          error: 'Could not find a ranked rank from previous acts/seasons. Please complete your placement matches first.',
        });
        return;
      }

      valorantRank = lastRanked.rank;
      valorantELO = lastRanked.elo;
    } else {
      valorantRank = mmr.currenttierpatched;
      valorantELO = mmr.elo;
    }

    // Step 2: Calculate initial MMR (capped at GRNDS V)
    const startingMMR = calculateInitialMMR(valorantRank, valorantELO);
    const discordRank = getRankFromMMR(startingMMR);
    const discordRankValue = getRankValue(discordRank);

    // Step 3: Create or update player in database
    const playerData = {
      discord_user_id: userId,
      discord_username: username,
      riot_name: riotName,
      riot_tag: riotTag,
      riot_region: region,
      discord_rank: discordRank,
      discord_rank_value: discordRankValue,
      current_mmr: startingMMR,
      peak_mmr: startingMMR,
      verified_at: new Date().toISOString(),
    };

    const { data: player, error: upsertError } = await supabase
      .from('players')
      .upsert(playerData, { onConflict: 'discord_user_id' })
      .select()
      .single();

    if (upsertError || !player) {
      console.error('Database error upserting player', { userId, error: upsertError });
      res.status(500).json({ success: false, error: 'Failed to save player data' });
      return;
    }

    // Step 4: Log rank history
    await supabase.from('rank_history').insert({
      player_id: player.id,
      old_rank: existingPlayer?.discord_rank || 'Unranked',
      new_rank: discordRank,
      old_mmr: existingPlayer?.current_mmr || 0,
      new_mmr: startingMMR,
      reason: 'verification',
    });

    console.log('Account verified successfully', {
      userId,
      username,
      riotId: `${riotName}#${riotTag}`,
      discordRank,
      startingMMR,
    });

    // Return success
    res.status(200).json({
      success: true,
      discordRank,
      discordRankValue,
      startingMMR,
      valorantRank,
      valorantELO,
      message: `Placed at ${discordRank} (${startingMMR} MMR)`,
    });
  } catch (error) {
    console.error('Verify account error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
    });
  }
}
