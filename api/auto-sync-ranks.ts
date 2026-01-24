import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';

/**
 * Auto-Sync Ranks API
 * 
 * This endpoint checks for players who need their Marvel Rivals rank re-synced
 * (those marked with needs_resync = true) and attempts to fetch their updated stats.
 * 
 * Call this endpoint periodically (e.g., every 10 minutes via cron) to auto-sync
 * players who had invalid rank data.
 */

// Map Marvel Rivals rank to Discord rank
function mapMarvelRankToDiscord(rank: string, tier: number = 1): string {
  const normalized = rank.toLowerCase().trim();
  
  if (normalized.includes('one above all')) return 'GRNDS V';
  if (normalized.includes('eternity')) return 'GRNDS V';
  if (normalized.includes('celestial')) return 'GRNDS V';
  if (normalized.includes('grandmaster')) return 'GRNDS V';
  
  if (normalized.includes('unranked') || normalized === '' || normalized === 'none') {
    return 'GRNDS I';
  }

  const tierOptions = (options: string[]) => {
    const index = Math.min(Math.max(tier, 1), options.length) - 1;
    return options[index];
  };

  if (normalized.includes('bronze')) return tierOptions(['GRNDS I', 'GRNDS II', 'GRNDS III']);
  if (normalized.includes('silver')) return tierOptions(['GRNDS II', 'GRNDS III', 'GRNDS IV']);
  if (normalized.includes('gold')) return tierOptions(['GRNDS II', 'GRNDS III', 'GRNDS IV']);
  if (normalized.includes('platinum')) return tierOptions(['GRNDS III', 'GRNDS IV', 'GRNDS V']);
  if (normalized.includes('diamond')) return 'GRNDS V';
  
  return 'GRNDS I';
}

function getRankValue(rank: string): number {
  const RANK_VALUE_MAP: Record<string, number> = {
    'GRNDS I': 1, 'GRNDS II': 2, 'GRNDS III': 3, 'GRNDS IV': 4, 'GRNDS V': 5,
    'BREAKPOINT I': 6, 'BREAKPOINT II': 7, 'BREAKPOINT III': 8, 'BREAKPOINT IV': 9, 'BREAKPOINT V': 10,
    'CHALLENGER I': 11, 'CHALLENGER II': 12, 'CHALLENGER III': 13, 'X': 15,
  };
  return RANK_VALUE_MAP[rank] || 0;
}

function getRankMMR(rank: string): number {
  const mmrMap: Record<string, number> = {
    'GRNDS I': 150, 'GRNDS II': 450, 'GRNDS III': 750, 'GRNDS IV': 1050, 'GRNDS V': 1350,
    'BREAKPOINT I': 1600, 'BREAKPOINT II': 1800, 'BREAKPOINT III': 2000, 'BREAKPOINT IV': 2150, 'BREAKPOINT V': 2300,
    'CHALLENGER I': 2450, 'CHALLENGER II': 2550, 'CHALLENGER III': 2800, 'X': 3000,
  };
  return Math.min(mmrMap[rank] || 0, 1499); // Cap at GRNDS V for initial placement
}

function extractRank(stats: Record<string, unknown>): string | null {
  // Check direct rank field
  if (stats.rank && typeof stats.rank === 'string') {
    const rank = stats.rank.trim();
    if (rank && !rank.toLowerCase().includes('invalid') && !rank.toLowerCase().includes('level') && !/^\d+$/.test(rank)) {
      return rank;
    }
  }
  
  // Check rank_history
  const rankHistory = stats.rank_history as Array<Record<string, unknown>> | undefined;
  if (rankHistory && Array.isArray(rankHistory) && rankHistory.length > 0) {
    const latestRank = rankHistory[rankHistory.length - 1];
    const histRank = latestRank.rank_name || latestRank.rank || latestRank.tier_name;
    if (histRank && typeof histRank === 'string') {
      const rank = histRank.trim();
      if (rank && !rank.toLowerCase().includes('invalid') && !rank.toLowerCase().includes('level') && !/^\d+$/.test(rank)) {
        return rank;
      }
    }
  }
  
  return null;
}

