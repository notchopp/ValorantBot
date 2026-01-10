import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { GRNDSTopNav } from './GRNDSTopNav'

export async function GRNDSTopNavWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  let discordUserId: string | undefined = undefined
  
  if (user) {
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Try to get discord_user_id from users table
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('discord_user_id')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: { discord_user_id: string } | null }
    
    if (userRecord) {
      discordUserId = userRecord.discord_user_id
    }
  }
  
  return <GRNDSTopNav discordUserId={discordUserId} />
}
