import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { ActivityFeed } from '@/components/ActivityFeed'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Player, ActivityFeed as ActivityFeedType, Comment, RankHistory } from '@/lib/types'
import { notFound } from 'next/navigation'

export default async function ProfilePage({ params }: { params: { userId: string } }) {
  // Use admin client for data fetching
  const supabaseAdmin = getSupabaseAdminClient()
  const { userId } = params
  
  // Get player by discord_user_id
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('discord_user_id', userId)
    .maybeSingle() as { data: Player | null }
  
  if (!player) {
    notFound()
  }
  
  const playerData = player as Player
  
  // Get player's match stats
  const { data: matchStats } = await supabaseAdmin
    .from('match_player_stats')
    .select('*, match:matches(*)')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
  
  interface MatchStatWithMatch {
    team: 'A' | 'B'
    kills: number
    deaths: number
    mvp: boolean
    mmr_after: number
    mmr_before: number
    match?: { winner?: 'A' | 'B' }
  }
  
  const stats = (matchStats as MatchStatWithMatch[]) || []
  
  // Calculate stats
  const wins = stats.filter(s => {
    if (s.match && s.team) {
      return s.match.winner === s.team
    }
    return s.mmr_after > s.mmr_before
  }).length
  
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  
  const totalKills = stats.reduce((sum, s) => sum + s.kills, 0)
  const totalDeaths = stats.reduce((sum, s) => sum + s.deaths, 0)
  const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00'
  
  const mvpCount = stats.filter(s => s.mvp).length
  
  // Get activity feed
  const { data: activities } = await supabaseAdmin
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const activityFeed = (activities as ActivityFeedType[]) || []
  
  // Get rank history
  const { data: rankHistory } = await supabaseAdmin
    .from('rank_history')
    .select('*')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const history = (rankHistory as RankHistory[]) || []
  
  // Get comments for profile
  const { data: comments } = await supabaseAdmin
    .from('comments')
    .select('*, author:players(*)')
    .eq('target_type', 'profile')
    .eq('target_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(50)
  
  const profileComments = (comments as Comment[]) || []
  
  // Get leaderboard position
  const { count: position } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt('current_mmr', playerData.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  // Get user profile for display name
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name')
    .eq('discord_user_id', playerData.discord_user_id)
    .maybeSingle() as { data: { display_name: string | null } | null }
  
  const displayName = userProfile?.display_name || playerData.discord_username || 'Player'
  
  return (
    <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Profile Header */}
        <div className="mb-12 md:mb-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 mb-8 md:mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white mb-2 md:mb-4 tracking-tighter leading-[0.9]">
                {displayName}
              </h1>
              <p className="text-lg md:text-xl text-white/60 font-light">
                {playerData.riot_name && playerData.riot_tag 
                  ? `${playerData.riot_name}#${playerData.riot_tag}`
                  : 'No Riot account linked'
                }
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              <RankBadge mmr={playerData.current_mmr} size="xl" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                #{leaderboardPosition} on Leaderboard
              </p>
            </div>
          </div>
          
          {/* MMR Progress */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5 mb-8 md:mb-12">
            <div className="mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Current MMR</span>
                <span className="text-5xl md:text-7xl font-black text-red-500 tracking-tighter">
                  {playerData.current_mmr}
                </span>
              </div>
            </div>
            <MMRProgressBar currentMMR={playerData.current_mmr} />
            <div className="mt-6 flex items-center justify-between text-sm md:text-base">
              <span className="text-white/40 font-light">
                Peak: <span className="text-red-500 font-black">{playerData.peak_mmr} MMR</span>
              </span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Matches</div>
              <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{totalMatches}</div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Win Rate</div>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                {winRate}%
              </div>
              <div className="text-xs text-white/40 mt-1 font-light">{wins}W / {losses}L</div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">K/D Ratio</div>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter ${parseFloat(kd) >= 1.0 ? 'text-green-500' : 'text-red-500'}`}>
                {kd}
              </div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">MVP Count</div>
              <div className="text-3xl md:text-4xl font-black text-red-500 tracking-tighter">{mvpCount}</div>
            </div>
          </div>
        </div>
        
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-20">
          {/* Rank History */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Rank Journey</h2>
            {history.length > 0 ? (
              <div className="space-y-4 md:space-y-6">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:border-red-500/30 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white mb-2 tracking-tight">
                        {entry.old_rank} → {entry.new_rank}
                      </div>
                      <div className="text-sm text-white/40 font-light">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`text-lg md:text-xl font-black tracking-tighter ml-4 ${
                      entry.new_mmr > entry.old_mmr ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {entry.new_mmr > entry.old_mmr ? '+' : ''}{entry.new_mmr - entry.old_mmr} MMR
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                <p className="font-light">No rank history yet</p>
              </div>
            )}
          </div>
          
          {/* Activity Feed */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Recent Activity</h2>
            {activityFeed.length > 0 ? (
              <ActivityFeed activities={activityFeed} limit={10} />
            ) : (
              <div className="text-center py-12 text-white/40">
                <p className="font-light">No activity yet. Play some matches!</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Comments */}
        <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Comments</h2>
          <CommentSectionWrapper
            targetType="profile"
            targetId={playerData.id}
            comments={profileComments}
          />
        </div>
      </div>
    </div>
  )
}
