'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { TerminalMMRBar } from '@/components/TerminalMMRBar'
import { ActivityFeed as ActivityFeedType, calculateRankLabel } from '@/lib/types'
import Link from 'next/link'
import { useAccentColor } from '@/lib/AccentColorContext'

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

// ASCII box drawing
function AsciiBox({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  const { accentColor } = useAccentColor()
  return (
    <div className={`font-mono text-[11px] ${className}`}>
      {title && (
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color: accentColor }}>[</span>
          <span className="text-white/70 uppercase tracking-wider">{title}</span>
          <span style={{ color: accentColor }}>]</span>
          <div className="flex-1 border-b border-white/10" />
        </div>
      )}
      <div className="bg-black/30 border border-white/10 rounded p-3">
        {children}
      </div>
    </div>
  )
}

// Stat display component
function StatBlock({ label, value, subtext, positive, highlight }: { 
  label: string; 
  value: string | number; 
  subtext?: string;
  positive?: boolean;
  highlight?: boolean;
}) {
  const { accentColor } = useAccentColor()
  return (
    <div className="font-mono">
      <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">{label}</div>
      <div 
        className="text-xl font-bold tabular-nums"
        style={{ 
          color: highlight ? accentColor : positive === true ? '#22c55e' : positive === false ? '#ef4444' : '#e5e7eb'
        }}
      >
        {value}
      </div>
      {subtext && <div className="text-[9px] text-white/30 mt-0.5">{subtext}</div>}
    </div>
  )
}

// Match entry component
function MatchEntry({ match, accentColor }: { match: MatchHistoryEntry; accentColor: string }) {
  const isWin = match.winner === match.team
  const mmrChange = match.mmr_after - match.mmr_before
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0 font-mono text-[10px]"
    >
      <span 
        className="w-8 font-bold"
        style={{ color: isWin ? '#22c55e' : '#ef4444' }}
      >
        {isWin ? 'WIN' : 'LOSS'}
      </span>
      <span className="text-white/40 w-20 truncate">{match.map || 'UNKNOWN'}</span>
      <span className="text-white/30 w-16">{match.kills}/{match.deaths}/{match.assists}</span>
      {match.mvp && <span style={{ color: accentColor }}>[MVP]</span>}
      <span className="flex-1" />
      <span 
        className="font-bold tabular-nums"
        style={{ color: mmrChange >= 0 ? '#22c55e' : '#ef4444' }}
      >
        {mmrChange >= 0 ? '+' : ''}{mmrChange}
      </span>
    </motion.div>
  )
}

// Activity entry component
function ActivityEntry({ activity, accentColor }: { activity: ActivityFeedType; accentColor: string }) {
  const typeColors: Record<string, string> = {
    rank_up: '#22c55e',
    rank_down: '#ef4444',
    mvp: accentColor,
    big_mmr_gain: '#22c55e',
    big_mmr_loss: '#ef4444',
  }
  const color = typeColors[activity.activity_type] || '#eab308'
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className="py-2 border-b border-white/5 last:border-0 font-mono text-[10px]"
    >
      <div className="flex items-center gap-2">
        <span className="font-bold uppercase" style={{ color }}>[{activity.activity_type.replace(/_/g, ' ')}]</span>
        <span className="text-white/30 text-[9px]">
          {new Date(activity.created_at).toLocaleDateString()}
        </span>
      </div>
      <div className="text-white/60 mt-0.5">{activity.title}</div>
    </motion.div>
  )
}

