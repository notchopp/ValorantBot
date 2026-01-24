import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { Terminal3DShellClient } from './Terminal3DShellClient'

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

interface Terminal3DShellWrapperProps {
  children: React.ReactNode
}

export async function Terminal3DShellWrapper({ children }: Terminal3DShellWrapperProps) {
  let discordUserId: string | undefined
  let isAdminUser = false

  try {
    const hasSupabaseConfig = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (hasSupabaseConfig) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        try {
          const supabaseAdmin = getSupabaseAdminClient()
          const { data: player } = await supabaseAdmin
            .from('players')
            .select('discord_user_id, discord_username, riot_name, riot_tag')
            .eq('id', user.id)
            .maybeSingle() as { data: { discord_user_id: string; discord_username?: string | null; riot_name?: string | null; riot_tag?: string | null } | null }
          
          discordUserId = player?.discord_user_id || user.id
          isAdminUser = player ? isAdmin(player) : false
        } catch {
          discordUserId = user.id
        }
      }
    }
  } catch {
    // Silently fail
  }
  
  return (
    <Terminal3DShellClient discordUserId={discordUserId} isAdmin={isAdminUser}>
      {children}
    </Terminal3DShellClient>
  )
}
