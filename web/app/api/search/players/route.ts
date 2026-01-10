import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    
    if (!query || query.length < 1) {
      return NextResponse.json({ players: [] })
    }
    
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Search players by username (case-insensitive, prefix match)
    // Order alphabetically by username
    const { data: players, error } = await supabaseAdmin
      .from('players')
      .select('id, discord_user_id, discord_username, current_mmr, discord_avatar_url')
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
      current_mmr: number | null
      discord_avatar_url?: string | null
    }
    
    const formattedPlayers = (players || []).map((player: PlayerRow) => {
      let rank = 'GRNDS I'
      const mmr = player.current_mmr || 0
      
      if (mmr >= 3000) rank = 'X'
      else if (mmr >= 2000) {
        const tier = Math.floor((mmr - 2000) / 200) + 1
        rank = `CHALLENGER ${Math.min(tier, 5)}`
      } else if (mmr >= 1000) {
        const tier = Math.floor((mmr - 1000) / 200) + 1
        rank = `BREAKPOINT ${Math.min(tier, 5)}`
      } else if (mmr > 0) {
        const tier = Math.floor(mmr / 200) + 1
        rank = `GRNDS ${Math.min(tier, 5)}`
      }
      
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
