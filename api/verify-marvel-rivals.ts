import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios, { AxiosInstance } from 'axios';

interface VerifyMarvelRequest {
  userId: string;
  username: string;
  marvelRivalsUid: string;
  marvelRivalsUsername?: string;
}

export interface VerifyMarvelResponse {
  success: boolean;
  discordRank?: string;
  discordRankValue?: number;
  startingMMR?: number;
  marvelRivalsRank?: string;
  message?: string;
  error?: string;
}

// Maximum MMR for initial placement (cap at GRNDS V)
const GRNDS_V_MAX_MMR = 1499;

const RANK_VALUE_MAP: Record<string, number> = {
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

function getRankValue(rank: string): number {
  return RANK_VALUE_MAP[rank] || 0;
}

function getRankMMR(rank: string): number {
  const mmrMap: Record<string, number> = {
    'GRNDS I': 150,
    'GRNDS II': 450,
    'GRNDS III': 750,
    'GRNDS IV': 1050,
    'GRNDS V': 1350,
    'BREAKPOINT I': 1600,
    'BREAKPOINT II': 1800,
    'BREAKPOINT III': 2000,
    'BREAKPOINT IV': 2150,
    'BREAKPOINT V': 2300,
    'CHALLENGER I': 2450,
    'CHALLENGER II': 2550,
    'CHALLENGER III': 2800,
    'ABSOLUTE': 2700,
    'X': 3000,
  };
  return mmrMap[rank] || 0;
}

function normalizeRankValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeRankValue(entry);
      if (normalized) return normalized;
    }
    return null;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [
      record.name,
      record.rank,
      record.rank_name,
      record.tier_name,
      record.tier,
      record.division,
      record.title,
      record.current,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeRankValue(candidate);
      if (normalized) return normalized;
    }
  }
  return null;
}

function findValueByKeys(obj: Record<string, unknown>, keys: string[], maxDepth: number): unknown {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: obj, depth: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, depth } = current;
    if (!value || typeof value !== 'object') continue;

    if (Array.isArray(value)) {
      for (const entry of value) {
        queue.push({ value: entry, depth: depth + 1 });
      }
      continue;
    }

    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (key in record && record[key] !== undefined && record[key] !== null) {
        return record[key];
      }
    }

    if (depth >= maxDepth) continue;

    for (const nested of Object.values(record)) {
      if (!nested) continue;
      if (Array.isArray(nested)) {
        for (const entry of nested) {
          queue.push({ value: entry, depth: depth + 1 });
        }
        continue;
      }
      if (typeof nested === 'object') {
        queue.push({ value: nested, depth: depth + 1 });
      }
    }
  }

  return undefined;
}

function extractRank(stats: Record<string, unknown>): string | null {
  const direct = normalizeRankValue(stats.rank);
  if (direct) return direct;
  const keys = [
    'rank',
    'rank_name',
    'current_rank',
    'competitive_rank',
    'ranked_rank',
    'tier_name',
    'division',
    'tier',
  ];
  return normalizeRankValue(findValueByKeys(stats, keys, 4));
}

function extractTier(stats: Record<string, unknown>): unknown {
  const keys = ['tier', 'rank_tier', 'tier_value', 'division', 'rank_division'];
  return findValueByKeys(stats, keys, 4);
}

