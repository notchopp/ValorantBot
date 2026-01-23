'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, CheckCircle, AlertCircle, Users, Zap } from 'lucide-react'

interface PlayerWithStats {
  id: string
  discord_username: string | null
  riot_name: string | null
  riot_tag: string | null
  valorant_mmr: number | null
  valorant_rank: string | null
  marvel_rivals_mmr: number | null
  marvel_rivals_rank: string | null
  discord_rank: string | null
  current_mmr: number | null
  expectedRank: string
  rankMismatch: boolean
}

interface HQClientProps {
  initialPlayers: PlayerWithStats[]
  mismatchCount: number
}

interface RefreshResult {
  success: boolean
  message: string
  totalPlayers: number
  updatedRanks: number
  updates: { id: string; oldRank: string; newRank: string; mmr: number; game: string }[]
  errors?: string[]
}

export function HQClient({ initialPlayers, mismatchCount }: HQClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null)
  const [selectedGame, setSelectedGame] = useState<'valorant' | 'marvel_rivals' | 'both'>('both')
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(false)

  const handleRefreshRanks = async () => {
    setIsRefreshing(true)
    setRefreshResult(null)
    
    try {
      const response = await fetch('/api/admin/refresh-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: selectedGame })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        setRefreshResult({
          success: false,
          message: result.error || 'Failed to refresh ranks',
          totalPlayers: 0,
          updatedRanks: 0,
          updates: []
        })
      } else {
        setRefreshResult(result)
      }
    } catch (error) {
      setRefreshResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        totalPlayers: 0,
        updatedRanks: 0,
        updates: []
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const filteredPlayers = showMismatchesOnly 
    ? initialPlayers.filter(p => p.rankMismatch)
    : initialPlayers

  return (
    <div className="space-y-8">
      {/* Actions Panel */}
      <div className="terminal-panel p-6">
        <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">&gt; ACTIONS</div>
        
        <div className="flex flex-wrap gap-4 items-center mb-6">
          {/* Game Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 font-mono">GAME:</span>
            <select
              value={selectedGame}
              onChange={(e) => setSelectedGame(e.target.value as typeof selectedGame)}
              className="bg-black/50 border border-white/20 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-red-500"
            >
              <option value="both">Both Games</option>
              <option value="valorant">Valorant Only</option>
              <option value="marvel_rivals">Marvel Rivals Only</option>
            </select>
          </div>
          
          {/* Refresh Button */}
          <motion.button
            onClick={handleRefreshRanks}
            disabled={isRefreshing}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-wider transition-all ${
              isRefreshing 
                ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                : 'bg-red-600 hover:bg-red-500 text-white'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'REFRESHING...' : 'REFRESH ALL RANKS'}
          </motion.button>
        </div>
        
        {/* Result Display */}
        {refreshResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-lg border ${
              refreshResult.success 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-red-500/10 border-red-500/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {refreshResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`font-bold ${refreshResult.success ? 'text-green-500' : 'text-red-500'}`}>
                {refreshResult.message}
              </span>
            </div>
            
            {refreshResult.success && (
              <div className="text-sm text-white/60 font-mono space-y-1">
                <div>Total Players: {refreshResult.totalPlayers}</div>
                <div>Ranks Updated: {refreshResult.updatedRanks}</div>
                
                {refreshResult.updates.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto">
                    <div className="text-[10px] text-white/40 uppercase mb-2">CHANGES:</div>
                    {refreshResult.updates.slice(0, 20).map((update, i) => (
                      <div key={i} className="text-xs py-1 border-b border-white/5">
                        <span className="text-white/80">{update.oldRank}</span>
                        <span className="text-white/40"> → </span>
                        <span className="text-green-500">{update.newRank}</span>
                        <span className="text-white/30 ml-2">({update.mmr} MMR, {update.game})</span>
                      </div>
                    ))}
                    {refreshResult.updates.length > 20 && (
                      <div className="text-xs text-white/40 mt-2">
                        ...and {refreshResult.updates.length - 20} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {refreshResult.errors && refreshResult.errors.length > 0 && (
              <div className="mt-3 text-sm text-red-400">
                <div className="text-[10px] text-red-500 uppercase mb-1">ERRORS:</div>
                {refreshResult.errors.slice(0, 5).map((err, i) => (
                  <div key={i} className="text-xs">{err}</div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
      
      {/* Players Table */}
      <div className="terminal-panel overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/40" />
            <span className="text-sm font-mono text-white/60">PLAYER DATABASE</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMismatchesOnly}
              onChange={(e) => setShowMismatchesOnly(e.target.checked)}
              className="form-checkbox bg-black border-white/20 text-red-500 rounded"
            />
            <span className="text-xs font-mono text-white/60">Show mismatches only ({mismatchCount})</span>
          </label>
        </div>
        
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/40 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase text-white/40">Player</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase text-white/40">Valorant MMR</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase text-white/40">Current Rank</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase text-white/40">Expected Rank</th>
                <th className="px-4 py-3 text-left text-[10px] font-mono uppercase text-white/40">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredPlayers.map((player) => (
                <tr key={player.id} className={`hover:bg-white/5 ${player.rankMismatch ? 'bg-red-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-white">{player.discord_username || 'Unknown'}</div>
                    {player.riot_name && player.riot_tag && (
                      <div className="text-xs text-white/40">{player.riot_name}#{player.riot_tag}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-white/80">
                    {player.valorant_mmr ?? player.current_mmr ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono ${player.rankMismatch ? 'text-red-400' : 'text-white/60'}`}>
                      {player.valorant_rank || player.discord_rank || 'Unranked'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-green-500">{player.expectedRank}</span>
                  </td>
                  <td className="px-4 py-3">
                    {player.rankMismatch ? (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Zap className="w-3 h-3" />
                        <span className="text-xs font-mono">MISMATCH</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-500">
                        <CheckCircle className="w-3 h-3" />
                        <span className="text-xs font-mono">OK</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Rank Thresholds Reference */}
      <div className="terminal-panel p-6">
        <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-4">&gt; RANK_THRESHOLDS</div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs font-mono">
          <div className="p-2 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded">
            <div className="text-[#ff8c00] font-bold">GRNDS I</div>
            <div className="text-white/40">0-299</div>
          </div>
          <div className="p-2 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded">
            <div className="text-[#ff8c00] font-bold">GRNDS II</div>
            <div className="text-white/40">300-599</div>
          </div>
          <div className="p-2 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded">
            <div className="text-[#ff8c00] font-bold">GRNDS III</div>
            <div className="text-white/40">600-899</div>
          </div>
          <div className="p-2 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded">
            <div className="text-[#ff8c00] font-bold">GRNDS IV</div>
            <div className="text-white/40">900-1199</div>
          </div>
          <div className="p-2 bg-[#ff8c00]/10 border border-[#ff8c00]/30 rounded">
            <div className="text-[#ff8c00] font-bold">GRNDS V</div>
            <div className="text-white/40">1200-1499</div>
          </div>
          <div className="p-2 bg-[#888]/10 border border-[#888]/30 rounded">
            <div className="text-[#888] font-bold">BREAK I</div>
            <div className="text-white/40">1500-1699</div>
          </div>
          <div className="p-2 bg-[#888]/10 border border-[#888]/30 rounded">
            <div className="text-[#888] font-bold">BREAK II</div>
            <div className="text-white/40">1700-1899</div>
          </div>
          <div className="p-2 bg-[#888]/10 border border-[#888]/30 rounded">
            <div className="text-[#888] font-bold">BREAK III</div>
            <div className="text-white/40">1900-2099</div>
          </div>
          <div className="p-2 bg-[#888]/10 border border-[#888]/30 rounded">
            <div className="text-[#888] font-bold">BREAK IV</div>
            <div className="text-white/40">2100-2299</div>
          </div>
          <div className="p-2 bg-[#888]/10 border border-[#888]/30 rounded">
            <div className="text-[#888] font-bold">BREAK V</div>
            <div className="text-white/40">2300-2399</div>
          </div>
          <div className="p-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded">
            <div className="text-[#dc2626] font-bold">CHAL I</div>
            <div className="text-white/40">2400-2499</div>
          </div>
          <div className="p-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded">
            <div className="text-[#dc2626] font-bold">CHAL II</div>
            <div className="text-white/40">2500-2599</div>
          </div>
          <div className="p-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded">
            <div className="text-[#dc2626] font-bold">CHAL III</div>
            <div className="text-white/40">2600-2999</div>
          </div>
          <div className="p-2 bg-white/10 border border-white/30 rounded">
            <div className="text-white font-bold">X</div>
            <div className="text-white/40">3000+</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-white/40 font-mono">
          Note: ABSOLUTE rank is position-based (#11-#20 leaderboard with 2600+ MMR)
        </div>
      </div>
    </div>
  )
}
