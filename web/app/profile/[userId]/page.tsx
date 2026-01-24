import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { Player, Comment } from '@/lib/types'
import { notFound } from 'next/navigation'
import { ProfileContent } from './ProfileContent'

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
    <ProfileContent
      userId={userId}
      playerData={{
        id: playerData.id,
        discord_user_id: playerData.discord_user_id,
        discord_username: playerData.discord_username,
        discord_avatar_url: playerData.discord_avatar_url,
        discord_rank: playerData.discord_rank,
        riot_name: playerData.riot_name,
        riot_tag: playerData.riot_tag,
        riot_region: playerData.riot_region,
        verified_at: playerData.verified_at,
        marvel_rivals_username: playerData.marvel_rivals_username,
        marvel_rivals_uid: playerData.marvel_rivals_uid,
        marvel_rivals_rank: playerData.marvel_rivals_rank,
      }}
      selectedGame={selectedGame}
      gameLabel={gameLabel}
      currentMMR={currentMMR}
      peakMMR={peakMMR}
      rankLabel={rankLabel}
      isOwnProfile={isOwnProfile}
      displayName={displayName}
      userBio={userBio}
      profileAccentColor={profileAccentColor}
      totalMatches={totalMatches}
      wins={wins}
      losses={losses}
      winRate={winRate}
      kd={kd}
      mvpCount={mvpCount}
      leaderboardPosition={leaderboardPosition}
      stats={stats}
      userComments={userComments}
      profileComments={profileComments}
    />
  )
}
