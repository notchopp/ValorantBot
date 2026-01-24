'use client'

import { motion } from 'framer-motion'
import { RankBadge } from '@/components/RankBadge'
import { Player } from '@/lib/types'
import Link from 'next/link'
import { useAccentColor } from '@/lib/AccentColorContext'

interface PlayerWithStats extends Player {
  discord_avatar_url?: string | null
  currentMMR: number
  peakMMR: number
  rankLabel: string
  totalMatches: number
  wins: number
  winRate: number
  kd: number
}

interface LeaderboardContentProps {
  playersWithStats: PlayerWithStats[]
  totalPlayers: number
  averageMMR: number
  topPlayer: PlayerWithStats | undefined
  selectedGame: 'valorant' | 'marvel_rivals'
  gameLabel: string
}

export function LeaderboardContent({
  playersWithStats,
  totalPlayers,
  averageMMR,
  topPlayer,
  selectedGame,
  gameLabel,
}: LeaderboardContentProps) {
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
          <span>cat /root/leaderboard.dat | sort -k mmr -r</span>
        </div>
        
        {/* Title */}
        <div className="flex items-center gap-3 mb-4">
          <span style={{ color: accentColor }} className="text-2xl font-bold">[</span>
          <span className="text-xl text-white font-bold tracking-wider">LEADERBOARD</span>
          <span style={{ color: accentColor }} className="text-2xl font-bold">]</span>
        </div>
        
        {/* Game toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/leaderboard?game=valorant"
            className={`px-2 py-0.5 text-[9px] font-bold uppercase border transition-all ${
              selectedGame === 'valorant'
                ? 'border-white/30 text-white bg-white/10'
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            VAL
          </Link>
          <Link
            href="/leaderboard?game=marvel_rivals"
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
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <div className="text-[9px] text-white/30 uppercase">TOTAL</div>
            <div className="text-xl font-bold text-white tabular-nums">{totalPlayers}</div>
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <div className="text-[9px] text-white/30 uppercase">AVG_MMR</div>
            <div className="text-xl font-bold tabular-nums" style={{ color: accentColor }}>{averageMMR}</div>
          </div>
          <div className="bg-black/30 border border-white/10 rounded p-3">
            <div className="text-[9px] text-white/30 uppercase">LEADER</div>
            <div className="text-sm font-bold text-white truncate">{topPlayer?.discord_username || 'N/A'}</div>
          </div>
        </div>
      </motion.div>

      {/* Table Header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-black/50 border border-white/10 rounded-t"
      >
        <div className="flex items-center gap-2 px-3 py-2 text-[9px] text-white/30 uppercase border-b border-white/10">
          <span className="w-10 text-center">#</span>
          <span className="flex-1">PLAYER</span>
          <span className="w-16 text-right hidden sm:block">RANK</span>
          <span className="w-16 text-right">MMR</span>
          <span className="w-12 text-right hidden md:block">K/D</span>
          <span className="w-12 text-right hidden md:block">WIN%</span>
          <span className="w-14 text-right hidden lg:block">PEAK</span>
        </div>
      </motion.div>

      {/* Player Rows */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="bg-black/30 border-l border-r border-b border-white/10 rounded-b overflow-hidden"
      >
        {playersWithStats.length === 0 ? (
          <div className="py-16 text-center text-white/30 text-[10px]">
            [NO_DATA] No players found
          </div>
        ) : (
          playersWithStats.map((player, index) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.02 * index }}
            >
              <Link href={`/profile/${player.discord_user_id}`}>
                <div 
                  className={`
                    flex items-center gap-2 px-3 py-2.5 text-[11px] border-b border-white/5 
                    hover:bg-white/5 transition-all cursor-pointer
                    ${index === 0 ? 'bg-white/[0.03]' : ''}
                  `}
                >
                  {/* Position */}
                  <div className="w-10 text-center">
                    <span 
                      className={`font-bold ${
                        index === 0 ? 'text-yellow-500' : 
                        index < 3 ? 'text-white/70' : 
                        'text-white/30'
                      }`}
                    >
                      {index === 0 ? '>>' : index < 3 ? '>' : ' '}{index + 1}
                    </span>
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {/* Avatar */}
                    <div className="w-7 h-7 rounded bg-white/10 border border-white/10 flex-shrink-0 overflow-hidden">
                      {player.discord_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.discord_avatar_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-[9px]">
                          {(player.discord_username || '?')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    {/* Name */}
                    <div className="truncate">
                      <span className={index === 0 ? 'text-yellow-500 font-bold' : 'text-white/80'}>
                        {player.discord_username || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Rank Badge */}
                  <div className="w-16 hidden sm:flex justify-end">
                    <RankBadge mmr={player.currentMMR} size="sm" rankLabel={player.rankLabel} />
                  </div>
                  
                  {/* MMR */}
                  <div className="w-16 text-right">
                    <span className="font-bold tabular-nums" style={{ color: accentColor }}>
                      {player.currentMMR}
                    </span>
                  </div>
                  
                  {/* K/D */}
                  <div className="w-12 text-right hidden md:block">
                    <span className={`tabular-nums ${player.kd >= 1 ? 'text-green-500' : 'text-white/40'}`}>
                      {player.kd.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Win Rate */}
                  <div className="w-12 text-right hidden md:block">
                    <span className={`tabular-nums ${player.winRate >= 50 ? 'text-green-500' : 'text-white/40'}`}>
                      {player.winRate}%
                    </span>
                  </div>
                  
                  {/* Peak */}
                  <div className="w-14 text-right hidden lg:block">
                    <span className="text-white/30 tabular-nums">{player.peakMMR}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </motion.div>
      
      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-4 text-[9px] text-white/20 flex items-center justify-between"
      >
        <span>Total entries: {playersWithStats.length}</span>
        <span>Updated: {new Date().toLocaleTimeString()}</span>
      </motion.div>
    </div>
  )
}
