import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

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

const GRNDS_V_MAX_MMR = 1499; // Cap at GRNDS V for initial boost from Valorant rank

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
 * Calculate MMR from Valorant rank and ELO (capped at GRNDS V for initial boost)
 */
function calculateMMRFromValorantRank(valorantRank: string, valorantELO: number): number {
  try {
    const rankMMRMap: Record<string, { min: number; max: number }> = {
      'Iron 1': { min: 0, max: 150 }, 'Iron 2': { min: 100, max: 250 }, 'Iron 3': { min: 200, max: 350 },
      'Bronze 1': { min: 300, max: 450 }, 'Bronze 2': { min: 350, max: 500 }, 'Bronze 3': { min: 450, max: 599 },
      'Silver 1': { min: 500, max: 650 }, 'Silver 2': { min: 600, max: 750 }, 'Silver 3': { min: 700, max: 899 },
      'Gold 1': { min: 450, max: 599 }, 'Gold 2': { min: 600, max: 899 }, 'Gold 3': { min: 900, max: 1199 },
      'Platinum 1': { min: 900, max: 1099 }, 'Platinum 2': { min: 1100, max: 1299 }, 'Platinum 3': { min: 1200, max: 1499 },
      'Diamond 1': { min: 1250, max: 1499 }, 'Diamond 2': { min: 1300, max: 1499 }, 'Diamond 3': { min: 1350, max: 1499 },
      'Ascendant 1': { min: 1350, max: 1499 }, 'Ascendant 2': { min: 1400, max: 1499 }, 'Ascendant 3': { min: 1450, max: 1499 },
      'Immortal 1': { min: 1450, max: 1499 }, 'Immortal 2': { min: 1450, max: 1499 }, 'Immortal 3': { min: 1450, max: 1499 },
      'Radiant': { min: 1450, max: 1499 },
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
    // Validate environment variables and use SERVICE_ROLE_KEY for writes (bypasses RLS)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ success: false, error: 'Missing Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get VALORANT_API_KEY from env for API client
    const valorantAPIKey = process.env.VALORANT_API_KEY;

    // Initialize Valorant API
    const valorantAPI = axios.create({
      baseURL: 'https://api.henrikdev.xyz/valorant',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValorantBot-Vercel/1.0',
        ...(valorantAPIKey ? { 
          'Authorization': valorantAPIKey,
        } : {}),
      },
    });

    // Log API key status (don't log the actual key)
    if (valorantAPIKey) {
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

    console.log('Refreshing rank', { userId, riotName: normalizedName, riotTag: normalizedTag, region });

    // Get current player from database
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, discord_rank, current_mmr, discord_rank_value, peak_mmr, role_mode, primary_game, valorant_rank, valorant_rank_value, valorant_mmr, valorant_peak_mmr, marvel_rivals_rank, marvel_rivals_rank_value, marvel_rivals_mmr, marvel_rivals_peak_mmr')
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
        // Extract API error message if available
        let apiErrorMessage = '';
        if (error.response?.data?.errors) {
          if (Array.isArray(error.response.data.errors)) {
            apiErrorMessage = error.response.data.errors
              .map((e: any) => e.message || e.msg || JSON.stringify(e))
              .join('; ');
          } else if (typeof error.response.data.errors === 'object') {
            apiErrorMessage = JSON.stringify(error.response.data.errors);
          }
        }
        
        console.error('API 404 error details:', { 
          apiErrorMessage,
          fullResponseData: error.response?.data 
        });
        
        const errorMsg = apiErrorMessage 
          ? `Could not find Riot account "${normalizedName}#${normalizedTag}". API Error: ${apiErrorMessage}`
          : `Could not find Riot account "${normalizedName}#${normalizedTag}". Please verify your current Riot ID in-game.`;
        
        res.status(404).json({
          success: false,
          error: errorMsg,
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
    const updatedValorantRank = discordRank;
    const updatedValorantRankValue = discordRankValue;
    const updatedValorantMMR = newMMR;
    const updatedMarvelRank = player.marvel_rivals_rank || 'Unranked';
    const updatedMarvelRankValue = player.marvel_rivals_rank_value ?? getRankValue(updatedMarvelRank);
    const updatedMarvelMMR = player.marvel_rivals_mmr ?? 0;

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
    const combinedRank = combined.discordRank;
    const combinedRankValue = combined.discordRankValue;
    const combinedMMR = combined.currentMMR;

    const { error: updateError } = await supabase
      .from('players')
      .update({
        riot_puuid: puuid, // Update PUUID for future v3 API calls
        riot_region: accountRegion, // Update region in case it changed
        valorant_rank: updatedValorantRank,
        valorant_rank_value: updatedValorantRankValue,
        valorant_mmr: updatedValorantMMR,
        valorant_peak_mmr: Math.max(player.valorant_peak_mmr || 0, updatedValorantMMR),
        discord_rank: combinedRank,
        discord_rank_value: combinedRankValue,
        current_mmr: combinedMMR,
        peak_mmr: Math.max(currentPeakMMR, combinedMMR),
        updated_at: new Date().toISOString(),
      })
      .eq('discord_user_id', userId);

    if (updateError) {
      console.error('Database error updating player', { userId, error: updateError });
      res.status(500).json({ success: false, error: 'Failed to update player data' });
      return;
    }

    // Log rank history if rank changed
    if (combinedRank !== oldRank || combinedMMR !== oldMMR) {
      await supabase.from('rank_history').insert({
        player_id: player.id,
        old_rank: oldRank,
        new_rank: combinedRank,
        old_mmr: oldMMR,
        new_mmr: combinedMMR,
        reason: boosted ? 'valorant_refresh_boost' : 'valorant_refresh',
      });
    }

    console.log('Rank refreshed successfully', {
      userId,
      oldRank,
      newRank: combinedRank,
      oldMMR,
      newMMR: combinedMMR,
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
        ? `Rank boosted to ${discordRank} (${newMMR} MMR) based on your Valorant rank (${valorantRank}). Note: Valorant rank boost is capped at GRNDS V. Play customs to rank up further!`
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
