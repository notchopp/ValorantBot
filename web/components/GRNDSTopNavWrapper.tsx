import { createClient } from '@/lib/supabase/server'
import { GRNDSTopNav } from './GRNDSTopNav'

export async function GRNDSTopNavWrapper() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Only show nav if user is authenticated
  if (!user) {
    return null
  }
  
  // Use auth UID as discordUserId for navigation (id is now auth UID)
  const discordUserId = user.id
  
  return <GRNDSTopNav discordUserId={discordUserId} />
}
