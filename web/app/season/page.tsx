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
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="text-center max-w-md">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">No Active Season</h1>
          <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed">Check back later for the next season!</p>
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
  const xWatch = players.slice(10, 20)
  
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
    <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Season Header */}
        <div className="text-center mb-12 md:mb-20">
          <h1 className="text-5xl sm:text-6xl md:text-8xl font-black text-[#ffd700] mb-4 md:mb-6 tracking-tighter leading-[0.9]">
            {currentSeason.name}
          </h1>
          {currentSeason.description && (
            <p className="text-xl md:text-2xl text-white/60 font-light mb-8 md:mb-12 max-w-3xl mx-auto leading-relaxed">
              {currentSeason.description}
            </p>
          )}
          <div className="text-sm md:text-base text-white/40 mb-8 md:mb-12 font-light">
            {new Date(currentSeason.start_date).toLocaleDateString()} - {new Date(currentSeason.end_date).toLocaleDateString()}
          </div>
          
          {/* Countdown */}
          <div className="max-w-2xl mx-auto mb-12 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Season Ends In</h2>
            <SeasonCountdown endDate={currentSeason.end_date} />
          </div>
        </div>
        
        {/* Top 10 & X Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-20">
          {/* Top 10 */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Top 10 (X Rank)</h2>
            <div className="space-y-3 md:space-y-4">
              {top10.map((player, index) => (
                <Link
                  key={player.id}
                  href={`/profile/${player.discord_user_id}`}
                  className="flex items-center gap-4 md:gap-6 p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-[#ffd700]/20 transition-all duration-200 group"
                >
                  <div className="text-2xl md:text-3xl font-black text-[#ffd700] w-8 md:w-12">
                    #{index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username}</div>
                    <div className="text-sm text-white/40 font-light">{player.current_mmr} MMR</div>
                  </div>
                  <RankBadge mmr={player.current_mmr} size="sm" />
                  <svg className="w-4 h-4 text-white/20 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
          
          {/* X Watch */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-2 md:mb-4 tracking-tighter uppercase">X Watch</h2>
            <p className="text-sm md:text-base text-white/40 mb-6 md:mb-8 font-light">Players close to Top 10</p>
            <div className="space-y-3 md:space-y-4">
              {xWatch.map((player, index) => (
                <Link
                  key={player.id}
                  href={`/profile/${player.discord_user_id}`}
                  className="flex items-center gap-4 md:gap-6 p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-[#ffd700]/20 transition-all duration-200 group"
                >
                  <div className="text-lg md:text-xl font-black text-white/40 w-8 md:w-12">
                    #{index + 11}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username}</div>
                    <div className="text-sm text-white/40 font-light">
                      {player.current_mmr} MMR
                      {top10[9] && (
                        <span className="ml-2 text-red-500">
                          (-{top10[9].current_mmr - player.current_mmr} from #10)
                        </span>
                      )}
                    </div>
                  </div>
                  <RankBadge mmr={player.current_mmr} size="sm" />
                  <svg className="w-4 h-4 text-white/20 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
        
        {/* Global Leaderboard Link */}
        <div className="text-center mb-12 md:mb-20">
          <Link
            href="/leaderboard"
            className="inline-block px-8 md:px-12 py-4 md:py-6 bg-[#ffd700] text-black font-black uppercase tracking-[0.2em] text-[10px] md:text-[11px] rounded-xl hover:bg-[#ffed4e] transition-all shadow-xl"
          >
            View Full Leaderboard
          </Link>
        </div>
        
        {/* Season Comments */}
        <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Season Discussion</h2>
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
