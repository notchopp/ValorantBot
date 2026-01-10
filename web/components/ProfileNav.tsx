'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ProfileData {
  discord_username: string | null
  display_name: string | null
  discord_user_id: string
}

export function ProfileNav() {
  const supabase = createClient()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Get player data directly by id (which is now the auth UID)
      const { data: player } = await supabase
        .from('players')
        .select('discord_username, discord_user_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!player) {
        setLoading(false)
        return
      }

      // Get user profile for display name
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('display_name')
        .eq('discord_user_id', player.discord_user_id)
        .maybeSingle()

      setProfile({
        discord_username: player.discord_username,
        display_name: userProfile?.display_name || null,
        discord_user_id: player.discord_user_id,
      })
      setLoading(false)
    }

    loadProfile()
  }, [supabase])

  if (loading) {
    return null
  }

  if (!profile) {
    return null
  }

  const displayName = profile.display_name || profile.discord_username || 'Player'

  return (
    <Link
      href={`/profile/${profile.discord_user_id}`}
      className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-red-500/30 hover:bg-white/[0.05] transition-all group"
    >
      <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
        <span className="text-xs font-black text-red-500 uppercase">
          {displayName.charAt(0)}
        </span>
      </div>
      <div className="hidden md:block">
        <div className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[120px]">
          {displayName}
        </div>
      </div>
    </Link>
  )
}
