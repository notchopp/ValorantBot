import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { GRNDSTopNav } from './GRNDSTopNav'

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
        .select('discord_user_id')
        .eq('id', user.id)
        .maybeSingle() as { data: { discord_user_id: string } | null }
      
      const discordUserId = player?.discord_user_id || user.id
      
      return <GRNDSTopNav discordUserId={discordUserId} />
    } catch {
      // If admin client fails, just use user.id
      return <GRNDSTopNav discordUserId={user.id} />
    }
  } catch {
    // Silently fail if Supabase is not configured
    // This allows pages like /hub to work without Supabase
    return null
  }
}
