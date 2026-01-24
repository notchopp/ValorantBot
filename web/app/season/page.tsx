import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { Player, Season, Comment } from '@/lib/types'
import { SeasonContent } from './SeasonContent'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SeasonPage({
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
  
  const now = new Date()
  
  // Get all seasons ordered by start_date
  const { data: allSeasonsData } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .order('start_date', { ascending: false })
  
  const allSeasons = (allSeasonsData as Season[]) || []
  
  // Find the current or upcoming season
  // Priority: active season that has started, then active season that hasn't started, then upcoming season
  let currentSeason: Season | null = null
  let isBeforeStart = false
  
  if (allSeasons.length > 0) {
    // First, try to find an active season
    const activeSeason = allSeasons.find(s => s.is_active)
    
    if (activeSeason) {
      const startDate = new Date(activeSeason.start_date)
      const endDate = new Date(activeSeason.end_date)
      
      // If season hasn't started yet
      if (now < startDate) {
        currentSeason = activeSeason
        isBeforeStart = true
      }
      // If season has started but hasn't ended
      else if (now >= startDate && now < endDate) {
        currentSeason = activeSeason
        isBeforeStart = false
      }
      // If season has ended, look for upcoming season
      else {
        const upcomingSeason = allSeasons.find(s => {
          const sStart = new Date(s.start_date)
          return sStart > now
        }) as Season | undefined
        
        if (upcomingSeason) {
          currentSeason = upcomingSeason
          isBeforeStart = true
        }
      }
    } else {
      // No active season, find the next upcoming one
      const upcomingSeason = allSeasons.find(s => {
        const sStart = new Date(s.start_date)
        return sStart > now
      }) as Season | undefined
      
      if (upcomingSeason) {
        currentSeason = upcomingSeason
        isBeforeStart = true
      }
    }
  }
  
  if (!currentSeason) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="text-center max-w-md glass rounded-2xl p-8 border border-white/5">
          <h1 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">No Season</h1>
          <p className="text-base text-white/60 font-light">Check back later for the next competitive season!</p>
        </div>
      </div>
    )
  }
  
  // Get leaderboard (top 50) with real stats from match_player_stats
  const { data: leaderboard } = await supabaseAdmin
    .from('players')
    .select('*')
    .order(leaderboardField, { ascending: false })
    .limit(50)
  
  const players = (leaderboard as (Player & { discord_avatar_url?: string | null })[]) || []
  
  // Get current queue for selected game
  interface QueueEntry {
    id: string
    player_id: string
    joined_at: string
    game: 'valorant' | 'marvel_rivals'
    player: {
      id: string
      discord_user_id: string
      discord_username: string | null
      discord_avatar_url?: string | null
      valorant_mmr: number | null
      marvel_rivals_mmr: number | null
      valorant_rank: string | null
      marvel_rivals_rank: string | null
    }
  }
  
  const { data: queueData } = await supabaseAdmin
    .from('queue')
    .select('id, player_id, joined_at, game, player:players(id, discord_user_id, discord_username, discord_avatar_url, valorant_mmr, marvel_rivals_mmr, valorant_rank, marvel_rivals_rank)')
    .eq('game', selectedGame)
    .order('joined_at', { ascending: true })
  
  const queuePlayers = (queueData as QueueEntry[] | null) || []
  
  // Get live matches (pending or in-progress)
  interface LiveMatch {
    id: string
    match_id: string
    match_type: 'custom' | 'valorant' | 'marvel_rivals'
    match_date: string
    map: string | null
    status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
    team_a: { discord_username?: string; discord_user_id?: string }[]
    team_b: { discord_username?: string; discord_user_id?: string }[]
    host: {
      discord_username: string | null
      discord_user_id: string
    } | null
  }
  
  let liveMatchesQuery = supabaseAdmin
    .from('matches')
    .select('id, match_id, match_type, match_date, map, status, team_a, team_b, host:players!matches_host_id_fkey(discord_username, discord_user_id)')
    .in('status', ['pending', 'in-progress'])
    .order('match_date', { ascending: false })
    .limit(10)
  
  if (selectedGame === 'marvel_rivals') {
    liveMatchesQuery = liveMatchesQuery.eq('match_type', 'marvel_rivals')
  } else {
    liveMatchesQuery = liveMatchesQuery.in('match_type', ['custom', 'valorant'])
  }
  
  const { data: liveMatchesData } = await liveMatchesQuery
  const liveMatches = (liveMatchesData as LiveMatch[] | null) || []
  
  // Calculate season stats for each player (matches, win rate, etc.)
  // Only calculate if season has started
  interface SeasonMatchStat {
    team: 'A' | 'B'
    mmr_after: number
    mmr_before: number
    match?: { match_date: string; winner?: 'A' | 'B' }
  }
  
  const playersWithStats = await Promise.all(
    players.map(async (player) => {
      // Only get match stats if season has started
      let totalMatches = 0
      let wins = 0
      let winRate = 0
      let netMMR = 0
      
      if (!isBeforeStart && currentSeason) {
        // Get match stats for this player this season
        let matchStatsQuery = supabaseAdmin
          .from('match_player_stats')
          .select('*, match:matches(match_date, winner, match_type)')
          .eq('player_id', player.id)
          .gte('created_at', currentSeason.start_date)
          .lte('created_at', currentSeason.end_date)

        if (selectedGame === 'marvel_rivals') {
          matchStatsQuery = matchStatsQuery.eq('match.match_type', 'marvel_rivals')
        } else {
          matchStatsQuery = matchStatsQuery.in('match.match_type', ['custom', 'valorant'])
        }

        const { data: matchStats } = await matchStatsQuery
        
        const stats = (matchStats as SeasonMatchStat[]) || []
        wins = stats.filter((s) => {
          if (s.match) {
            return s.match.winner === s.team
          }
          return s.mmr_after > s.mmr_before
        }).length
        
        totalMatches = stats.length
        winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
        netMMR = stats.reduce((sum, s) => sum + (s.mmr_after - s.mmr_before), 0)
      }
      
      const currentMMR = selectedGame === 'marvel_rivals'
        ? (player.marvel_rivals_mmr ?? 0)
        : (player.valorant_mmr ?? player.current_mmr ?? 0)
      const rankLabel = selectedGame === 'marvel_rivals'
        ? (player.marvel_rivals_rank ?? 'Unranked')
        : (player.valorant_rank ?? 'Unranked')

      return {
        ...player,
        discord_avatar_url: player.discord_avatar_url,
        currentMMR,
        rankLabel,
        seasonMatches: totalMatches,
        seasonWins: wins,
        seasonWinRate: winRate,
        seasonNetMMR: netMMR,
      } as typeof player & { currentMMR: number; rankLabel: string; seasonMatches: number; seasonWins: number; seasonWinRate: number; seasonNetMMR: number }
    })
  )
  
  // Get comments for season (use admin client for read access)
  const { data: comments } = await supabaseAdmin
    .from('comments')
    .select('*, author:players(*)')
    .eq('target_type', 'season')
    .eq('target_id', currentSeason.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const seasonComments = (comments as Comment[]) || []
  
  // Calculate season-wide stats
  const totalSeasonMatches = playersWithStats.reduce((sum, p) => sum + (p.seasonMatches || 0), 0)
  const averageMMR = playersWithStats.length > 0 
    ? Math.round(playersWithStats.reduce((sum, p) => sum + p.currentMMR, 0) / playersWithStats.length)
    : 0
  
  // Transform queue players to match component interface
  const queuePlayersFormatted = queuePlayers.map(q => ({
    id: q.id,
    joined_at: q.joined_at,
    player: {
      discord_user_id: q.player.discord_user_id,
      discord_username: q.player.discord_username,
      discord_avatar_url: q.player.discord_avatar_url,
      valorant_mmr: q.player.valorant_mmr,
      marvel_rivals_mmr: q.player.marvel_rivals_mmr,
      valorant_rank: q.player.valorant_rank,
      marvel_rivals_rank: q.player.marvel_rivals_rank,
    }
  }))

  // Transform players with stats to match component interface
  const playersFormatted = playersWithStats.map(p => ({
    id: p.id,
    discord_user_id: p.discord_user_id,
    discord_username: p.discord_username,
    discord_avatar_url: p.discord_avatar_url,
    currentMMR: p.currentMMR,
    rankLabel: p.rankLabel,
    seasonMatches: p.seasonMatches,
    seasonWins: p.seasonWins,
    seasonWinRate: p.seasonWinRate,
    seasonNetMMR: p.seasonNetMMR,
  }))

  return (
    <SeasonContent
      currentSeason={{
        id: currentSeason.id,
        name: currentSeason.name,
        description: currentSeason.description,
        start_date: currentSeason.start_date,
        end_date: currentSeason.end_date,
      }}
      isBeforeStart={isBeforeStart}
      selectedGame={selectedGame}
      gameLabel={gameLabel}
      playersWithStats={playersFormatted}
      queuePlayers={queuePlayersFormatted}
      liveMatches={liveMatches}
      top10={playersFormatted.filter(p => p.currentMMR >= 3000).slice(0, 10)}
      xWatch={playersFormatted.filter(p => p.currentMMR < 3000 && p.currentMMR >= 2000).slice(0, 10)}
      totalSeasonMatches={totalSeasonMatches}
      totalPlayers={players.length}
      averageMMR={averageMMR}
      seasonComments={seasonComments}
    />
  )
}
