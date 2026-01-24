'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { SeasonCountdown } from '@/components/SeasonCountdown'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Comment } from '@/lib/types'
import Link from 'next/link'
import { useAccentColor } from '@/lib/AccentColorContext'

interface PlayerWithStats {
  id: string
  discord_user_id: string
  discord_username: string | null
  discord_avatar_url?: string | null
  currentMMR: number
  rankLabel: string
  seasonMatches: number
  seasonWins: number
  seasonWinRate: number
  seasonNetMMR: number
}

interface QueueEntry {
  id: string
  joined_at: string
  player: {
    discord_user_id: string
    discord_username: string | null
    discord_avatar_url?: string | null
    valorant_mmr: number | null
    marvel_rivals_mmr: number | null
    valorant_rank: string | null
    marvel_rivals_rank: string | null
  }
}

interface LiveMatch {
  id: string
  match_id: string
  match_type: 'custom' | 'valorant' | 'marvel_rivals'
  match_date: string
  map: string | null
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled'
  team_a: { discord_username?: string; discord_user_id?: string }[]
  team_b: { discord_username?: string; discord_user_id?: string }[]
  host: {
    discord_username: string | null
    discord_user_id: string
  } | null
}

interface SeasonContentProps {
  currentSeason: {
    id: string
    name: string
    description: string | null
    start_date: string
    end_date: string
  }
  isBeforeStart: boolean
  selectedGame: 'valorant' | 'marvel_rivals'
  gameLabel: string
  playersWithStats: PlayerWithStats[]
  queuePlayers: QueueEntry[]
  liveMatches: LiveMatch[]
  top10: PlayerWithStats[]
  xWatch: PlayerWithStats[]
  totalSeasonMatches: number
  totalPlayers: number
  averageMMR: number
  seasonComments: Comment[]
}

