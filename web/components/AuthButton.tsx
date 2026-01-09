'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function AuthButton() {
  const router = useRouter()
  const supabase = createClient()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      setIsAuthenticated(!!user)
      setLoading(false)
    }
    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth()
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 text-white/40 rounded-xl">
        ...
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <button
        onClick={handleSignOut}
        className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all border border-white/5"
      >
        Sign Out
      </button>
    )
  }

  return (
    <a
      href="/auth/login"
      className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-xl border border-red-500/20"
    >
      Sign In
    </a>
  )
}
