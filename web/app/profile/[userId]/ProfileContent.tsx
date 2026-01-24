'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { TerminalMMRBar } from '@/components/TerminalMMRBar'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { ProfileAccentColor } from '@/components/ProfileAccentColor'
import { Comment } from '@/lib/types'
import Link from 'next/link'

interface MatchStat {
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

interface UserComment {
  id: string
  content: string
  created_at: string
  target_player?: {
    discord_user_id?: string
    discord_username?: string | null
  }
}

interface PlayerData {
  id: string
  discord_user_id: string
  discord_username: string | null
  discord_avatar_url?: string | null
  discord_rank: string | null
  riot_name: string | null
  riot_tag: string | null
  riot_region: string | null
  verified_at: string | null
  marvel_rivals_username: string | null
  marvel_rivals_uid: string | null
  marvel_rivals_rank: string | null
}

interface ProfileContentProps {
  userId: string
  playerData: PlayerData
  selectedGame: 'valorant' | 'marvel_rivals'
  gameLabel: string
  currentMMR: number
  peakMMR: number
  rankLabel: string
  isOwnProfile: boolean
  displayName: string
  userBio: string | null
  profileAccentColor: string
  totalMatches: number
  wins: number
  losses: number
  winRate: number
  kd: string
  mvpCount: number
  leaderboardPosition: number
  stats: MatchStat[]
  userComments: UserComment[]
  profileComments: Comment[]
}

// Animated stat block
function StatBlock({ label, value, color = 'white', subtext, delay = 0 }: { 
  label: string; 
  value: string | number; 
  color?: string; 
  subtext?: string;
  delay?: number 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="terminal-panel p-4 md:p-6"
    >
      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-2">{label}</div>
      <div className="text-2xl md:text-3xl font-mono font-black tabular-nums" style={{ color }}>
        {value}
      </div>
      {subtext && (
        <div className="text-[10px] font-mono text-[var(--term-muted)] mt-1">{subtext}</div>
      )}
    </motion.div>
  )
}

// Match history entry with animation
function MatchEntry({ stat, index }: { stat: MatchStat; index: number }) {
  const isWin = stat.match && stat.team ? stat.match.winner === stat.team : stat.mmr_after > stat.mmr_before
  const mmrChange = stat.mmr_after - stat.mmr_before
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="p-3 md:p-4 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/30 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-mono font-bold" style={{ color: isWin ? '#22c55e' : '#ef4444' }}>
          [{isWin ? 'WIN' : 'LOSS'}]
        </div>
        <div className="text-sm font-mono font-bold tabular-nums" style={{ color: mmrChange >= 0 ? '#22c55e' : '#ef4444' }}>
          {mmrChange >= 0 ? '+' : ''}{mmrChange} MMR
        </div>
      </div>
      <div className="text-[10px] font-mono text-[var(--term-muted)] mb-1">
        {stat.match?.map || 'Unknown'} • {stat.match?.match_date ? new Date(stat.match.match_date).toLocaleDateString() : '???'} • {(() => {
          const type = stat.match?.match_type
          if (type === 'marvel_rivals') return 'MR'
          if (type === 'valorant') return 'VAL'
          if (type === 'custom') return 'CUSTOM'
          return 'MATCH'
        })()}
      </div>
      <div className="text-[10px] font-mono text-[var(--term-muted)]">
        {stat.kills}/{stat.deaths} K/D {stat.mvp && <span className="font-bold text-[var(--term-accent)]">[MVP]</span>}
      </div>
    </motion.div>
  )
}

