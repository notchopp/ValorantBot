import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { Player } from '@/lib/types'
import Link from 'next/link'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  
  // Get all players ordered by MMR
  const { data: leaderboard } = await supabase
    .from('players')
    .select('*')
    .order('current_mmr', { ascending: false })
    .limit(100)
  
  const players = leaderboard as Player[] || []
  
  // Calculate stats
  const totalPlayers = players.length
  const averageMMR = players.length > 0 
    ? Math.round(players.reduce((sum, p) => sum + p.current_mmr, 0) / players.length)
    : 0
  
  const topPlayer = players[0]
  
  return (
    <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12 md:mb-20">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-white mb-4 md:mb-6 tracking-tighter leading-[0.9] uppercase">
            Global
            <br />
            <span className="text-[#ffd700]">Leaderboard</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/60 font-light mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed">
            Top players ranked by MMR. Climb the ranks and compete with the best.
          </p>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Total Players</div>
              <div className="text-3xl md:text-5xl font-black text-white tracking-tighter">{totalPlayers}</div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Average MMR</div>
              <div className="text-3xl md:text-5xl font-black text-[#ffd700] tracking-tighter">{averageMMR}</div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Top Player</div>
              <div className="text-xl md:text-2xl font-black text-white tracking-tighter truncate">
                {topPlayer?.discord_username || 'N/A'}
              </div>
              {topPlayer && (
                <div className="text-sm text-[#ffd700] font-black mt-1">{topPlayer.current_mmr} MMR</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Leaderboard Table */}
        <div className="glass rounded-[2rem] md:rounded-[3rem] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Rank
                  </th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Player
                  </th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-left text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Tier
                  </th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    MMR
                  </th>
                  <th className="px-4 md:px-8 py-4 md:py-6 text-right text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                    Peak MMR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {players.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-16 text-center text-white/40 font-light">
                      No players found. Be the first to join!
                    </td>
                  </tr>
                ) : (
                  players.map((player, index) => (
                    <tr
                      key={player.id}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg md:text-xl font-black tracking-tighter ${
                            index === 0 ? 'text-[#ffd700]' : 
                            index < 3 ? 'text-[#ffd700]/80' : 
                            index < 10 ? 'text-[#ffd700]/60' : 
                            'text-white/40'
                          }`}>
                            #{index + 1}
                          </span>
                          {index === 0 && (
                            <span className="text-2xl">👑</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <Link
                          href={`/profile/${player.discord_user_id}`}
                          className="flex items-center gap-3 md:gap-4 group/link"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-white tracking-tight truncate group-hover/link:text-[#ffd700] transition-colors">
                              {player.discord_username}
                            </div>
                            {player.riot_name && player.riot_tag && (
                              <div className="text-sm text-white/40 font-light truncate">
                                {player.riot_name}#{player.riot_tag}
                              </div>
                            )}
                          </div>
                          <svg className="w-4 h-4 text-white/20 group-hover/link:text-[#ffd700] group-hover/link:translate-x-1 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6">
                        <RankBadge mmr={player.current_mmr} size="sm" />
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                        <span className="text-lg md:text-xl font-black text-white tracking-tighter">{player.current_mmr}</span>
                      </td>
                      <td className="px-4 md:px-8 py-4 md:py-6 text-right">
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