export function DashboardContent({
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
  const displayName = userProfile?.display_name || playerDataToUse.discord_username || 'UNKNOWN'
  const { accentColor } = useAccentColor()
  const termAccent = accentColor || userAccentColor || '#22c55e'

  return (
    <div className="min-h-full p-4 md:p-6 font-mono">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* Command line header */}
        <div className="flex items-center gap-2 text-[10px] text-white/30 mb-3">
          <span className="text-green-500">$</span>
          <span>cat /root/user.profile</span>
        </div>
        
        {/* User info block */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span style={{ color: termAccent }} className="text-lg font-bold">@{displayName}</span>
              <span className="text-white/20">|</span>
              <span className="text-[10px] text-white/40">ID:{playerDataToUse.discord_user_id.slice(-8)}</span>
            </div>
            
            {/* Game toggle */}
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/dashboard?game=valorant"
                className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all ${
                  selectedGame === 'valorant'
                    ? 'border-white/30 text-white bg-white/10'
                    : 'border-white/10 text-white/30 hover:text-white/60'
                }`}
              >
                VAL
              </Link>
              <Link
                href="/dashboard?game=marvel_rivals"
                className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all ${
                  selectedGame === 'marvel_rivals'
                    ? 'border-white/30 text-white bg-white/10'
                    : 'border-white/10 text-white/30 hover:text-white/60'
                }`}
              >
                MR
              </Link>
              <span className="text-[9px] text-white/20">[{gameLabel.toUpperCase()}]</span>
            </div>
            
            {/* Account link status */}
            <div className="text-[9px] text-white/30 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span>
                {selectedGame === 'marvel_rivals'
                  ? (playerDataToUse.marvel_rivals_username || 'NOT_LINKED')
                  : (playerDataToUse.riot_name ? `${playerDataToUse.riot_name}#${playerDataToUse.riot_tag}` : 'NOT_LINKED')}
              </span>
            </div>
          </div>
          
          {/* Rank display */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[9px] text-white/30 mb-1">RANK</div>
              <RankBadge mmr={playerDataToUse.current_mmr} size="lg" rankLabel={calculateRankLabel(playerDataToUse.current_mmr)} />
            </div>
            <div className="text-right">
              <div className="text-[9px] text-white/30 mb-1">POS</div>
              <div className="text-2xl font-bold" style={{ color: termAccent }}>#{leaderboardPosition}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* MMR Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <AsciiBox title="MMR_READOUT">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl md:text-5xl font-bold tabular-nums" style={{ color: termAccent }}>
                {playerDataToUse.current_mmr}
              </span>
              {netMMR !== 0 && (
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: netMMR > 0 ? '#22c55e' : '#ef4444' }}
                >
                  {netMMR > 0 ? '+' : ''}{netMMR}
                </span>
              )}
            </div>
            <div className="text-[10px] text-white/30 font-mono">
              PEAK: <span style={{ color: termAccent }}>{playerDataToUse.peak_mmr}</span>
              {playerDataToUse.current_mmr > 0 && (
                <span> | {3000 - playerDataToUse.current_mmr} TO_X</span>
              )}
            </div>
          </div>
          <TerminalMMRBar currentMMR={playerDataToUse.current_mmr} accentColor={termAccent} />
        </AsciiBox>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-[10px] text-white/30 mb-2">
          <span className="text-green-500">$</span>
          <span>./stats --summary</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <StatBlock label="MATCHES" value={totalMatches} subtext={`${wins}W / ${losses}L`} />
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <StatBlock 
              label="WIN_RATE" 
              value={`${winRate}%`} 
              subtext="LAST_10" 
              positive={winRate >= 50}
            />
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <StatBlock 
              label="K/D_RATIO" 
              value={kdRatio} 
              subtext="OVERALL" 
              positive={parseFloat(kdRatio) >= 1}
            />
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <StatBlock label="MVP_COUNT" value={mvpCount} subtext="TOTAL" highlight />
          </div>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Match History */}
        <AsciiBox title="MATCH_LOG" className="lg:col-span-1">
          <div className="max-h-[350px] overflow-y-auto">
            {matchHistory.length > 0 ? (
              matchHistory.slice(0, 10).map((match) => (
                <MatchEntry key={match.id} match={match} accentColor={termAccent} />
              ))
            ) : (
              <div className="text-white/30 text-center py-8">
                NO_DATA
                <br />
                <span className="text-[9px]">Play matches to populate</span>
              </div>
            )}
          </div>
        </AsciiBox>

        {/* Rank Progression */}
        <AsciiBox title="RANK_HISTORY" className="lg:col-span-1">
          <div className="max-h-[350px] overflow-y-auto">
            {rankProgression.length > 0 ? (
              rankProgression.slice(0, 8).map((entry) => {
                const mmrChange = entry.new_mmr - entry.old_mmr
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="py-2 border-b border-white/5 last:border-0 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">
                        {entry.old_rank || 'UNRANKED'} <span className="text-white/20">-&gt;</span> {entry.new_rank}
                      </span>
                      <span
                        className="font-bold tabular-nums"
                        style={{ color: mmrChange >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {mmrChange >= 0 ? '+' : ''}{mmrChange}
                      </span>
                    </div>
                    <div className="text-[9px] text-white/20 mt-0.5">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                  </motion.div>
                )
              })
            ) : (
              <div className="text-white/30 text-center py-8">
                NO_DATA
                <br />
                <span className="text-[9px]">Rank up to record</span>
              </div>
            )}
          </div>
        </AsciiBox>

        {/* Activity Feed */}
        <AsciiBox title="ACTIVITY_LOG" className="lg:col-span-1">
          <div className="max-h-[350px] overflow-y-auto">
            {activityFeed.length > 0 ? (
              activityFeed.slice(0, 8).map((a) => (
                <ActivityEntry key={a.id} activity={a} accentColor={termAccent} />
              ))
            ) : (
              <div className="text-white/30 text-center py-8">
                NO_DATA
                <br />
                <span className="text-[9px]">Play to populate</span>
              </div>
            )}
          </div>
        </AsciiBox>
      </motion.div>

      {/* Quick Nav */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-6"
      >
        <div className="flex items-center gap-2 text-[10px] text-white/30 mb-2">
          <span className="text-green-500">$</span>
          <span>ls /root/modules</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Link href="/leaderboard">
            <motion.div
              className="bg-black/30 border border-white/10 rounded p-3 hover:border-white/30 transition-all cursor-pointer"
              whileHover={{ x: 2 }}
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <div>
                  <span style={{ color: termAccent }}>&gt;</span> leaderboard.dat
                </div>
                <span className="text-white/20">-&gt;</span>
              </div>
            </motion.div>
          </Link>
          {season && (
            <Link href="/season">
              <motion.div
                className="bg-black/30 border border-white/10 rounded p-3 hover:border-white/30 transition-all cursor-pointer"
                whileHover={{ x: 2 }}
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <div>
                    <span style={{ color: termAccent }}>&gt;</span> season.log
                  </div>
                  <span className="text-white/20">-&gt;</span>
                </div>
              </motion.div>
            </Link>
          )}
          <Link href={`/profile/${playerDataToUse.discord_user_id}`}>
            <motion.div
              className="bg-black/30 border border-white/10 rounded p-3 hover:border-white/30 transition-all cursor-pointer"
              whileHover={{ x: 2 }}
            >
              <div className="flex items-center justify-between font-mono text-[10px]">
                <div>
                  <span style={{ color: termAccent }}>&gt;</span> user.profile
                </div>
                <span className="text-white/20">-&gt;</span>
              </div>
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
