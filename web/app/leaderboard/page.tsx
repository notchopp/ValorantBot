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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-[#ffd700] mb-4">
            Global Leaderboard
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Top players ranked by MMR
          </p>
          
          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
              <div className="text-sm uppercase tracking-wider text-gray-500 mb-2">Total Players</div>
              <div className="text-3xl font-black text-white">{totalPlayers}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
              <div className="text-sm uppercase tracking-wider text-gray-500 mb-2">Average MMR</div>
              <div className="text-3xl font-black text-[#ffd700]">{averageMMR}</div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
              <div className="text-sm uppercase tracking-wider text-gray-500 mb-2">Top Player</div>
              <div className="text-xl font-black text-white truncate">
                {topPlayer?.discord_username || 'N/A'}
              </div>
            </div>
          </div>
        </div>
        
        {/* Leaderboard Table */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Player
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                    Tier
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    MMR
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-gray-500">
                    Peak MMR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {players.map((player, index) => (
                  <tr 
                    key={player.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-2xl font-black ${index < 3 ? 'text-[#ffd700]' : 'text-gray-400'}`}>
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link 
                        href={`/profile/${player.discord_user_id}`}
                        className="hover:text-[#ffd700] transition-colors"
                      >
                        <div className="font-bold text-white">{player.discord_username}</div>
                        {player.riot_name && player.riot_tag && (
                          <div className="text-sm text-gray-500">
                            {player.riot_name}#{player.riot_tag}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RankBadge mmr={player.current_mmr} size="sm" />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-lg font-black text-[#ffd700]">
                        {player.current_mmr}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-400">
                        {player.peak_mmr}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {players.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No players found. Be the first to join!</p>
          </div>
        )}
      </div>
    </div>
  )
}