async function fetchMarvelStats(api: AxiosInstance, query: string): Promise<Record<string, unknown> | null> {
  const encoded = encodeURIComponent(query.trim());
  try {
    const v2 = await api.get(`https://marvelrivalsapi.com/api/v2/player/${encoded}`);
    return (v2.data?.data || v2.data) as Record<string, unknown>;
  } catch {
    // Fallback to v1
  }
  try {
    const v1 = await api.get(`/player/${encoded}`);
    return (v1.data?.data || v1.data) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('=== AUTO-SYNC RANKS API CALLED ===', { timestamp: new Date().toISOString() });

  // Allow GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const marvelApiKey = process.env.MARVEL_RIVALS_API_KEY;

    if (!supabaseUrl || !supabaseKey || !marvelApiKey) {
      res.status(500).json({ success: false, error: 'Missing environment variables' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const marvelAPI = axios.create({
      baseURL: 'https://marvelrivalsapi.com/api/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValorantBot-Vercel/1.0',
        'x-api-key': marvelApiKey,
      },
    });

    // Find players who need resync (requested at least 5 minutes ago to give API time)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: playersToSync, error: fetchError } = await supabase
      .from('players')
      .select('id, discord_user_id, discord_username, marvel_rivals_uid, marvel_rivals_username')
      .eq('needs_resync', true)
      .lt('resync_requested_at', fiveMinutesAgo)
      .limit(10); // Process up to 10 at a time to avoid timeout

    if (fetchError) {
      console.error('Error fetching players to sync:', fetchError);
      res.status(500).json({ success: false, error: 'Database error' });
      return;
    }

    if (!playersToSync || playersToSync.length === 0) {
      res.status(200).json({ success: true, message: 'No players need syncing', synced: 0 });
      return;
    }

    console.log(`Found ${playersToSync.length} players to auto-sync`);
    const results: Array<{ uid: string; success: boolean; rank?: string; error?: string }> = [];

    for (const player of playersToSync) {
      if (!player.marvel_rivals_uid) {
        results.push({ uid: 'unknown', success: false, error: 'No Marvel Rivals UID' });
        continue;
      }

      try {
        const stats = await fetchMarvelStats(marvelAPI, player.marvel_rivals_uid);
        
        if (!stats) {
          results.push({ uid: player.marvel_rivals_uid, success: false, error: 'Could not fetch stats' });
          continue;
        }

        const rank = extractRank(stats);
        
        if (!rank) {
          // Still no valid rank, leave needs_resync = true but update timestamp
          await supabase
            .from('players')
            .update({ resync_requested_at: new Date().toISOString() })
            .eq('id', player.id);
          results.push({ uid: player.marvel_rivals_uid, success: false, error: 'Rank still invalid' });
          continue;
        }

        // Valid rank found! Update player
        const tier = typeof stats.tier === 'number' ? stats.tier : 1;
        const discordRank = mapMarvelRankToDiscord(rank, tier);
        const rankValue = getRankValue(discordRank);
        const mmr = getRankMMR(discordRank);

        const { error: updateError } = await supabase
          .from('players')
          .update({
            marvel_rivals_rank: discordRank,
            marvel_rivals_mmr: mmr,
            marvel_rivals_rank_value: rankValue,
            discord_rank: discordRank,
            discord_rank_value: rankValue,
            current_mmr: mmr,
            needs_resync: false,
            resync_requested_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', player.id);

        if (updateError) {
          results.push({ uid: player.marvel_rivals_uid, success: false, error: 'Update failed' });
        } else {
          console.log(`Auto-synced ${player.discord_username}: ${rank} → ${discordRank}`);
          results.push({ uid: player.marvel_rivals_uid, success: true, rank: discordRank });
        }
      } catch (error) {
        results.push({ 
          uid: player.marvel_rivals_uid, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    }

    const synced = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Processed ${playersToSync.length} players: ${synced} synced, ${failed} failed`,
      synced,
      failed,
      results,
    });
  } catch (error) {
    console.error('Auto-sync error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
