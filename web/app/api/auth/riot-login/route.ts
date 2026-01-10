import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
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
      claimed: boolean
    }

    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id, discord_username, riot_name, riot_tag, current_mmr, discord_user_id, claimed')
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

    // Check if profile is already claimed
    if (player.claimed) {
      // Check if player.id is a UUID (meaning it's been claimed)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(player.id)
      
      if (isUUID && player.id !== player.discord_user_id) {
        // Profile is claimed - create anonymous session with the existing player.id
        const supabase = await createClient()
        
        // Try to sign in with the existing player.id as a custom token
        // Since we can't directly set the user ID, we'll create an anonymous session
        // and then update the player record to match
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously()

        if (authError || !authData.user) {
          console.error('Error creating session:', authError)
          return NextResponse.json(
            { error: 'Failed to create session. Please try again.' },
            { status: 500 }
          )
        }

        // Update player.id to match the anonymous session
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabaseAdmin.rpc as any)('update_player_id_with_auth_uid', {
          p_old_player_id: player.id,
          p_new_auth_uid: authData.user.id,
          p_discord_user_id: player.discord_user_id || '',
          p_display_name: player.discord_username || riotName
        })

        if (updateError) {
          console.error('Error updating player ID:', updateError)
          return NextResponse.json(
            { error: 'Failed to create session. Please try again.' },
            { status: 500 }
          )
        }

        // Return success - user is now logged in
        return NextResponse.json(
          {
            success: true,
            message: 'Logged in successfully!',
            player: {
              riotName: player.riot_name,
              riotTag: player.riot_tag,
              mmr: player.current_mmr
            }
          },
          { status: 200 }
        )
      }
    }

    // Profile is not claimed - create anonymous session and claim it
    const supabase = await createClient()
    
    // Sign in anonymously
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously()

    if (authError || !authData.user) {
      console.error('Error creating anonymous session:', authError)
      return NextResponse.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      )
    }

    // Claim the profile by updating player.id to the anonymous auth UID and setting claimed = true
    const playerId = player.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabaseAdmin.rpc as any)('update_player_id_with_auth_uid', {
      p_old_player_id: playerId || player.discord_user_id,
      p_new_auth_uid: authData.user.id,
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

    // Set claimed = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: claimedError } = await (supabaseAdmin.from('players') as any)
      .update({ claimed: true })
      .eq('id', authData.user.id)

    if (claimedError) {
      console.error('Error setting claimed flag:', claimedError)
      return NextResponse.json(
        { error: 'Failed to complete profile claim. Please try again.' },
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
    console.error('Unexpected error in riot login API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
