'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { TerminalMMRBar } from '@/components/TerminalMMRBar'
import { CommentSectionWrapper } from '@/components/CommentSectionWrapper'
import { ProfileAccentColor } from '@/components/ProfileAccentColor'
import { Comment } from '@/lib/types'
import Link from 'next/link'
import { useAccentColor } from '@/lib/AccentColorContext'

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

// Match entry component
function MatchEntry({ stat, index, accentColor }: { stat: MatchStat; index: number; accentColor: string }) {
  const isWin = stat.match && stat.team ? stat.match.winner === stat.team : stat.mmr_after > stat.mmr_before
  const mmrChange = stat.mmr_after - stat.mmr_before
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-center gap-2 px-3 py-2 text-[11px] border-b border-white/5 hover:bg-white/5 transition-all"
    >
      <span className={`w-10 font-bold ${isWin ? 'text-green-500' : 'text-red-500'}`}>
        {isWin ? '[W]' : '[L]'}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-white/70">{stat.match?.map || 'Unknown'}</span>
        <span className="text-white/30 ml-2 text-[9px]">
          {stat.match?.match_date ? new Date(stat.match.match_date).toLocaleDateString() : '???'}
        </span>
      </div>
      <span className="text-white/50 text-[10px] hidden sm:block">{stat.kills}/{stat.deaths}</span>
      {stat.mvp && <span className="text-[9px] font-bold" style={{ color: accentColor }}>[MVP]</span>}
      <span className={`font-bold tabular-nums ${mmrChange >= 0 ? 'text-green-500' : 'text-red-500'}`}>
        {mmrChange >= 0 ? '+' : ''}{mmrChange}
      </span>
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
  const { accentColor: globalAccent } = useAccentColor()
  const accentColor = profileAccentColor || globalAccent

  return (
    <>
      <ProfileAccentColor accentColor={profileAccentColor} />
      <div className="min-h-full p-4 md:p-6 font-mono" style={{ '--profile-accent-color': profileAccentColor } as React.CSSProperties}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          {/* Command line */}
          <div className="flex items-center gap-2 text-[10px] text-white/30 mb-3">
            <span className="text-green-500">$</span>
            <span>cat /users/{playerData.discord_user_id.slice(0, 8)}/profile.dat</span>
          </div>
          
          {/* User info block */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-16 h-16 md:w-20 md:h-20 rounded bg-white/10 border border-white/10 flex-shrink-0 overflow-hidden">
                {playerData.discord_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={playerData.discord_avatar_url} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ color: accentColor }} className="text-lg font-bold">@{displayName}</span>
                  {isOwnProfile && (
                    <Link
                      href={`/profile/${userId}/edit`}
                      className="p-1 border border-white/10 hover:border-white/30 transition-all"
                      title="Edit Profile"
                    >
                      <svg className="w-3 h-3 text-white/30 hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                  )}
                </div>
                
                {/* Game toggle */}
                <div className="flex items-center gap-2 mb-1">
                  <Link
                    href={`/profile/${userId}?game=valorant`}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all ${
                      selectedGame === 'valorant'
                        ? 'border-white/30 text-white bg-white/10'
                        : 'border-white/10 text-white/30 hover:text-white/60'
                    }`}
                  >
                    VAL
                  </Link>
                  <Link
                    href={`/profile/${userId}?game=marvel_rivals`}
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
                
                {/* Account link */}
                <div className="text-[9px] text-white/30 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span>
                    {selectedGame === 'marvel_rivals'
                      ? (playerData.marvel_rivals_username || 'NOT_LINKED')
                      : (playerData.riot_name ? `${playerData.riot_name}#${playerData.riot_tag}` : 'NOT_LINKED')}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Rank display */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-[9px] text-white/30 mb-1">RANK</div>
                <RankBadge mmr={currentMMR} size="lg" rankLabel={rankLabel} />
              </div>
              <div className="text-right">
                <div className="text-[9px] text-white/30 mb-1">POS</div>
                <div className="text-2xl font-bold" style={{ color: accentColor }}>#{leaderboardPosition}</div>
              </div>
            </div>
          </div>
          
          {/* Bio */}
          {userBio && (
            <div className="bg-black/30 border border-white/10 rounded p-3 mb-4">
              <div className="text-[9px] text-white/30 mb-1"># BIO</div>
              <p className="text-[11px] text-white/70">{userBio}</p>
            </div>
          )}
        </motion.div>

        {/* MMR Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>MMR_READOUT</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-4">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <div className="text-[9px] text-white/30 mb-1">CURRENT</div>
                <span className="text-4xl font-bold tabular-nums" style={{ color: accentColor }}>{currentMMR}</span>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-white/30">PEAK: <span style={{ color: accentColor }}>{peakMMR}</span></div>
                {currentMMR > 0 && currentMMR < 3000 && (
                  <div className="text-[9px] text-yellow-500">{3000 - currentMMR} TO X</div>
                )}
              </div>
            </div>
            <TerminalMMRBar currentMMR={currentMMR} accentColor={accentColor} />
            <div className="mt-3 flex items-center justify-between text-[9px] text-white/30">
              <span>RANK: <span className="text-white">{rankLabel}</span></span>
              <span>POS: <span className="text-white">#{leaderboardPosition}</span></span>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-black/30 border border-white/10 rounded p-3">
              <div className="text-[9px] text-white/30 uppercase">MATCHES</div>
              <div className="text-xl font-bold text-white tabular-nums">{totalMatches}</div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded p-3">
              <div className="text-[9px] text-white/30 uppercase">WIN_RATE</div>
              <div className={`text-xl font-bold tabular-nums ${winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                {winRate}%
              </div>
              <div className="text-[9px] text-white/20">{wins}W/{losses}L</div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded p-3">
              <div className="text-[9px] text-white/30 uppercase">K/D</div>
              <div className={`text-xl font-bold tabular-nums ${parseFloat(kd) >= 1.0 ? 'text-green-500' : 'text-white'}`}>
                {kd}
              </div>
            </div>
            <div className="bg-black/30 border border-white/10 rounded p-3">
              <div className="text-[9px] text-white/30 uppercase">MVP</div>
              <div className="text-xl font-bold tabular-nums" style={{ color: accentColor }}>{mvpCount}</div>
            </div>
          </div>
        </motion.div>

        {/* Match History & Comments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Recent Matches */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
              <span style={{ color: accentColor }}>[</span>
              <span>MATCH_HISTORY</span>
              <span style={{ color: accentColor }}>]</span>
              <div className="flex-1 border-b border-white/10" />
            </div>
            <div className="bg-black/30 border border-white/10 rounded overflow-hidden max-h-[400px] overflow-y-auto">
              {stats.length > 0 ? (
                stats.slice(0, 10).map((stat, index) => (
                  <MatchEntry key={stat.match?.match_date || stat.created_at} stat={stat} index={index} accentColor={accentColor} />
                ))
              ) : (
                <div className="py-8 text-center text-white/30 text-[10px]">
                  [EMPTY] No matches recorded
                </div>
              )}
            </div>
          </motion.div>

          {/* Comments Left by User */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
              <span style={{ color: accentColor }}>[</span>
              <span>USER_COMMENTS</span>
              <span style={{ color: accentColor }}>]</span>
              <div className="flex-1 border-b border-white/10" />
            </div>
            <div className="bg-black/30 border border-white/10 rounded overflow-hidden max-h-[400px] overflow-y-auto">
              {userComments.length > 0 ? (
                userComments.map((comment, index) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <Link href={`/profile/${comment.target_player?.discord_user_id || ''}`}>
                      <div className="px-3 py-2 text-[11px] border-b border-white/5 hover:bg-white/5 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/50">→ @{comment.target_player?.discord_username || 'Unknown'}</span>
                          <span className="text-white/20 text-[9px]">{new Date(comment.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-white/70 line-clamp-2">{comment.content}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <div className="py-8 text-center text-white/30 text-[10px]">
                  [EMPTY] No comments by user
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Account Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Valorant Account */}
            <div>
              <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
                <span style={{ color: accentColor }}>[</span>
                <span>VALORANT_ACCOUNT</span>
                <span style={{ color: accentColor }}>]</span>
                <div className="flex-1 border-b border-white/10" />
              </div>
              <div className="bg-black/30 border border-white/10 rounded p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">RIOT_ID</span>
                  <span className="text-[11px] text-white">
                    {playerData.riot_name && playerData.riot_tag 
                      ? `${playerData.riot_name}#${playerData.riot_tag}`
                      : '[NOT_LINKED]'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">REGION</span>
                  <span className="text-[11px] text-white">{playerData.riot_region?.toUpperCase() || 'NULL'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">VERIFIED</span>
                  <span className={`text-[11px] ${playerData.verified_at ? 'text-green-500' : 'text-white/30'}`}>
                    {playerData.verified_at ? '[TRUE]' : '[FALSE]'}
                  </span>
                </div>
              </div>
            </div>

            {/* Marvel Rivals Account */}
            <div>
              <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
                <span style={{ color: accentColor }}>[</span>
                <span>MARVEL_RIVALS_ACCOUNT</span>
                <span style={{ color: accentColor }}>]</span>
                <div className="flex-1 border-b border-white/10" />
              </div>
              <div className="bg-black/30 border border-white/10 rounded p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">USERNAME</span>
                  <span className="text-[11px] text-white">
                    {playerData.marvel_rivals_username || '[NOT_LINKED]'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">UID</span>
                  <span className="text-[11px] text-white">{playerData.marvel_rivals_uid || 'NULL'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] text-white/30">VERIFIED</span>
                  <span className={`text-[11px] ${playerData.marvel_rivals_rank ? 'text-green-500' : 'text-white/30'}`}>
                    {playerData.marvel_rivals_rank ? '[TRUE]' : '[FALSE]'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Profile Comments */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase mb-2">
            <span style={{ color: accentColor }}>[</span>
            <span>PROFILE_COMMENTS</span>
            <span style={{ color: accentColor }}>]</span>
            <div className="flex-1 border-b border-white/10" />
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-4">
            <CommentSectionWrapper
              targetType="profile"
              targetId={playerData.id}
              comments={profileComments}
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
          <span>User: {playerData.discord_user_id.slice(-8)}</span>
          <span>Updated: {new Date().toLocaleTimeString()}</span>
        </motion.div>
      </div>
    </>
  )
}
