export interface Player {
  id: string
  discord_user_id: string
  discord_username: string
  discord_avatar_url?: string | null
  riot_name: string | null
  riot_tag: string | null
  riot_puuid: string | null
  riot_region: string
  preferred_game: 'valorant' | 'marvel_rivals'
  primary_game: 'valorant' | 'marvel_rivals'
  role_mode: 'highest' | 'primary'
  discord_rank: string
  discord_rank_value: number
  discord_mmr: number
  current_mmr: number
  peak_mmr: number
  valorant_rank: string | null
  valorant_rank_value: number | null
  valorant_mmr: number | null
  valorant_peak_mmr: number | null
  marvel_rivals_uid: string | null
  marvel_rivals_username: string | null
  marvel_rivals_rank: string | null
  marvel_rivals_rank_value: number | null
  marvel_rivals_mmr: number | null
  marvel_rivals_peak_mmr: number | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface Season {
  id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ActivityFeed {
  id: string
  player_id: string
  activity_type: 'rank_up' | 'rank_down' | 'mvp' | 'big_mmr_gain' | 'big_mmr_loss' | 'achievement'
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  player?: Player
}

export interface Comment {
  id: string
  author_id: string
  target_type: 'profile' | 'match' | 'season'
  target_id: string
  content: string
  content_censored: string
  created_at: string
  updated_at: string
  author?: Player
}

export interface Match {
  id: string
  match_id: string
  match_type: 'custom' | 'valorant' | 'marvel_rivals'
  match_date: string
  map: string | null
  host_id: string | null
  team_a: string[]
  team_b: string[]
  winner: 'A' | 'B' | null
  score: { teamA: number; teamB: number } | null
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  created_at: string
  completed_at: string | null
}

export interface MatchPlayerStat {
  id: string
  match_id: string
  player_id: string
  team: 'A' | 'B'
  kills: number
  deaths: number
  assists: number
  mvp: boolean
  damage: number
  score: number
  points_earned: number
  mmr_before: number
  mmr_after: number
  created_at: string
  player?: Player
  match?: Match
}

export interface RankHistory {
  id: string
  player_id: string
  old_rank: string
  new_rank: string
  old_mmr: number
  new_mmr: number
  reason: 'match' | 'verification' | 'adjustment'
  match_id: string | null
  created_at: string
}

export interface RankThreshold {
  rank: string
  min_mmr: number
  max_mmr: number
  role_id: string | null
  created_at: string
}

// Helper function to get rank info from MMR
export function getRankFromMMR(mmr: number): { rank: string; tier: string; color: string } {
  if (mmr >= 3000) return { rank: 'X', tier: '', color: '#ffffff' }
  if (mmr >= 2600) return { rank: 'CHALLENGER', tier: 'III', color: '#ff0000' }
  if (mmr >= 2500) return { rank: 'CHALLENGER', tier: 'II', color: '#ff0000' }
  if (mmr >= 2400) return { rank: 'CHALLENGER', tier: 'I', color: '#ff0000' }
  if (mmr >= 2300) return { rank: 'BREAKPOINT', tier: 'V', color: '#000000' }
  if (mmr >= 2100) return { rank: 'BREAKPOINT', tier: 'IV', color: '#000000' }
  if (mmr >= 1900) return { rank: 'BREAKPOINT', tier: 'III', color: '#000000' }
  if (mmr >= 1700) return { rank: 'BREAKPOINT', tier: 'II', color: '#000000' }
  if (mmr >= 1500) return { rank: 'BREAKPOINT', tier: 'I', color: '#000000' }
  if (mmr >= 1200) return { rank: 'GRNDS', tier: 'V', color: '#ff8c00' }
  if (mmr >= 900) return { rank: 'GRNDS', tier: 'IV', color: '#ff8c00' }
  if (mmr >= 600) return { rank: 'GRNDS', tier: 'III', color: '#ff8c00' }
  if (mmr >= 300) return { rank: 'GRNDS', tier: 'II', color: '#ff8c00' }
  return { rank: 'GRNDS', tier: 'I', color: '#ff8c00' }
}

// Helper function to get next rank info
export function getNextRank(mmr: number): { rank: string; tier: string; mmrNeeded: number } | null {
  const thresholds = [
    { mmr: 300, rank: 'GRNDS', tier: 'II' },
    { mmr: 600, rank: 'GRNDS', tier: 'III' },
    { mmr: 900, rank: 'GRNDS', tier: 'IV' },
    { mmr: 1200, rank: 'GRNDS', tier: 'V' },
    { mmr: 1500, rank: 'BREAKPOINT', tier: 'I' },
    { mmr: 1700, rank: 'BREAKPOINT', tier: 'II' },
    { mmr: 1900, rank: 'BREAKPOINT', tier: 'III' },
    { mmr: 2100, rank: 'BREAKPOINT', tier: 'IV' },
    { mmr: 2300, rank: 'BREAKPOINT', tier: 'V' },
    { mmr: 2400, rank: 'CHALLENGER', tier: 'I' },
    { mmr: 2500, rank: 'CHALLENGER', tier: 'II' },
    { mmr: 2600, rank: 'CHALLENGER', tier: 'III' },
    { mmr: 3000, rank: 'X', tier: '' },
  ]

  for (const threshold of thresholds) {
    if (mmr < threshold.mmr) {
      return {
        rank: threshold.rank,
        tier: threshold.tier,
        mmrNeeded: threshold.mmr - mmr,
      }
    }
  }

  return null // Already at max rank
}
