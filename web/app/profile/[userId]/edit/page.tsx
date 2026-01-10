import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ProfileEditForm } from '@/components/ProfileEditForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProfileEditPage({ params }: { params: { userId: string } }) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // Get player data by discord_user_id (from URL param)
  const supabaseAdmin = getSupabaseAdminClient()
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('*')
    .eq('discord_user_id', params.userId)
    .maybeSingle() as { data: { id: string; discord_user_id: string; discord_username: string | null } | null }
  
  if (!player) {
    redirect('/dashboard')
  }
  
  // Verify user owns this profile
  if (player.id !== user.id) {
    redirect('/dashboard')
  }
  
  // Get or create user profile (use admin client)
  const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
  const supabaseAdmin = getSupabaseAdminClient()
  
  let { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('discord_user_id', player.discord_user_id)
    .maybeSingle() as { data: { display_name?: string | null; bio?: string | null; favorite_agent?: string | null; favorite_map?: string | null; accent_color?: string | null } | null }
  
  // If no profile exists, create one
  if (!userProfile) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile } = await (supabaseAdmin.from('user_profiles') as any)
      .insert({
        discord_user_id: player.discord_user_id,
        display_name: player.discord_username,
        accent_color: '#ef4444',
      })
      .select()
      .single()
    
    if (newProfile) {
      userProfile = newProfile
    }
  }
  
  return (
    <div className="min-h-screen py-8 md:py-12 px-4 md:px-8 relative z-10">
      <div className="max-w-[800px] mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter leading-none">
            Customize Profile
          </h1>
          <p className="text-base text-white/60 font-light">
            Customize your GRNDS profile. This will be shown in the hub and on your public profile.
          </p>
        </div>
        
        <ProfileEditForm 
          initialProfile={{
            display_name: userProfile?.display_name || player.discord_username || '',
            bio: userProfile?.bio || '',
            favorite_agent: userProfile?.favorite_agent || '',
            favorite_map: userProfile?.favorite_map || '',
            accent_color: userProfile?.accent_color || '#ef4444',
          }}
          discordUserId={player.discord_user_id}
        />
      </div>
    </div>
  )
}
