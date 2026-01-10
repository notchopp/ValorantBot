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
      
      // If we have a Discord user ID, automatically create/update users table entry
      if (discordUserId) {
        console.log('=== OAuth Callback: Linking User ===')
        console.log('Discord User ID:', discordUserId)
        console.log('Auth User ID:', user.id)
        
        const supabaseAdmin = getSupabaseAdminClient()
        
        try {
          // Check if player exists with this Discord ID
          const { data: existingPlayer, error: playerError } = await supabaseAdmin
            .from('players')
            .select('discord_user_id, discord_username, current_mmr')
            .eq('discord_user_id', discordUserId)
            .maybeSingle()
          
          if (playerError) {
            console.error('Error checking player:', playerError)
          }
          
          // SOLUTION FOR ALL 3 PROBLEMS:
          // Always create users table entry, even if player doesn't exist yet
          // Use pending_discord_link flag to track users waiting for /verify
          
          const isPending = !existingPlayer
          
          if (isPending) {
            console.log('Player not found yet - creating pending user record')
            console.log('User will see "Link Discord Account" message until they run /verify')
          } else {
            console.log('Player found - linking immediately:', existingPlayer.discord_username)
          }
          
          // Upsert users table entry (always succeeds now)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: userResult, error: userError } = await (supabaseAdmin.from('users') as any).upsert({
            auth_id: user.id,
            discord_user_id: isPending ? null : discordUserId, // Null if pending
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
            console.log('✓ User record created/updated:', userResult?.[0]?.auth_id)
          }
          
          // Create user_profile if player exists
          if (!isPending) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: discordUserId,
              display_name: discordIdentity?.identity_data?.preferred_username || 
                           discordIdentity?.identity_data?.username ||
                           user.user_metadata?.preferred_username ||
                           null,
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
