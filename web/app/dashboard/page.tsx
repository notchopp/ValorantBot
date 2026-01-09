import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { StatCard } from '@/components/StatCard'
import { ActivityFeed } from '@/components/ActivityFeed'
import { Player, ActivityFeed as ActivityFeedType, MatchPlayerStat } from '@/lib/types'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // For now, we'll use a mock user. In production, you'd get this from auth
  // const { data: { user } } = await supabase.auth.getUser()
  // if (!user) redirect('/auth/login')
  
  // Mock data for demonstration - in production, query by user's discord_user_id
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .order('current_mmr', { ascending: false })
    .limit(1)
    .single()
  
  const player = players as Player | null
  
  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white mb-4">No Player Data</h1>
          <p className="text-gray-400 mb-8">
            Link your Riot account to get started
          </p>
          <a
            href="/auth/login"
            className="px-6 py-3 bg-[#ffd700] text-black font-bold rounded-lg hover:bg-[#ccaa00] transition-colors inline-block"
          >
            Sign In
          </a>
        </div>
      </div>
    )
  }
  
  // Get player's match stats for season stats
  const { data: matchStats } = await supabase
    .from('match_player_stats')
    .select('*')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
  
  const stats = matchStats as MatchPlayerStat[] || []
  
  // Calculate season stats
  const wins = stats.filter(s => {
    // Need to check if their team won - this would require joining with matches table
    // For now, we'll use a simple heuristic: positive MMR change = win
    return s.mmr_after > s.mmr_before
  }).length
  
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  
  const netMMR = player.current_mmr - (player.discord_mmr || 0)
  
  // Get activity feed
  const { data: activities } = await supabase
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const activityFeed = activities as ActivityFeedType[] || []
  
  // Get leaderboard position
  const { count: position } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt('current_mmr', player.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-black text-white mb-2">
                {player.discord_username}
              </h1>
              <p className="text-gray-400">
                {player.riot_name && player.riot_tag 
                  ? `${player.riot_name}#${player.riot_tag}`
                  : 'No Riot account linked'
                }
              </p>
            </div>
            <div className="text-right">
              <RankBadge mmr={player.current_mmr} size="xl" />
              <p className="text-sm text-gray-500 mt-2">#{leaderboardPosition} on Leaderboard</p>
            </div>
          </div>
          
          {/* MMR Progress */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl mb-8">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">Current MMR</span>
                <span className="text-4xl font-black text-[#ffd700]">
                  {player.current_mmr}
                </span>
              </div>
            </div>
            <MMRProgressBar currentMMR={player.current_mmr} />
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Peak: <span className="text-[#ffd700] font-bold">{player.peak_mmr} MMR</span>
              </span>
              <span className={`font-bold ${netMMR >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {netMMR >= 0 ? '+' : ''}{netMMR} this season
              </span>
            </div>
          </div>
          
          {/* Season Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Matches Played"
              value={totalMatches}
              subtext="This season"
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              subtext={`${wins}W / ${losses}L`}
              trend={winRate >= 50 ? 'up' : 'down'}
            />
            <StatCard
              label="Net MMR"
              value={netMMR >= 0 ? `+${netMMR}` : netMMR}
              subtext="This season"
              trend={netMMR >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Peak Rank"
              value={player.peak_mmr}
              subtext="All time"
            />
          </div>
        </div>
        
        {/* Activity Feed */}
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
          <h2 className="text-2xl font-black text-white mb-6">Recent Activity</h2>
          <ActivityFeed activities={activityFeed} limit={5} />
        </div>
      </div>
    </div>
  )
}
