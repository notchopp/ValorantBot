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
  games_needed_for_rating?: number;
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
  baseURL: 'https://api.henrikdev.xyz/valorant',
  timeout: 10000,
  headers: {
    'User-Agent': 'ValorantBot-Vercel/1.0',
    'Content-Type': 'application/json',
    ...(process.env.VALORANT_API_KEY ? {
      'Authorization': process.env.VALORANT_API_KEY,
    } : {}),
  },
});

// Log API key status (don't log the actual key)
if (process.env.VALORANT_API_KEY) {
  console.log('✅ Valorant API key is configured');
} else {
  console.warn('⚠️  VALORANT_API_KEY is not set - API calls may be rate limited (30 req/min without key)');
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

const GRNDS_V_MAX_MMR = 900; // Cap for initial placement at GRNDS V

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

    // Normalize inputs (ensure tags are strings, even if numeric like "1017")
    const normalizedName = typeof riotName === 'string' ? riotName.trim() : String(riotName || '').trim();
    const normalizedTag = typeof riotTag === 'string' ? riotTag.trim() : String(riotTag || '').trim();

    if (!normalizedName || normalizedName.length < 1 || normalizedName.length > 50) {
      res.status(400).json({ success: false, error: 'Invalid riotName format' });
      return;
    }

    if (!normalizedTag || normalizedTag.length < 1 || normalizedTag.length > 10) {
      res.status(400).json({ success: false, error: 'Invalid riotTag format' });
      return;
    }

    const validRegions = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];
    if (!validRegions.includes(region.toLowerCase())) {
      res.status(400).json({ success: false, error: 'Invalid region' });
      return;
    }

    console.log('Verifying account', { userId, username, riotName: normalizedName, riotTag: normalizedTag, region });

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

    // Step 1: Get account for PUUID (using normalized values from above)
    console.log('Fetching account information', { 
      riotName: normalizedName, 
      riotTag: normalizedTag,
    });
    
    let puuid: string | null = null;
    let accountRegion: string = region;
    try {
      const encodedName = encodeURIComponent(normalizedName);
      const encodedTag = encodeURIComponent(normalizedTag);
      const accountUrl = `/v2/account/${encodedName}/${encodedTag}`;
      
      console.log('Calling Valorant Account API', { 
        url: accountUrl,
        encodedName,
        encodedTag,
      });
      
      const accountResponse = await valorantAPI.get<{ status: number; data: any }>(accountUrl);
      
      // Handle different possible response structures
      const accountData = accountResponse.data?.data || accountResponse.data;
      puuid = accountData?.puuid;
      accountRegion = accountData?.region || region;
      
      console.log('Account response received', {
        riotName: normalizedName,
        riotTag: normalizedTag,
        puuid: puuid ? puuid.substring(0, 8) + '...' : 'not found',
        accountRegion,
        hasData: !!accountData,
        dataKeys: accountData ? Object.keys(accountData) : [],
      });
      
      if (!puuid) {
        console.error('PUUID not found in account response', {
          responseStatus: accountResponse.status,
          responseDataStructure: Object.keys(accountResponse.data || {}),
          accountDataStructure: accountData ? Object.keys(accountData) : [],
        });
        res.status(404).json({
          success: false,
          error: `Could not find Riot account "${normalizedName}#${normalizedTag}". Please check your username and tag.`,
        });
        return;
      }
    } catch (error: any) {
      console.error('Error fetching account', {
        riotName: normalizedName,
        riotTag: normalizedTag,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data,
        url: error.config?.url,
      });
      
      // Provide more specific error messages
      if (error.response?.status === 404) {
        res.status(404).json({
          success: false,
          error: `Could not find Riot account "${normalizedName}#${normalizedTag}". Please check your username and tag.`,
        });
        return;
      }
      
      res.status(500).json({
        success: false,
        error: `Failed to fetch account information: ${error.message || 'Unknown error'}. Please try again.`,
      });
      return;
    }

    // Step 2: Get current Valorant rank using v3 API
    console.log('Fetching current Valorant rank', { riotName, riotTag, region: accountRegion, puuid: 'hidden' });
    
    let mmr: ValorantMMR | null = null;
    const platform = 'pc'; // Default to PC
    try {
      const mmrUrl = `/v3/by-puuid/mmr/${accountRegion}/${platform}/${puuid}`;
      console.log('Calling Valorant MMR API v3', { url: mmrUrl });
      
      const mmrResponse = await valorantAPI.get<{ status: number; data: any }>(mmrUrl);
      const mmrData = mmrResponse.data.data;
      
      // Map v3 response to ValorantMMR interface
      if (mmrData) {
        mmr = {
          currenttier: mmrData.current?.tier?.id || 0,
          currenttierpatched: mmrData.current?.tier?.name || 'Unrated',
          ranking_in_tier: mmrData.current?.ranking_in_tier || 0,
          mmr_change_to_last_game: mmrData.current?.mmr_change_to_last_game || 0,
          elo: mmrData.current?.elo || 0,
          name: mmrData.name || riotName,
          tag: mmrData.tag || riotTag,
          old: mmrData.old || false,
          games_needed_for_rating: mmrData.current?.games_needed_for_rating || 0,
        };
      }
      
      console.log('Valorant MMR response received', {
        riotName,
        riotTag,
        currentTier: mmr?.currenttier,
        currentTierPatched: mmr?.currenttierpatched,
        elo: mmr?.elo,
        gamesNeededForRating: mmr?.games_needed_for_rating,
      });
    } catch (error: any) {
      console.error('Error fetching current MMR', {
        riotName,
        riotTag,
        region: accountRegion,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
    }

    let valorantRank: string;
    let valorantELO: number;
    let startingMMR: number;
    let discordRank: string;
    let discordRankValue: number;

    // Check if unrated or in placement matches
    const isUnrated = !mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated');
    const isInPlacements = mmr && mmr.games_needed_for_rating && mmr.games_needed_for_rating > 0;
    
    console.log('Checking rank status', {
      riotName,
      riotTag,
      isUnrated,
      isInPlacements,
      gamesNeeded: mmr?.games_needed_for_rating,
      currentTierPatched: mmr?.currenttierpatched,
    });
    
    if (isInPlacements) {
      // Player is in placement matches - check MMR history for last ranked match
      console.log('Player is in placement matches, checking MMR history', { riotName, riotTag, gamesNeeded: mmr?.games_needed_for_rating });
      
      try {
        const historyUrl = `/v2/by-puuid/mmr-history/${accountRegion}/${platform}/${puuid}`;
        console.log('Calling Valorant MMR History API', { url: historyUrl });
        
        const historyResponse = await valorantAPI.get<{ status: number; data: any }>(historyUrl);
        const history = historyResponse.data.data?.history;
        
        if (history && history.length > 0) {
          // Find last ranked match with tier data
          const lastRanked = history.find((entry: any) => entry.tier && entry.tier.id > 0);
          
          if (lastRanked) {
            console.log('Found last ranked match in history', {
              rank: lastRanked.tier.name,
              elo: lastRanked.elo,
            });
            
            valorantRank = lastRanked.tier.name;
            valorantELO = lastRanked.elo || 0;
            startingMMR = calculateInitialMMR(valorantRank, valorantELO);
            discordRank = getRankFromMMR(startingMMR);
            discordRankValue = getRankValue(discordRank);
          } else {
            // No ranked history - place in GRNDS I
            console.log('No ranked history found, placing in GRNDS I', { riotName, riotTag });
            valorantRank = 'Unrated (in placements)';
            valorantELO = 0;
            startingMMR = 0;
            discordRank = 'GRNDS I';
            discordRankValue = getRankValue(discordRank);
          }
        } else {
          // No history - place in GRNDS I
          console.log('No MMR history available, placing in GRNDS I', { riotName, riotTag });
          valorantRank = 'Unrated (in placements)';
          valorantELO = 0;
          startingMMR = 0;
          discordRank = 'GRNDS I';
          discordRankValue = getRankValue(discordRank);
        }
      } catch (error: any) {
        console.error('Error fetching MMR history', {
          riotName,
          riotTag,
          error: error.message,
        });
        // Fallback to GRNDS I if history fetch fails
        valorantRank = 'Unrated (in placements)';
        valorantELO = 0;
        startingMMR = 0;
        discordRank = 'GRNDS I';
        discordRankValue = getRankValue(discordRank);
      }
    } else if (isUnrated) {
      console.log('User is currently unrated, placing in GRNDS I', { riotName, riotTag });
      valorantRank = 'Unrated';
      valorantELO = 0;
      startingMMR = 0; // GRNDS I starts at 0 MMR
      discordRank = 'GRNDS I';
      discordRankValue = getRankValue(discordRank);
    } else {
      // User is ranked - calculate MMR from Valorant rank (capped at GRNDS V)
      valorantRank = mmr!.currenttierpatched;
      valorantELO = mmr!.elo;
      console.log('Using current rank for placement', {
        riotName,
        riotTag,
        rank: valorantRank,
        elo: valorantELO,
      });
      startingMMR = calculateInitialMMR(valorantRank, valorantELO);
      discordRank = getRankFromMMR(startingMMR);
      discordRankValue = getRankValue(discordRank);
    }
    
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
      riot_puuid: puuid,
      riot_region: accountRegion,
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

    // Return success with clear messaging about initial placement cap
    let message: string;
    if (isUnrated || valorantRank === 'Unrated' || valorantRank.includes('in placements')) {
      message = `✅ Rank Placement Complete!\n\n` +
        `**Discord Rank:** ${discordRank}\n` +
        `**Starting MMR:** ${startingMMR}\n\n` +
        `You're currently unranked in Valorant. ` +
        `Play customs to rank up! Once you get ranked in Valorant, ` +
        `use \`/riot refresh\` to update your Discord rank.\n\n` +
        `**Note:** The highest rank you can initially be placed at is GRNDS V.`;
    } else {
      message = `✅ Rank Placement Complete!\n\n` +
        `**Valorant Rank:** ${valorantRank}\n` +
        `**Discord Rank:** ${discordRank}\n` +
        `**Starting MMR:** ${startingMMR}\n\n` +
        `Your initial Discord rank is based on your Valorant rank. ` +
        `Play customs to rank up further!\n\n` +
        `**Note:** The highest rank you can initially be placed at is GRNDS V.`;
    }
    
    const successResponse = {
      success: true,
      discordRank,
      discordRankValue,
      startingMMR,
      valorantRank,
      valorantELO,
      message,
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
