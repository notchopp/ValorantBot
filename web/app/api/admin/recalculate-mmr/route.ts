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
function calculateInitialMMRFromValorant(valorantRank: string, valorantELO: number): number {
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
    return 100
  }
}

/**
 * Calculate initial MMR based on Marvel Rivals rank (capped at GRNDS V)
 */
function calculateInitialMMRFromMarvelRivals(rank: string | undefined): number {
  if (!rank) return 0
  
  // Marvel Rivals rank to MMR mapping (capped at GRNDS V = 1499)
  const rankMMRMap: Record<string, number> = {
    'Bronze III': 0, 'Bronze II': 100, 'Bronze I': 200,
    'Silver III': 300, 'Silver II': 400, 'Silver I': 500,
    'Gold III': 600, 'Gold II': 700, 'Gold I': 800,
    'Platinum III': 900, 'Platinum II': 1000, 'Platinum I': 1100,
    'Diamond III': 1200, 'Diamond II': 1300, 'Diamond I': 1400,
    'Grandmaster III': 1450, 'Grandmaster II': 1475, 'Grandmaster I': 1499,
    'Celestial III': 1499, 'Celestial II': 1499, 'Celestial I': 1499,
    'One Above All': 1499, 'Eternity': 1499,
  }
  
  return Math.min(rankMMRMap[rank] ?? 0, GRNDS_V_MAX_MMR)
}

// ============ VALORANT API ============

interface ValorantMMRResult {
  rank: string
  elo: number
  error?: string
}

/**
 * Fetch Valorant MMR using PUUID (v3 API)
 */
