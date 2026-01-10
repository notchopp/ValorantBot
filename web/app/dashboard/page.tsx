import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
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

interface MatchHistoryEntry {
  id: string
  match_date: string
  map: string | null
  winner: 'A' | 'B' | null
  team: 'A' | 'B'
  kills: number
  deaths: number
  assists: number
  mvp: boolean
  mmr_before: number
  mmr_after: number
}

interface RankProgressionEntry {
  id: string
  old_rank: string | null
  new_rank: string
  old_mmr: number
  new_mmr: number
  reason: string
  created_at: string
}

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Use admin client for data fetching (bypasses RLS)
  const supabaseAdmin = getSupabaseAdminClient()
  
  // Step 1: Check users table for auth_id -> discord_user_id mapping (use admin client)
  let { data: userRecord } = await supabaseAdmin
    .from('users')
    .select('discord_user_id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { discord_user_id: string } | null }
  
  // If no user record exists, try to auto-link from OAuth metadata
  if (!userRecord) {
    const identities = user.identities || []
    interface Identity {
      provider: string
      identity_data?: {
        id?: string
        preferred_username?: string
        username?: string
      }
      user_id?: string
    }
    const discordIdentity = identities.find((id: Identity) => id.provider === 'discord') as Identity | undefined
    const discordUserIdFromAuth = discordIdentity?.identity_data?.id || 
                                  discordIdentity?.user_id ||
                                  user.user_metadata?.provider_user_id ||
                                  user.user_metadata?.provider_id || 
                                  user.user_metadata?.sub || 
                                  user.user_metadata?.discord_id ||
                                  null
    
    if (discordUserIdFromAuth) {
      // Check if player exists with this Discord ID
      const { data: existingPlayer } = await supabaseAdmin
        .from('players')
        .select('discord_user_id')
        .eq('discord_user_id', discordUserIdFromAuth)
        .maybeSingle() as { data: { discord_user_id: string } | null }
      
      // If player exists, create/update users table entry using admin client
      if (existingPlayer) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newUserRecord } = await (supabaseAdmin.from('users') as any)
          .upsert({
            auth_id: user.id,
            discord_user_id: discordUserIdFromAuth,
            email: user.email || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'auth_id'
          })
          .select('discord_user_id')
          .single()
        
        if (newUserRecord) {
          userRecord = newUserRecord as { discord_user_id: string }
        }
      }
    }
  }
  
  // If still no user record exists, show link message
  if (!userRecord || !userRecord.discord_user_id) {
    const discordUsername = user.user_metadata?.preferred_username || 
                            user.user_metadata?.global_name ||
                            user.user_metadata?.full_name || 
                            user.user_metadata?.name || 
                            user.user_metadata?.username ||
                            user.email?.split('@')[0] || 
                            'Player'
    
    const playerDataToUse: PlayerData = {
      id: user.id,
      discord_user_id: user.id,
      discord_username: discordUsername,
      riot_name: null,
      riot_tag: null,
      current_mmr: 0,
      peak_mmr: 0,
      discord_rank: 'GRNDS I',
    }
    
    return (
      <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
        <div className="max-w-[1600px] mx-auto">
          <div className="glass rounded-2xl p-8 border border-red-500/30 mb-8 bg-red-500/5">
            <h2 className="text-xl font-black text-white mb-4 uppercase tracking-tight">Link Your Discord Account</h2>
            <p className="text-white/60 mb-4">
              To view your stats, you need to link your Discord account. You&apos;ve signed in with Discord, but you need to:
            </p>
            <div className="space-y-2 text-sm text-white/40 font-mono">
              <div>1. Join the Discord server</div>
              <div>2. Run <code className="bg-black/50 px-2 py-1 rounded text-red-500">/riot link</code> and <code className="bg-black/50 px-2 py-1 rounded text-red-500">/verify</code> in Discord</div>
              <div>3. Refresh this page to see your stats</div>
            </div>
          </div>
          
          <DashboardContent 
            playerDataToUse={playerDataToUse}
            totalMatches={0}
            wins={0}
            losses={0}
            winRate={0}
            netMMR={0}
            leaderboardPosition={0}
            activityFeed={[]}
            season={null}
            matchHistory={[]}
            rankProgression={[]}
            userProfile={null}
            kdRatio="0.00"
            mvpCount={0}
          />
        </div>
      </div>
    )
  }
  
  // Step 2: Get player data using discord_user_id from users table (use admin client)
  const { data: playerData } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('discord_user_id', userRecord.discord_user_id)
    .maybeSingle() as { data: PlayerData | null }
  
  if (!playerData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <div className="text-center max-w-md glass rounded-2xl p-8 border border-white/5">
          <h1 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Player Not Found</h1>
          <p className="text-base text-white/60 font-light">
            Your Discord account is linked, but no player data was found. Make sure you&apos;ve used <code className="bg-black/50 px-2 py-1 rounded text-red-500">/verify</code> in Discord.
          </p>
        </div>
      </div>
    )
  }
  
  const playerDataToUse: PlayerData = {
    id: playerData.id,
    discord_user_id: playerData.discord_user_id,
    discord_username: playerData.discord_username ?? 'Player',
    riot_name: playerData.riot_name ?? null,
    riot_tag: playerData.riot_tag ?? null,
    current_mmr: (playerData.current_mmr ?? 0) as number,
    peak_mmr: (playerData.peak_mmr ?? 0) as number,
    discord_rank: playerData.discord_rank ?? 'GRNDS I',
  }
  
  // Get player's match stats and history (use admin client)
  const { data: matchStats } = await supabaseAdmin
    .from('match_player_stats')
    .select('*, match:matches(match_date, map, winner)')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(20)
  
  interface MatchStatWithMatch {
    id: string
    team: 'A' | 'B'
    kills: number
    deaths: number
    assists: number
    mvp: boolean
    mmr_after: number
    mmr_before: number
    created_at: string
    match?: {
      match_date: string
      map: string | null
      winner?: 'A' | 'B'
    }
  }
  
  const stats = (matchStats as MatchStatWithMatch[]) || []
  
  // Build match history
  const matchHistory: MatchHistoryEntry[] = stats.map((stat) => ({
    id: stat.id,
    match_date: stat.match?.match_date || stat.created_at,
    map: stat.match?.map || null,
    winner: stat.match?.winner || null,
    team: stat.team,
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    mvp: stat.mvp,
    mmr_before: stat.mmr_before,
    mmr_after: stat.mmr_after,
  }))
  
  // Calculate season stats
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
  
  // Calculate K/D ratio
  const totalKills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
  const totalDeaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
  const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : '0.00'
  
  // Calculate MVP count
  const mvpCount = stats.filter(s => s.mvp).length
  
  // Get rank progression (rank_history) - use admin client
  const { data: rankHistory } = await supabaseAdmin
    .from('rank_history')
    .select('*')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(15)
  
  const rankProgression: RankProgressionEntry[] = (rankHistory as RankProgressionEntry[]) || []
  
  // Get activity feed - use admin client
  const { data: activities } = await supabaseAdmin
    .from('activity_feed')
    .select('*, player:players(*)')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(10)
  
  const activityFeed = (activities as ActivityFeedType[]) || []
  
  // Get leaderboard position - use admin client
  const { count: position } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt('current_mmr', playerDataToUse.current_mmr)
  
  const leaderboardPosition = (position || 0) + 1
  
  // Get current season - use admin client
  const { data: season } = await supabaseAdmin
    .from('seasons')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  
  // Get user profile for customization - use admin client
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('discord_user_id', playerDataToUse.discord_user_id)
    .maybeSingle() as { data: { display_name?: string | null; bio?: string | null } | null }
  
  return (
    <DashboardContent 
      playerDataToUse={playerDataToUse}
      totalMatches={totalMatches}
      wins={wins}
      losses={losses}
      winRate={winRate}
      netMMR={netMMR}
      leaderboardPosition={leaderboardPosition}
      activityFeed={activityFeed}
      season={season}
      matchHistory={matchHistory}
      rankProgression={rankProgression}
      userProfile={userProfile}
      kdRatio={kdRatio}
      mvpCount={mvpCount}
    />
  )
}

