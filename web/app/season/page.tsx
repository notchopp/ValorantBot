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
                  ? 'bg-[var(--term-accent)] text-black border-[var(--term-accent)]'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              Valorant
            </Link>
            <Link
              href="/season?game=marvel_rivals"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'marvel_rivals'
                  ? 'bg-[var(--term-accent)] text-black border-[var(--term-accent)]'
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
        
        {/* Top 10 & X Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Top 10 (X Rank) */}
          <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Top 10 (X Rank)</h2>
              <div className="text-xs text-white/40">{top10.length} players</div>
            </div>
            <div className="space-y-2">
              {top10.length > 0 ? (
                top10.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/profile/${player.discord_user_id}`}
                    className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-red-500/30 transition-all group"
                  >
                    <div className="text-xl font-black text-red-500 w-8">#{index + 1}</div>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {player.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.discord_avatar_url}
                          alt={player.discord_username || 'Player'}
                          className="w-10 h-10 rounded-full border border-white/10 group-hover:border-red-500/50 transition-colors"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/60 text-xs font-black group-hover:border-red-500/50 transition-colors">
                          {(player.discord_username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-xs text-white/40">
                        {player.currentMMR} MMR • {player.seasonMatches || 0} matches • {player.seasonWinRate || 0}% WR
                      </div>
                    </div>
                    <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                    <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 text-white/40">
                  <p className="text-sm font-light mb-2">No one has hit X rank yet</p>
                  <p className="text-xs text-white/30">Be the first to reach 3000+ MMR!</p>
                </div>
              )}
            </div>
          </div>
          
          {/* X Watch */}
          <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-tight mb-1">X Watch</h2>
                <p className="text-xs text-white/40">Players chasing Top 10</p>
              </div>
              <div className="text-xs text-white/40">{xWatch.length} players</div>
            </div>
            <div className="space-y-2">
              {xWatch.length > 0 ? (
                xWatch.map((player, index) => (
                  <Link
                    key={player.id}
                    href={`/profile/${player.discord_user_id}`}
                    className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-red-500/30 transition-all group"
                  >
                    <div className="text-base font-black text-white/40 w-8">#{index + 11}</div>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {player.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.discord_avatar_url}
                          alt={player.discord_username || 'Player'}
                          className="w-10 h-10 rounded-full border border-white/10 group-hover:border-red-500/50 transition-colors"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/60 text-xs font-black group-hover:border-red-500/50 transition-colors">
                          {(player.discord_username || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-xs text-white/40">
                        {player.currentMMR} MMR
                        {top10.length > 0 && top10[top10.length - 1] && (
                          <span className="ml-2 text-white/30">
                            (-{top10[top10.length - 1].currentMMR - player.currentMMR} from #10)
                          </span>
                        )}
                      </div>
                    </div>
                    <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                    <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">No players in X Watch</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Full Leaderboard Link */}
        <div className="text-center mb-8 md:mb-12">
          <Link
            href={`/leaderboard?game=${selectedGame}`}
            className="inline-block px-8 py-4 bg-red-500 text-white font-black uppercase tracking-wider text-xs rounded-xl hover:bg-red-600 transition-all shadow-xl"
          >
            View Full Leaderboard
          </Link>
        </div>
        
        {/* Season Comments */}
        <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
          <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Season Discussion</h2>
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
