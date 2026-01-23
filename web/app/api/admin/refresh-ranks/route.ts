import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// Rank thresholds matching database migration 014
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdminClient()
    
    // Get the current user's player data to check if admin
    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('discord_username, riot_name, riot_tag')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!currentPlayer || !isAdmin(currentPlayer)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { game } = body as { game: 'valorant' | 'marvel_rivals' | 'both' }

    // Get all players
    interface PlayerRow {
      id: string
      discord_username: string | null
      valorant_mmr: number | null
      valorant_rank: string | null
      marvel_rivals_mmr: number | null
      marvel_rivals_rank: string | null
      current_mmr: number | null
      discord_rank: string | null
    }
    
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, discord_username, valorant_mmr, valorant_rank, marvel_rivals_mmr, marvel_rivals_rank, current_mmr, discord_rank') as { data: PlayerRow[] | null; error: unknown }
    
    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    const updates: { id: string; oldRank: string; newRank: string; mmr: number; game: string }[] = []
    const errors: string[] = []

    for (const player of players || []) {
      try {
        const updateData: Record<string, string> = {}
        
        // Update Valorant ranks
        if (game === 'valorant' || game === 'both') {
          const valorantMMR = player.valorant_mmr ?? player.current_mmr ?? 0
          const correctValorantRank = getRankFromMMR(valorantMMR)
          
          if (player.valorant_rank !== correctValorantRank) {
            updateData.valorant_rank = correctValorantRank
            updates.push({
              id: player.id,
              oldRank: player.valorant_rank || 'Unranked',
              newRank: correctValorantRank,
              mmr: valorantMMR,
              game: 'valorant'
            })
          }
          
          // Also update discord_rank to match highest MMR game
          const marvelMMR = player.marvel_rivals_mmr ?? 0
          const highestMMR = Math.max(valorantMMR, marvelMMR)
          const correctDiscordRank = getRankFromMMR(highestMMR)
          if (player.discord_rank !== correctDiscordRank) {
            updateData.discord_rank = correctDiscordRank
          }
        }
        
        // Update Marvel Rivals ranks
        if (game === 'marvel_rivals' || game === 'both') {
          const marvelMMR = player.marvel_rivals_mmr ?? 0
          const correctMarvelRank = getRankFromMMR(marvelMMR)
          
          if (player.marvel_rivals_rank !== correctMarvelRank && marvelMMR > 0) {
            updateData.marvel_rivals_rank = correctMarvelRank
            updates.push({
              id: player.id,
              oldRank: player.marvel_rivals_rank || 'Unranked',
              newRank: correctMarvelRank,
              mmr: marvelMMR,
              game: 'marvel_rivals'
            })
          }
        }
        
        // Apply updates if any
        if (Object.keys(updateData).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: updateError } = await (supabaseAdmin as any)
            .from('players')
            .update(updateData)
            .eq('id', player.id)
          
          if (updateError) {
            errors.push(`Failed to update ${player.discord_username}: ${(updateError as Error).message}`)
          }
        }
      } catch (err) {
        errors.push(`Error processing ${player.discord_username}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Rank refresh complete`,
      totalPlayers: players?.length || 0,
      updatedRanks: updates.length,
      updates,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error refreshing ranks:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
