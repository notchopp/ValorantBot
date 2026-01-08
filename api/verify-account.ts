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

export interface VerifyResponse {
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
  console.log('Fetching last ranked rank from MMR history', { name, tag });
  
  try {
    const url = `/mmr-history/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    console.log('Calling Valorant API:', { url });
    
    const response = await valorantAPI.get<{ status: number; data: ValorantMMRHistory[] }>(url);
    
    console.log('MMR history response received', {
      name,
      tag,
      status: response.status,
      dataLength: response.data.data?.length || 0,
    });
    
    if (!response.data.data || response.data.data.length === 0) {
      console.log('No MMR history data found', { name, tag });
      return null;
    }

    // Find first ranked entry (history is sorted by date, most recent first)
    for (let i = 0; i < response.data.data.length; i++) {
      const entry = response.data.data[i];
      console.log(`Checking MMR history entry ${i}`, {
        date: entry.date,
        tier: entry.currenttier,
        tierPatched: entry.currenttierpatched,
        elo: entry.elo,
      });
      
      if (
        entry.currenttierpatched &&
        !entry.currenttierpatched.toLowerCase().includes('unrated') &&
        entry.currenttier > 0
      ) {
        console.log('Found ranked entry in history', {
          name,
          tag,
          rank: entry.currenttierpatched,
          elo: entry.elo,
          date: entry.date,
        });
        
        return {
          rank: entry.currenttierpatched,
          elo: entry.elo,
          date: entry.date,
        };
      }
    }

    console.log('No ranked entries found in MMR history', {
      name,
      tag,
      totalEntries: response.data.data.length,
    });
    
    return null;
  } catch (error: any) {
    console.error('Error fetching last ranked rank', {
      name,
      tag,
      status: error.response?.status,
      message: error.message,
      data: error.response?.data,
    });
    
    if (error.response?.status === 404) {
      console.log('MMR history not found (404)', { name, tag });
      return null;
    }
    
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
  // Log all incoming requests for debugging
  console.log('=== VERIFY ACCOUNT API CALLED ===', {
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
        data: error.response?.data,
      });
      
      if (error.response?.status !== 404) {
        console.error('Non-404 error during MMR fetch - continuing with history check');
      }
    }

    let valorantRank: string;
    let valorantELO: number;

    // Check if unrated
    const isUnrated = !mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated');
    console.log('Checking rank status', {
      riotName,
      riotTag,
      isUnrated,
      currentTierPatched: mmr?.currenttierpatched,
    });
    
    if (isUnrated) {
      console.log('User is currently unrated, checking ranked history', { riotName, riotTag });
      const lastRanked = await getLastRankedRank(riotName, riotTag);
      
      if (!lastRanked) {
        console.error('No ranked history found for user', { riotName, riotTag });
        res.status(404).json({
          success: false,
          error: `Could not find a ranked rank from previous acts/seasons for "${riotName}#${riotTag}". Please complete your placement matches first, or ensure you have played ranked in a previous act.`,
        });
        return;
      }

      console.log('Using ranked history for placement', {
        riotName,
        riotTag,
        rank: lastRanked.rank,
        elo: lastRanked.elo,
        date: lastRanked.date,
      });
      
      valorantRank = lastRanked.rank;
      valorantELO = lastRanked.elo;
    } else {
<<<<<<< HEAD
      // TypeScript knows mmr is not null here due to the condition above
      const validMMR = mmr;
      valorantRank = validMMR.currenttierpatched;
      valorantELO = validMMR.elo;
=======
      console.log('Using current rank for placement', {
        riotName,
        riotTag,
        rank: mmr.currenttierpatched,
        elo: mmr.elo,
      });
      
      valorantRank = mmr.currenttierpatched;
      valorantELO = mmr.elo;
>>>>>>> c0dfc6ca2641384cef56c3f793a0d603c5e15ecc
    }

    // Step 2: Calculate initial MMR (capped at GRNDS V)
    console.log('Calculating initial MMR', { valorantRank, valorantELO });
    const startingMMR = calculateInitialMMR(valorantRank, valorantELO);
    const discordRank = getRankFromMMR(startingMMR);
    const discordRankValue = getRankValue(discordRank);
    
    console.log('Initial placement calculated', {
      userId,
      riotId: `${riotName}#${riotTag}`,
      valorantRank,
      valorantELO,
      startingMMR,
      discordRank,
      discordRankValue,
    });

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
    
    console.log('Upserting player to database', { userId, playerData });

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
    
    console.log('Player upserted successfully', { userId, playerId: player.id });

    // Step 4: Log rank history
    console.log('Logging rank history', {
      playerId: player.id,
      oldRank: existingPlayer?.discord_rank || 'Unranked',
      newRank: discordRank,
    });
    
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
    const successResponse = {
      success: true,
      discordRank,
      discordRankValue,
      startingMMR,
      valorantRank,
      valorantELO,
      message: `Placed at ${discordRank} (${startingMMR} MMR)`,
    };
    
    console.log('=== VERIFY ACCOUNT API SUCCESS ===', {
      timestamp: new Date().toISOString(),
      response: successResponse,
    });
    
    res.status(200).json(successResponse);
  } catch (error) {
    console.error('=== VERIFY ACCOUNT API ERROR ===', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error during verification',
    });
  }
}
