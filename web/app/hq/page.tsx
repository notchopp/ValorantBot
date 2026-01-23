import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { HQClient } from './HQClient'

// Force dynamic rendering
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Admin users who can access HQ
const ADMIN_USERS = [
  { discord_username: 'userneedsdrank' },
  { riot_name: 'rawl', riot_tag: 'shtt' },
]

function isAdmin(player: { discord_username?: string | null; riot_name?: string | null; riot_tag?: string | null }): boolean {
  return ADMIN_USERS.some(admin => {
    if (admin.discord_username && player.discord_username?.toLowerCase() === admin.discord_username.toLowerCase()) {
      return true
    }
    if (admin.riot_name && admin.riot_tag && 
        player.riot_name?.toLowerCase() === admin.riot_name.toLowerCase() &&
        player.riot_tag?.toLowerCase() === admin.riot_tag.toLowerCase()) {
      return true
    }
    return false
  })
}

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

// Rank thresholds matching database
const RANK_THRESHOLDS = [
  { min: 0, max: 299, rank: 'GRNDS I' },
  { min: 300, max: 599, rank: 'GRNDS II' },
  { min: 600, max: 899, rank: 'GRNDS III' },
  { min: 900, max: 1199, rank: 'GRNDS IV' },
  { min: 1200, max: 1499, rank: 'GRNDS V' },
  { min: 1500, max: 1699, rank: 'BREAKPOINT I' },
  { min: 1700, max: 1899, rank: 'BREAKPOINT II' },
  { min: 1900, max: 2099, rank: 'BREAKPOINT III' },
  { min: 2100, max: 2299, rank: 'BREAKPOINT IV' },
  { min: 2300, max: 2399, rank: 'BREAKPOINT V' },
  { min: 2400, max: 2499, rank: 'CHALLENGER I' },
  { min: 2500, max: 2599, rank: 'CHALLENGER II' },
  { min: 2600, max: 2999, rank: 'CHALLENGER III' },
  { min: 3000, max: 99999, rank: 'X' },
]

function getRankFromMMR(mmr: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (mmr >= threshold.min && mmr <= threshold.max) {
      return threshold.rank
    }
  }
  return 'GRNDS I'
}

export default async function HeadquartersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  const supabaseAdmin = getSupabaseAdminClient()
  
  // Get the current user's player data
  const { data: currentPlayer } = await supabaseAdmin
    .from('players')
    .select('discord_username, riot_name, riot_tag')
    .eq('id', user.id)
    .maybeSingle()
  
  if (!currentPlayer || !isAdmin(currentPlayer)) {
    redirect('/dashboard')
  }
  
  // Get all players with their stats
  interface PlayerRow {
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
  }
  
  const { data: players } = await supabaseAdmin
    .from('players')
    .select('id, discord_username, riot_name, riot_tag, valorant_mmr, valorant_rank, marvel_rivals_mmr, marvel_rivals_rank, discord_rank, current_mmr')
    .order('valorant_mmr', { ascending: false, nullsFirst: false }) as { data: PlayerRow[] | null }
  
  // Calculate expected ranks and find mismatches
  const playersWithStats: PlayerWithStats[] = (players || []).map(player => {
    const valorantMMR = player.valorant_mmr ?? player.current_mmr ?? 0
    const expectedRank = getRankFromMMR(valorantMMR)
    const currentRank = player.valorant_rank || player.discord_rank || 'Unranked'
    const rankMismatch = currentRank !== expectedRank && currentRank !== 'Unranked'
    
    return {
      ...player,
      expectedRank,
      rankMismatch
    }
  })
  
  const mismatchCount = playersWithStats.filter(p => p.rankMismatch).length
  const totalPlayers = playersWithStats.length
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10 pt-24 md:pt-28">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <div className="terminal-prompt text-[10px] uppercase tracking-wider mb-2">&gt; ADMIN_HEADQUARTERS</div>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter leading-none uppercase">
            Head
            <br />
            <span className="text-red-500">quarters</span>
          </h1>
          <p className="text-base md:text-lg text-white/60 font-light mb-8 max-w-2xl font-mono">
            Admin controls for the GRNDS rank system. Manage players and sync ranks.
          </p>
        </div>
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
          <div className="terminal-panel p-6">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2">TOTAL_PLAYERS</div>
            <div className="text-3xl md:text-5xl font-black text-white tabular-nums">{totalPlayers}</div>
          </div>
          <div className="terminal-panel p-6">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2">RANK_MISMATCHES</div>
            <div className={`text-3xl md:text-5xl font-black tabular-nums ${mismatchCount > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {mismatchCount}
            </div>
          </div>
          <div className="terminal-panel p-6">
            <div className="text-[10px] text-[var(--term-muted)] uppercase tracking-wider mb-2">STATUS</div>
            <div className={`text-xl font-bold ${mismatchCount > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
              {mismatchCount > 0 ? 'SYNC NEEDED' : 'ALL SYNCED'}
            </div>
          </div>
        </div>
        
        {/* Client component for interactive features */}
        <HQClient initialPlayers={playersWithStats} mismatchCount={mismatchCount} />
      </div>
    </div>
  )
}
