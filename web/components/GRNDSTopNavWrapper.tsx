import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { GRNDSTopNav } from './GRNDSTopNav'

export async function GRNDSTopNavWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Only show nav if user is authenticated
  if (!user) {
    return null
  }
  
  // Get player's discord_user_id for navigation (profile uses discord_user_id in URL)
  const supabaseAdmin = getSupabaseAdminClient()
  const { data: player } = await supabaseAdmin
    .from('players')
    .select('discord_user_id')
    .eq('id', user.id)
    .maybeSingle() as { data: { discord_user_id: string } | null }
  
  const discordUserId = player?.discord_user_id || user.id
  
  return <GRNDSTopNav discordUserId={discordUserId} />
}
