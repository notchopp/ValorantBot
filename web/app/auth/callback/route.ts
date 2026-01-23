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
      
      // Extract Discord user ID (provider_id) from OAuth metadata
      // Flow: Match provider_id (Discord user ID) to players.discord_user_id
      
      const supabaseAdmin = getSupabaseAdminClient()
      
      // Extract Discord identity data
      const identities = user.identities || []
      interface Identity {
        provider: string
        identity_data?: {
          provider_id?: string  // Discord user ID (snowflake) - use this for matching
          name?: string  // Discord username (may have #0 discriminator)
          full_name?: string  // Discord display name without discriminator
          preferred_username?: string
          avatar_url?: string  // Discord avatar URL
          picture?: string  // Alternative avatar field
        }
      }
      
      const discordIdentity = identities.find((id: Identity) => id.provider === 'discord') as Identity | undefined
      
      // Extract Discord user ID (provider_id) - this is what we match against
      const discordUserId = discordIdentity?.identity_data?.provider_id || null
      
      // Extract username and strip discriminator (e.g., "userneedsdrank#0" -> "userneedsdrank")
      const rawUsername = discordIdentity?.identity_data?.name || discordIdentity?.identity_data?.preferred_username || null
      const discordUsername = rawUsername ? rawUsername.replace(/#\d+$/, '') : null
      
      // Extract Discord avatar URL
      const discordAvatarUrl = discordIdentity?.identity_data?.avatar_url || discordIdentity?.identity_data?.picture || user.user_metadata?.avatar_url || user.user_metadata?.picture || null
      
      // Actor ID is the Supabase auth UID (user.id)
      const actorId = user.id
      
      console.log('=== OAuth Callback: Extracted Data ===')
      console.log('Auth UID (Supabase):', actorId)
      console.log('Discord User ID (provider_id):', discordUserId)
      console.log('Discord Username (stripped):', discordUsername)
      console.log('Discord Avatar URL:', discordAvatarUrl)
      
      // Match players by Discord user ID (provider_id)
      if (discordUserId) {
        try {
          interface PlayerData {
            id?: string
            discord_user_id: string
            discord_username: string | null
            current_mmr: number
          }
          
          // Find player by Discord user ID (provider_id)
          const { data: playerData, error: playerError } = await supabaseAdmin
            .from('players')
            .select('id, discord_user_id, discord_username, current_mmr, discord_avatar_url')
            .eq('discord_user_id', discordUserId) // Match by Discord user ID
            .maybeSingle() as { data: PlayerData & { discord_avatar_url?: string | null } | null; error: unknown }
          
          const existingPlayer = playerData
          
          if (playerError) {
            console.error('Error checking player:', playerError)
          }
          
          if (!existingPlayer) {
            console.log('✗ No player found with discord_user_id matching:', discordUserId)
            console.log('User needs to run /verify in Discord first to create player record')
            // Still redirect to dashboard - they'll see a message there
          } else {
            console.log('✓ Player found by Discord user ID')
            console.log('  Player Discord ID:', existingPlayer.discord_user_id)
            console.log('  Player username:', existingPlayer.discord_username)
            console.log('  Current player.id:', existingPlayer.id || 'unknown')
            console.log('  New auth.uid():', actorId)
            
            const currentPlayerId = existingPlayer.id
            
            // Update Discord avatar URL if available
            if (discordAvatarUrl && discordAvatarUrl !== existingPlayer.discord_avatar_url) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: avatarError } = await (supabaseAdmin.from('players') as any)
                .update({ discord_avatar_url: discordAvatarUrl })
                .eq('discord_user_id', discordUserId)
              
              if (avatarError) {
                console.error('Error updating avatar:', avatarError)
              } else {
                console.log('✓ Discord avatar URL updated')
              }
            }
            
            // Only update if the id is different
            if (currentPlayerId && currentPlayerId !== actorId) {
              console.log('  → Player id needs to be updated from', currentPlayerId, 'to', actorId)
              
              // Use database function to atomically update id and all foreign keys
              // This function creates a new row, updates foreign keys, then deletes old row
              // Note: We'll update avatar separately after the ID update
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: updateError } = await (supabaseAdmin.rpc as any)('update_player_id_with_auth_uid', {
                p_old_player_id: currentPlayerId,
                p_new_auth_uid: actorId,
                p_discord_user_id: existingPlayer.discord_user_id,
                p_display_name: discordUsername || existingPlayer.discord_username || 'Player'
              })
              
              if (updateError) {
                console.error('✗ Failed to update player id:', updateError)
                console.error('  Error details:', JSON.stringify(updateError, null, 2))
                // Don't fail completely - user can still access
              } else {
                console.log('✓ Player id updated to auth.uid() (all foreign keys updated, claimed=true)')
                
                // Update avatar after ID update
                if (discordAvatarUrl) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const { error: avatarUpdateError } = await (supabaseAdmin.from('players') as any)
                    .update({ discord_avatar_url: discordAvatarUrl })
                    .eq('id', actorId)
                  
                  if (avatarUpdateError) {
                    console.error('Error updating avatar after ID change:', avatarUpdateError)
                  }
                }
              }
            } else if (currentPlayerId === actorId) {
              console.log('  ✓ Player id already matches auth.uid() - no update needed')
              
              // Still set claimed = true if not already set and update avatar
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateData: { claimed?: boolean; discord_avatar_url?: string } = { claimed: true }
              if (discordAvatarUrl) {
                updateData.discord_avatar_url = discordAvatarUrl
              }
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: claimedError } = await (supabaseAdmin.from('players') as any)
                .update(updateData)
                .eq('id', actorId)
              
              if (claimedError) {
                console.error('Error setting claimed flag/avatar:', claimedError)
              } else {
                console.log('✓ Claimed flag set to true and avatar updated')
              }
            } else {
              console.log('  ⚠ Could not determine current player id - will set claimed flag and avatar')
              // Try to update claimed flag even if we can't update the ID
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const updateData: { claimed?: boolean; discord_avatar_url?: string } = { claimed: true }
              if (discordAvatarUrl) {
                updateData.discord_avatar_url = discordAvatarUrl
              }
              
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { error: claimedError } = await (supabaseAdmin.from('players') as any)
                .update(updateData)
                .eq('discord_user_id', discordUserId)
              
              if (claimedError) {
                console.error('Error setting claimed flag/avatar:', claimedError)
              }
            }
            
            // Create/update user_profile with cleaned username (no discriminator)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: existingPlayer.discord_user_id,
              display_name: discordUsername || existingPlayer.discord_username || 'Player',
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'discord_user_id'
            })
            
            if (profileError) {
              console.error('Profile creation failed:', profileError)
            } else {
              console.log('✓ User profile created/updated')
            }
          }
          
          console.log('=== OAuth Callback Complete ===')
        } catch (error) {
          console.error('Unexpected error during OAuth callback:', error)
          // Don't fail - user can still access dashboard
        }
      } else {
        console.error('No Discord user ID (provider_id) found in OAuth metadata')
        console.log('User metadata:', JSON.stringify(user.user_metadata, null, 2))
        console.log('Identities:', JSON.stringify(identities, null, 2))
      }
      
      // Redirect to production domain
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.grnds.xyz'
      const redirectUrl = new URL(next, baseUrl)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there's an error, redirect back to hub (landing + auth)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hub.grnds.xyz'
  const hubUrl = new URL('/hub', baseUrl)
  hubUrl.searchParams.set('error', 'oauth_error')
  return NextResponse.redirect(hubUrl)
}
