import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { StatCard } from '@/components/StatCard'
import { ActivityFeed } from '@/components/ActivityFeed'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Player, ActivityFeed as ActivityFeedType, Comment, MatchPlayerStat, RankHistory } from '@/lib/types'
import { notFound } from 'next/navigation'

export default async function ProfilePage({ params }: { params: { userId: string } }) {
  const supabase = await createClient()
  const { userId } = params
  
  // Get player by discord_user_id
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', userId)
    .single()
  
  if (!player) {
    notFound()
  }
  
  const playerData = player as Player
  
  // Get player's match stats
  const { data: matchStats } = await supabase
    .from('match_player_stats')
    .select('*')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
  
  const stats = matchStats as MatchPlayerStat[] || []
  
  // Calculate stats
  const wins = stats.filter(s => s.mmr_after > s.mmr_before).length
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  
  const totalKills = stats.reduce((sum, s) => sum + s.kills, 0)
  const totalDeaths = stats.reduce((sum, s) => sum + s.deaths, 0)
  const kd = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00'
  
  const mvpCount = stats.filter(s => s.mvp).length
  
  // Get activity feed
  const { data: activities } = await supabase
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  const activityFeed = activities as ActivityFeedType[] || []
  
  // Get rank history
  const { data: rankHistory } = await supabase
    .from('rank_history')
    .select('*')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const history = rankHistory as RankHistory[] || []
  
  // Get comments for profile
  const { data: comments } = await supabase
    .from('comments')
    .select('*, author:players(*)')
    .eq('target_type', 'profile')
    .eq('target_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(50)
  
  const profileComments = comments as Comment[] || []
  
  // Get leaderboard position
  const { count: position } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt('current_mmr', playerData.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Profile Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-black text-white mb-2">
                {playerData.discord_username}
              </h1>
              <p className="text-gray-400">
                {playerData.riot_name && playerData.riot_tag 
                  ? `${playerData.riot_name}#${playerData.riot_tag}`
                  : 'No Riot account linked'
                }
              </p>
            </div>
            <div className="text-right">
              <RankBadge mmr={playerData.current_mmr} size="xl" />
              <p className="text-sm text-gray-500 mt-2">#{leaderboardPosition} on Leaderboard</p>
            </div>
          </div>
          
          {/* MMR Progress */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl mb-8">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Current MMR</span>
                <span className="text-4xl font-black text-[#ffd700]">
                  {playerData.current_mmr}
                </span>
              </div>
            </div>
            <MMRProgressBar currentMMR={playerData.current_mmr} />
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Peak: <span className="text-[#ffd700] font-bold">{playerData.peak_mmr} MMR</span>
              </span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Matches"
              value={totalMatches}
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              subtext={`${wins}W / ${losses}L`}
              trend={winRate >= 50 ? 'up' : 'down'}
            />
            <StatCard
              label="K/D Ratio"
              value={kd}
              trend={parseFloat(kd) >= 1.0 ? 'up' : 'down'}
            />
            <StatCard
              label="MVP Count"
              value={mvpCount}
            />
          </div>
        </div>
        
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Rank History */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white mb-6">Rank Journey</h2>
            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-bold text-white mb-1">
                        {entry.old_rank} → {entry.new_rank}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`text-lg font-black ${
                      entry.new_mmr > entry.old_mmr ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {entry.new_mmr > entry.old_mmr ? '+' : ''}{entry.new_mmr - entry.old_mmr} MMR
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No rank history yet</p>
            )}
          </div>
          
          {/* Activity Feed */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <h2 className="text-2xl font-black text-white mb-6">Recent Activity</h2>
            <ActivityFeed activities={activityFeed} limit={5} />
          </div>
        </div>
        
        {/* Comments */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white mb-6">Comments</h2>
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