async function fetchValorantMMR(puuid: string, region: string): Promise<ValorantMMRResult | null> {
  try {
    const apiRegion = region === 'latam' || region === 'br' ? 'na' : region
    const platform = 'pc'
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'GRNDS-Bot/1.0',
    }
    
    if (process.env.VALORANT_API_KEY) {
      headers['Authorization'] = process.env.VALORANT_API_KEY
    }
    
    const url = `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${apiRegion}/${platform}/${puuid}`
    const response = await fetch(url, { headers, cache: 'no-store' })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { rank: '', elo: 0, error: `API ${response.status}: ${errorText.substring(0, 100)}` }
    }
    
    const data = await response.json()
    const mmrData = data?.data
    
    if (!mmrData) {
      return { rank: '', elo: 0, error: 'No data in response' }
    }
    
    const rank = mmrData.current?.tier?.name || ''
    const elo = mmrData.current?.elo || 0
    const gamesNeeded = mmrData.current?.games_needed_for_rating || 0
    
    // Check if unrated or in placements
    if (!rank || rank.toLowerCase().includes('unrated') || gamesNeeded > 0) {
      // Try to get MMR history for last ranked match
      return await fetchValorantMMRHistory(puuid, region)
    }
    
    return { rank, elo }
  } catch (error) {
    return { rank: '', elo: 0, error: `Exception: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * Fetch Valorant MMR history to find last ranked match (for unranked/placement players)
 */
async function fetchValorantMMRHistory(puuid: string, region: string): Promise<ValorantMMRResult | null> {
  try {
    const apiRegion = region === 'latam' || region === 'br' ? 'na' : region
    const platform = 'pc'
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'GRNDS-Bot/1.0',
    }
    
    if (process.env.VALORANT_API_KEY) {
      headers['Authorization'] = process.env.VALORANT_API_KEY
    }
    
    const url = `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr-history/${apiRegion}/${platform}/${puuid}`
    const response = await fetch(url, { headers, cache: 'no-store' })
    
    if (!response.ok) {
      return { rank: '', elo: 0, error: 'In placements, no history available' }
    }
    
    const data = await response.json()
    const history = data?.data?.history
    
    if (history && history.length > 0) {
      // Find last ranked match with tier data
      const lastRanked = history.find((entry: { tier?: { id?: number; name?: string }; elo?: number }) => entry.tier && entry.tier.id && entry.tier.id > 0)
      
      if (lastRanked) {
        return { rank: lastRanked.tier.name, elo: lastRanked.elo || 0 }
      }
    }
    
    // No ranked history - return as truly unranked
    return { rank: 'Unranked', elo: 0, error: 'Never been ranked' }
  } catch (error) {
    return { rank: '', elo: 0, error: `History fetch failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// ============ MARVEL RIVALS API ============

interface MarvelRivalsResult {
  rank: string
  error?: string
}

/**
 * Fetch Marvel Rivals rank using UID
 */
async function fetchMarvelRivalsRank(uid: string): Promise<MarvelRivalsResult | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'GRNDS-Bot/1.0',
    }
    
    if (process.env.MARVEL_RIVALS_API_KEY) {
      headers['x-api-key'] = process.env.MARVEL_RIVALS_API_KEY
    }
    
    const url = `https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(uid)}`
    const response = await fetch(url, { headers, cache: 'no-store' })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { rank: '', error: `API ${response.status}: ${errorText.substring(0, 100)}` }
    }
    
    const data = await response.json()
    const playerData = data?.data || data
    
    if (!playerData) {
      return { rank: '', error: 'No data in response' }
    }
    
    const rank = playerData.rank || playerData.tier || ''
    
    if (!rank) {
      return { rank: '', error: 'No rank data found' }
    }
    
    return { rank }
  } catch (error) {
    return { rank: '', error: `Exception: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// ============ ADMIN CHECK ============

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

// ============ MAIN ENDPOINT ============

interface PlayerRow {
  id: string
  discord_user_id: string | null
  discord_username: string | null
  riot_name: string | null
  riot_tag: string | null
  riot_puuid: string | null
  riot_region: string | null
  valorant_mmr: number | null
  valorant_rank: string | null
  marvel_rivals_uid: string | null
  marvel_rivals_username: string | null
  marvel_rivals_mmr: number | null
  marvel_rivals_rank: string | null
  current_mmr: number | null
  discord_rank: string | null
}

interface UpdateRecord {
  id: string
  discordUserId: string | null
  username: string
  oldMMR: number
  newMMR: number
  oldRank: string
  newRank: string
  sourceRank: string
  game: string
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
    const { data: players, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id, discord_user_id, discord_username, riot_name, riot_tag, riot_puuid, riot_region, valorant_mmr, valorant_rank, marvel_rivals_uid, marvel_rivals_username, marvel_rivals_mmr, marvel_rivals_rank, current_mmr, discord_rank') as { data: PlayerRow[] | null; error: unknown }
    
    if (playersError) {
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    const updates: UpdateRecord[] = []
    const roleUpdates: { discordUserId: string; oldRank: string; newRank: string }[] = []
    const errors: string[] = []
    const skipped: string[] = []

    for (const player of players || []) {
      try {
        // ============ VALORANT ============
        if ((game === 'valorant' || game === 'both') && player.riot_puuid) {
          const valorantData = await fetchValorantMMR(player.riot_puuid, player.riot_region || 'na')
          
          if (!valorantData || valorantData.error) {
            if (valorantData?.rank === 'Unranked') {
              // Truly unranked - set to GRNDS I
              const newMMR = 0
              const newRank = 'GRNDS I'
              const oldMMR = player.valorant_mmr ?? 0
              const oldRank = player.valorant_rank || 'Unranked'
              
              if (newMMR !== oldMMR || newRank !== oldRank) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabaseAdmin as any)
                  .from('players')
                  .update({
                    valorant_mmr: newMMR,
                    valorant_rank: newRank,
                    current_mmr: newMMR,
                    discord_rank: newRank,
                  })
                  .eq('id', player.id)
                
                updates.push({
                  id: player.id,
                  discordUserId: player.discord_user_id,
                  username: player.discord_username || 'Unknown',
                  oldMMR,
                  newMMR,
                  oldRank,
                  newRank,
                  sourceRank: 'Unranked',
                  game: 'valorant'
                })
                
                if (player.discord_user_id && oldRank !== newRank) {
                  roleUpdates.push({ discordUserId: player.discord_user_id, oldRank, newRank })
                }
              }
            } else {
              skipped.push(`${player.discord_username} (${player.riot_name}#${player.riot_tag}): ${valorantData?.error || 'Unknown error'}`)
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
          
          // Calculate new MMR (capped at GRNDS V = 1499)
          const newMMR = calculateInitialMMRFromValorant(valorantData.rank, valorantData.elo)
          const newRank = getRankFromMMR(newMMR)
          const oldMMR = player.valorant_mmr ?? player.current_mmr ?? 0
          const oldRank = player.valorant_rank || player.discord_rank || 'Unranked'
          
          if (newMMR !== oldMMR || newRank !== oldRank) {
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
                discordUserId: player.discord_user_id,
                username: player.discord_username || 'Unknown',
                oldMMR,
                newMMR,
                oldRank,
                newRank,
                sourceRank: valorantData.rank,
                game: 'valorant'
              })
              
              if (player.discord_user_id && oldRank !== newRank) {
                roleUpdates.push({ discordUserId: player.discord_user_id, oldRank, newRank })
              }
            }
          } else {
            skipped.push(`${player.discord_username}: MMR unchanged (${oldMMR})`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else if ((game === 'valorant' || game === 'both') && !player.riot_puuid) {
          if (game === 'valorant') {
            skipped.push(`${player.discord_username}: No PUUID stored`)
          }
        }
        
        // ============ MARVEL RIVALS ============
        if ((game === 'marvel_rivals' || game === 'both') && player.marvel_rivals_uid) {
          const mrData = await fetchMarvelRivalsRank(player.marvel_rivals_uid)
          
          if (!mrData || mrData.error || !mrData.rank) {
            skipped.push(`${player.discord_username} (MR: ${player.marvel_rivals_username}): ${mrData?.error || 'No rank data'}`)
            await new Promise(resolve => setTimeout(resolve, 2000))
            continue
          }
          
          // Calculate new MMR (capped at GRNDS V = 1499)
          const newMMR = calculateInitialMMRFromMarvelRivals(mrData.rank)
          const newRank = getRankFromMMR(newMMR)
          const oldMMR = player.marvel_rivals_mmr ?? 0
          const oldRank = player.marvel_rivals_rank || 'Unranked'
          
          if (newMMR !== oldMMR || newRank !== oldRank) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await (supabaseAdmin as any)
              .from('players')
              .update({
                marvel_rivals_mmr: newMMR,
                marvel_rivals_rank: newRank,
              })
              .eq('id', player.id)
            
            if (updateError) {
              errors.push(`Failed to update ${player.discord_username} MR: ${(updateError as Error).message}`)
            } else {
              updates.push({
                id: player.id,
                discordUserId: player.discord_user_id,
                username: player.discord_username || 'Unknown',
                oldMMR,
                newMMR,
                oldRank,
                newRank,
                sourceRank: mrData.rank,
                game: 'marvel_rivals'
              })
            }
          } else {
            skipped.push(`${player.discord_username} (MR): MMR unchanged (${oldMMR})`)
          }
          
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else if ((game === 'marvel_rivals' || game === 'both') && !player.marvel_rivals_uid) {
          if (game === 'marvel_rivals') {
            skipped.push(`${player.discord_username}: No Marvel Rivals UID stored`)
          }
        }
      } catch (err) {
        errors.push(`Error processing ${player.discord_username}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Store role updates in database for Discord bot to process
    if (roleUpdates.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
          .from('pending_role_updates')
          .insert(roleUpdates.map(r => ({
            discord_user_id: r.discordUserId,
            old_rank: r.oldRank,
            new_rank: r.newRank,
            created_at: new Date().toISOString(),
          })))
      } catch (e) {
        // Table might not exist yet, that's okay
        console.log('Could not store pending role updates:', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: `MMR recalculation complete`,
      totalPlayers: players?.length || 0,
      updated: updates.length,
      skipped: skipped.length,
      pendingRoleUpdates: roleUpdates.length,
      updates: updates.map(u => ({
        id: u.id,
        username: u.username,
        oldMMR: u.oldMMR,
        newMMR: u.newMMR,
        oldRank: u.oldRank,
        newRank: u.newRank,
        sourceRank: u.sourceRank,
        game: u.game,
      })),
      skippedDetails: skipped.length > 0 ? skipped.slice(0, 30) : undefined,
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
