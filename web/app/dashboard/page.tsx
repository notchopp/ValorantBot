import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { ActivityFeed } from '@/components/ActivityFeed'
import { Player, ActivityFeed as ActivityFeedType } from '@/lib/types'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check authentication - if not logged in, redirect to login
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Get player by discord_user_id from auth
  const { data: playerData } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', user.id)
    .single()
  
  const player = playerData as Player | null
  
  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="text-center max-w-md">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter">No Player Data</h1>
          <p className="text-lg md:text-xl text-white/60 font-light leading-relaxed mb-8">
            Link your Discord account to get started with GRNDS
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-8 py-4 bg-[#ffd700] text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-xl hover:bg-[#ffed4e] transition-all shadow-xl"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }
  
  // Get player's match stats
  const { data: matchStats } = await supabase
    .from('match_player_stats')
    .select('*, match:matches(*)')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
  
  interface MatchStatWithMatch {
    team: 'A' | 'B'
    mmr_after: number
    mmr_before: number
    match?: { winner?: 'A' | 'B' }
  }
  
  const stats = (matchStats as MatchStatWithMatch[]) || []
  
  // Calculate season stats
  const wins = stats.filter(s => {
    // Check if player's team won by joining with matches
    if (s.match) {
      return s.match.winner === s.team
    }
    // Fallback: positive MMR change = win
    return s.mmr_after > s.mmr_before
  }).length
  
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  
  // Get recent matches for net MMR calculation
  const recentMatches = stats.slice(0, 10)
  const netMMR = recentMatches.reduce((sum, s) => sum + (s.mmr_after - s.mmr_before), 0)
  
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
    <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10">
      <div className="max-w-[1400px] mx-auto">
        {/* Hero Section */}
        <div className="mb-12 md:mb-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8 mb-8 md:mb-12">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black text-white mb-2 md:mb-4 tracking-tighter leading-[0.9]">
                {player.discord_username}
              </h1>
              <p className="text-lg md:text-xl text-white/60 font-light">
                {player.riot_name && player.riot_tag 
                  ? `${player.riot_name}#${player.riot_tag}`
                  : 'No Riot account linked'
                }
              </p>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <RankBadge mmr={player.current_mmr} size="xl" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                #{leaderboardPosition} on Leaderboard
              </p>
            </div>
          </div>
          
          {/* MMR Display */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5 mb-8 md:mb-12">
            <div className="mb-6 md:mb-8">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Current MMR</span>
                <span className="text-5xl md:text-7xl font-black text-[#ffd700] tracking-tighter">
                  {player.current_mmr}
                </span>
              </div>
            </div>
            <MMRProgressBar currentMMR={player.current_mmr} />
            <div className="mt-6 flex items-center justify-between text-sm md:text-base">
              <span className="text-white/40 font-light">
                Peak: <span className="text-[#ffd700] font-bold">{player.peak_mmr} MMR</span>
              </span>
              {netMMR !== 0 && (
                <span className={`font-black ${netMMR > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {netMMR > 0 ? '+' : ''}{netMMR} MMR this season
                </span>
              )}
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Matches</div>
              <div className="text-3xl md:text-4xl font-black text-white tracking-tighter">{totalMatches}</div>
            </div>
            <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Win Rate</div>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                {winRate}%
              </div>
              <div className="text-xs text-white/40 mt-1">{wins}W / {losses}L</div>
            </div>
            <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Net MMR</div>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter ${netMMR >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {netMMR >= 0 ? '+' : ''}{netMMR}
              </div>
            </div>
            <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Rank</div>
              <div className="text-lg md:text-xl font-black text-white tracking-tighter">{player.discord_rank || 'Unranked'}</div>
            </div>
          </div>
        </div>
        
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
          {/* Activity Feed */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Recent Activity</h2>
            {activityFeed.length > 0 ? (
              <ActivityFeed activities={activityFeed} limit={10} />
            ) : (
              <div className="text-center py-12 text-white/40">
                <p className="font-light">No activity yet. Play some matches to see your progress!</p>
              </div>
            )}
          </div>
          
          {/* Quick Links */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Quick Links</h2>
            <div className="space-y-4">
              <Link
                href="/season"
                className="block p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#ffd700]/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-black text-white mb-1 uppercase tracking-tight">Season</div>
                    <div className="text-sm text-white/40 font-light">View current season stats</div>
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link
                href="/leaderboard"
                className="block p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#ffd700]/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-black text-white mb-1 uppercase tracking-tight">Leaderboard</div>
                    <div className="text-sm text-white/40 font-light">See where you rank globally</div>
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              <Link
                href={`/profile/${player.discord_user_id}`}
                className="block p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#ffd700]/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-black text-white mb-1 uppercase tracking-tight">Public Profile</div>
                    <div className="text-sm text-white/40 font-light">View your full profile</div>
                  </div>
                  <svg className="w-5 h-5 text-white/40 group-hover:text-[#ffd700] group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
