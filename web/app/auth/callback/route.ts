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
      
      // Extract Discord user ID from OAuth metadata
      const identities = user.identities || []
      interface Identity {
        provider: string
        identity_data?: {
          id?: string
          preferred_username?: string
          username?: string
        }
        user_id?: string
      }
      
      const discordIdentity = identities.find((id: Identity) => id.provider === 'discord') as Identity | undefined
      const discordUserId = discordIdentity?.identity_data?.id || 
                            discordIdentity?.user_id ||
                            user.user_metadata?.provider_user_id ||
                            user.user_metadata?.provider_id || 
                            user.user_metadata?.sub || 
                            user.user_metadata?.discord_id ||
                            null
      
      const discordUsername = discordIdentity?.identity_data?.preferred_username ||
                              discordIdentity?.identity_data?.username ||
                              user.user_metadata?.preferred_username ||
                              user.user_metadata?.username ||
                              user.user_metadata?.global_name ||
                              user.user_metadata?.full_name ||
                              null
      
      // If we have a Discord user ID, link auth UID to player record
      if (discordUserId) {
        console.log('=== OAuth Callback: User Data Extraction ===')
        console.log('Supabase Auth ID (auth_id):', user.id)
        console.log('Discord User ID (discord_user_id):', discordUserId)
        console.log('Discord Username:', discordUsername)
        console.log('User Email:', user.email)
        console.log('---')
        console.log('NOTE: auth_id is Supabase internal, discord_user_id is Discord snowflake')
        console.log('---')
        
        const supabaseAdmin = getSupabaseAdminClient()
        
        try {
          // Try to find player by Discord ID first
          interface PlayerData {
            discord_user_id: string
            discord_username: string | null
            current_mmr: number
          }
          
          let existingPlayer: PlayerData | null = null
          const { data: playerData, error: playerError } = await supabaseAdmin
            .from('players')
            .select('discord_user_id, discord_username, current_mmr')
            .eq('discord_user_id', discordUserId)
            .maybeSingle() as { data: PlayerData | null; error: unknown }
          existingPlayer = playerData
          
          // If not found by ID, try matching by Discord username
          // This matches the discord_username in players table to the display name from auth
          if (!existingPlayer && discordUsername) {
            console.log('Player not found by Discord ID, trying username match...')
            console.log('Searching for discord_username matching:', discordUsername)
            
            const { data: playerByUsername } = await supabaseAdmin
              .from('players')
              .select('discord_user_id, discord_username, current_mmr')
              .ilike('discord_username', discordUsername) // Case-insensitive match
              .maybeSingle() as { data: PlayerData | null }
            
            if (playerByUsername) {
              console.log('✓ Found player by Discord username match!')
              console.log('  Player discord_username:', playerByUsername.discord_username)
              console.log('  Player discord_user_id:', playerByUsername.discord_user_id)
              console.log('  Auth display name:', discordUsername)
              console.log('  → Linking to this player')
              existingPlayer = playerByUsername
            } else {
              console.log('✗ No player found with discord_username matching:', discordUsername)
            }
          }
          
          if (playerError) {
            console.error('Error checking player:', playerError)
          }
          
          // If player exists, update their id to be the auth UID
          // This links the player record directly to the Supabase auth account
          if (existingPlayer) {
            console.log('✓ Player found - linking auth UID to player record')
            console.log('  Player username:', existingPlayer.discord_username)
            console.log('  Player Discord ID:', existingPlayer.discord_user_id)
            console.log('  Auth UID:', user.id)
            
            // Update player record to use auth UID as id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: updateError } = await (supabaseAdmin.from('players') as any)
              .update({ id: user.id })
              .eq('discord_user_id', existingPlayer.discord_user_id)
            
            if (updateError) {
              console.error('✗ Failed to update player id:', updateError)
            } else {
              console.log('✓ Player id updated to auth UID')
            }
            
            // Create/update user_profile
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: existingPlayer.discord_user_id,
              display_name: discordUsername || existingPlayer.discord_username,
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
        console.error('No Discord user ID found in OAuth metadata')
        console.log('User metadata:', JSON.stringify(user.user_metadata, null, 2))
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
