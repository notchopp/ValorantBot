import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const game = searchParams.get('game') === 'marvel_rivals' ? 'marvel_rivals' : 'valorant'
    
    if (!query || query.length < 1) {
      return NextResponse.json({ players: [] })
    }
    
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Search players by username (case-insensitive, prefix match)
    // Order alphabetically by username
    const { data: players, error } = await supabaseAdmin
      .from('players')
      .select('id, discord_user_id, discord_username, valorant_mmr, marvel_rivals_mmr, discord_avatar_url')
      .ilike('discord_username', `${query}%`)
      .order('discord_username', { ascending: true })
      .limit(10)
    
    if (error) {
      console.error('Error searching players:', error)
      return NextResponse.json(
        { error: 'Failed to search players' },
        { status: 500 }
      )
    }
    
    // Format response with rank calculation
    interface PlayerRow {
      id: string
      discord_user_id: string
      discord_username: string | null
      valorant_mmr: number | null
      marvel_rivals_mmr: number | null
      discord_avatar_url?: string | null
    }
    
    const formattedPlayers = (players || []).map((player: PlayerRow) => {
      let rank = 'GRNDS I'
      const mmr = game === 'marvel_rivals' ? (player.marvel_rivals_mmr || 0) : (player.valorant_mmr || 0)
      
      if (mmr >= 3000) rank = 'X'
      else if (mmr >= 2600) rank = 'CHALLENGER III'
      else if (mmr >= 2500) rank = 'CHALLENGER II'
      else if (mmr >= 2400) rank = 'CHALLENGER I'
      else if (mmr >= 2300) rank = 'BREAKPOINT V'
      else if (mmr >= 2100) rank = 'BREAKPOINT IV'
      else if (mmr >= 1900) rank = 'BREAKPOINT III'
      else if (mmr >= 1700) rank = 'BREAKPOINT II'
      else if (mmr >= 1500) rank = 'BREAKPOINT I'
      else if (mmr >= 1200) rank = 'GRNDS V'
      else if (mmr >= 900) rank = 'GRNDS IV'
      else if (mmr >= 600) rank = 'GRNDS III'
      else if (mmr >= 300) rank = 'GRNDS II'
      
      return {
        id: player.id,
        discord_user_id: player.discord_user_id,
        username: player.discord_username || 'Unknown',
        mmr: mmr,
        rank: rank,
        avatar_url: player.discord_avatar_url
      }
    })
    
    return NextResponse.json({ players: formattedPlayers })
  } catch (error) {
    console.error('Unexpected error in player search:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