function parseTierValue(tier: unknown, rank: string): number {
  if (typeof tier === 'number' && !Number.isNaN(tier)) {
    return tier;
  }
  if (typeof tier === 'string') {
    const trimmed = tier.trim().toUpperCase();
    if (trimmed === 'I') return 1;
    if (trimmed === 'II') return 2;
    if (trimmed === 'III') return 3;
    const parsed = parseInt(trimmed, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }

  const match = rank.match(/\b(I{1,3}|[1-3])\b/i);
  if (match) {
    const value = match[1].toUpperCase();
    if (value === 'I') return 1;
    if (value === 'II') return 2;
    if (value === 'III') return 3;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapTierToRank(options: string[], tier: number): string {
  if (!tier || tier < 1) return options[0];
  const index = Math.min(tier, options.length) - 1;
  return options[index];
}

function mapMarvelRankToDiscord(rank: string, tier: number): string | null {
  const normalized = rank.toLowerCase();
  if (normalized.includes('one above all')) return 'GRNDS V';
  if (normalized.includes('eternity')) return 'GRNDS V';

  if (normalized.includes('bronze')) return mapTierToRank(['GRNDS I', 'GRNDS II', 'GRNDS III'], tier);
  if (normalized.includes('silver')) return mapTierToRank(['GRNDS II', 'GRNDS III', 'GRNDS IV'], tier);
  if (normalized.includes('gold')) return mapTierToRank(['GRNDS II', 'GRNDS III', 'GRNDS IV'], tier);
  if (normalized.includes('platinum')) return mapTierToRank(['GRNDS III', 'GRNDS IV', 'GRNDS V'], tier);
  if (normalized.includes('diamond')) return mapTierToRank(['GRNDS V', 'GRNDS V', 'GRNDS V'], tier);
  if (normalized.includes('grandmaster')) return mapTierToRank(['GRNDS V', 'GRNDS V', 'GRNDS V'], tier);
  if (normalized.includes('celestial')) return mapTierToRank(['GRNDS V', 'GRNDS V', 'GRNDS V'], tier);

  return null;
}

function computeDiscordRank(params: {
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

async function fetchMarvelStats(api: AxiosInstance, query: string): Promise<Record<string, unknown> | null> {
  const encoded = encodeURIComponent(query.trim());
  try {
    const v2 = await api.get(`https://marvelrivalsapi.com/api/v2/player/${encoded}`);
    return (v2.data?.data || v2.data) as Record<string, unknown>;
  } catch (error) {
    // Fallback to v1 if v2 fails
  }

  try {
    const v1 = await api.get(`/player/${encoded}`);
    return (v1.data?.data || v1.data) as Record<string, unknown>;
  } catch (error) {
    return null;
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  console.log('=== VERIFY MARVEL RIVALS API CALLED ===', {
    timestamp: new Date().toISOString(),
    method: req.method,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent'],
    bodyKeys: req.body ? Object.keys(req.body) : [],
  });

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const marvelApiKey = process.env.MARVEL_RIVALS_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ success: false, error: 'Missing Supabase environment variables' });
      return;
    }

    if (!marvelApiKey) {
      res.status(500).json({ success: false, error: 'Missing MARVEL_RIVALS_API_KEY' });
      return;
    }

    const { userId, username, marvelRivalsUid, marvelRivalsUsername } = req.body as VerifyMarvelRequest;

    if (!userId || !username || !marvelRivalsUid) {
      res.status(400).json({ success: false, error: 'Missing required fields: userId, username, marvelRivalsUid' });
      return;
    }

    if (typeof userId !== 'string' || !/^\d{17,19}$/.test(userId)) {
      res.status(400).json({ success: false, error: 'Invalid userId format' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
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

    const stats = await fetchMarvelStats(marvelAPI, marvelRivalsUid);
    if (!stats) {
      res.status(404).json({ success: false, error: 'Could not fetch Marvel Rivals stats.' });
      return;
    }

    const rank = extractRank(stats);
    if (!rank) {
      res.status(400).json({ success: false, error: 'Could not parse Marvel Rivals rank from API response.' });
      return;
    }

    const tierValue = parseTierValue(extractTier(stats), rank);
    const discordRank = mapMarvelRankToDiscord(rank, tierValue);
    if (!discordRank) {
      res.status(400).json({ success: false, error: 'Could not map Marvel Rivals rank to Discord rank.' });
      return;
    }

    const marvelRankValue = getRankValue(discordRank);
    // Cap MMR at GRNDS V (1499) for initial placement
    const marvelMMR = Math.min(getRankMMR(discordRank), GRNDS_V_MAX_MMR);

    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id, discord_rank, discord_rank_value, current_mmr, peak_mmr, role_mode, primary_game, valorant_rank, valorant_rank_value, valorant_mmr, valorant_peak_mmr, marvel_rivals_rank, marvel_rivals_rank_value, marvel_rivals_mmr, marvel_rivals_peak_mmr')
      .eq('discord_user_id', userId)
      .single();

    if (playerError || !player) {
      res.status(404).json({ success: false, error: 'Player not found. Please link your account first.' });
      return;
    }

    const valorantRank = player.valorant_rank || player.discord_rank || 'Unranked';
    const valorantRankValue = player.valorant_rank_value ?? player.discord_rank_value ?? getRankValue(valorantRank);
    const valorantMMR = player.valorant_mmr ?? player.current_mmr ?? 0;

    const combined = computeDiscordRank({
      roleMode: player.role_mode || 'highest',
      primaryGame: player.primary_game || 'valorant',
      valorantRank,
      valorantRankValue,
      valorantMMR,
      marvelRank: discordRank,
      marvelRankValue,
      marvelMMR,
    });

    const updated = {
      discord_username: username,
      marvel_rivals_uid: marvelRivalsUid,
      marvel_rivals_username: marvelRivalsUsername || player.marvel_rivals_username,
      marvel_rivals_rank: discordRank,
      marvel_rivals_rank_value: marvelRankValue,
      marvel_rivals_mmr: marvelMMR,
      marvel_rivals_peak_mmr: Math.max(player.marvel_rivals_peak_mmr || 0, marvelMMR),
      discord_rank: combined.discordRank,
      discord_rank_value: combined.discordRankValue,
      current_mmr: combined.currentMMR,
      peak_mmr: Math.max(player.peak_mmr || 0, combined.currentMMR),
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('players')
      .update(updated)
      .eq('discord_user_id', userId);

    if (updateError) {
      console.error('Error updating Marvel Rivals player', { userId, error: updateError });
      res.status(500).json({ success: false, error: 'Failed to update player data.' });
      return;
    }

    await supabase.from('rank_history').insert({
      player_id: player.id,
      old_rank: player.marvel_rivals_rank || 'Unranked',
      new_rank: discordRank,
      old_mmr: player.marvel_rivals_mmr || 0,
      new_mmr: marvelMMR,
      reason: 'verification',
    });

    const response: VerifyMarvelResponse = {
      success: true,
      discordRank: combined.discordRank,
      discordRankValue: combined.discordRankValue,
      startingMMR: combined.currentMMR,
      marvelRivalsRank: discordRank,
      message: `Marvel Rivals rank verified: ${discordRank} (${marvelMMR} MMR).`,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('=== VERIFY MARVEL RIVALS API ERROR ===', {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({ success: false, error: 'Internal server error during Marvel Rivals verification' });
  }
}
