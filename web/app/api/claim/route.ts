import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { riotName, riotTag } = body
    
    if (!riotName || !riotTag) {
      return NextResponse.json(
        { error: 'Riot name and tag are required' },
        { status: 400 }
      )
    }
    
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Find player by Riot ID
    interface PlayerRow {
      id: string
      discord_username: string | null
      riot_name: string | null
      riot_tag: string | null
      current_mmr: number
      discord_user_id: string
    }
    
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, discord_username, riot_name, riot_tag, current_mmr, discord_user_id')
      .eq('riot_name', riotName.trim())
      .eq('riot_tag', riotTag.trim())
      .maybeSingle() as { data: PlayerRow | null; error: unknown }
    
    if (playerError) {
      console.error('Error finding player:', playerError)
      return NextResponse.json(
        { error: 'Failed to find player. Please try again.' },
        { status: 500 }
      )
    }
    
    if (!player) {
      return NextResponse.json(
        { error: 'Player not found. Make sure you have run /verify in Discord first.' },
        { status: 404 }
      )
    }
    
    // Check if profile is already claimed by another user
    // If player.id exists and is a UUID (not the old Discord ID), it's claimed
    const playerId = player.id
    if (playerId && playerId !== player.discord_user_id && playerId !== user.id) {
      // Profile is claimed by another user
      return NextResponse.json(
        { error: 'This profile has already been claimed by another user.' },
        { status: 403 }
      )
    }
    
    // Check if user already has a claimed profile
    interface ExistingClaimRow {
      id: string
      discord_username: string | null
      riot_name: string | null
      riot_tag: string | null
    }
    
    const { data: existingClaim, error: claimError } = await supabaseAdmin
      .from('players')
      .select('id, discord_username, riot_name, riot_tag')
      .eq('id', user.id)
      .maybeSingle() as { data: ExistingClaimRow | null; error: unknown }
    
    if (claimError) {
      console.error('Error checking existing claim:', claimError)
    }
    
    if (existingClaim && existingClaim.riot_name !== riotName.trim()) {
      return NextResponse.json(
        { error: 'You have already claimed a different profile.' },
        { status: 403 }
      )
    }
    
    // If profile is already claimed by this user, just return success
    if (playerId === user.id) {
      return NextResponse.json(
        { 
          success: true,
          message: 'Profile already claimed!',
          player: {
            riotName: player.riot_name,
            riotTag: player.riot_tag,
            mmr: player.current_mmr
          }
        },
        { status: 200 }
      )
    }
    
    // Claim the profile by updating player.id to user.id
    // Use the database function to handle foreign key updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabaseAdmin.rpc as any)('update_player_id_with_auth_uid', {
      p_old_player_id: playerId || player.discord_user_id,
      p_new_auth_uid: user.id,
      p_discord_user_id: player.discord_user_id || '',
      p_display_name: player.discord_username || riotName
    })
    
    if (updateError) {
      console.error('Error claiming profile:', updateError)
      return NextResponse.json(
        { error: 'Failed to claim profile. Please try again.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Profile claimed successfully!',
        player: {
          riotName: player.riot_name,
          riotTag: player.riot_tag,
          mmr: player.current_mmr
        }
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error in claim API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