// Stat block matching dashboard style
function StatBlock({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  const { accentColor } = useAccentColor()
  return (
    <div className="bg-black/30 border border-white/10 rounded p-3">
      <div className="text-[9px] text-white/30 uppercase">{label}</div>
      <div 
        className="text-xl font-bold tabular-nums" 
        style={{ color: highlight ? accentColor : '#e5e7eb' }}
      >
        {value}
      </div>
    </div>
  )
}

// Player row component
function PlayerRow({ player, index, isTopRank = false }: { 
  player: PlayerWithStats; 
  index: number; 
  isTopRank?: boolean 
}) {
  const { accentColor } = useAccentColor()
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
    >
      <Link href={`/profile/${player.discord_user_id}`}>
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] border-b border-white/5 hover:bg-white/5 transition-all">
          <span className={`w-8 font-bold ${isTopRank && index < 3 ? 'text-yellow-500' : 'text-white/30'}`}>
            {isTopRank ? index + 1 : index + 11}
          </span>
          <div className="w-6 h-6 rounded bg-white/10 border border-white/10 flex-shrink-0 overflow-hidden">
            {player.discord_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={player.discord_avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/30 text-[9px]">
                {(player.discord_username || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 truncate text-white/80">
            {player.discord_username || 'Unknown'}
          </div>
          <span className="text-white/30 tabular-nums hidden sm:block">{player.seasonMatches}M</span>
          <span className={`tabular-nums hidden sm:block ${player.seasonWinRate >= 50 ? 'text-green-500' : 'text-white/30'}`}>
            {player.seasonWinRate}%
          </span>
          <span className="font-bold tabular-nums" style={{ color: accentColor }}>{player.currentMMR}</span>
          <div className="hidden sm:block">
            <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export function SeasonContent({
  currentSeason,
  isBeforeStart,
  selectedGame,
  gameLabel,
  queuePlayers,
  liveMatches,
  top10,
  xWatch,
  totalSeasonMatches,
  totalPlayers,
  averageMMR,
  seasonComments,
}: SeasonContentProps) {
  const { accentColor } = useAccentColor()

  return (
    <div className="min-h-full p-4 md:p-6 font-mono">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {/* Command line */}
        <div className="flex items-center gap-2 text-[10px] text-white/30 mb-3">
          <span className="text-green-500">$</span>
          <span>cat /sys/season/active.log</span>
        </div>
        
        {/* Title */}
        <div className="flex items-center gap-3 mb-2">
          <span style={{ color: accentColor }} className="text-2xl font-bold">[</span>
          <span className="text-xl text-white font-bold tracking-wider">{currentSeason.name}</span>
          <span style={{ color: accentColor }} className="text-2xl font-bold">]</span>
          <span className={`text-[9px] font-bold uppercase ${isBeforeStart ? 'text-yellow-500' : 'text-green-500'}`}>
            {isBeforeStart ? '[PENDING]' : '[ACTIVE]'}
          </span>
        </div>
        
        {currentSeason.description && (
          <p className="text-[10px] text-white/40 mb-3">
            # {currentSeason.description}
          </p>
        )}
        
        {/* Game toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/season?game=valorant"
            className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all ${
              selectedGame === 'valorant'
                ? 'border-white/30 text-white bg-white/10'
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            VAL
          </Link>
          <Link
            href="/season?game=marvel_rivals"
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
        
        {/* Countdown */}
        <div className="bg-black/30 border border-white/10 rounded p-4 mb-4">
          <div className="text-[9px] text-white/30 uppercase mb-2">
            {isBeforeStart ? 'STARTS_IN' : 'ENDS_IN'}
          </div>
          <SeasonCountdown endDate={isBeforeStart ? currentSeason.start_date : currentSeason.end_date} />
          <div className="text-[9px] text-white/20 mt-2">
            [{new Date(currentSeason.start_date).toLocaleDateString()}] → [{new Date(currentSeason.end_date).toLocaleDateString()}]
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <StatBlock label="MATCHES" value={totalSeasonMatches} highlight />
          <StatBlock label="PLAYERS" value={totalPlayers} />
          <StatBlock label="AVG_MMR" value={averageMMR} />
        </div>
      </motion.div>

      {/* Queue & Live Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Queue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>QUEUE</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {queuePlayers.length}/10
            </span>
          </div>
          <div className="bg-black/30 border border-white/10 rounded">
            {queuePlayers.length > 0 ? (
              <>
                {queuePlayers.map((entry, index) => {
                  const mmr = selectedGame === 'marvel_rivals' 
                    ? (entry.player?.marvel_rivals_mmr ?? 0)
                    : (entry.player?.valorant_mmr ?? 0)
                  const rank = selectedGame === 'marvel_rivals'
                    ? (entry.player?.marvel_rivals_rank ?? 'Unranked')
                    : (entry.player?.valorant_rank ?? 'Unranked')
                  const joinedAgo = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000)
                  
                  return (
                    <Link key={entry.id} href={`/profile/${entry.player?.discord_user_id}`}>
                      <div className="flex items-center gap-2 px-3 py-2 text-[11px] border-b border-white/5 hover:bg-white/5 transition-all">
                        <span className="text-white/30 w-5">{String(index + 1).padStart(2, '0')}</span>
                        <div className="w-6 h-6 rounded bg-white/10 border border-white/10 flex-shrink-0 overflow-hidden">
                          {entry.player?.discord_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={entry.player.discord_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 text-[9px]">
                              {(entry.player?.discord_username || '?')[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 truncate text-white/80">
                          {entry.player?.discord_username || 'Unknown'}
                        </div>
                        <span className="font-bold tabular-nums" style={{ color: accentColor }}>{mmr}</span>
                        <RankBadge mmr={mmr} size="sm" rankLabel={rank} />
                        <span className="text-white/20 text-[9px]">{joinedAgo}m</span>
                      </div>
                    </Link>
                  )
                })}
                {/* Progress bar */}
                <div className="px-3 py-2 border-t border-white/10">
                  <div className="h-1 bg-white/10 rounded overflow-hidden">
                    <motion.div 
                      className="h-full"
                      style={{ backgroundColor: accentColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(queuePlayers.length / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-white/30 text-[10px]">
                [EMPTY] No players in queue
              </div>
            )}
          </div>
        </motion.div>

        {/* Live Matches */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>LIVE_MATCHES</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
            {liveMatches.length > 0 && (
              <span className="flex items-center gap-1 text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {liveMatches.length} ACTIVE
              </span>
            )}
          </div>
          <div className="bg-black/30 border border-white/10 rounded">
            {liveMatches.length > 0 ? (
              liveMatches.map((match, index) => {
                const isInProgress = match.status === 'in-progress'
                const teamANames = (match.team_a || []).slice(0, 2).map(p => p.discord_username?.split('#')[0] || '?').join(', ')
                const teamBNames = (match.team_b || []).slice(0, 2).map(p => p.discord_username?.split('#')[0] || '?').join(', ')
                const matchAge = Math.floor((Date.now() - new Date(match.match_date).getTime()) / 60000)
                
                return (
                  <div key={match.id} className={`px-3 py-2.5 text-[11px] ${index < liveMatches.length - 1 ? 'border-b border-white/5' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`flex items-center gap-1 text-[9px] font-bold ${isInProgress ? 'text-green-500' : 'text-yellow-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isInProgress ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
                        {isInProgress ? 'LIVE' : 'PENDING'}
                      </span>
                      <span className="text-white/20 text-[9px]">{match.map || 'TBD'} • {matchAge}m</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 truncate max-w-[40%]">{teamANames}</span>
                      <span className="text-white/30 text-[9px]">VS</span>
                      <span className="text-white/70 truncate max-w-[40%] text-right">{teamBNames}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-white/30 text-[10px]">
                [NONE] No active matches
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Top 10 & X Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Top 10 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>X_RANK</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
            <span style={{ color: accentColor }}>{top10.length} PLAYERS</span>
          </div>
          <div className="bg-black/30 border border-white/10 rounded overflow-hidden">
            {top10.length > 0 ? (
              top10.map((player, index) => (
                <PlayerRow key={player.id} player={player} index={index} isTopRank />
              ))
            ) : (
              <div className="py-8 text-center text-white/30 text-[10px]">
                [EMPTY] Reach 3000+ MMR for X rank
              </div>
            )}
          </div>
        </motion.div>

        {/* X Watch */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>CONTENDERS</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
            <span className="text-white/30">{xWatch.length} WATCHING</span>
          </div>
          <div className="bg-black/30 border border-white/10 rounded overflow-hidden">
            {xWatch.length > 0 ? (
              xWatch.map((player, index) => (
                <PlayerRow key={player.id} player={player} index={index} />
              ))
            ) : (
              <div className="py-8 text-center text-white/30 text-[10px]">
                [EMPTY] No contenders near X rank
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Leaderboard Link */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <Link
          href={`/leaderboard?game=${selectedGame}`}
          className="block w-full py-2 text-center text-[10px] font-bold border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all"
          style={{ color: accentColor }}
        >
          VIEW FULL LEADERBOARD →
        </Link>
      </motion.div>

      {/* Comments */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
          <span style={{ color: accentColor }}>[</span>
          <span>COMMENTS</span>
          <span style={{ color: accentColor }}>]</span>
          <div className="flex-1 border-b border-white/10" />
        </div>
        <div className="bg-black/30 border border-white/10 rounded p-4">
          <CommentSectionWrapper
            targetType="season"
            targetId={currentSeason.id}
            comments={seasonComments}
          />
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-4 text-[9px] text-white/20 flex items-center justify-between"
      >
        <span>Season: {currentSeason.id.slice(0, 8)}</span>
        <span>Updated: {new Date().toLocaleTimeString()}</span>
      </motion.div>
    </div>
  )
}
