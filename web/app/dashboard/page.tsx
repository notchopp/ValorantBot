import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { RankBadge } from '@/components/RankBadge'
import { TerminalMMRBar } from '@/components/TerminalMMRBar'
import { ActivityFeed as ActivityFeedType, calculateRankLabel } from '@/lib/types'
import { redirect } from 'next/navigation'
import Link from 'next/link'

interface PlayerData {
  id: string
  discord_user_id: string
  discord_username: string | null
  riot_name: string | null
  riot_tag: string | null
  marvel_rivals_uid: string | null
  marvel_rivals_username: string | null
  preferred_game: 'valorant' | 'marvel_rivals' | null
  valorant_rank: string | null
  valorant_mmr: number | null
  valorant_peak_mmr: number | null
  marvel_rivals_rank: string | null
  marvel_rivals_mmr: number | null
  marvel_rivals_peak_mmr: number | null
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { game?: string }
}) {
  const supabase = await createClient()
  
  // Check if user has an anonymous session
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }
  
  // Get player data for this user (anonymous session)
  const supabaseAdmin = getSupabaseAdminClient()
  interface PlayerCheckRow {
    id: string
    discord_username: string | null
    riot_name: string | null
    riot_tag: string | null
    current_mmr: number
    claimed: boolean
  }
  
  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('id, discord_username, riot_name, riot_tag, current_mmr, claimed')
    .eq('id', user.id)
    .maybeSingle() as { data: PlayerCheckRow | null; error: unknown }
  
  if (playerError) {
    console.error('Error checking player:', playerError)
  }
  
  // If no player found, not claimed, or player.id doesn't match user.id, redirect to login
  if (!player || !player.claimed || player.id !== user.id) {
    redirect('/auth/login')
  }
  
  console.log('Dashboard - Auth user ID:', user.id)
  
  // Query player directly by id (which is now the auth UID)
  const { data: playerData } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('id', user.id)
    .maybeSingle() as { data: PlayerData | null }
  
  if (!playerData) {
    redirect('/auth/login?step=claim')
  }
  
  // Get user's accent color (will fetch full profile later)
  const { data: accentColorProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('accent_color')
    .eq('discord_user_id', playerData.discord_user_id)
    .maybeSingle() as { data: { accent_color?: string | null } | null }
  
  const userAccentColor = accentColorProfile?.accent_color || '#ef4444'
  
  const selectedGame =
    searchParams?.game === 'marvel_rivals'
      ? 'marvel_rivals'
      : searchParams?.game === 'valorant'
        ? 'valorant'
        : (playerData.preferred_game || 'valorant')
  const gameLabel = selectedGame === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant'
  const currentMMR =
    selectedGame === 'marvel_rivals'
      ? (playerData.marvel_rivals_mmr ?? 0)
      : (playerData.valorant_mmr ?? playerData.current_mmr ?? 0)
  const peakMMR =
    selectedGame === 'marvel_rivals'
      ? (playerData.marvel_rivals_peak_mmr ?? 0)
      : (playerData.valorant_peak_mmr ?? playerData.peak_mmr ?? 0)

  const playerDataToUse: PlayerData = {
    id: playerData.id,
    discord_user_id: playerData.discord_user_id,
    discord_username: playerData.discord_username ?? 'Player',
    riot_name: playerData.riot_name ?? null,
    riot_tag: playerData.riot_tag ?? null,
    marvel_rivals_uid: playerData.marvel_rivals_uid ?? null,
    marvel_rivals_username: playerData.marvel_rivals_username ?? null,
    preferred_game: playerData.preferred_game ?? null,
    valorant_rank: playerData.valorant_rank ?? null,
    valorant_mmr: playerData.valorant_mmr ?? null,
    valorant_peak_mmr: playerData.valorant_peak_mmr ?? null,
    marvel_rivals_rank: playerData.marvel_rivals_rank ?? null,
    marvel_rivals_mmr: playerData.marvel_rivals_mmr ?? null,
    marvel_rivals_peak_mmr: playerData.marvel_rivals_peak_mmr ?? null,
    current_mmr: currentMMR as number,
    peak_mmr: peakMMR as number,
    discord_rank: playerData.discord_rank ?? 'Unranked',
  }
  
  // Get player's match stats and history (use admin client)
  let matchStatsQuery = supabaseAdmin
    .from('match_player_stats')
    .select('*, match:matches(match_date, map, winner, match_type)')
    .eq('player_id', playerDataToUse.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (selectedGame === 'marvel_rivals') {
    matchStatsQuery = matchStatsQuery.eq('match.match_type', 'marvel_rivals')
  } else {
    matchStatsQuery = matchStatsQuery.in('match.match_type', ['custom', 'valorant'])
  }

  const { data: matchStats } = await matchStatsQuery
  
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
        match_type?: 'custom' | 'valorant' | 'marvel_rivals'
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
  const leaderboardField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_mmr' : 'valorant_mmr'
  const { count: position } = await supabaseAdmin
    .from('players')
    .select('*', { count: 'exact', head: true })
    .gt(leaderboardField, playerDataToUse.current_mmr)
  
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
      userAccentColor={userAccentColor}
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
      selectedGame={selectedGame}
      gameLabel={gameLabel}
    />
  )
}

