import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { SeasonCountdown } from '@/components/SeasonCountdown'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Player, Season, Comment } from '@/lib/types'
import Link from 'next/link'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SeasonPage() {
  const supabase = await createClient()
  
  // Get active season or upcoming season
  const { data: activeSeason } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  
  // If no active season, check for upcoming season (starts soon)
  let currentSeason = activeSeason as Season | null
  let seasonStartsSoon = false
  
  if (!currentSeason) {
    const { data: upcomingSeason } = await supabase
      .from('seasons')
      .select('*')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    if (upcomingSeason) {
      currentSeason = upcomingSeason as Season
      seasonStartsSoon = true
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
  
  // Get leaderboard (top 50)
  const { data: leaderboard } = await supabase
    .from('players')
    .select('*')
    .order('current_mmr', { ascending: false })
    .limit(50)
  
  const players = (leaderboard as Player[]) || []
  
  // Get top 10 for X rank
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
  
  const seasonComments = (comments as Comment[]) || []
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Season Header - Compact */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-yellow-500 mb-2 tracking-tighter leading-none">
                {currentSeason.name}
              </h1>
              {currentSeason.description && (
                <p className="text-base md:text-lg text-white/60 font-light max-w-2xl">
                  {currentSeason.description}
                </p>
              )}
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Status</div>
              <div className="text-lg font-black text-white">
                {seasonStartsSoon ? 'Starts Soon' : 'Active'}
              </div>
            </div>
          </div>
          
          {/* Countdown - Compact */}
          <div className="glass rounded-2xl p-6 border border-white/5 mb-8">
            {seasonStartsSoon ? (
              <>
                <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-3">Season Starts In</div>
                <SeasonCountdown endDate={currentSeason.start_date} />
              </>
            ) : (
              <>
                <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-3">Season Ends In</div>
                <SeasonCountdown endDate={currentSeason.end_date} />
              </>
            )}
            <div className="text-xs text-white/40 mt-3 font-light">
              {new Date(currentSeason.start_date).toLocaleDateString()} - {new Date(currentSeason.end_date).toLocaleDateString()}
            </div>
          </div>
        </div>
        
        {/* Top 10 & X Watch Grid - Dashboard Style */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Top 10 (X Rank) */}
          <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all">
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
                    className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-yellow-500/30 transition-all group"
                  >
                    <div className="text-xl font-black text-yellow-500 w-8">#{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-xs text-white/40">{player.current_mmr} MMR</div>
                    </div>
                    <RankBadge mmr={player.current_mmr} size="sm" />
                    <svg className="w-4 h-4 text-white/20 group-hover:text-yellow-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-white/40 text-sm">No players yet</div>
              )}
            </div>
          </div>
          
          {/* X Watch */}
          <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all">
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
                    className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-yellow-500/30 transition-all group"
                  >
                    <div className="text-base font-black text-white/40 w-8">#{index + 11}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white mb-1 tracking-tight truncate">{player.discord_username || 'Unknown'}</div>
                      <div className="text-xs text-white/40">
                        {player.current_mmr} MMR
                        {top10[9] && (
                          <span className="ml-2 text-white/30">
                            (-{top10[9].current_mmr - player.current_mmr} from #10)
                          </span>
                        )}
                      </div>
                    </div>
                    <RankBadge mmr={player.current_mmr} size="sm" />
                    <svg className="w-4 h-4 text-white/20 group-hover:text-yellow-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            href="/leaderboard"
            className="inline-block px-8 py-4 bg-yellow-500 text-black font-black uppercase tracking-wider text-xs rounded-xl hover:bg-yellow-400 transition-all shadow-xl"
          >
            View Full Leaderboard
          </Link>
        </div>
        
        {/* Season Comments */}
        <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all">
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
