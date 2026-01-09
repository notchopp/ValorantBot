import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { ActivityFeed } from '@/components/ActivityFeed'
import { ActivityFeed as ActivityFeedType } from '@/lib/types'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface PlayerData {
  id: string
  discord_user_id: string
  discord_username: string | null
  riot_name: string | null
  riot_tag: string | null
  current_mmr: number
  peak_mmr: number
  discord_rank: string | null
}

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Get or create player data
  let { data: playerData } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', user.id)
    .single()
  
  // If no player exists, create one with defaults
  if (!playerData) {
    // Try to get username from auth metadata or user object
    const username = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Player'
    
    const { data: newPlayer } = await supabase
      .from('players')
      .insert({
        discord_user_id: user.id,
        discord_username: username,
        current_mmr: 0,
        peak_mmr: 0,
      })
      .select()
      .single()
    
    playerData = newPlayer
  }
  
  const player = playerData as PlayerData | null
  
  // Default values if no player
  const playerDefaults = {
    id: user.id,
    discord_user_id: user.id,
    discord_username: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Player',
    riot_name: null,
    riot_tag: null,
    current_mmr: 0,
    peak_mmr: 0,
    discord_rank: null,
  }
  
  const playerDataToUse = player || playerDefaults
  
  // Get player's match stats (only if player exists in DB)
  const { data: matchStats } = player ? await supabase
    .from('match_player_stats')
    .select('*, match:matches(*)')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    : { data: null }
  
  interface MatchStatWithMatch {
    team: 'A' | 'B'
    mmr_after: number
    mmr_before: number
    match?: { winner?: 'A' | 'B' }
  }
  
  const stats = (matchStats as MatchStatWithMatch[]) || []
  
  // Calculate season stats - defaults to 0
  const wins = stats.filter(s => {
    if (s.match) {
      return s.match.winner === s.team
    }
    return s.mmr_after > s.mmr_before
  }).length
  
  const totalMatches = stats.length
  const losses = totalMatches - wins
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0
  const recentMatches = stats.slice(0, 10)
  const netMMR = recentMatches.reduce((sum, s) => sum + (s.mmr_after - s.mmr_before), 0)
  
  // Get activity feed
  const { data: activities } = player ? await supabase
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', player.id)
    .order('created_at', { ascending: false })
    .limit(10)
    : { data: null }
  
  const activityFeed = (activities as ActivityFeedType[]) || []
  
  // Get leaderboard position
  const { count: position } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt('current_mmr', playerDataToUse.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  // Get current season
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .single()
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Live Header */}
        <div className="mb-8 md:mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter leading-none">
              {playerDataToUse.discord_username}
            </h1>
            <p className="text-sm md:text-base text-white/40 font-light">
              {playerDataToUse.riot_name && playerDataToUse.riot_tag 
                ? `${playerDataToUse.riot_name}#${playerDataToUse.riot_tag}`
                : 'Link Riot ID in Discord'
              }
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-1">Rank</div>
              <RankBadge mmr={playerDataToUse.current_mmr} size="lg" />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-1">Position</div>
              <div className="text-2xl md:text-3xl font-black text-yellow-500">#{leaderboardPosition}</div>
            </div>
          </div>
        </div>
        
        {/* MMR Card - Main Focus */}
        <div className="glass rounded-3xl p-8 md:p-12 border border-white/5 mb-8 md:mb-12 hover:border-yellow-500/20 transition-all group">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Current MMR</div>
              <div className="text-6xl md:text-8xl font-black text-yellow-500 tracking-tighter leading-none">
                {playerDataToUse.current_mmr}
              </div>
            </div>
            {netMMR !== 0 && (
              <div className={`text-2xl md:text-3xl font-black ${netMMR > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {netMMR > 0 ? '+' : ''}{netMMR}
              </div>
            )}
          </div>
          <MMRProgressBar currentMMR={playerDataToUse.current_mmr} />
          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="text-white/40">
              Peak: <span className="text-yellow-500 font-black">{playerDataToUse.peak_mmr}</span>
            </span>
            <span className="text-white/40">
              {playerDataToUse.current_mmr > 0 ? `${3000 - playerDataToUse.current_mmr} to X Rank` : 'Link Riot ID to start'}
            </span>
          </div>
        </div>
        
        {/* Competitive Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-yellow-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Matches</div>
            <div className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-1">{totalMatches}</div>
            <div className="text-xs text-white/40">{wins}W / {losses}L</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-yellow-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Win Rate</div>
            <div className={`text-4xl md:text-5xl font-black tracking-tighter mb-1 ${winRate >= 50 ? 'text-green-500' : winRate > 0 ? 'text-yellow-500' : 'text-white/40'}`}>
              {winRate}%
            </div>
            <div className="text-xs text-white/40">Last 10 matches</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-yellow-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Season MMR</div>
            <div className={`text-4xl md:text-5xl font-black tracking-tighter mb-1 ${netMMR >= 0 ? 'text-green-500' : netMMR < 0 ? 'text-red-500' : 'text-white/40'}`}>
              {netMMR >= 0 && netMMR > 0 ? '+' : ''}{netMMR}
            </div>
            <div className="text-xs text-white/40">Net change</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-yellow-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Leaderboard</div>
            <div className="text-4xl md:text-5xl font-black text-yellow-500 tracking-tighter mb-1">#{leaderboardPosition}</div>
            <div className="text-xs text-white/40">Global rank</div>
          </div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Season Progress */}
          {season && (
            <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Season</h2>
                <Link href="/season" className="text-xs text-white/40 hover:text-yellow-500 transition-colors">
                  View →
                </Link>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-white/40 mb-1">{season.name}</div>
                  <div className="text-2xl font-black text-white">{season.name}</div>
                </div>
                <div className="pt-4 border-t border-white/5">
                  <div className="text-xs text-white/40 mb-2">Season Stats</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-black text-yellow-500">{totalMatches}</div>
                      <div className="text-xs text-white/40 mt-1">Matches</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-white">{winRate}%</div>
                      <div className="text-xs text-white/40 mt-1">Win Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Activity Feed */}
          <div className={`glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all ${season ? 'lg:col-span-1' : 'lg:col-span-2'}`}>
            <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Recent Activity</h2>
            {activityFeed.length > 0 ? (
              <ActivityFeed activities={activityFeed} limit={8} />
            ) : (
              <div className="text-center py-12">
                <div className="text-white/20 text-sm font-light">No activity yet</div>
                <div className="text-white/10 text-xs mt-2">Play matches to see your journey</div>
              </div>
            )}
          </div>
          
          {/* Quick Navigation */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-yellow-500/20 transition-all">
            <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Navigation</h2>
            <div className="space-y-3">
              <Link
                href="/leaderboard"
                className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-1">Leaderboard</div>
                    <div className="text-xs text-white/40">Top players</div>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-yellow-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              {season && (
                <Link
                  href="/season"
                  className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-white mb-1">Season</div>
                      <div className="text-xs text-white/40">Current season</div>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-yellow-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )}
              <Link
                href={`/profile/${playerDataToUse.discord_user_id}`}
                className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-1">Profile</div>
                    <div className="text-xs text-white/40">Public profile</div>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-yellow-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
