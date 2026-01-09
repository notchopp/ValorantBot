import { createClient } from '@/lib/supabase/server'
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
  
  // Get user's discord_user_id
  const { data: userRecord } = await supabase
    .from('users')
    .select('discord_user_id')
    .eq('auth_id', user.id)
    .maybeSingle()
  
  if (!userRecord) {
    redirect('/dashboard')
  }
  
  // Get player data
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('discord_user_id', userRecord.discord_user_id)
    .maybeSingle()
  
  if (!player) {
    redirect('/dashboard')
  }
  
  // Get or create user profile
  let { data: userProfile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('discord_user_id', userRecord.discord_user_id)
    .maybeSingle()
  
  // If no profile exists, create one
  if (!userProfile) {
    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        discord_user_id: userRecord.discord_user_id,
        display_name: player.discord_username,
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
          }}
          discordUserId={userRecord.discord_user_id}
        />
      </div>
    </div>
  )
}
