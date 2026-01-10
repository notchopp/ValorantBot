'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ConditionalMain({ children }: { children: React.ReactNode }) {
  const [hasNav, setHasNav] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setHasNav(!!user)
    }
    checkAuth()
  }, [])

  return (
    <main className={`relative z-10 min-h-screen ${hasNav ? 'pt-20 md:pt-24' : ''}`}>
      {children}
    </main>
  )
}
