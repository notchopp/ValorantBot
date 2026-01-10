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
        const supabaseAdmin = getSupabaseAdminClient()
        
        try {
          // Check if player exists with this Discord ID
          const { data: existingPlayer, error: playerError } = await supabaseAdmin
            .from('players')
            .select('discord_user_id')
            .eq('discord_user_id', discordUserId)
            .maybeSingle()
          
          console.log('OAuth Callback - Discord User ID:', discordUserId)
          console.log('OAuth Callback - Player found:', existingPlayer)
          console.log('OAuth Callback - Player error:', playerError)
          
          // Only create/update users table entry if player exists
          // This ensures we only link authenticated web users who have used the bot
          if (existingPlayer) {
            // Upsert users table entry (create if doesn't exist, update if exists)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: userResult, error: userError } = await (supabaseAdmin.from('users') as any).upsert({
              auth_id: user.id,
              discord_user_id: discordUserId,
              email: user.email || null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'auth_id'
            }).select()
            
            console.log('OAuth Callback - User upsert result:', userResult)
            console.log('OAuth Callback - User upsert error:', userError)
            
            // Also ensure user_profile exists (for customization)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: profileResult, error: profileError } = await (supabaseAdmin.from('user_profiles') as any).upsert({
              discord_user_id: discordUserId,
              display_name: discordIdentity?.identity_data?.preferred_username || 
                           discordIdentity?.identity_data?.username ||
                           user.user_metadata?.preferred_username ||
                           null,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'discord_user_id'
            }).select()
            
            console.log('OAuth Callback - Profile upsert result:', profileResult)
            console.log('OAuth Callback - Profile upsert error:', profileError)
          } else {
            console.log('OAuth Callback - No player found for Discord ID:', discordUserId)
          }
        } catch (error) {
          // Log error but don't fail auth - user can still access dashboard
          console.error('Error linking user to Discord account:', error)
        }
      } else {
        console.log('OAuth Callback - No Discord user ID found in OAuth metadata')
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