export function ProfileContent({
  userId,
  playerData,
  selectedGame,
  gameLabel,
  currentMMR,
  peakMMR,
  rankLabel,
  isOwnProfile,
  displayName,
  userBio,
  profileAccentColor,
  totalMatches,
  wins,
  losses,
  winRate,
  kd,
  mvpCount,
  leaderboardPosition,
  stats,
  userComments,
  profileComments,
}: ProfileContentProps) {
  return (
    <>
      <ProfileAccentColor accentColor={profileAccentColor} />
      <div className="min-h-screen py-12 md:py-20 px-4 md:px-8 relative z-10" style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}>
        <div className="max-w-[1400px] mx-auto">
          {/* Profile Header */}
          <motion.div 
            className="mb-12 md:mb-20"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 md:gap-8 mb-8 md:mb-12">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-[10px] text-white/30 mb-3">
                  <span className="text-green-500">$</span>
                  <span>cat /users/{playerData.discord_user_id.slice(0, 8)}/profile.dat</span>
                </div>
                
                {/* Game Selector */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Link
                    href={`/profile/${userId}?game=valorant`}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all font-mono ${
                      selectedGame === 'valorant'
                        ? 'border-[var(--term-accent)] text-[var(--term-accent)] bg-[var(--term-accent)]/10'
                        : 'border-[var(--term-border)] text-[var(--term-muted)] hover:border-[var(--term-accent)] hover:text-white'
                    }`}
                  >
                    ./valorant
                  </Link>
                  <Link
                    href={`/profile/${userId}?game=marvel_rivals`}
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

                {/* Avatar + Name */}
                <motion.div 
                  className="flex items-center gap-4 md:gap-6 mb-4 md:mb-6"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
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
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-mono font-black text-white tracking-tighter leading-[0.9]">
                        <span className="text-[var(--term-muted)]">[</span>{displayName}<span className="text-[var(--term-muted)]">]</span>
                      </h1>
                      {isOwnProfile && (
                        <Link
                          href={`/profile/${userId}/edit`}
                          className="p-2 md:p-3 border border-[var(--term-border)] bg-[var(--term-panel)] hover:border-[var(--term-accent)]/50 transition-all group"
                          title="Edit Profile"
                        >
                          <svg className="w-5 h-5 md:w-6 md:h-6 text-[var(--term-muted)] group-hover:text-[var(--term-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                      )}
                    </div>
                    <p className="text-lg md:text-xl text-[var(--term-muted)] font-mono">
                      {playerData.riot_name && playerData.riot_tag 
                        ? `${playerData.riot_name}#${playerData.riot_tag}`
                        : '[RIOT_NOT_LINKED]'
                      }
                    </p>
                  </div>
                </motion.div>
                
                {/* Bio */}
                {userBio && (
                  <motion.div 
                    className="terminal-panel p-4 mb-6"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                  >
                    <div className="text-[10px] font-mono text-[var(--term-muted)] mb-2"># BIO</div>
                    <p className="text-sm md:text-base text-white/80 font-mono leading-relaxed">{userBio}</p>
                  </motion.div>
                )}
              </div>
              
              {/* Rank Badge Side */}
              <motion.div 
                className="flex flex-col items-start md:items-end gap-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <RankBadge mmr={currentMMR} size="xl" rankLabel={rankLabel} />
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)]">
                  DISCORD_RANK: <span className="text-white">{playerData.discord_rank || 'Unranked'}</span>
                </p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)]">
                  POSITION: <span className="text-[var(--term-accent)]">#{leaderboardPosition}</span>
                </p>
              </motion.div>
            </div>
            
            {/* MMR Progress */}
            <motion.div 
              className="terminal-panel p-6 md:p-8 mb-8 md:mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">mmr --status</span>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div className="flex items-baseline gap-3">
                  <motion.span 
                    className="text-4xl md:text-6xl font-mono font-bold tabular-nums text-[var(--term-accent)]"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    {currentMMR}
                  </motion.span>
                </div>
                <div className="text-[10px] text-[var(--term-muted)] font-mono">
                  PEAK: <span className="text-[var(--term-accent)]">{peakMMR}</span>
                  {currentMMR > 0 && currentMMR < 3000 && (
                    <> · <span className="text-yellow-500">{3000 - currentMMR} TO X</span></>
                  )}
                </div>
              </div>
              <TerminalMMRBar currentMMR={currentMMR} accentColor="var(--term-accent)" />
              <div className="mt-4 flex items-center justify-between text-[10px] font-mono text-[var(--term-muted)]">
                <span>
                  {gameLabel.toUpperCase()}_RANK: <span className="text-white">{rankLabel}</span>
                </span>
                <span>
                  GLOBAL_POS: <span className="text-white">#{leaderboardPosition}</span>
                </span>
              </div>
            </motion.div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-12">
              <StatBlock label="MATCHES" value={totalMatches} delay={0.3} />
              <StatBlock 
                label="WIN_RATE" 
                value={`${winRate}%`} 
                color={winRate >= 50 ? '#22c55e' : '#ef4444'} 
                subtext={`${wins}W/${losses}L`}
                delay={0.35} 
              />
              <StatBlock 
                label="K/D_RATIO" 
                value={kd} 
                color={parseFloat(kd) >= 1.0 ? '#22c55e' : '#ef4444'}
                delay={0.4} 
              />
              <StatBlock label="MVP_COUNT" value={mvpCount} color="var(--term-accent)" delay={0.45} />
            </div>
          </motion.div>
          
          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-20">
            {/* Recent Games */}
            <motion.div 
              className="terminal-panel p-6 md:p-8"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">history --matches --limit 10</span>
              </div>
              {stats.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {stats.slice(0, 10).map((stat, index) => (
                    <MatchEntry key={stat.match?.match_date || stat.created_at} stat={stat} index={index} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-[var(--term-muted)] font-mono text-sm">[NO_MATCH_DATA]</div>
                  <div className="text-[10px] text-[var(--term-muted)] font-mono mt-1">No games recorded yet</div>
                </div>
              )}
            </motion.div>
            
            {/* Comments Left by User */}
            <motion.div 
              className="terminal-panel p-6 md:p-8"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">grep --author {displayName.slice(0, 8)} /comments/*</span>
              </div>
              {userComments.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {userComments.map((comment, index) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Link
                        href={`/profile/${comment.target_player?.discord_user_id || ''}`}
                        className="block p-3 md:p-4 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/30 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[10px] font-mono text-[var(--term-muted)]">
                            &gt; @<span className="text-white group-hover:text-[var(--term-accent)] transition-colors">{comment.target_player?.discord_username || 'Unknown'}</span>
                          </div>
                          <span className="text-[10px] font-mono text-[var(--term-muted)]">
                            [{new Date(comment.created_at).toLocaleDateString()}]
                          </span>
                        </div>
                        <p className="text-sm font-mono text-white/80 line-clamp-2">{comment.content}</p>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-[var(--term-muted)] font-mono text-sm">[NO_COMMENTS]</div>
                  <div className="text-[10px] text-[var(--term-muted)] font-mono mt-1">No comments by user</div>
                </div>
              )}
            </motion.div>
          </div>
          
          {/* Account Info & Profile Comments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mb-12 md:mb-20">
            <div className="space-y-4">
              {/* Valorant Account */}
              <motion.div 
                className="terminal-panel p-6 md:p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                  <span className="text-[var(--term-muted)]">$</span> <span className="text-white">account --game valorant</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">RIOT_ID</div>
                    <div className="text-base font-mono font-bold text-white">
                      {playerData.riot_name && playerData.riot_tag 
                        ? `${playerData.riot_name}#${playerData.riot_tag}`
                        : '[NOT_LINKED]'
                      }
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">REGION</div>
                    <div className="text-base font-mono font-bold text-white">{playerData.riot_region?.toUpperCase() || 'NULL'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">VERIFIED</div>
                    <div className={`text-base font-mono font-bold ${playerData.verified_at ? 'text-green-500' : 'text-[var(--term-muted)]'}`}>
                      {playerData.verified_at ? '[TRUE]' : '[FALSE]'}
                    </div>
                  </div>
                </div>
              </motion.div>
              
              {/* Marvel Rivals Account */}
              <motion.div 
                className="terminal-panel p-6 md:p-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                  <span className="text-[var(--term-muted)]">$</span> <span className="text-white">account --game marvel_rivals</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">USERNAME</div>
                    <div className="text-base font-mono font-bold text-white">
                      {playerData.marvel_rivals_username || '[NOT_LINKED]'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">UID</div>
                    <div className="text-base font-mono font-bold text-white">
                      {playerData.marvel_rivals_uid || 'NULL'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--term-muted)] mb-1">VERIFIED</div>
                    <div className={`text-base font-mono font-bold ${playerData.marvel_rivals_rank ? 'text-green-500' : 'text-[var(--term-muted)]'}`}>
                      {playerData.marvel_rivals_rank ? '[TRUE]' : '[FALSE]'}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Comments on Profile */}
            <motion.div 
              className="terminal-panel p-6 md:p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">
                <span className="text-[var(--term-muted)]">$</span> <span className="text-white">comments --target {displayName.slice(0, 8)}</span>
              </div>
              <CommentSectionWrapper
                targetType="profile"
                targetId={playerData.id}
                comments={profileComments}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </>
  )
}
