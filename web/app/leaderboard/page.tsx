import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { RankBadge } from '@/components/RankBadge'
import { Player, calculateRankLabel } from '@/lib/types'
import Link from 'next/link'

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
  const { data: leaderboard } = await supabaseAdmin
    .from('players')
    .select('*')
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
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-2">
            <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">QUERY</span><span className="text-white/40">::</span><span className="text-white">GLOBAL_RANKINGS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-mono font-black text-white mb-4 tracking-tighter leading-none uppercase">
            <span className="text-[var(--term-muted)]">[</span>LEAD<span className="text-[var(--term-muted)]">]</span>
            <br />
            <span className="text-[var(--term-accent)]">_ERBOARD</span>
          </h1>
          <p className="text-sm md:text-base text-[var(--term-muted)] font-mono mb-8 max-w-2xl">
            <span className="text-[var(--term-accent)]">#</span> Top players ranked by MMR. Real stats from competitive matches.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Link
              href="/leaderboard?game=valorant"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'valorant'
                  ? 'bg-[var(--term-accent)] text-black border-[var(--term-accent)]'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              Valorant
            </Link>
            <Link
              href="/leaderboard?game=marvel_rivals"
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
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl">
            <div className="terminal-panel p-6">
              <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2 font-mono">TOTAL_PLAYERS</div>
              <div className="text-3xl md:text-5xl font-mono font-black text-white tabular-nums">{totalPlayers}</div>
            </div>
            <div className="terminal-panel p-6">
              <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2 font-mono">AVG_MMR</div>
              <div className="text-3xl md:text-5xl font-mono font-black text-[var(--term-accent)] tabular-nums">{averageMMR}</div>
            </div>
            <div className="terminal-panel p-6">
              <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2 font-mono">TOP_PLAYER</div>
              <div className="text-xl md:text-2xl font-mono font-black text-white truncate">
                {topPlayer?.discord_username || 'N/A'}
              </div>
              {topPlayer && (
                <div className="text-sm text-[var(--term-accent)] font-mono font-black mt-1">{topPlayer.currentMMR} MMR</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Leaderboard Table */}
        <div className="terminal-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full font-mono">
              <thead className="bg-[var(--term-panel)] border-b border-[var(--term-border)]">
                <tr>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)]">
                    POS
                  </th>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)]">
                    PLAYER
                  </th>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)]">
                    TIER
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)]">
                    MMR
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)] hidden md:table-cell">
                    K/D
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)] hidden md:table-cell">
                    WIN%
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--term-muted)]">
                    PEAK
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--term-border)]">
                {playersWithStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center text-[var(--term-muted)]">
                      [NO_DATA] No players found. Be the first to join!
                    </td>
                  </tr>
                ) : (
                  playersWithStats.map((player, index) => (
                    <tr
                      key={player.id}
                      className="group hover:bg-[var(--term-panel)] transition-colors"
                    >
                      <td className="px-4 md:px-8 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg md:text-xl font-black tabular-nums ${
                            index === 0 ? 'text-[var(--term-accent)]' : 
                            index < 3 ? 'text-[var(--term-accent)]/80' : 
                            index < 10 ? 'text-[var(--term-accent)]/60' : 
                            'text-[var(--term-muted)]'
                          }`}>
                            #{index + 1}
                          </span>
                          {index === 0 && (
                            <span className="text-2xl">👑</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4">
                        <Link
                          href={`/profile/${player.discord_user_id}`}
                          className="flex items-center gap-3 md:gap-4 group/link"
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            {player.discord_avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={player.discord_avatar_url}
                                alt={player.discord_username || 'Player'}
                                className="w-10 h-10 rounded-full border border-white/10 group-hover/link:border-red-500/50 transition-colors"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/60 text-xs font-black group-hover/link:border-red-500/50 transition-colors">
                                {(player.discord_username || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-white tracking-tight truncate group-hover/link:text-red-500 transition-colors">
                              {player.discord_username || 'Unknown'}
                            </div>
                            {selectedGame === 'marvel_rivals' ? (
                              player.marvel_rivals_username && (
                                <div className="text-sm text-white/40 font-light truncate">
                                  {player.marvel_rivals_username}
                                </div>
                              )
                            ) : (
                              player.riot_name && player.riot_tag && (
                                <div className="text-sm text-white/40 font-light truncate">
                                  {player.riot_name}#{player.riot_tag}
                                </div>
                              )
                            )}
                          </div>
                          <svg className="w-4 h-4 text-white/20 group-hover/link:text-red-500 group-hover/link:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 md:px-8 py-4">
                        <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                      </td>
                      <td className="px-4 md:px-8 py-4 text-right">
                        <span className="text-lg md:text-xl font-black text-white tracking-tighter">{player.currentMMR}</span>
                      </td>
                      <td className="px-4 md:px-8 py-4 text-right hidden md:table-cell">
                        <span className={`text-base font-black tracking-tight ${player.kd >= 1.0 ? 'text-green-500' : 'text-white/60'}`}>
                          {player.kd.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 md:px-8 py-4 text-right hidden md:table-cell">
                        <span className={`text-base font-black tracking-tight ${player.winRate >= 50 ? 'text-green-500' : 'text-white/60'}`}>
                          {player.winRate}%
                        </span>
                        <div className="text-xs text-white/40">{player.totalMatches || 0} matches</div>
                      </td>
                      <td className="px-4 md:px-8 py-4 text-right">
                        <span className="text-base md:text-lg font-black text-white/60 tracking-tight">{player.peakMMR}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
