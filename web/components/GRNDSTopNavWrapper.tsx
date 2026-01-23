import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { GRNDSTopNav } from './GRNDSTopNav'

// Admin users who can access HQ
const ADMIN_USERS = [
  { discord_username: 'userneedsdrank' },
  { riot_name: 'rawl', riot_tag: 'shtt' },
]

function isAdmin(player: { discord_username?: string | null; riot_name?: string | null; riot_tag?: string | null }): boolean {
  return ADMIN_USERS.some(admin => {
    if (admin.discord_username && player.discord_username?.toLowerCase() === admin.discord_username.toLowerCase()) {
      return true
    }
    if (admin.riot_name && admin.riot_tag && 
        player.riot_name?.toLowerCase() === admin.riot_name.toLowerCase() &&
        player.riot_tag?.toLowerCase() === admin.riot_tag.toLowerCase()) {
      return true
    }
    return false
  })
}

export async function GRNDSTopNavWrapper() {
  // Handle missing Supabase credentials gracefully
  try {
    // Check if environment variables are set
    const hasSupabaseConfig = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!hasSupabaseConfig) {
      return null // Don't show nav if Supabase is not configured
    }
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Only show nav if user is authenticated
    if (!user) {
      return null
    }
    
    // Get player's discord_user_id for navigation (profile uses discord_user_id in URL)
    try {
      const supabaseAdmin = getSupabaseAdminClient()
      const { data: player } = await supabaseAdmin
        .from('players')
        .select('discord_user_id, discord_username, riot_name, riot_tag')
        .eq('id', user.id)
        .maybeSingle() as { data: { discord_user_id: string; discord_username?: string | null; riot_name?: string | null; riot_tag?: string | null } | null }
      
      const discordUserId = player?.discord_user_id || user.id
      const isAdminUser = player ? isAdmin(player) : false
      
      return <GRNDSTopNav discordUserId={discordUserId} isAdmin={isAdminUser} />
    } catch {
      // If admin client fails, just use user.id
      return <GRNDSTopNav discordUserId={user.id} isAdmin={false} />
    }
  } catch {
    // Silently fail if Supabase is not configured
    // This allows pages like /hub to work without Supabase
    return null
  }
}
