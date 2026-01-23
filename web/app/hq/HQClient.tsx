'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Users, Zap, Terminal, Database, Shield } from 'lucide-react'

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
  updatedRanks?: number
  updated?: number
  skipped?: number
  pendingRoleUpdates?: number
  updates: { 
    id: string
    username?: string
    oldRank: string
    newRank: string
    mmr?: number
    oldMMR?: number
    newMMR?: number
    sourceRank?: string
    valorantRank?: string
    game: string 
  }[]
  skippedDetails?: string[]
  errors?: string[]
}

export function HQClient({ initialPlayers, mismatchCount }: HQClientProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null)
  const [selectedGame, setSelectedGame] = useState<'valorant' | 'marvel_rivals' | 'both'>('valorant')
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '> SYSTEM INITIALIZED',
    '> AWAITING COMMAND...',
  ])

  const addTerminalLine = (line: string) => {
    setTerminalOutput(prev => [...prev.slice(-50), line])
  }

  const handleRefreshRanks = async () => {
    setIsRefreshing(true)
    setRefreshResult(null)
    addTerminalLine(`> EXECUTING: FIX_RANK_LABELS --game=${selectedGame}`)
    
    try {
      const response = await fetch('/api/admin/refresh-ranks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: selectedGame })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        addTerminalLine(`> ERROR: ${result.error || 'Failed to refresh ranks'}`)
        setRefreshResult({
          success: false,
          message: result.error || 'Failed to refresh ranks',
          totalPlayers: 0,
          updatedRanks: 0,
          updates: []
        })
      } else {
        addTerminalLine(`> SUCCESS: ${result.updatedRanks || 0} ranks updated`)
        setRefreshResult(result)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      addTerminalLine(`> FATAL: ${msg}`)
      setRefreshResult({
        success: false,
        message: msg,
        totalPlayers: 0,
        updatedRanks: 0,
        updates: []
      })
    } finally {
      setIsRefreshing(false)
      addTerminalLine('> READY')
    }
  }

  const handleRecalculateMMR = async () => {
    if (!confirm(`RECALCULATE MMR FROM API\n\nThis will:\n1. Pull fresh rank data from ${selectedGame === 'both' ? 'Valorant & Marvel Rivals APIs' : selectedGame === 'valorant' ? 'Valorant API' : 'Marvel Rivals API'}\n2. Recalculate MMR (capped at GRNDS V / 1499)\n3. Update database\n4. Queue Discord role updates\n\nThis may take several minutes. Continue?`)) {
      return
    }
    
    setIsRecalculating(true)
    setRefreshResult(null)
    addTerminalLine(`> EXECUTING: RECALCULATE_MMR --game=${selectedGame} --source=API`)
    addTerminalLine(`> CONNECTING TO EXTERNAL APIS...`)
    
    try {
      const response = await fetch('/api/admin/recalculate-mmr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: selectedGame })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        addTerminalLine(`> ERROR: ${result.error || 'Failed to recalculate MMR'}`)
        setRefreshResult({
          success: false,
          message: result.error || 'Failed to recalculate MMR',
          totalPlayers: 0,
          updates: []
        })
      } else {
        addTerminalLine(`> SUCCESS: ${result.updated || 0} players updated`)
        addTerminalLine(`> SKIPPED: ${result.skipped || 0} players`)
        if (result.pendingRoleUpdates) {
          addTerminalLine(`> ROLE_UPDATES_QUEUED: ${result.pendingRoleUpdates}`)
        }
        setRefreshResult(result)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      addTerminalLine(`> FATAL: ${msg}`)
      setRefreshResult({
        success: false,
        message: msg,
        totalPlayers: 0,
        updates: []
      })
    } finally {
      setIsRecalculating(false)
      addTerminalLine('> READY')
    }
  }

  const filteredPlayers = showMismatchesOnly 
    ? initialPlayers.filter(p => p.rankMismatch)
    : initialPlayers

  return (
    <div className="space-y-6 font-mono">
      {/* Terminal Output */}
      <div className="bg-black border border-[var(--term-border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--term-bg)] border-b border-[var(--term-border)]">
          <Terminal className="w-4 h-4 text-[var(--term-green)]" />
          <span className="text-xs text-[var(--term-muted)] uppercase tracking-wider">SYSTEM_LOG</span>
        </div>
        <div className="p-4 h-32 overflow-y-auto text-xs leading-relaxed bg-black/80">
          {terminalOutput.map((line, i) => (
            <div 
              key={i} 
              className={`${
                line.includes('ERROR') || line.includes('FATAL') ? 'text-red-500' :
                line.includes('SUCCESS') ? 'text-[var(--term-green)]' :
                line.includes('EXECUTING') ? 'text-yellow-500' :
                'text-[var(--term-text)]'
              }`}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Actions Panel */}
      <div className="bg-black border border-[var(--term-border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--term-bg)] border-b border-[var(--term-border)]">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-xs text-[var(--term-muted)] uppercase tracking-wider">ADMIN_ACTIONS</span>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Game Selector */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs text-[var(--term-muted)]">TARGET_GAME:</span>
            <div className="flex gap-2">
              {(['valorant', 'marvel_rivals', 'both'] as const).map(game => (
                <button
                  key={game}
                  onClick={() => setSelectedGame(game)}
                  className={`px-3 py-1.5 text-xs uppercase tracking-wider border rounded transition-all ${
                    selectedGame === game
                      ? 'bg-[var(--term-green)] text-black border-[var(--term-green)] font-bold'
                      : 'bg-transparent text-[var(--term-muted)] border-[var(--term-border)] hover:border-[var(--term-green)] hover:text-[var(--term-green)]'
                  }`}
                >
                  {game === 'both' ? 'BOTH' : game === 'valorant' ? 'VALORANT' : 'MARVEL_RIVALS'}
                </button>
              ))}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefreshRanks}
              disabled={isRefreshing || isRecalculating}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider border rounded transition-all ${
                isRefreshing || isRecalculating
                  ? 'bg-[var(--term-bg)] text-[var(--term-muted)] border-[var(--term-border)] cursor-not-allowed' 
                  : 'bg-transparent text-white border-white/30 hover:bg-white hover:text-black'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'PROCESSING...' : 'FIX_RANK_LABELS'}
            </button>
            
            <button
              onClick={handleRecalculateMMR}
              disabled={isRefreshing || isRecalculating}
              className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider border rounded transition-all ${
                isRefreshing || isRecalculating
                  ? 'bg-[var(--term-bg)] text-[var(--term-muted)] border-[var(--term-border)] cursor-not-allowed' 
                  : 'bg-red-600 text-white border-red-600 hover:bg-red-500'
              }`}
            >
              <Database className={`w-3 h-3 ${isRecalculating ? 'animate-pulse' : ''}`} />
              {isRecalculating ? 'FETCHING_API_DATA...' : 'RECALCULATE_MMR_FROM_API'}
            </button>
          </div>
          
          <div className="text-[10px] text-[var(--term-muted)] leading-relaxed">
            <p>• FIX_RANK_LABELS: Updates rank names based on existing MMR values</p>
            <p>• RECALCULATE_MMR: Pulls fresh rank from game APIs, recalculates MMR (capped at GRNDS V / 1499 MMR)</p>
          </div>
        </div>
      </div>
      
      {/* Result Display */}
      {refreshResult && (
        <div className={`bg-black border rounded-lg overflow-hidden ${
          refreshResult.success ? 'border-[var(--term-green)]' : 'border-red-500'
        }`}>
          <div className={`flex items-center gap-2 px-4 py-2 border-b ${
            refreshResult.success ? 'bg-[var(--term-green)]/10 border-[var(--term-green)]' : 'bg-red-500/10 border-red-500'
          }`}>
            {refreshResult.success ? (
              <CheckCircle className="w-4 h-4 text-[var(--term-green)]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-xs uppercase tracking-wider ${
              refreshResult.success ? 'text-[var(--term-green)]' : 'text-red-500'
            }`}>
              {refreshResult.message}
            </span>
          </div>
          
          <div className="p-4 text-xs space-y-3">
            {refreshResult.success && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[var(--term-muted)]">TOTAL:</span>
                    <span className="ml-2 text-white">{refreshResult.totalPlayers}</span>
                  </div>
                  <div>
                    <span className="text-[var(--term-muted)]">UPDATED:</span>
                    <span className="ml-2 text-[var(--term-green)]">{refreshResult.updatedRanks ?? refreshResult.updated ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[var(--term-muted)]">SKIPPED:</span>
                    <span className="ml-2 text-yellow-500">{refreshResult.skipped ?? 0}</span>
                  </div>
                  {refreshResult.pendingRoleUpdates !== undefined && (
                    <div>
                      <span className="text-[var(--term-muted)]">ROLE_QUEUE:</span>
                      <span className="ml-2 text-blue-400">{refreshResult.pendingRoleUpdates}</span>
                    </div>
                  )}
                </div>
                
                {refreshResult.updates.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[var(--term-muted)] mb-2">CHANGES:</div>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-black/50 p-2 rounded border border-[var(--term-border)]">
                      {refreshResult.updates.slice(0, 25).map((update, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className={`px-1 rounded ${
                            update.game === 'valorant' ? 'bg-red-500/20 text-red-400' : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {update.game === 'valorant' ? 'VAL' : 'MR'}
                          </span>
                          <span className="text-white/80">{update.username}:</span>
                          <span className="text-white/50">{update.oldRank}</span>
                          <span className="text-[var(--term-muted)]">→</span>
                          <span className="text-[var(--term-green)]">{update.newRank}</span>
                          {update.oldMMR !== undefined && update.newMMR !== undefined && (
                            <span className="text-white/30">({update.oldMMR}→{update.newMMR})</span>
                          )}
                          {update.sourceRank && (
                            <span className="text-yellow-500/60">[{update.sourceRank}]</span>
                          )}
                        </div>
                      ))}
                      {refreshResult.updates.length > 25 && (
                        <div className="text-[var(--term-muted)] pt-1">...+{refreshResult.updates.length - 25} more</div>
                      )}
                    </div>
                  </div>
                )}
                
                {refreshResult.skippedDetails && refreshResult.skippedDetails.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[var(--term-muted)] mb-2">SKIPPED_DETAILS:</div>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-black/50 p-2 rounded border border-[var(--term-border)]">
                      {refreshResult.skippedDetails.slice(0, 15).map((msg, i) => (
                        <div key={i} className="text-[10px] text-white/40">{msg}</div>
                      ))}
                      {refreshResult.skippedDetails.length > 15 && (
                        <div className="text-[var(--term-muted)] pt-1">...+{refreshResult.skippedDetails.length - 15} more</div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {refreshResult.errors && refreshResult.errors.length > 0 && (
              <div className="mt-4">
                <div className="text-red-500 mb-2">ERRORS:</div>
                <div className="space-y-1">
                  {refreshResult.errors.slice(0, 5).map((err, i) => (
                    <div key={i} className="text-[10px] text-red-400">{err}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Players Database */}
      <div className="bg-black border border-[var(--term-border)] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--term-bg)] border-b border-[var(--term-border)]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--term-muted)]" />
            <span className="text-xs text-[var(--term-muted)] uppercase tracking-wider">PLAYER_DATABASE</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMismatchesOnly}
              onChange={(e) => setShowMismatchesOnly(e.target.checked)}
              className="w-3 h-3 bg-black border border-[var(--term-border)] rounded text-[var(--term-green)] focus:ring-0"
            />
            <span className="text-[10px] text-[var(--term-muted)]">SHOW_MISMATCHES_ONLY ({mismatchCount})</span>
          </label>
        </div>
        
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--term-bg)] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-[var(--term-muted)]">PLAYER</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-[var(--term-muted)]">VAL_MMR</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-[var(--term-muted)]">CURRENT</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-[var(--term-muted)]">EXPECTED</th>
                <th className="px-3 py-2 text-left text-[10px] uppercase text-[var(--term-muted)]">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--term-border)]">
              {filteredPlayers.map((player) => (
                <tr key={player.id} className={`hover:bg-white/5 ${player.rankMismatch ? 'bg-red-500/5' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="text-white">{player.discord_username || 'NULL'}</div>
                    {player.riot_name && player.riot_tag && (
                      <div className="text-[10px] text-[var(--term-muted)]">{player.riot_name}#{player.riot_tag}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-white/80 tabular-nums">
                    {player.valorant_mmr ?? player.current_mmr ?? 0}
                  </td>
                  <td className="px-3 py-2">
                    <span className={player.rankMismatch ? 'text-red-400' : 'text-white/60'}>
                      {player.valorant_rank || player.discord_rank || 'NULL'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-[var(--term-green)]">{player.expectedRank}</span>
                  </td>
                  <td className="px-3 py-2">
                    {player.rankMismatch ? (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <Zap className="w-3 h-3" />
                        <span className="text-[10px]">MISMATCH</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--term-green)]">
                        <CheckCircle className="w-3 h-3" />
                        <span className="text-[10px]">OK</span>
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
      <div className="bg-black border border-[var(--term-border)] rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--term-bg)] border-b border-[var(--term-border)]">
          <Shield className="w-4 h-4 text-[var(--term-muted)]" />
          <span className="text-xs text-[var(--term-muted)] uppercase tracking-wider">RANK_THRESHOLDS</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2 text-[10px]">
            {[
              { rank: 'GRNDS I', range: '0-299', color: '#ff8c00' },
              { rank: 'GRNDS II', range: '300-599', color: '#ff8c00' },
              { rank: 'GRNDS III', range: '600-899', color: '#ff8c00' },
              { rank: 'GRNDS IV', range: '900-1199', color: '#ff8c00' },
              { rank: 'GRNDS V', range: '1200-1499', color: '#ff8c00' },
              { rank: 'BREAK I', range: '1500-1699', color: '#888' },
              { rank: 'BREAK II', range: '1700-1899', color: '#888' },
              { rank: 'BREAK III', range: '1900-2099', color: '#888' },
              { rank: 'BREAK IV', range: '2100-2299', color: '#888' },
              { rank: 'BREAK V', range: '2300-2399', color: '#888' },
              { rank: 'CHAL I', range: '2400-2499', color: '#dc2626' },
              { rank: 'CHAL II', range: '2500-2599', color: '#dc2626' },
              { rank: 'CHAL III', range: '2600-2999', color: '#dc2626' },
              { rank: 'X', range: '3000+', color: '#fff' },
            ].map(({ rank, range, color }) => (
              <div key={rank} className="p-2 border rounded" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
                <div className="font-bold" style={{ color }}>{rank}</div>
                <div className="text-white/40">{range}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-[var(--term-muted)]">
            NOTE: Initial placement capped at GRNDS V (1499 MMR). ABSOLUTE = position-based (#11-#20 @ 2600+ MMR)
          </div>
        </div>
      </div>
    </div>
  )
}
