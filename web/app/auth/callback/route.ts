import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.session) {
      const user = data.session.user
      
      // Extract Discord username (actor_name) from OAuth metadata
      // Based on Supabase logs: actor_id = Supabase UID (user.id), actor_name = Discord username
      // The actor_name is stored in the identity_data or user_metadata
      
      const supabaseAdmin = getSupabaseAdminClient()
      
      // Get full user data from auth.users to access the complete identity structure
      const { data: authUserData, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(user.id)
      
      if (authUserError) {
        console.error('Error fetching auth user data:', authUserError)
      }
      
      // Log full structure for debugging
      console.log('=== OAuth Callback: Full User Data ===')
      console.log('User ID (actor_id):', user.id)
      console.log('User metadata:', JSON.stringify(user.user_metadata, null, 2))
      console.log('User identities:', JSON.stringify(user.identities, null, 2))
      if (authUserData?.user) {
        console.log('Auth user identities:', JSON.stringify(authUserData.user.identities, null, 2))
        console.log('Auth user metadata:', JSON.stringify(authUserData.user.user_metadata, null, 2))
      }
      
      // Extract actor_name (Discord username) from identity_data
      // For Discord OAuth, actor_name is typically in identity_data.name or identity_data.preferred_username
      const identities = user.identities || []
      interface Identity {
        provider: string
        identity_data?: {
          name?: string  // actor_name - Discord username
          preferred_username?: string
          username?: string
          full_name?: string
        }
      }
      
      const discordIdentity = identities.find((id: Identity) => id.provider === 'discord') as Identity | undefined
      
      // Discord username (actor_name) - check identity_data.name first (this is actor_name)
      const actorName = discordIdentity?.identity_data?.name || null
      
      // Actor ID is the Supabase auth UID (user.id)
      const actorId = user.id
      
      console.log('=== OAuth Callback: Extracted Data ===')
      console.log('Actor ID (Supabase auth UID):', actorId)
      console.log('Actor Name (Discord username from identity_data.name):', actorName)
      console.log('Discord identity data:', JSON.stringify(discordIdentity?.identity_data, null, 2))
      console.log('User Email:', user.email)
      
      // Match players by actor_name (Discord username) only
      if (actorName) {
        try {
          // Match player by Discord username (actor_name) only
          interface PlayerData {
            id?: string
            discord_user_id: string
            discord_username: string | null
            current_mmr: number
          }
          
          // Find player by Discord username (case-insensitive match)
          const { data: playerData, error: playerError } = await supabaseAdmin
            .from('players')
            .select('id, discord_user_id, discord_username, current_mmr')
            .ilike('discord_username', actorName) // Case-insensitive match using actor_name
            .maybeSingle() as { data: PlayerData | null; error: unknown }
          
          const existingPlayer = playerData
          
          if (playerError) {
            console.error('Error checking player:', playerError)
          }
          
          if (!existingPlayer) {
            console.log('✗ No player found with discord_username matching:', actorName)
            console.log('User needs to run /verify in Discord first to create player record')
          }
          
          // If player exists, update their id to be the actor_id (Supabase auth UID)
          // This links the player record directly to the Supabase auth account
          if (existingPlayer) {
            console.log('✓ Player found by actor_name - updating id to actor_id')
            console.log('  Player username (actor_name):', existingPlayer.discord_username)
            console.log('  Player Discord ID:', existingPlayer.discord_user_id)
            console.log('  Current player.id:', existingPlayer.id || 'unknown')
            console.log('  New actor_id (auth.uid()):', actorId)
            
            const currentPlayerId = existingPlayer.id
            
            // Only update if the id is different
            if (currentPlayerId && currentPlayerId !== actorId) {
              console.log('  → Player id needs to be updated from', currentPlayerId, 'to', actorId)
              
              // Use database function to atomically update id and all foreign keys
              // This function uses a temporary UUID to safely update the primary key
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: updateError } = await (supabaseAdmin.rpc as any)('update_player_id_with_auth_uid', {
                p_old_player_id: currentPlayerId,
                p_new_auth_uid: actorId,
                p_discord_user_id: existingPlayer.discord_user_id,
                p_display_name: actorName || existingPlayer.discord_username || 'Player'
              })
              
              if (updateError) {
                console.error('✗ Failed to update player id:', updateError)
                console.error('  This might be because foreign keys need to be updated manually')
              } else {
                console.log('✓ Player id updated to actor_id (all foreign keys updated)')
              }
            } else if (currentPlayerId === actorId) {
              console.log('  ✓ Player id already matches actor_id - no update needed')
            } else {
              console.log('  ⚠ Could not determine current player id - skipping update')
            }
            
            // Create/update user_profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: existingPlayer.discord_user_id,
              display_name: actorName || existingPlayer.discord_username,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'discord_user_id'
            })
            
            if (profileError) {
              console.error('Profile creation failed:', profileError)
            } else {
              console.log('✓ User profile created/updated')
            }
          } else {
            console.log('Player not found - user needs to run /verify in Discord first')
            console.log('User will see "Link Discord Account" message until they run /verify')
          }
          
          console.log('=== OAuth Callback Complete ===')
        } catch (error) {
          console.error('Unexpected error during OAuth callback:', error)
          // Don't fail - user can still access dashboard
        }
      } else {
        console.error('No actor_name (Discord username) found in OAuth metadata')
        console.log('User metadata:', JSON.stringify(user.user_metadata, null, 2))
        console.log('Identities:', JSON.stringify(identities, null, 2))
      }
      
      // Redirect to production domain
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.grnds.xyz'
      const redirectUrl = new URL(next, baseUrl)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there's an error, redirect back to login
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.grnds.xyz'
  const loginUrl = new URL('/auth/login', baseUrl)
  loginUrl.searchParams.set('error', 'oauth_error')
  return NextResponse.redirect(loginUrl)
}