// Dashboard content component
function DashboardContent({
  playerDataToUse,
  totalMatches,
  wins,
  losses,
  winRate,
  netMMR,
  leaderboardPosition,
  activityFeed,
  season,
  matchHistory,
  rankProgression,
  userProfile,
  kdRatio,
  mvpCount,
}: {
  playerDataToUse: PlayerData
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  netMMR: number
  leaderboardPosition: number
  activityFeed: ActivityFeedType[]
  season: { id: string; name: string } | null
  matchHistory: MatchHistoryEntry[]
  rankProgression: RankProgressionEntry[]
  userProfile?: { display_name?: string | null; bio?: string | null } | null
  kdRatio: string
  mvpCount: number
}) {
  const displayName = userProfile?.display_name || playerDataToUse.discord_username || 'Player'
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Live Header */}
        <div className="mb-8 md:mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter leading-none">
              {displayName}
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
              <div className="text-2xl md:text-3xl font-black text-red-500">#{leaderboardPosition}</div>
            </div>
          </div>
        </div>
        
        {/* MMR Card - Main Focus */}
        <div className="glass rounded-3xl p-8 md:p-12 border border-white/5 mb-8 md:mb-12 hover:border-red-500/20 transition-all group">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Current MMR</div>
              <div className="text-6xl md:text-8xl font-black text-red-500 tracking-tighter leading-none">
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
              Peak: <span className="text-red-500 font-black">{playerDataToUse.peak_mmr}</span>
            </span>
            <span className="text-white/40">
              {playerDataToUse.current_mmr > 0 ? `${3000 - playerDataToUse.current_mmr} to X Rank` : 'Link Riot ID to start'}
            </span>
          </div>
        </div>
        
        {/* Competitive Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-red-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Matches</div>
            <div className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-1">{totalMatches}</div>
            <div className="text-xs text-white/40">{wins}W / {losses}L</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-red-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">Win Rate</div>
            <div className={`text-4xl md:text-5xl font-black tracking-tighter mb-1 ${winRate >= 50 ? 'text-green-500' : winRate > 0 ? 'text-red-500' : 'text-white/40'}`}>
              {winRate}%
            </div>
            <div className="text-xs text-white/40">Last 10 matches</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-red-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">K/D Ratio</div>
            <div className={`text-4xl md:text-5xl font-black tracking-tighter mb-1 ${parseFloat(kdRatio) >= 1.0 ? 'text-green-500' : parseFloat(kdRatio) > 0 ? 'text-red-500' : 'text-white/40'}`}>
              {kdRatio}
            </div>
            <div className="text-xs text-white/40">Overall stats</div>
          </div>
          
          <div className="glass rounded-2xl p-6 border border-white/5 hover:border-red-500/30 transition-all group">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-3">MVP Count</div>
            <div className="text-4xl md:text-5xl font-black text-red-500 tracking-tighter mb-1">{mvpCount}</div>
            <div className="text-xs text-white/40">Match MVPs</div>
          </div>
        </div>
        
        {/* Main Content Grid - Match History, Rank Progression, Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Match History */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Match History</h2>
              <div className="text-xs text-white/40">{matchHistory.length} matches</div>
            </div>
            {matchHistory.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {matchHistory.slice(0, 10).map((match) => {
                  const isWin = match.winner === match.team
                  const mmrChange = match.mmr_after - match.mmr_before
                  return (
                    <div
                      key={match.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`text-xs font-black ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                          {isWin ? 'WIN' : 'LOSS'}
                        </div>
                        <div className={`text-xs font-black ${mmrChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {mmrChange >= 0 ? '+' : ''}{mmrChange} MMR
                        </div>
                      </div>
                      <div className="text-xs text-white/60 mb-1">
                        {match.map || 'Unknown Map'}
                      </div>
                      <div className="text-xs text-white/40">
                        {match.kills}/{match.deaths}/{match.assists} {match.mvp && <span className="text-red-500">MVP</span>}
                      </div>
                      <div className="text-xs text-white/30 mt-1">
                        {new Date(match.match_date).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-white/20 text-sm font-light">No matches yet</div>
                <div className="text-white/10 text-xs mt-2">Play matches to see history</div>
              </div>
            )}
          </div>
          
          {/* Rank Progression */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Rank Progression</h2>
              <div className="text-xs text-white/40">{rankProgression.length} changes</div>
            </div>
            {rankProgression.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {rankProgression.slice(0, 10).map((entry) => {
                  const mmrChange = entry.new_mmr - entry.old_mmr
                  return (
                    <div
                      key={entry.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-black text-white">
                          {entry.old_rank || 'Unranked'} → {entry.new_rank}
                        </div>
                        <div className={`text-xs font-black ${mmrChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {mmrChange >= 0 ? '+' : ''}{mmrChange} MMR
                        </div>
                      </div>
                      <div className="text-xs text-white/40">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-white/20 text-sm font-light">No rank changes yet</div>
                <div className="text-white/10 text-xs mt-2">Rank up to see progression</div>
              </div>
            )}
          </div>
          
          {/* Activity Feed */}
          <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
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
        </div>
        
        {/* Bottom Row - Season & Navigation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Season Progress */}
          {season && (
            <div className="lg:col-span-1 glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-black text-white uppercase tracking-tight">Season</h2>
                <Link href="/season" className="text-xs text-white/40 hover:text-red-500 transition-colors">
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
                      <div className="text-2xl font-black text-red-500">{totalMatches}</div>
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
          
          {/* Quick Navigation */}
          <div className={`glass rounded-2xl p-6 md:p-8 border border-white/5 hover:border-red-500/20 transition-all ${season ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <h2 className="text-lg font-black text-white uppercase tracking-tight mb-6">Navigation</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link
                href="/leaderboard"
                className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-red-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-1">Leaderboard</div>
                    <div className="text-xs text-white/40">Top players</div>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              {season && (
                <Link
                  href="/season"
                  className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-red-500/30 hover:bg-white/[0.04] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-black text-white mb-1">Season</div>
                      <div className="text-xs text-white/40">Current season</div>
                    </div>
                    <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              )}
              <Link
                href={`/profile/${playerDataToUse.discord_user_id}`}
                className="block p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-red-500/30 hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-white mb-1">Profile</div>
                    <div className="text-xs text-white/40">View your profile</div>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
