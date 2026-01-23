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

const GRNDS_V_MAX_MMR = 1499 // Cap for initial placement at GRNDS V

function getRankFromMMR(mmr: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (mmr >= threshold.min && mmr <= threshold.max) {
      return threshold.rank
    }
  }
  return 'GRNDS I'
}

/**
 * Calculate initial MMR based on Valorant rank and ELO (capped at GRNDS V)
 */
function calculateInitialMMR(valorantRank: string, valorantELO: number): number {
  try {
    const rankMMRMap: Record<string, { min: number; max: number }> = {
      'Iron 1': { min: 0, max: 150 }, 'Iron 2': { min: 100, max: 250 }, 'Iron 3': { min: 200, max: 350 },
      'Bronze 1': { min: 300, max: 450 }, 'Bronze 2': { min: 350, max: 500 }, 'Bronze 3': { min: 450, max: 599 },
      'Silver 1': { min: 500, max: 650 }, 'Silver 2': { min: 600, max: 750 }, 'Silver 3': { min: 700, max: 899 },
      'Gold 1': { min: 450, max: 599 }, 'Gold 2': { min: 600, max: 899 }, 'Gold 3': { min: 900, max: 1199 },
      'Platinum 1': { min: 900, max: 1099 }, 'Platinum 2': { min: 1100, max: 1299 }, 'Platinum 3': { min: 1200, max: 1499 },
      'Diamond 1': { min: 1250, max: 1499 }, 'Diamond 2': { min: 1300, max: 1499 }, 'Diamond 3': { min: 1350, max: 1499 },
      'Ascendant 1': { min: 1350, max: 1499 }, 'Ascendant 2': { min: 1400, max: 1499 }, 'Ascendant 3': { min: 1450, max: 1499 },
      'Immortal 1': { min: 1450, max: 1499 }, 'Immortal 2': { min: 1450, max: 1499 }, 'Immortal 3': { min: 1450, max: 1499 },
      'Radiant': { min: 1450, max: 1499 },
    }

    const range = rankMMRMap[valorantRank] || { min: 0, max: 200 }
    const normalizedELO = Math.min(Math.max(valorantELO, 0), 5000)
    const eloPercentage = normalizedELO / 5000
    const baseMMR = range.min + Math.round((range.max - range.min) * eloPercentage)
    
    return Math.min(baseMMR, GRNDS_V_MAX_MMR)
  } catch (error) {
    console.error('Error calculating initial MMR', { valorantRank, valorantELO, error })
    return 100 // Safe fallback
  }
}

/**
 * Fetch Valorant MMR using PUUID (v3 API like verify-account.ts)
 */
async function fetchValorantMMR(puuid: string, region: string): Promise<{ rank: string; elo: number } | null> {
  try {
    const apiRegion = region === 'latam' || region === 'br' ? 'na' : region
    const platform = 'pc'
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'GRNDS-Bot/1.0',
    }
    
    // Add API key if available
    if (process.env.VALORANT_API_KEY) {
      headers['Authorization'] = process.env.VALORANT_API_KEY
    }
    
    const response = await fetch(
      `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${apiRegion}/${platform}/${puuid}`,
      { headers, next: { revalidate: 0 } }
    )
    
    if (!response.ok) {
      console.error(`MMR API error: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    const mmrData = data?.data
    
    if (!mmrData) {
      return null
    }
    
    // Map v3 response structure
    const rank = mmrData.current?.tier?.name || 'Unrated'
    const elo = mmrData.current?.elo || 0
    
    // Check if unrated
    if (!rank || rank.toLowerCase().includes('unrated')) {
      return null
    }
    
    return { rank, elo }
  } catch (error) {
    console.error('Error fetching Valorant MMR:', error)
    return null
  }
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

    // Get all players with riot credentials
    interface PlayerRow {
      id: string
      discord_username: string | null
      riot_name: string | null
      riot_tag: string | null
      riot_puuid: string | null
      riot_region: string | null
      valorant_mmr: number | null
      valorant_rank: string | null
      marvel_rivals_mmr: number | null
      marvel_rivals_rank: string | null
      current_mmr: number | null
      discord_rank: string | null
    }
    
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, discord_username, riot_name, riot_tag, riot_puuid, riot_region, valorant_mmr, valorant_rank, marvel_rivals_mmr, marvel_rivals_rank, current_mmr, discord_rank') as { data: PlayerRow[] | null; error: unknown }
    
    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    const updates: { 
      id: string
      username: string
      oldMMR: number
      newMMR: number
      oldRank: string
      newRank: string
      valorantRank: string
      game: string 
    }[] = []
    const errors: string[] = []
    const skipped: string[] = []

    for (const player of players || []) {
      try {
        // Only process Valorant for now (Marvel Rivals API would need separate implementation)
        if ((game === 'valorant' || game === 'both') && player.riot_puuid) {
          // Use stored PUUID to fetch fresh rank from Valorant API
          const valorantData = await fetchValorantMMR(
            player.riot_puuid,
            player.riot_region || 'na'
          )
          
          if (!valorantData) {
            skipped.push(`${player.discord_username} (${player.riot_name}#${player.riot_tag}): Could not fetch Valorant data`)
            continue
          }
          
          // Calculate new MMR from fresh Valorant rank
          const newMMR = calculateInitialMMR(valorantData.rank, valorantData.elo)
          const newRank = getRankFromMMR(newMMR)
          const oldMMR = player.valorant_mmr ?? player.current_mmr ?? 0
          const oldRank = player.valorant_rank || player.discord_rank || 'Unranked'
          
          // Only update if MMR changed
          if (newMMR !== oldMMR) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await (supabaseAdmin as any)
              .from('players')
              .update({
                valorant_mmr: newMMR,
                valorant_rank: newRank,
                current_mmr: newMMR,
                discord_rank: newRank,
              })
              .eq('id', player.id)
            
            if (updateError) {
              errors.push(`Failed to update ${player.discord_username}: ${(updateError as Error).message}`)
            } else {
              updates.push({
                id: player.id,
                username: player.discord_username || 'Unknown',
                oldMMR,
                newMMR,
                oldRank,
                newRank,
                valorantRank: valorantData.rank,
                game: 'valorant'
              })
            }
          } else {
            skipped.push(`${player.discord_username}: MMR unchanged (${oldMMR})`)
          }
          
          // Rate limit - wait 500ms between API calls to avoid hitting rate limits
          await new Promise(resolve => setTimeout(resolve, 500))
        } else if (!player.riot_puuid) {
          skipped.push(`${player.discord_username}: No PUUID stored`)
        }
      } catch (err) {
        errors.push(`Error processing ${player.discord_username}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `MMR recalculation complete`,
      totalPlayers: players?.length || 0,
      updated: updates.length,
      skipped: skipped.length,
      updates,
      skippedDetails: skipped.length > 0 ? skipped.slice(0, 20) : undefined,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error recalculating MMR:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
