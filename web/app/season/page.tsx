import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { RankBadge } from '@/components/RankBadge'
import { SeasonCountdown } from '@/components/SeasonCountdown'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Player, Season, Comment } from '@/lib/types'
import Link from 'next/link'

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
  
  // Get top 10 for X rank (only players with 3000+ MMR)
  const xRankPlayers = playersWithStats.filter(p => p.currentMMR >= 3000)
  const top10 = xRankPlayers.slice(0, 10)
  const xWatch = playersWithStats.filter(p => p.currentMMR < 3000 && p.currentMMR >= 2000).slice(0, 10)
  
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
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Season Header */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-2">
                <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">SEASON</span><span className="text-white/40">::</span><span className="text-white">ACTIVE_INSTANCE</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-mono font-black text-[var(--term-accent)] mb-2 tracking-tighter leading-none">
                <span className="text-[var(--term-muted)]">[</span>{currentSeason.name}<span className="text-[var(--term-muted)]\">]</span>
              </h1>
              {currentSeason.description && (
                <p className="text-sm md:text-base text-[var(--term-muted)] font-mono max-w-2xl">
                  <span className="text-[var(--term-accent)]">#</span> {currentSeason.description}
                </p>
              )}
            </div>
            <div className="text-right hidden sm:block terminal-panel p-4">
              <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2">STATUS</div>
              <div className="text-lg font-mono font-black text-[var(--term-accent)]">
                {isBeforeStart ? '[PENDING]' : '[ACTIVE]'}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Link
              href="/season?game=valorant"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'valorant'
                  ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              Valorant
            </Link>
            <Link
              href="/season?game=marvel_rivals"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'marvel_rivals'
                  ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              Marvel Rivals
            </Link>
            <span className="text-[10px] font-mono text-[var(--term-muted)] px-2">[{gameLabel.toUpperCase()}]</span>
          </div>
          
          {/* Countdown & Stats */}
          <div className="terminal-panel p-6 mb-8">
            {isBeforeStart ? (
              <>
                <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">&gt; COUNTDOWN_TO_START</div>
                <SeasonCountdown endDate={currentSeason.start_date} />
              </>
            ) : (
              <>
                <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">&gt; TIME_REMAINING</div>
                <SeasonCountdown endDate={currentSeason.end_date} />
              </>
            )}
            <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-[var(--term-border)]">
              <div>
                <div className="text-[10px] text-[var(--term-muted)] mb-1 font-mono uppercase">MATCHES</div>
                <div className="text-2xl font-mono font-black text-[var(--term-accent)]">{totalSeasonMatches}</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--term-muted)] mb-1 font-mono uppercase">PLAYERS</div>
                <div className="text-2xl font-mono font-black text-white">{players.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-[var(--term-muted)] mb-1 font-mono uppercase">AVG_MMR</div>
                <div className="text-2xl font-mono font-black text-white">{averageMMR}</div>
              </div>
            </div>
            <div className="text-[10px] text-[var(--term-muted)] mt-3 font-mono">
              [{new Date(currentSeason.start_date).toLocaleDateString()}] → [{new Date(currentSeason.end_date).toLocaleDateString()}]
            </div>
          </div>
        </div>
        
        {/* Live Matches & Queue Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Current Queue */}
          <div className="terminal-panel p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">QUEUE</span><span className="text-white/40">::</span><span className="text-white">ACTIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--term-accent)] rounded-full animate-pulse"></span>
                <span className="text-[10px] font-mono text-[var(--term-muted)]">{queuePlayers.length}/10 PLAYERS</span>
              </div>
            </div>
            
            {queuePlayers.length > 0 ? (
              <div className="space-y-2">
                {queuePlayers.map((entry, index) => {
                  const mmr = selectedGame === 'marvel_rivals' 
                    ? (entry.player?.marvel_rivals_mmr ?? 0)
                    : (entry.player?.valorant_mmr ?? 0)
                  const rank = selectedGame === 'marvel_rivals'
                    ? (entry.player?.marvel_rivals_rank ?? 'Unranked')
                    : (entry.player?.valorant_rank ?? 'Unranked')
                  const joinedAgo = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000)
                  
                  return (
                    <Link
                      key={entry.id}
                      href={`/profile/${entry.player?.discord_user_id}`}
                      className="flex items-center gap-3 p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/50 transition-all group"
                    >
                      <span className="text-[var(--term-muted)] font-mono text-sm w-6">{index + 1}.</span>
                      {entry.player?.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.player.discord_avatar_url}
                          alt={entry.player.discord_username || 'Player'}
                          className="w-8 h-8 rounded-sm border border-[var(--term-border)]"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-sm bg-[var(--term-bg)] border border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-xs font-mono">
                          {(entry.player?.discord_username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-white text-sm truncate">{entry.player?.discord_username || 'Unknown'}</div>
                        <div className="text-[10px] text-[var(--term-muted)] font-mono">{mmr} MMR</div>
                      </div>
                      <RankBadge mmr={mmr} size="sm" rankLabel={rank} />
                      <span className="text-[10px] text-[var(--term-muted)] font-mono">{joinedAgo}m</span>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[QUEUE_EMPTY]</div>
                <div className="text-[10px] text-[var(--term-muted)]">No players in queue. Join via Discord!</div>
              </div>
            )}
            
            {/* Queue Progress Bar */}
            <div className="mt-4 pt-4 border-t border-[var(--term-border)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--term-muted)] mb-2">
                <span>QUEUE_FILL</span>
                <span>{queuePlayers.length}/10</span>
              </div>
              <div className="h-2 bg-[var(--term-bg)] border border-[var(--term-border)]">
                <div 
                  className="h-full bg-[var(--term-accent)] transition-all duration-500"
                  style={{ width: `${(queuePlayers.length / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Live Matches */}
          <div className="terminal-panel p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">MATCHES</span><span className="text-white/40">::</span><span className="text-white">LIVE</span>
              </div>
              <div className="flex items-center gap-2">
                {liveMatches.length > 0 && (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-mono text-[var(--term-muted)]">{liveMatches.length} ACTIVE</span>
                  </>
                )}
              </div>
            </div>
            
            {liveMatches.length > 0 ? (
              <div className="space-y-3">
                {liveMatches.map((match) => {
                  const isInProgress = match.status === 'in-progress'
                  const teamANames = (match.team_a || []).slice(0, 3).map(p => p.discord_username?.split('#')[0] || 'Player').join(', ')
                  const teamBNames = (match.team_b || []).slice(0, 3).map(p => p.discord_username?.split('#')[0] || 'Player').join(', ')
                  const matchAge = Math.floor((Date.now() - new Date(match.match_date).getTime()) / 60000)
                  
                  return (
                    <div
                      key={match.id}
                      className="p-4 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/30 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isInProgress ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                          <span className="text-[10px] font-mono font-bold text-white uppercase">
                            {isInProgress ? '[IN_PROGRESS]' : '[PENDING]'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--term-muted)]">
                          {match.map || 'TBD'} • {matchAge}m ago
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-[var(--term-accent)] mb-1">TEAM_A</div>
                          <div className="text-xs font-mono text-white truncate" title={teamANames}>
                            {teamANames}{(match.team_a?.length || 0) > 3 ? '...' : ''}
                          </div>
                        </div>
                        <div className="text-center px-4">
                          <div className="text-lg font-mono font-black text-[var(--term-muted)]">VS</div>
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] font-mono text-[var(--term-accent)] mb-1">TEAM_B</div>
                          <div className="text-xs font-mono text-white truncate" title={teamBNames}>
                            {teamBNames}{(match.team_b?.length || 0) > 3 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                      
                      {match.host && (
                        <div className="mt-3 pt-3 border-t border-[var(--term-border)] flex items-center gap-2 text-[10px] font-mono text-[var(--term-muted)]">
                          <span>HOST:</span>
                          <Link 
                            href={`/profile/${match.host.discord_user_id}`}
                            className="text-white hover:text-[var(--term-accent)] transition-colors"
                          >
                            {match.host.discord_username || 'Unknown'}
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[NO_ACTIVE_MATCHES]</div>
                <div className="text-[10px] text-[var(--term-muted)]">No live matches. Start a game via Discord!</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Top 10 & X Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Top 10 (X Rank) */}
          <div className="terminal-panel p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">TOP_10</span><span className="text-white/40">::</span><span className="text-white">X_RANK</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--term-muted)]">{top10.length} PLAYERS</div>
            </div>
            <div className="space-y-2">
              {top10.length > 0 ? (
                top10.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/profile/${player.discord_user_id}`}
                    className="flex items-center gap-3 p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/50 transition-all group"
                  >
                    <div className="text-lg font-mono font-black text-[var(--term-accent)] w-8">#{index + 1}</div>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {player.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.discord_avatar_url}
                          alt={player.discord_username || 'Player'}
                          className="w-8 h-8 rounded-sm border border-[var(--term-border)] group-hover:border-[var(--term-accent)]/50 transition-colors"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-sm bg-[var(--term-bg)] border border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-xs font-mono group-hover:border-[var(--term-accent)]/50 transition-colors">
                          {(player.discord_username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-bold text-white text-sm truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-[10px] text-[var(--term-muted)] font-mono">
                        {player.currentMMR} MMR • {player.seasonMatches || 0}M • {player.seasonWinRate || 0}%WR
                      </div>
                    </div>
                    <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                  </Link>
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[NO_X_RANK]</div>
                  <div className="text-[10px] text-[var(--term-muted)]">Be the first to reach 3000+ MMR!</div>
                </div>
              )}
            </div>
          </div>
          
          {/* X Watch */}
          <div className="terminal-panel p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">X_WATCH</span><span className="text-white/40">::</span><span className="text-white">CONTENDERS</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--term-muted)]">{xWatch.length} PLAYERS</div>
            </div>
            <div className="space-y-2">
              {xWatch.length > 0 ? (
                xWatch.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/profile/${player.discord_user_id}`}
                    className="flex items-center gap-3 p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/50 transition-all group"
                  >
                    <div className="text-sm font-mono font-bold text-[var(--term-muted)] w-8">#{index + 11}</div>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {player.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.discord_avatar_url}
                          alt={player.discord_username || 'Player'}
                          className="w-8 h-8 rounded-sm border border-[var(--term-border)] group-hover:border-[var(--term-accent)]/50 transition-colors"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-sm bg-[var(--term-bg)] border border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-xs font-mono group-hover:border-[var(--term-accent)]/50 transition-colors">
                          {(player.discord_username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-bold text-white text-sm truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-[10px] text-[var(--term-muted)] font-mono">
                        {player.currentMMR} MMR
                        {top10.length > 0 && top10[top10.length - 1] && (
                          <span className="ml-2 text-[var(--term-accent)]">
                            [-{top10[top10.length - 1].currentMMR - player.currentMMR} TO #10]
                          </span>
                        )}
                      </div>
                    </div>
                    <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                  </Link>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-[var(--term-muted)] font-mono text-sm">[NO_CONTENDERS]</div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Full Leaderboard Link */}
        <div className="text-center mb-8 md:mb-12">
          <Link
            href={`/leaderboard?game=${selectedGame}`}
            className="inline-block px-8 py-3 border border-[var(--term-accent)] text-[var(--term-accent)] font-mono font-bold uppercase tracking-wider text-xs hover:bg-[var(--term-accent)] hover:text-black transition-all"
          >
            [VIEW_FULL_LEADERBOARD]
          </Link>
        </div>
        
        {/* Season Comments */}
        <div className="terminal-panel p-6 md:p-8">
          <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
            <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">SEASON</span><span className="text-white/40">::</span><span className="text-white">DISCUSSION</span>
          </div>
          <CommentSectionWrapper
            targetType="season"
            targetId={currentSeason.id}
            comments={seasonComments}
          />
        </div>
      </div>
    </div>
  )
}
