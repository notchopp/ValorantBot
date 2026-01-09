import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { RankBadge } from '@/components/RankBadge'
import { Player } from '@/lib/types'
import Link from 'next/link'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LeaderboardPage() {
  // Use admin client to ensure data access
  const supabaseAdmin = getSupabaseAdminClient()
  
  // Get all players ordered by MMR with real stats
  const { data: leaderboard } = await supabaseAdmin
    .from('players')
    .select('*')
    .order('current_mmr', { ascending: false })
    .limit(100)
  
  const players = (leaderboard as Player[]) || []
  
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
      const { data: matchStats } = await supabaseAdmin
        .from('match_player_stats')
        .select('*, match:matches(winner)')
        .eq('player_id', player.id)
      
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
      
      return {
        ...player,
        totalMatches,
        wins,
        winRate,
        kd: parseFloat(kd),
      }
    })
  )
  
  // Calculate global stats
  const totalPlayers = playersWithStats.length
  const averageMMR = players.length > 0 
    ? Math.round(players.reduce((sum, p) => sum + p.current_mmr, 0) / players.length)
    : 0
  
  const topPlayer = playersWithStats[0]
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter leading-none uppercase">
            Global
            <br />
            <span className="text-red-500">Leaderboard</span>
          </h1>
          <p className="text-base md:text-lg text-white/60 font-light mb-8 max-w-2xl">
            Top players ranked by MMR. Real stats from competitive matches.
          </p>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl">
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Total Players</div>
              <div className="text-3xl md:text-5xl font-black text-white tracking-tighter">{totalPlayers}</div>
            </div>
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Average MMR</div>
              <div className="text-3xl md:text-5xl font-black text-red-500 tracking-tighter">{averageMMR}</div>
            </div>
            <div className="glass rounded-2xl p-6 border border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Top Player</div>
              <div className="text-xl md:text-2xl font-black text-white tracking-tighter truncate">
                {topPlayer?.discord_username || 'N/A'}
              </div>
              {topPlayer && (
                <div className="text-sm text-red-500 font-black mt-1">{topPlayer.current_mmr} MMR</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Leaderboard Table */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Rank
                  </th>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Player
                  </th>
                  <th className="px-4 md:px-8 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Tier
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    MMR
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hidden md:table-cell">
                    K/D
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hidden md:table-cell">
                    Win Rate
                  </th>
                  <th className="px-4 md:px-8 py-4 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Peak
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {playersWithStats.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-8 py-16 text-center text-white/40 font-light">
                      No players found. Be the first to join!
                    </td>
                  </tr>
                ) : (
                  playersWithStats.map((player, index) => (
                    <tr
                      key={player.id}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 md:px-8 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg md:text-xl font-black tracking-tighter ${
                            index === 0 ? 'text-red-500' : 
                            index < 3 ? 'text-red-500/80' : 
                            index < 10 ? 'text-red-500/60' : 
                            'text-white/40'
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
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-white tracking-tight truncate group-hover/link:text-red-500 transition-colors">
                              {player.discord_username || 'Unknown'}
                            </div>
                            {player.riot_name && player.riot_tag && (
                              <div className="text-sm text-white/40 font-light truncate">
                                {player.riot_name}#{player.riot_tag}
                              </div>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-white/20 group-hover/link:text-red-500 group-hover/link:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 md:px-8 py-4">
                        <RankBadge mmr={player.current_mmr} size="sm" />
                      </td>
                      <td className="px-4 md:px-8 py-4 text-right">
                        <span className="text-lg md:text-xl font-black text-white tracking-tighter">{player.current_mmr}</span>
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
                        <span className="text-base md:text-lg font-black text-white/60 tracking-tight">{player.peak_mmr}</span>
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
