import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { ActivityFeed as ActivityFeedType } from '@/lib/types'
import { redirect } from 'next/navigation'
import { DashboardContent } from './DashboardContent'

interface PlayerData {
  id: string
  discord_user_id: string
  discord_username: string | null
  riot_name: string | null
  riot_tag: string | null
  marvel_rivals_uid: string | null
  marvel_rivals_username: string | null
  preferred_game: 'valorant' | 'marvel_rivals' | null
  valorant_rank: string | null
  valorant_mmr: number | null
  valorant_peak_mmr: number | null
  marvel_rivals_rank: string | null
  marvel_rivals_mmr: number | null
  marvel_rivals_peak_mmr: number | null
  current_mmr: number
  peak_mmr: number
  discord_rank: string | null
}

interface MatchHistoryEntry {
  id: string
  match_date: string
  map: string | null
  winner: 'A' | 'B' | null
  team: 'A' | 'B'
  kills: number
  deaths: number
  assists: number
  mvp: boolean
  mmr_before: number
  mmr_after: number
}

interface RankProgressionEntry {
  id: string
  old_rank: string | null
  new_rank: string
  old_mmr: number
  new_mmr: number
  reason: string
  created_at: string
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { game?: string }
}) {
  const supabase = await createClient()
  
  // Check if user has an anonymous session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }
  
  // Get player data for this user (anonymous session)
  const supabaseAdmin = getSupabaseAdminClient()
  interface PlayerCheckRow {
    id: string
    discord_username: string | null
    riot_name: string | null
    riot_tag: string | null
    current_mmr: number
    claimed: boolean
  }
  
  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('id, discord_username, riot_name, riot_tag, current_mmr, claimed')
    .eq('id', user.id)
    .maybeSingle() as { data: PlayerCheckRow | null; error: unknown }
  
  if (playerError) {
    console.error('Error checking player:', playerError)
  }
  
  // If no player found, not claimed, or player.id doesn't match user.id, redirect to login
  if (!player || !player.claimed || player.id !== user.id) {
    redirect('/auth/login')
  }
  
  console.log('Dashboard - Auth user ID:', user.id)
  
  // Query player directly by id (which is now the auth UID)
  const { data: playerData } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('id', user.id)
    .maybeSingle() as { data: PlayerData | null }
  
  if (!playerData) {
    redirect('/auth/login?step=claim')
  }
  
  // Get user's accent color (will fetch full profile later)
  const { data: accentColorProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('accent_color')
    .eq('discord_user_id', playerData.discord_user_id)
    .maybeSingle() as { data: { accent_color?: string | null } | null }
  
  const userAccentColor = accentColorProfile?.accent_color || '#ef4444'
  
  const selectedGame =
    searchParams?.game === 'marvel_rivals'
      ? 'marvel_rivals'
      : searchParams?.game === 'valorant'
        ? 'valorant'
        : (playerData.preferred_game || 'valorant')
  const gameLabel = selectedGame === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant'
  const currentMMR =
    selectedGame === 'marvel_rivals'
      ? (playerData.marvel_rivals_mmr ?? 0)
      : (playerData.valorant_mmr ?? playerData.current_mmr ?? 0)
  const peakMMR =
    selectedGame === 'marvel_rivals'
      ? (playerData.marvel_rivals_peak_mmr ?? 0)
      : (playerData.valorant_peak_mmr ?? playerData.peak_mmr ?? 0)

  const playerDataToUse: PlayerData = {
    id: playerData.id,
    discord_user_id: playerData.discord_user_id,
    discord_username: playerData.discord_username ?? 'Player',
    riot_name: playerData.riot_name ?? null,
    riot_tag: playerData.riot_tag ?? null,
    marvel_rivals_uid: playerData.marvel_rivals_uid ?? null,
    marvel_rivals_username: playerData.marvel_rivals_username ?? null,
    preferred_game: playerData.preferred_game ?? null,
    valorant_rank: playerData.valorant_rank ?? null,
    valorant_mmr: playerData.valorant_mmr ?? null,
    valorant_peak_mmr: playerData.valorant_peak_mmr ?? null,
    marvel_rivals_rank: playerData.marvel_rivals_rank ?? null,
    marvel_rivals_mmr: playerData.marvel_rivals_mmr ?? null,
    marvel_rivals_peak_mmr: playerData.marvel_rivals_peak_mmr ?? null,
    current_mmr: currentMMR as number,
    peak_mmr: peakMMR as number,
    discord_rank: playerData.discord_rank ?? 'Unranked',
  }
  
  // Get player's match stats and history (use admin client)
  let matchStatsQuery = supabaseAdmin
    .from('match_player_stats')
    .select('*, match:matches(match_date, map, winner, match_type)')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (selectedGame === 'marvel_rivals') {
    matchStatsQuery = matchStatsQuery.eq('match.match_type', 'marvel_rivals')
  } else {
    matchStatsQuery = matchStatsQuery.in('match.match_type', ['custom', 'valorant'])
  }

  const { data: matchStats } = await matchStatsQuery
  
  interface MatchStatWithMatch {
    id: string
    team: 'A' | 'B'
    kills: number
    deaths: number
    assists: number
    mvp: boolean
    mmr_after: number
    mmr_before: number
    created_at: string
      match?: {
        match_date: string
        map: string | null
        winner?: 'A' | 'B'
        match_type?: 'custom' | 'valorant' | 'marvel_rivals'
      }
    }
  
  const stats = (matchStats as MatchStatWithMatch[]) || []
  
  // Build match history
  const matchHistory: MatchHistoryEntry[] = stats.map((stat) => ({
    id: stat.id,
    match_date: stat.match?.match_date || stat.created_at,
    map: stat.match?.map || null,
    winner: stat.match?.winner || null,
    team: stat.team,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    mvp: stat.mvp,
    mmr_before: stat.mmr_before,
    mmr_after: stat.mmr_after,
  }))
  
  // Calculate season stats
  const wins = stats.filter(s => {
    if (s.match) {
      return s.match.winner === s.team
    }
    return s.mmr_after > s.mmr_before
  }).length
  
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  const recentMatches = stats.slice(0, 10)
  const netMMR = recentMatches.reduce((sum, s) => sum + (s.mmr_after - s.mmr_before), 0)
  
  // Calculate K/D ratio
  const totalKills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
  const totalDeaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
  const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00'
  
  // Calculate MVP count
  const mvpCount = stats.filter(s => s.mvp).length
  
  // Get rank progression (rank_history) - use admin client
  const { data: rankHistory } = await supabaseAdmin
    .from('rank_history')
    .select('*')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(15)
  
  const rankProgression: RankProgressionEntry[] = (rankHistory as RankProgressionEntry[]) || []
  
  // Get activity feed - use admin client
  const { data: activities } = await supabaseAdmin
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const activityFeed = (activities as ActivityFeedType[]) || []
  
  // Get leaderboard position - use admin client
  const leaderboardField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_mmr' : 'valorant_mmr'
  const { count: position } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt(leaderboardField, playerDataToUse.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  // Get current season - use admin client
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  
  // Get user profile for customization - use admin client
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('discord_user_id', playerDataToUse.discord_user_id)
    .maybeSingle() as { data: { display_name?: string | null; bio?: string | null } | null }
  
  return (
    <DashboardContent 
      playerDataToUse={playerDataToUse}
      totalMatches={totalMatches}
      userAccentColor={userAccentColor}
      wins={wins}
      losses={losses}
      winRate={winRate}
      netMMR={netMMR}
      leaderboardPosition={leaderboardPosition}
      activityFeed={activityFeed}
      season={season}
      matchHistory={matchHistory}
      rankProgression={rankProgression}
      userProfile={userProfile}
      kdRatio={kdRatio}
      mvpCount={mvpCount}
      selectedGame={selectedGame}
      gameLabel={gameLabel}
    />
  )
}

