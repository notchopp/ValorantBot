'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { SeasonCountdown } from '@/components/SeasonCountdown'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { Comment } from '@/lib/types'
import Link from 'next/link'

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

// Glitch text effect component
function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <motion.span 
      className={`relative inline-block ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {text}
    </motion.span>
  )
}

// Animated stat block
function StatBlock({ label, value, color = 'white', delay = 0 }: { label: string; value: string | number; color?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="terminal-panel p-4"
    >
      <div className="text-[10px] text-[var(--term-muted)] mb-1 font-mono uppercase">{label}</div>
      <div className="text-2xl font-mono font-black tabular-nums" style={{ color }}>
        {value}
      </div>
    </motion.div>
  )
}

// Animated player row
function PlayerRow({ player, index, isTopRank = false }: { 
  player: PlayerWithStats; 
  index: number; 
  isTopRank?: boolean 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/profile/${player.discord_user_id}`}
        className="flex items-center gap-3 p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/50 transition-all group"
      >
        <div className={`font-mono font-black w-8 ${isTopRank ? 'text-lg text-[var(--term-accent)]' : 'text-sm text-[var(--term-muted)]'}`}>
          #{isTopRank ? index + 1 : index + 11}
        </div>
        <div className="relative flex-shrink-0">
          {player.discord_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.discord_avatar_url}
              alt={player.discord_username || 'Player'}
              className="w-8 h-8 rounded-sm border border-[var(--term-border)] group-hover:border-[var(--term-accent)]/50 transition-colors"
            />
          ) : (
            <div className="w-8 h-8 rounded-sm bg-[var(--term-bg)] border border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-xs font-mono">
              {(player.discord_username || 'U').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono font-bold text-white text-sm truncate group-hover:text-[var(--term-accent)] transition-colors">
            {player.discord_username || 'Unknown'}
          </div>
          <div className="text-[10px] text-[var(--term-muted)] font-mono">
            {player.currentMMR} MMR • {player.seasonMatches || 0}M • {player.seasonWinRate || 0}%WR
          </div>
        </div>
        <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
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
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Season Header */}
        <motion.div 
          className="mb-8 md:mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-2">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-[var(--term-accent)]">cat</span> <span className="text-white">/sys/season/active.log</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-7xl font-mono font-black text-[var(--term-accent)] mb-2 tracking-tighter leading-none">
                <GlitchText text={`[${currentSeason.name}]`} />
              </h1>
              {currentSeason.description && (
                <p className="text-sm md:text-base text-[var(--term-muted)] font-mono max-w-2xl">
                  <span className="text-[var(--term-accent)]">#</span> {currentSeason.description}
                </p>
              )}
            </div>
            <motion.div 
              className="text-right hidden sm:block terminal-panel p-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2">STATUS</div>
              <div className={`text-lg font-mono font-black ${isBeforeStart ? 'text-yellow-500' : 'text-[var(--term-accent)]'}`}>
                {isBeforeStart ? '[PENDING]' : '[ACTIVE]'}
              </div>
            </motion.div>
          </div>

          {/* Game Selector */}
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Link
              href="/season?game=valorant"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'valorant'
                  ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              ./valorant
            </Link>
            <Link
              href="/season?game=marvel_rivals"
              className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                selectedGame === 'marvel_rivals'
                  ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                  : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
              }`}
            >
              ./marvel_rivals
            </Link>
            <span className="text-[10px] font-mono text-[var(--term-muted)] px-2">&gt; {gameLabel.toUpperCase()}</span>
          </div>
          
          {/* Countdown & Stats */}
          <motion.div 
            className="terminal-panel p-6 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-3">
              $ {isBeforeStart ? 'countdown --until start' : 'countdown --until end'}
            </div>
            <SeasonCountdown endDate={isBeforeStart ? currentSeason.start_date : currentSeason.end_date} />
            
            <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-[var(--term-border)]">
              <StatBlock label="MATCHES" value={totalSeasonMatches} color="var(--term-accent)" delay={0.2} />
              <StatBlock label="PLAYERS" value={totalPlayers} delay={0.3} />
              <StatBlock label="AVG_MMR" value={averageMMR} delay={0.4} />
            </div>
            <div className="text-[10px] text-[var(--term-muted)] mt-3 font-mono">
              [{new Date(currentSeason.start_date).toLocaleDateString()}] → [{new Date(currentSeason.end_date).toLocaleDateString()}]
            </div>
          </motion.div>
        </motion.div>
        
        {/* Live Matches & Queue Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Current Queue */}
          <motion.div 
            className="terminal-panel p-6 md:p-8"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">queue --status</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--term-accent)] rounded-full animate-pulse"></span>
                <span className="text-[10px] font-mono text-[var(--term-muted)]">{queuePlayers.length}/10</span>
              </div>
            </div>
            
            {queuePlayers.length > 0 ? (
              <div className="space-y-2">
                {queuePlayers.map((entry, index) => {
                  const mmr = selectedGame === 'marvel_rivals' 
                    ? (entry.player?.marvel_rivals_mmr ?? 0)
                    : (entry.player?.valorant_mmr ?? 0)
                  const rank = selectedGame === 'marvel_rivals'
                    ? (entry.player?.marvel_rivals_rank ?? 'Unranked')
                    : (entry.player?.valorant_rank ?? 'Unranked')
                  const joinedAgo = Math.floor((Date.now() - new Date(entry.joined_at).getTime()) / 60000)
                  
                  return (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Link
                        href={`/profile/${entry.player?.discord_user_id}`}
                        className="flex items-center gap-3 p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/50 transition-all group"
                      >
                        <span className="text-[var(--term-accent)] font-mono text-sm w-6">{String(index + 1).padStart(2, '0')}</span>
                        {entry.player?.discord_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.player.discord_avatar_url}
                            alt={entry.player.discord_username || 'Player'}
                            className="w-8 h-8 rounded-sm border border-[var(--term-border)]"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-sm bg-[var(--term-bg)] border border-[var(--term-border)] flex items-center justify-center text-[var(--term-muted)] text-xs font-mono">
                            {(entry.player?.discord_username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono font-bold text-white text-sm truncate group-hover:text-[var(--term-accent)] transition-colors">
                            {entry.player?.discord_username || 'Unknown'}
                          </div>
                          <div className="text-[10px] text-[var(--term-muted)] font-mono">{mmr} MMR</div>
                        </div>
                        <RankBadge mmr={mmr} size="sm" rankLabel={rank} />
                        <span className="text-[10px] text-[var(--term-muted)] font-mono">{joinedAgo}m</span>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[QUEUE_EMPTY]</div>
                <div className="text-[10px] text-[var(--term-muted)]">No players in queue. Join via Discord!</div>
              </div>
            )}
            
            {/* Queue Progress Bar */}
            <div className="mt-4 pt-4 border-t border-[var(--term-border)]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--term-muted)] mb-2">
                <span>QUEUE_FILL</span>
                <span>{queuePlayers.length}/10</span>
              </div>
              <div className="h-2 bg-[var(--term-bg)] border border-[var(--term-border)]">
                <motion.div 
                  className="h-full bg-[var(--term-accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(queuePlayers.length / 10) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
          
          {/* Live Matches */}
          <motion.div 
            className="terminal-panel p-6 md:p-8"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">matches --live</span>
              </div>
              <div className="flex items-center gap-2">
                {liveMatches.length > 0 && (
                  <>
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-mono text-green-500">{liveMatches.length} ACTIVE</span>
                  </>
                )}
              </div>
            </div>
            
            {liveMatches.length > 0 ? (
              <div className="space-y-3">
                {liveMatches.map((match, index) => {
                  const isInProgress = match.status === 'in-progress'
                  const teamANames = (match.team_a || []).slice(0, 3).map(p => p.discord_username?.split('#')[0] || 'Player').join(', ')
                  const teamBNames = (match.team_b || []).slice(0, 3).map(p => p.discord_username?.split('#')[0] || 'Player').join(', ')
                  const matchAge = Math.floor((Date.now() - new Date(match.match_date).getTime()) / 60000)
                  
                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="p-4 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/30 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isInProgress ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                          <span className={`text-[10px] font-mono font-bold uppercase ${isInProgress ? 'text-green-500' : 'text-yellow-500'}`}>
                            {isInProgress ? '[LIVE]' : '[PENDING]'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--term-muted)]">
                          {match.map || 'TBD'} • {matchAge}m ago
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        <div className="text-right">
                          <div className="text-[10px] font-mono text-[var(--term-accent)] mb-1">TEAM_A</div>
                          <div className="text-xs font-mono text-white truncate">
                            {teamANames}{(match.team_a?.length || 0) > 3 ? '...' : ''}
                          </div>
                        </div>
                        <div className="text-center px-4">
                          <div className="text-lg font-mono font-black text-[var(--term-muted)]">VS</div>
                        </div>
                        <div className="text-left">
                          <div className="text-[10px] font-mono text-[var(--term-accent)] mb-1">TEAM_B</div>
                          <div className="text-xs font-mono text-white truncate">
                            {teamBNames}{(match.team_b?.length || 0) > 3 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                      
                      {match.host && (
                        <div className="mt-3 pt-3 border-t border-[var(--term-border)] flex items-center gap-2 text-[10px] font-mono text-[var(--term-muted)]">
                          <span>HOST:</span>
                          <Link 
                            href={`/profile/${match.host.discord_user_id}`}
                            className="text-white hover:text-[var(--term-accent)] transition-colors"
                          >
                            @{match.host.discord_username || 'Unknown'}
                          </Link>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[NO_LIVE_MATCHES]</div>
                <div className="text-[10px] text-[var(--term-muted)]">No active matches. Start via Discord!</div>
              </div>
            )}
          </motion.div>
        </div>
        
        {/* Top 10 & X Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-12">
          {/* Top 10 (X Rank) */}
          <motion.div 
            className="terminal-panel p-6 md:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">leaderboard --top 10 --rank X</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--term-accent)]">{top10.length} X-RANK</div>
            </div>
            <div className="space-y-2">
              {top10.length > 0 ? (
                top10.map((player, index) => (
                  <PlayerRow key={player.id} player={player} index={index} isTopRank={true} />
                ))
              ) : (
                <div className="text-center py-12">
                  <div className="text-[var(--term-muted)] font-mono text-sm mb-2">[NO_X_RANK]</div>
                  <div className="text-[10px] text-[var(--term-muted)]">Reach 3000+ MMR to claim X rank!</div>
                </div>
              )}
            </div>
          </motion.div>
          
          {/* X Watch */}
          <motion.div 
            className="terminal-panel p-6 md:p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="terminal-prompt text-[10px] uppercase tracking-wider">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">watch --contenders</span>
              </div>
              <div className="text-[10px] font-mono text-[var(--term-muted)]">{xWatch.length} CONTENDERS</div>
            </div>
            <div className="space-y-2">
              {xWatch.length > 0 ? (
                xWatch.map((player, index) => (
                  <PlayerRow key={player.id} player={player} index={index} isTopRank={false} />
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-[var(--term-muted)] font-mono text-sm">[NO_CONTENDERS]</div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
        
        {/* Full Leaderboard Link */}
        <motion.div 
          className="text-center mb-8 md:mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Link
            href={`/leaderboard?game=${selectedGame}`}
            className="inline-block px-8 py-3 border border-[var(--term-accent)] text-[var(--term-accent)] font-mono font-bold uppercase tracking-wider text-xs hover:bg-[var(--term-accent)] hover:text-black transition-all"
          >
            $ cat /leaderboard --full
          </Link>
        </motion.div>
        
        {/* Season Comments */}
        <motion.div 
          className="terminal-panel p-6 md:p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
            <span className="text-[var(--term-muted)]">$</span> <span className="text-white">comments --season {currentSeason.id.slice(0, 8)}</span>
          </div>
          <CommentSectionWrapper
            targetType="season"
            targetId={currentSeason.id}
            comments={seasonComments}
          />
        </motion.div>
      </div>
    </div>
  )
}
