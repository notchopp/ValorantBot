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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
      >
        Sign Out
      </button>
    )
  }

  return (
    <a
      href="/auth/login"
      className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-[#ffd700] text-black rounded-xl hover:bg-[#ffed4e] transition-all shadow-xl"
    >
      Sign In
    </a>
  )
}
