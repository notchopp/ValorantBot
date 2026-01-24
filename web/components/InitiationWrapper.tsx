'use client'

import { ReactNode, useEffect, useState } from 'react'
import { InitiationProvider } from '@/lib/InitiationContext'
import { createClient } from '@/lib/supabase/client'

interface InitiationWrapperProps {
  children: ReactNode
}

export function InitiationWrapper({ children }: InitiationWrapperProps) {
  const [username, setUsername] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function getUsername() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Try to get Discord username from players table
        const { data: player } = await supabase
          .from('players')
          .select('discord_username')
          .eq('id', user.id)
          .maybeSingle()
        
        setUsername(player?.discord_username || user.email?.split('@')[0] || 'Operative')
      }
      setIsLoading(false)
    }
    getUsername()
  }, [])

  // Show content while loading but don't show initiation guide yet
  if (isLoading || !username) {
    return <>{children}</>
  }

  return (
    <InitiationProvider username={username}>
      {children}
    </InitiationProvider>
  )
}
