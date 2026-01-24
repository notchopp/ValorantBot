import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { Player, calculateRankLabel } from '@/lib/types'
import { LeaderboardContent } from './LeaderboardContent'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: { game?: string }
}) {
  // Use admin client to ensure data access
  const supabaseAdmin = getSupabaseAdminClient()
  const selectedGame =
    searchParams?.game === 'marvel_rivals'
      ? 'marvel_rivals'
      : searchParams?.game === 'valorant'
        ? 'valorant'
        : 'valorant'
  const gameLabel = selectedGame === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant'
  const leaderboardField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_mmr' : 'valorant_mmr'
  
  // Get all players ordered by MMR with real stats
  // Filter by game-specific requirements (must have MMR > 0 and linked account)
  let query = supabaseAdmin
    .from('players')
    .select('*')
    .gt(leaderboardField, 0) // Only players with MMR > 0
  
  // Also ensure the player has linked their account for the selected game
  if (selectedGame === 'marvel_rivals') {
    query = query.not('marvel_rivals_uid', 'is', null)
  } else {
    query = query.not('riot_name', 'is', null)
  }
  
  const { data: leaderboard } = await query
    .order(leaderboardField, { ascending: false })
    .limit(100)
  
  const players = (leaderboard as (Player & { discord_avatar_url?: string | null })[]) || []
  
  // Calculate stats for each player (K/D, Win Rate, etc.) from match_player_stats
  interface MatchStatWithMatch {
    team: 'A' | 'B'
    kills: number
    deaths: number
    mmr_after: number
    mmr_before: number
    match?: { winner?: 'A' | 'B' }
  }
  
  const playersWithStats = await Promise.all(
    players.map(async (player) => {
      let matchStatsQuery = supabaseAdmin
        .from('match_player_stats')
        .select('*, match:matches(winner, match_type)')
        .eq('player_id', player.id)

      if (selectedGame === 'marvel_rivals') {
        matchStatsQuery = matchStatsQuery.eq('match.match_type', 'marvel_rivals')
      } else {
        matchStatsQuery = matchStatsQuery.in('match.match_type', ['custom', 'valorant'])
      }

      const { data: matchStats } = await matchStatsQuery
      
      const stats = (matchStats as MatchStatWithMatch[]) || []
      const wins = stats.filter((s) => {
        if (s.match) {
          return s.match.winner === s.team
        }
        return s.mmr_after > s.mmr_before
      }).length
      
      const totalMatches = stats.length
      const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
      const totalKills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
      const totalDeaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
      const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00'
      
      const currentMMR = selectedGame === 'marvel_rivals'
        ? (player.marvel_rivals_mmr ?? 0)
        : (player.valorant_mmr ?? player.current_mmr ?? 0)
      const peakMMR = selectedGame === 'marvel_rivals'
        ? (player.marvel_rivals_peak_mmr ?? 0)
        : (player.valorant_peak_mmr ?? player.peak_mmr ?? 0)
      // Calculate rank from MMR rather than using potentially outdated database value
      const rankLabel = calculateRankLabel(currentMMR)

      return {
        ...player,
        currentMMR,
        peakMMR,
        rankLabel,
        totalMatches,
        wins,
        winRate,
        kd: parseFloat(kd),
      }
    })
  )
  
  // Calculate global stats
  const totalPlayers = playersWithStats.length
  const averageMMR = playersWithStats.length > 0 
    ? Math.round(playersWithStats.reduce((sum, p) => sum + p.currentMMR, 0) / playersWithStats.length)
    : 0
  
  const topPlayer = playersWithStats[0]
  
  return (
    <LeaderboardContent
      playersWithStats={playersWithStats}
      totalPlayers={totalPlayers}
      averageMMR={averageMMR}
      topPlayer={topPlayer}
      selectedGame={selectedGame}
      gameLabel={gameLabel}
    />
  )
}