// Dashboard content – terminal-style UI
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
  userAccentColor,
  selectedGame,
  gameLabel,
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
  userAccentColor: string
  selectedGame: 'valorant' | 'marvel_rivals'
  gameLabel: string
}) {
  const displayName = userProfile?.display_name || playerDataToUse.discord_username || 'Player'
  const termAccent = userAccentColor || '#22c55e'

  return (
    <div
      className="terminal-dashboard min-h-screen py-6 md:py-10 px-4 md:px-6 lg:px-8 relative z-10 font-mono bg-[var(--term-bg)]"
      style={{ '--term-prompt': termAccent } as React.CSSProperties}
    >
      <div className="max-w-[1400px] mx-auto">
        {/* Header: GRNDS_TERMINAL — USER */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="terminal-prompt text-sm font-semibold">&gt; GRNDS_TERMINAL</span>
              <span className="text-[var(--term-muted)] text-xs">—</span>
              <span className="text-[var(--term-text)] text-sm">USER: {displayName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                href="/dashboard?game=valorant"
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                  selectedGame === 'valorant'
                    ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                    : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
                }`}
              >
                Valorant
              </Link>
              <Link
                href="/dashboard?game=marvel_rivals"
                className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                  selectedGame === 'marvel_rivals'
                    ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                    : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
                }`}
              >
                Marvel Rivals
              </Link>
              <span className="text-[var(--term-muted)] text-[10px] font-mono">[{gameLabel.toUpperCase()}]</span>
            </div>
            <p className="text-[10px] text-[var(--term-muted)]">
              {selectedGame === 'marvel_rivals'
                ? (playerDataToUse.marvel_rivals_username
                    ? `${playerDataToUse.marvel_rivals_username} · ${playerDataToUse.marvel_rivals_uid || 'UID pending'} · LINKED`
                    : 'LINK MARVEL RIVALS IN DISCORD')
                : (playerDataToUse.riot_name && playerDataToUse.riot_tag
                    ? `${playerDataToUse.riot_name}#${playerDataToUse.riot_tag} · LINKED`
                    : 'LINK RIOT ID IN DISCORD')}
            </p>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="text-right">
              <div className="text-[10px] text-[var(--term-muted)] mb-1 uppercase tracking-wider">RANK</div>
              <RankBadge mmr={playerDataToUse.current_mmr} size="lg" rankLabel={calculateRankLabel(playerDataToUse.current_mmr)} />
            </div>
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[var(--term-muted)] mb-1 uppercase tracking-wider">POS</div>
              <div className="text-xl font-bold" style={{ color: termAccent }}>#{leaderboardPosition}</div>
            </div>
          </div>
        </div>

        {/* MMR readout */}
        <div className="terminal-panel p-6 md:p-8 mb-6 md:mb-8">
          <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">&gt; MMR_READOUT</div>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl md:text-6xl font-bold tabular-nums" style={{ color: termAccent }}>
                {playerDataToUse.current_mmr}
              </span>
              {netMMR !== 0 && (
                <span
                  className="text-lg md:text-xl font-bold tabular-nums"
                  style={{ color: netMMR > 0 ? 'var(--term-green)' : 'var(--term-red)' }}
                >
                  {netMMR > 0 ? '+' : ''}{netMMR}
                </span>
              )}
            </div>
            <div className="text-[10px] text-[var(--term-muted)]">
              PEAK: <span style={{ color: termAccent }}>{playerDataToUse.peak_mmr}</span>
              {playerDataToUse.current_mmr > 0 && (
                <> · {3000 - playerDataToUse.current_mmr} TO X</>
              )}
            </div>
          </div>
          <TerminalMMRBar currentMMR={playerDataToUse.current_mmr} accentColor={termAccent} />
        </div>

        {/* Stats */}
        <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">&gt; STATS</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="terminal-panel p-4 md:p-5">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-1">MATCHES</div>
            <div className="text-2xl md:text-3xl font-bold text-[var(--term-text)] tabular-nums">{totalMatches}</div>
            <div className="text-[10px] text-[var(--term-muted)] mt-1">{wins}W / {losses}L</div>
          </div>
          <div className="terminal-panel p-4 md:p-5">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-1">WIN_RATE</div>
            <div
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{
                color: winRate >= 50 ? 'var(--term-green)' : winRate > 0 ? termAccent : 'var(--term-muted)'
              }}
            >
              {winRate}%
            </div>
            <div className="text-[10px] text-[var(--term-muted)] mt-1">LAST 10</div>
          </div>
          <div className="terminal-panel p-4 md:p-5">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-1">K/D</div>
            <div
              className="text-2xl md:text-3xl font-bold tabular-nums"
              style={{
                color: parseFloat(kdRatio) >= 1 ? 'var(--term-green)' : parseFloat(kdRatio) > 0 ? termAccent : 'var(--term-muted)'
              }}
            >
              {kdRatio}
            </div>
            <div className="text-[10px] text-[var(--term-muted)] mt-1">OVERALL</div>
          </div>
          <div className="terminal-panel p-4 md:p-5">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-1">MVP</div>
            <div className="text-2xl md:text-3xl font-bold tabular-nums" style={{ color: termAccent }}>{mvpCount}</div>
            <div className="text-[10px] text-[var(--term-muted)] mt-1">MATCH MVPS</div>
          </div>
        </div>

        {/* Match history, rank progression, activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="terminal-panel p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="terminal-prompt text-[10px] uppercase tracking-wider">&gt; MATCH_HISTORY</span>
              <span className="text-[10px] text-[var(--term-muted)]">{matchHistory.length} ENTRIES</span>
            </div>
            {matchHistory.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {matchHistory.slice(0, 10).map((match) => {
                  const isWin = match.winner === match.team
                  const mmrChange = match.mmr_after - match.mmr_before
                  return (
                    <div
                      key={match.id}
                      className="p-3 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/30 transition-colors"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold uppercase"
                          style={{ color: isWin ? 'var(--term-green)' : 'var(--term-red)' }}
                        >
                          [{isWin ? 'WIN' : 'LOSS'}]
                        </span>
                        <span
                          className="text-[10px] font-bold tabular-nums"
                          style={{ color: mmrChange >= 0 ? 'var(--term-green)' : 'var(--term-red)' }}
                        >
                          {mmrChange >= 0 ? '+' : ''}{mmrChange}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--term-text)]">{match.map || 'UNKNOWN'}</div>
                      <div className="text-[10px] text-[var(--term-muted)]">
                        {match.kills}/{match.deaths}/{match.assists}
                        {match.mvp && <span className="ml-1" style={{ color: termAccent }}>MVP</span>}
                      </div>
                      <div className="text-[9px] text-[var(--term-muted)] mt-0.5">
                        {new Date(match.match_date).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-[var(--term-muted)] text-sm">
                NO MATCHES · PLAY TO POPULATE
              </div>
            )}
          </div>

          <div className="terminal-panel p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="terminal-prompt text-[10px] uppercase tracking-wider">&gt; RANK_PROGRESSION</span>
              <span className="text-[10px] text-[var(--term-muted)]">{rankProgression.length} CHANGES</span>
            </div>
            {rankProgression.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {rankProgression.slice(0, 10).map((entry) => {
                  const mmrChange = entry.new_mmr - entry.old_mmr
                  return (
                    <div
                      key={entry.id}
                      className="p-3 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/30 transition-colors"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold text-[var(--term-text)]">
                          {entry.old_rank || 'UNRANKED'} → {entry.new_rank}
                        </span>
                        <span
                          className="text-[10px] font-bold tabular-nums"
                          style={{ color: mmrChange >= 0 ? 'var(--term-green)' : 'var(--term-red)' }}
                        >
                          {mmrChange >= 0 ? '+' : ''}{mmrChange}
                        </span>
                      </div>
                      <div className="text-[9px] text-[var(--term-muted)]">
                        {new Date(entry.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-[var(--term-muted)] text-sm">
                NO RANK CHANGES · RANK UP TO RECORD
              </div>
            )}
          </div>

          <div className="terminal-panel p-4 md:p-6">
            <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">&gt; ACTIVITY</div>
            {activityFeed.length > 0 ? (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {activityFeed.slice(0, 8).map((a) => {
                  const tag = a.activity_type === 'rank_up' ? 'RANK_UP' : a.activity_type === 'rank_down' ? 'RANK_DOWN' : a.activity_type === 'mvp' ? 'MVP' : a.activity_type === 'big_mmr_gain' ? 'MMR_GAIN' : a.activity_type === 'big_mmr_loss' ? 'MMR_LOSS' : 'EVENT'
                  const color = a.activity_type === 'rank_up' || a.activity_type === 'big_mmr_gain' ? 'var(--term-green)' : a.activity_type === 'rank_down' || a.activity_type === 'big_mmr_loss' ? 'var(--term-red)' : 'var(--term-amber)'
                  return (
                    <div
                      key={a.id}
                      className="p-3 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/30 transition-colors"
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase" style={{ color }}>[{tag}]</span>
                        <span className="text-[9px] text-[var(--term-muted)] whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] font-semibold text-[var(--term-text)]">{a.title}</div>
                      {a.description && (
                        <div className="text-[10px] text-[var(--term-muted)] mt-0.5">{a.description}</div>
                      )}
                      {a.metadata && (a.metadata as { mmr_change?: number }).mmr_change != null && (
                        <div className="text-[10px] mt-1" style={{ color: 'var(--term-green)' }}>
                          +{(a.metadata as { mmr_change: number }).mmr_change} MMR
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-[var(--term-muted)] text-sm">
                NO ACTIVITY · PLAY TO POPULATE
              </div>
            )}
          </div>
        </div>

        {/* Season + Nav */}
        <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">&gt; NAV</div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {season && (
            <div className="terminal-panel p-4 md:p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-[var(--term-muted)] uppercase">SEASON</span>
                <Link href="/season" className="text-[10px] hover:underline" style={{ color: termAccent }}>
                  VIEW →
                </Link>
              </div>
              <div className="text-lg font-bold text-[var(--term-text)] mb-3">{season.name}</div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[var(--term-border)]">
                <div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: termAccent }}>{totalMatches}</div>
                  <div className="text-[10px] text-[var(--term-muted)]">MATCHES</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-[var(--term-text)] tabular-nums">{winRate}%</div>
                  <div className="text-[10px] text-[var(--term-muted)]">WIN RATE</div>
                </div>
              </div>
            </div>
          )}
          <div className={season ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="terminal-panel p-4 md:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Link
                  href="/leaderboard"
                  className="flex items-center justify-between p-4 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/50 transition-colors group"
                >
                  <div>
                    <div className="text-sm font-bold text-[var(--term-text)]">LEADERBOARD</div>
                    <div className="text-[10px] text-[var(--term-muted)]">TOP PLAYERS</div>
                  </div>
                  <span className="text-[var(--term-muted)] group-hover:text-[var(--term-green)] transition-colors">→</span>
                </Link>
                {season && (
                  <Link
                    href="/season"
                    className="flex items-center justify-between p-4 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/50 transition-colors group"
                  >
                    <div>
                      <div className="text-sm font-bold text-[var(--term-text)]">SEASON</div>
                      <div className="text-[10px] text-[var(--term-muted)]">CURRENT</div>
                    </div>
                    <span className="text-[var(--term-muted)] group-hover:text-[var(--term-green)] transition-colors">→</span>
                  </Link>
                )}
                <Link
                  href={`/profile/${playerDataToUse.discord_user_id}`}
                  className="flex items-center justify-between p-4 border border-[var(--term-border)] bg-[var(--term-bg)] hover:border-[var(--term-green)]/50 transition-colors group"
                >
                  <div>
                    <div className="text-sm font-bold text-[var(--term-text)]">PROFILE</div>
                    <div className="text-[10px] text-[var(--term-muted)]">VIEW PROFILE</div>
                  </div>
                  <span className="text-[var(--term-muted)] group-hover:text-[var(--term-green)] transition-colors">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
