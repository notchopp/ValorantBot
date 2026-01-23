import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { RankBadge } from '@/components/RankBadge'
import { MMRProgressBar } from '@/components/MMRProgressBar'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { ProfileAccentColor } from '@/components/ProfileAccentColor'
import { Player, Comment } from '@/lib/types'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: { userId: string }
  searchParams?: { game?: string }
}) {
  // Use admin client for data fetching
  const supabaseAdmin = getSupabaseAdminClient()
  const supabase = await createClient()
  const { userId } = params
  
  // Get player by discord_user_id
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('discord_user_id', userId)
    .maybeSingle() as { data: (Player & { discord_avatar_url?: string | null }) | null }
  
  if (!player) {
    notFound()
  }
  
  const playerData = player as Player
  const selectedGame =
    searchParams?.game === 'marvel_rivals'
      ? 'marvel_rivals'
      : searchParams?.game === 'valorant'
        ? 'valorant'
        : (playerData.preferred_game || 'valorant')
  const gameLabel = selectedGame === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant'
  const leaderboardField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_mmr' : 'valorant_mmr'
  const currentMMR = selectedGame === 'marvel_rivals'
    ? (playerData.marvel_rivals_mmr ?? 0)
    : (playerData.valorant_mmr ?? playerData.current_mmr ?? 0)
  const peakMMR = selectedGame === 'marvel_rivals'
    ? (playerData.marvel_rivals_peak_mmr ?? 0)
    : (playerData.valorant_peak_mmr ?? playerData.peak_mmr ?? 0)
  const rankLabel = selectedGame === 'marvel_rivals'
    ? (playerData.marvel_rivals_rank ?? 'Unranked')
    : (playerData.valorant_rank ?? 'Unranked')
  
  // Check if current user is viewing their own profile
  const { data: { user } } = await supabase.auth.getUser()
  let isOwnProfile = false
  
  if (user) {
    // Check if this is the user's own profile by comparing player.id with auth.uid()
    if (playerData.id === user.id) {
      isOwnProfile = true
    }
  }
  
  // Get player's match stats
  let matchStatsQuery = supabaseAdmin
    .from('match_player_stats')
    .select('*, match:matches(*)')
    .eq('player_id', playerData.id)
    .order('created_at', { ascending: false })

  if (selectedGame === 'marvel_rivals') {
    matchStatsQuery = matchStatsQuery.eq('match.match_type', 'marvel_rivals')
  } else {
    matchStatsQuery = matchStatsQuery.in('match.match_type', ['custom', 'valorant'])
  }

  const { data: matchStats } = await matchStatsQuery
  
  interface MatchStatWithMatch {
    team: 'A' | 'B'
    kills: number
    deaths: number
    mvp: boolean
    mmr_after: number
    mmr_before: number
    created_at: string
    match?: { 
      winner?: 'A' | 'B'
      map?: string | null
      match_date?: string
      match_type?: 'custom' | 'valorant' | 'marvel_rivals'
    }
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
  
  
  // Get comments left on this profile by others
  const { data: profileCommentsData } = await supabaseAdmin
    .from('comments')
    .select('*, author:players(*)')
    .eq('target_type', 'profile')
    .eq('target_id', playerData.id)
    .order('created_at', { ascending: false })
    .limit(50)
  
  const profileComments = (profileCommentsData as Comment[]) || []
  
  // Get comments left BY this user on OTHER people's profiles
  interface UserComment {
    id: string
    content: string
    created_at: string
    target_player?: {
      discord_user_id?: string
      discord_username?: string | null
    }
  }
  
  const { data: userCommentsData } = await supabaseAdmin
    .from('comments')
    .select('id, content, created_at, target_id')
    .eq('author_id', playerData.id)
    .eq('target_type', 'profile')
    .neq('target_id', playerData.id)  // Exclude comments on own profile
    .order('created_at', { ascending: false })
    .limit(20)
  
  // Get target player info for each comment
  const userCommentsWithTargets = await Promise.all(
    ((userCommentsData as { id: string; content: string; created_at: string; target_id: string }[]) || []).map(async (comment) => {
      const { data: targetPlayer } = await supabaseAdmin
        .from('players')
        .select('discord_user_id, discord_username')
        .eq('id', comment.target_id)
        .maybeSingle() as { data: { discord_user_id: string; discord_username: string | null } | null }
      
      return {
        ...comment,
        target_player: targetPlayer || undefined
      } as UserComment
    })
  )
  
  const userComments = userCommentsWithTargets
  
  // Get leaderboard position
  const { count: position } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt(leaderboardField, currentMMR)
  
  const leaderboardPosition = (position || 0) + 1
  
  // Get user profile for display name, bio, and accent color
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name, bio, accent_color')
    .eq('discord_user_id', playerData.discord_user_id)
    .maybeSingle() as { data: { display_name: string | null; bio: string | null; accent_color?: string | null } | null }
  
  const displayName = userProfile?.display_name || playerData.discord_username || 'Player'
  const userBio = userProfile?.bio || null
  const profileAccentColor = userProfile?.accent_color || '#ef4444'
  
  return (
    <>
      <ProfileAccentColor accentColor={profileAccentColor} />
      <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10" style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}>
        <div className="max-w-[1400px] mx-auto">
        {/* Profile Header with Avatar */}
  <div className="mb-12 md:mb-20">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 md:gap-8 mb-8 md:mb-12">
      <div className="flex-1">
        <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">
          <span className="text-[var(--term-muted)]">&gt;</span> <span className="text-[var(--term-accent)]">PLAYER</span><span className="text-white/40">::</span><span className="text-white">PROFILE_VIEW</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link
            href={`/profile/${userId}?game=valorant`}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
              selectedGame === 'valorant'
                ? 'bg-[var(--term-accent)] text-black border-[var(--term-accent)]'
                : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
            }`}
          >
            Valorant
          </Link>
          <Link
            href={`/profile/${userId}?game=marvel_rivals`}
            className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
              selectedGame === 'marvel_rivals'
                ? 'bg-[var(--term-accent)] text-black border-[var(--term-accent)]'
                : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
            }`}
          >
            Marvel Rivals
          </Link>
          <span className="text-[10px] font-mono text-[var(--term-muted)] px-2">[{gameLabel.toUpperCase()}]</span>
        </div>
              <div className="flex items-center gap-4 md:gap-6 mb-4 md:mb-6">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {playerData.discord_avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={playerData.discord_avatar_url}
                      alt={displayName}
                      className="w-20 h-20 md:w-24 md:h-24 rounded-sm border-2 border-[var(--term-border)]"
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-sm bg-[var(--term-panel)] border-2 border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-2xl md:text-3xl font-mono font-black">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                
                {/* Name and Edit */}
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-mono font-black text-white tracking-tighter leading-[0.9]">
                      <span className="text-[var(--term-muted)]">[</span>{displayName}<span className="text-[var(--term-muted)]\">]</span>
                    </h1>
                    {isOwnProfile && (
                      <Link
                        href={`/profile/${userId}/edit`}
                        className="p-2 md:p-3 border border-[var(--term-border)] bg-[var(--term-panel)] hover:border-[var(--profile-accent-color)]/50 transition-all group"
                        style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}
                        title="Edit Profile"
                      >
                        <svg className="w-5 h-5 md:w-6 md:h-6 text-[var(--term-muted)] group-hover:text-[var(--profile-accent-color)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                    )}
                  </div>
                  {/* Valorant Info */}
                  <p className="text-lg md:text-xl text-white/60 font-light">
                    {playerData.riot_name && playerData.riot_tag 
                      ? `${playerData.riot_name}#${playerData.riot_tag}`
                      : 'No Riot account linked'
                    }
                  </p>
                </div>
              </div>
              
              {/* Bio */}
              {userBio && (
                <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
                  <p className="text-base md:text-lg text-white/80 font-light leading-relaxed">{userBio}</p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-start md:items-end gap-3">
              <RankBadge mmr={currentMMR} size="xl" rankLabel={rankLabel} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                Discord Rank: {playerData.discord_rank || 'Unranked'}
              </p>
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
                <span className="text-5xl md:text-7xl font-black tracking-tighter" style={{ color: profileAccentColor }}>
                  {currentMMR}
                </span>
              </div>
            </div>
            <MMRProgressBar currentMMR={currentMMR} accentColor={profileAccentColor} />
            <div className="mt-6 flex items-center justify-between text-sm md:text-base">
              <span className="text-white/40 font-light">
                Peak: <span className="font-black" style={{ color: profileAccentColor }}>{peakMMR} MMR</span>
              </span>
              <span className="text-white/40 font-light">
                {gameLabel} Rank: <span className="font-black">{rankLabel}</span>
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
              <div className={`text-3xl md:text-4xl font-black tracking-tighter`} style={{ color: winRate >= 50 ? '#22c55e' : profileAccentColor }}>
                {winRate}%
              </div>
              <div className="text-xs text-white/40 mt-1 font-light">{wins}W / {losses}L</div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">K/D Ratio</div>
              <div className={`text-3xl md:text-4xl font-black tracking-tighter`} style={{ color: parseFloat(kd) >= 1.0 ? '#22c55e' : profileAccentColor }}>
                {kd}
              </div>
            </div>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 border border-white/5 card-glow">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">MVP Count</div>
              <div className="text-3xl md:text-4xl font-black tracking-tighter" style={{ color: profileAccentColor }}>{mvpCount}</div>
            </div>
          </div>
        </div>
        
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-20">
          {/* Recent Games */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Recent Games</h2>
            {stats.length > 0 ? (
              <div className="space-y-3 md:space-y-4 max-h-[600px] overflow-y-auto">
                {stats.slice(0, 10).map((stat) => {
                  const isWin = stat.match && stat.team ? stat.match.winner === stat.team : stat.mmr_after > stat.mmr_before
                  const mmrChange = stat.mmr_after - stat.mmr_before
                  return (
                    <div
                      key={stat.match?.match_date || stat.created_at}
                      className="p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:border-[var(--profile-accent-color)]/30 transition-all"
                      style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-black" style={{ color: isWin ? '#22c55e' : profileAccentColor }}>
                          {isWin ? 'WIN' : 'LOSS'}
                        </div>
                        <div className="text-sm font-black" style={{ color: mmrChange >= 0 ? '#22c55e' : profileAccentColor }}>
                          {mmrChange >= 0 ? '+' : ''}{mmrChange} MMR
                        </div>
                      </div>
                      <div className="text-xs text-white/60 mb-1">
                        {stat.match?.map || 'Unknown Map'} • {stat.match?.match_date ? new Date(stat.match.match_date).toLocaleDateString() : 'Unknown Date'} • {(() => {
                          const type = stat.match?.match_type
                          if (type === 'marvel_rivals') return 'Marvel Rivals'
                          if (type === 'valorant') return 'Valorant'
                          if (type === 'custom') return 'Custom'
                          return 'Match'
                        })()}
                      </div>
                      <div className="text-xs text-white/40">
                        {stat.kills}/{stat.deaths} K/D {stat.mvp && <span className="font-black" style={{ color: profileAccentColor }}>MVP</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                <p className="font-light">No recent games yet</p>
              </div>
            )}
          </div>
          
          {/* Comments Left by User on Other Profiles */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Recent Comments</h2>
            {userComments.length > 0 ? (
              <div className="space-y-3 md:space-y-4 max-h-[600px] overflow-y-auto">
                {userComments.map((comment) => {
                  const targetPlayer = comment.target_player
                  return (
                    <Link
                      key={comment.id}
                      href={`/profile/${targetPlayer?.discord_user_id || ''}`}
                      className="block p-4 md:p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-[var(--profile-accent-color)]/30 transition-all group"
                      style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-white/40">
                          On <span className="text-white/60 font-medium group-hover:text-[var(--profile-accent-color)] transition-colors">{targetPlayer?.discord_username || 'Unknown'}&apos;s profile</span>
                        </div>
                        <span className="text-xs text-white/40">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 font-light leading-relaxed line-clamp-2">{comment.content}</p>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                <p className="font-light">No comments yet</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Valorant Info & Comments on This Profile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-20">
          <div className="space-y-6">
            <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Valorant Info</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Riot ID</div>
                  <div className="text-lg font-black text-white">
                    {playerData.riot_name && playerData.riot_tag 
                      ? `${playerData.riot_name}#${playerData.riot_tag}`
                      : 'Not linked'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Region</div>
                  <div className="text-lg font-black text-white">{playerData.riot_region || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Verified</div>
                  <div className="text-lg font-black text-white">{playerData.verified_at ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
            <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Marvel Rivals Info</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Username</div>
                  <div className="text-lg font-black text-white">
                    {playerData.marvel_rivals_username || 'Not linked'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">UID</div>
                  <div className="text-lg font-black text-white">
                    {playerData.marvel_rivals_uid || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-2">Verified</div>
                  <div className="text-lg font-black text-white">{playerData.marvel_rivals_rank ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Comments on This Profile */}
          <div className="glass rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-white/5">
            <h2 className="text-2xl md:text-3xl font-black text-white mb-6 md:mb-8 tracking-tighter uppercase">Comments on Profile</h2>
            <CommentSectionWrapper
              targetType="profile"
              targetId={playerData.id}
              comments={profileComments}
            />
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
