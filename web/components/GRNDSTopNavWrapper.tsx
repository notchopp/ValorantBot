import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { GRNDSTopNav } from './GRNDSTopNav'

export async function GRNDSTopNavWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let discordUserId: string | undefined = undefined
  
  if (user) {
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Get player data directly by id (which is now the auth UID)
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('discord_user_id')
      .eq('id', user.id)
      .maybeSingle() as { data: { discord_user_id: string } | null }
    
    if (player) {
      discordUserId = player.discord_user_id
    }
  }
  
  return <GRNDSTopNav discordUserId={discordUserId} />
}
