import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { SeasonCountdown } from '@/components/SeasonCountdown'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Player, Season, Comment } from '@/lib/types'
import Link from 'next/link'

export default async function SeasonPage() {
  const supabase = await createClient()
  
  // Get active season
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()
  
  const currentSeason = season as Season | null
  
  if (!currentSeason) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-4">No Active Season</h1>
          <p className="text-gray-400">Check back later for the next season!</p>
        </div>
      </div>
    )
  }
  
  // Get leaderboard (top 50)
  const { data: leaderboard } = await supabase
    .from('players')
    .select('*')
    .order('current_mmr', { ascending: false })
    .limit(50)
  
  const players = leaderboard as Player[] || []
  
  // Get top 10 for X watch
  const top10 = players.slice(0, 10)
  const xWatch = players.slice(10, 20) // Players 11-20 who are close to top 10
  
  // Get comments for season
  const { data: comments } = await supabase
    .from('comments')
    .select('*, author:players(*)')
    .eq('target_type', 'season')
    .eq('target_id', currentSeason.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const seasonComments = comments as Comment[] || []
  
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Season Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-black text-[#ffd700] mb-4">
            {currentSeason.name}
          </h1>
          {currentSeason.description && (
            <p className="text-xl text-gray-400 mb-8">
              {currentSeason.description}
            </p>
          )}
          <div className="text-sm text-gray-500 mb-8">
            {new Date(currentSeason.start_date).toLocaleDateString()} - {new Date(currentSeason.end_date).toLocaleDateString()}
          </div>
          
          {/* Countdown */}
          <div className="max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-black text-white mb-6">Season Ends In</h2>
            <SeasonCountdown endDate={currentSeason.end_date} />
          </div>
        </div>
        
        {/* Top 10 & X Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Top 10 */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white mb-6">Top 10 (X Rank)</h2>
            <div className="space-y-3">
              {top10.map((player, index) => (
                <Link
                  key={player.id}
                  href={`/profile/${player.discord_user_id}`}
                  className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="text-2xl font-black text-[#ffd700] w-8">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{player.discord_username}</div>
                    <div className="text-sm text-gray-500">{player.current_mmr} MMR</div>
                  </div>
                  <RankBadge mmr={player.current_mmr} size="sm" />
                </Link>
              ))}
            </div>
          </div>
          
          {/* X Watch */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white mb-6">X Watch</h2>
            <p className="text-sm text-gray-400 mb-4">Players close to Top 10</p>
            <div className="space-y-3">
              {xWatch.map((player, index) => (
                <Link
                  key={player.id}
                  href={`/profile/${player.discord_user_id}`}
                  className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.04] transition-all duration-200"
                >
                  <div className="text-lg font-bold text-gray-400 w-8">
                    #{index + 11}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white">{player.discord_username}</div>
                    <div className="text-sm text-gray-500">
                      {player.current_mmr} MMR
                      {top10[9] && (
                        <span className="ml-2 text-red-500">
                          (-{top10[9].current_mmr - player.current_mmr} from #10)
                        </span>
                      )}
                    </div>
                  </div>
                  <RankBadge mmr={player.current_mmr} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        </div>
        
        {/* Global Leaderboard Link */}
        <div className="text-center mb-12">
          <Link
            href="/leaderboard"
            className="inline-block px-8 py-4 bg-[#ffd700] text-black font-black text-lg rounded-lg hover:bg-[#ccaa00] transition-colors"
          >
            View Full Leaderboard
          </Link>
        </div>
        
        {/* Season Comments */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white mb-6">Season Discussion</h2>
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
