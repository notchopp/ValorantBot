import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
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
  games_needed_for_rating?: number;
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

// No cap on rank refresh - allow users to reach their actual Valorant rank tier

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
 * Calculate MMR from Valorant rank and ELO
 * Maps Valorant ranks to Discord MMR ranges without artificial caps
 */
function calculateMMRFromValorantRank(valorantRank: string, valorantELO: number): number {
  try {
    const rankMMRMap: Record<string, { min: number; max: number }> = {
      // Iron ranks (GRNDS I)
      'Iron 1': { min: 0, max: 50 },
      'Iron 2': { min: 50, max: 100 },
      'Iron 3': { min: 100, max: 150 },
      // Bronze ranks (GRNDS I-II)
      'Bronze 1': { min: 150, max: 200 },
      'Bronze 2': { min: 200, max: 250 },
      'Bronze 3': { min: 250, max: 300 },
      // Silver ranks (GRNDS II-III)
      'Silver 1': { min: 300, max: 400 },
      'Silver 2': { min: 400, max: 500 },
      'Silver 3': { min: 500, max: 600 },
      // Gold ranks (GRNDS III-V)
      'Gold 1': { min: 600, max: 700 },
      'Gold 2': { min: 700, max: 800 },
      'Gold 3': { min: 800, max: 900 },
      // Platinum ranks (GRNDS V - BREAKPOINT I)
      'Platinum 1': { min: 900, max: 1000 },
      'Platinum 2': { min: 1000, max: 1100 },
      'Platinum 3': { min: 1100, max: 1200 },
      // Diamond ranks (BREAKPOINT I-II)
      'Diamond 1': { min: 1200, max: 1300 },
      'Diamond 2': { min: 1300, max: 1400 },
      'Diamond 3': { min: 1400, max: 1500 },
      // Ascendant ranks (BREAKPOINT III-IV)
      'Ascendant 1': { min: 1500, max: 1650 },
      'Ascendant 2': { min: 1650, max: 1800 },
      'Ascendant 3': { min: 1800, max: 1950 },
      // Immortal ranks (BREAKPOINT V - CHALLENGER I)
      'Immortal 1': { min: 1950, max: 2100 },
      'Immortal 2': { min: 2100, max: 2300 },
      'Immortal 3': { min: 2300, max: 2500 },
      // Radiant (CHALLENGER II+)
      'Radiant': { min: 2500, max: 3000 },
    };

    const range = rankMMRMap[valorantRank] || { min: 0, max: 200 };
    const normalizedELO = Math.min(Math.max(valorantELO, 0), 5000);
    const eloPercentage = normalizedELO / 5000;
    const calculatedMMR = range.min + Math.round((range.max - range.min) * eloPercentage);
    
    // Return calculated MMR without artificial caps
    // Users can now be placed at any Discord rank (GRNDS I through CHALLENGER V) based on their Valorant rank
    // MMR ranges: 0-199 (GRNDS I) up to 3000+ (X rank)
    return Math.max(0, calculatedMMR);
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
      baseURL: 'https://api.henrikdev.xyz/valorant',
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
      .select('id, discord_rank, current_mmr, discord_rank_value, peak_mmr')
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
    const currentPeakMMR = player.peak_mmr || 0;

    // Step 1: Get account for PUUID
    console.log('Fetching account information', { riotName, riotTag });
    
    let puuid: string | null = null;
    let accountRegion: string = region;
    try {
      const accountUrl = `/v2/account/${encodeURIComponent(riotName)}/${encodeURIComponent(riotTag)}`;
      console.log('Calling Valorant Account API', { url: accountUrl });
      
      const accountResponse = await valorantAPI.get<{ status: number; data: any }>(accountUrl);
      puuid = accountResponse.data.data?.puuid;
      accountRegion = accountResponse.data.data?.region || region;
      
      console.log('Account response received', {
        riotName,
        riotTag,
        puuid: puuid ? 'found' : 'not found',
        accountRegion,
      });
      
      if (!puuid) {
        console.error('PUUID not found in account response');
        res.status(404).json({
          success: false,
          error: 'Could not find Riot account. Please check your Riot ID.',
        });
        return;
      }
    } catch (error: any) {
      console.error('Error fetching account', {
        riotName,
        riotTag,
        status: error.response?.status,
        message: error.message,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch account information. Please try again.',
      });
      return;
    }

    // Step 2: Get current Valorant rank using v3 API
    console.log('Fetching current Valorant rank', { riotName, riotTag, region: accountRegion });
    
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
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Valorant rank. Please check your Riot ID and try again.',
      });
      return;
    }

    // Check if unrated or in placement matches
    const isUnrated = !mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated');
    const isInPlacements = mmr && mmr.games_needed_for_rating && mmr.games_needed_for_rating > 0;
    
    let valorantRank: string;
    let valorantELO: number;
    let newMMR: number;
    let discordRank: string;
    let discordRankValue: number;
    let boosted = false;

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
            const valorantMMR = calculateMMRFromValorantRank(valorantRank, valorantELO);
            const valorantDiscordRank = getRankFromMMR(valorantMMR);
            const valorantDiscordRankValue = getRankValue(valorantDiscordRank);
            
            // Get current Discord rank values
            const currentDiscordRankValue = player.discord_rank_value || getRankValue(oldRank);
            
            // Use the HIGHER of the two
            if (valorantDiscordRankValue > currentDiscordRankValue) {
              newMMR = valorantMMR;
              discordRank = valorantDiscordRank;
              discordRankValue = valorantDiscordRankValue;
              boosted = true;
            } else {
              newMMR = oldMMR;
              discordRank = oldRank;
              discordRankValue = currentDiscordRankValue;
            }
          } else {
            // No ranked history - keep current rank
            console.log('No ranked history found, keeping current rank', { riotName, riotTag });
            valorantRank = 'Unrated (in placements)';
            valorantELO = 0;
            newMMR = oldMMR;
            discordRank = oldRank;
            discordRankValue = player.discord_rank_value || getRankValue(oldRank);
          }
        } else {
          // No history - keep current rank
          console.log('No MMR history available, keeping current rank', { riotName, riotTag });
          valorantRank = 'Unrated (in placements)';
          valorantELO = 0;
          newMMR = oldMMR;
          discordRank = oldRank;
          discordRankValue = player.discord_rank_value || getRankValue(oldRank);
        }
      } catch (error: any) {
        console.error('Error fetching MMR history', {
          riotName,
          riotTag,
          error: error.message,
        });
        // Keep current rank if history fetch fails
        valorantRank = 'Unrated (in placements)';
        valorantELO = 0;
        newMMR = oldMMR;
        discordRank = oldRank;
        discordRankValue = player.discord_rank_value || getRankValue(oldRank);
      }
    } else if (isUnrated) {
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
        riot_puuid: puuid, // Update PUUID for future v3 API calls
        riot_region: accountRegion, // Update region in case it changed
        discord_rank: discordRank,
        discord_rank_value: discordRankValue,
        current_mmr: newMMR,
        peak_mmr: Math.max(currentPeakMMR, newMMR),
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
