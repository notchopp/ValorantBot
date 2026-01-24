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

const GRNDS_V_MAX_MMR = 1499

function getRankFromMMR(mmr: number): string {
  for (const threshold of RANK_THRESHOLDS) {
    if (mmr >= threshold.min && mmr <= threshold.max) {
      return threshold.rank
    }
  }
  return 'GRNDS I'
}

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

function calculateInitialMMRFromMarvelRivals(rank: string | undefined): number {
  if (!rank) return 0
  
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

// Admin users
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
    
    // Check admin
    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('discord_username, riot_name, riot_tag')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!currentPlayer || !isAdmin(currentPlayer)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { playerId, game } = body as { playerId: string; game: 'valorant' | 'marvel_rivals' }

    // Get the player
    interface PlayerRecord {
      id: string
      discord_username: string | null
      riot_name: string | null
      riot_tag: string | null
      riot_puuid: string | null
      riot_region: string | null
      valorant_mmr: number | null
      valorant_rank: string | null
      current_mmr: number | null
      discord_rank: string | null
      marvel_rivals_uid: string | null
      marvel_rivals_username: string | null
      marvel_rivals_mmr: number | null
      marvel_rivals_rank: string | null
    }

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single() as { data: PlayerRecord | null; error: unknown }
    
    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Fetch from API based on game
    if (game === 'valorant') {
      if (!player.riot_puuid) {
        return NextResponse.json({ error: 'No PUUID stored for this player' }, { status: 400 })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'GRNDS-Bot/1.0',
      }
      
      if (process.env.VALORANT_API_KEY) {
        headers['Authorization'] = process.env.VALORANT_API_KEY
      }
      
      const apiRegion = player.riot_region === 'latam' || player.riot_region === 'br' ? 'na' : (player.riot_region || 'na')
      const url = `https://api.henrikdev.xyz/valorant/v3/by-puuid/mmr/${apiRegion}/pc/${player.riot_puuid}`
      
      const response = await fetch(url, { headers, cache: 'no-store' })
      
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limited. Try again in a minute.' }, { status: 429 })
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: `API error: ${errorText.substring(0, 100)}` }, { status: 500 })
      }
      
      const data = await response.json()
      const mmrData = data?.data
      
      if (!mmrData) {
        return NextResponse.json({ error: 'No data in API response' }, { status: 500 })
      }
      
      const valorantRank = mmrData.current?.tier?.name || 'Unranked'
      const valorantELO = mmrData.current?.elo || 0
      
      const oldMMR = player.valorant_mmr ?? player.current_mmr ?? 0
      const oldRank = player.valorant_rank || player.discord_rank || 'Unranked'
      const newMMR = valorantRank === 'Unranked' ? 0 : calculateInitialMMRFromValorant(valorantRank, valorantELO)
      const newRank = getRankFromMMR(newMMR)
      
      // Update database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('players')
        .update({
          valorant_mmr: newMMR,
          valorant_rank: newRank,
          current_mmr: newMMR,
          discord_rank: newRank,
        })
        .eq('id', playerId)
      
      return NextResponse.json({
        success: true,
        username: player.discord_username,
        game: 'valorant',
        sourceRank: valorantRank,
        sourceELO: valorantELO,
        oldMMR,
        newMMR,
        oldRank,
        newRank,
      })
    } else if (game === 'marvel_rivals') {
      if (!player.marvel_rivals_uid) {
        return NextResponse.json({ error: 'No Marvel Rivals UID stored for this player' }, { status: 400 })
      }

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'GRNDS-Bot/1.0',
      }
      
      if (process.env.MARVEL_RIVALS_API_KEY) {
        headers['x-api-key'] = process.env.MARVEL_RIVALS_API_KEY
      }
      
      const url = `https://marvelrivalsapi.com/api/v1/player/${encodeURIComponent(player.marvel_rivals_uid)}`
      const response = await fetch(url, { headers, cache: 'no-store' })
      
      if (response.status === 429) {
        return NextResponse.json({ error: 'Rate limited. Try again in a minute.' }, { status: 429 })
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json({ error: `API error: ${errorText.substring(0, 100)}` }, { status: 500 })
      }
      
      const data = await response.json()
      const playerData = data?.data || data
      const mrRank = playerData?.rank || playerData?.tier || 'Unranked'
      
      const oldMMR = player.marvel_rivals_mmr ?? 0
      const oldRank = player.marvel_rivals_rank || 'Unranked'
      const newMMR = calculateInitialMMRFromMarvelRivals(mrRank)
      const newRank = getRankFromMMR(newMMR)
      
      // Update database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any)
        .from('players')
        .update({
          marvel_rivals_mmr: newMMR,
          marvel_rivals_rank: newRank,
        })
        .eq('id', playerId)
      
      return NextResponse.json({
        success: true,
        username: player.discord_username,
        game: 'marvel_rivals',
        sourceRank: mrRank,
        oldMMR,
        newMMR,
        oldRank,
        newRank,
      })
    }

    return NextResponse.json({ error: 'Invalid game specified' }, { status: 400 })
  } catch (error) {
    console.error('Error refreshing player:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
