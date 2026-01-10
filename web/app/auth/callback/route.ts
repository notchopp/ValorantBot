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
      
      // If we have a Discord user ID, automatically create/update users table entry
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
          let { data: existingPlayer, error: playerError } = await supabaseAdmin
            .from('players')
            .select('discord_user_id, discord_username, current_mmr')
            .eq('discord_user_id', discordUserId)
            .maybeSingle()
          
          // If not found by ID, try matching by Discord username
          // This matches the discord_username in players table to the display name from auth
          if (!existingPlayer && discordUsername) {
            console.log('Player not found by Discord ID, trying username match...')
            console.log('Searching for discord_username matching:', discordUsername)
            
            const { data: playerByUsername } = await supabaseAdmin
              .from('players')
              .select('discord_user_id, discord_username, current_mmr')
              .ilike('discord_username', discordUsername) // Case-insensitive match
              .maybeSingle()
            
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
          
          // Determine which Discord ID to use for linking
          const discordIdToLink = existingPlayer?.discord_user_id || discordUserId
          
          // SOLUTION FOR ALL 3 PROBLEMS:
          // Always create users table entry, even if player doesn't exist yet
          // Use pending_discord_link flag to track users waiting for /verify
          
          const isPending = !existingPlayer
          
          if (isPending) {
            console.log('Player not found - creating pending user record')
            console.log('User will see "Link Discord Account" message until they run /verify')
          } else {
            console.log('✓ Player found - linking immediately')
            console.log('  Player username:', existingPlayer.discord_username)
            console.log('  Player Discord ID:', existingPlayer.discord_user_id)
          }
          
          // Upsert users table entry (always succeeds now)
          // Use the discord_user_id from the player record if found, otherwise use OAuth value
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: userResult, error: userError } = await (supabaseAdmin.from('users') as any).upsert({
            auth_id: user.id,
            discord_user_id: isPending ? null : discordIdToLink, // Use matched player's Discord ID
            email: user.email || null,
            pending_discord_link: isPending,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'auth_id'
          }).select()
          
          if (userError) {
            console.error('✗ Failed to create user record:', userError)
            console.error('This should not happen with new schema - check migrations')
          } else {
            console.log('✓ User record created/updated')
            console.log('  auth_id (Supabase):', user.id)
            console.log('  discord_user_id (Player link):', isPending ? 'null (pending)' : discordIdToLink)
          }
          
          // Create user_profile if player exists
          if (!isPending) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: discordIdToLink, // Use the correct Discord ID
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
