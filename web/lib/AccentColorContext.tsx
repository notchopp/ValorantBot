'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AccentColorContextType {
  accentColor: string
  setAccentColor: (color: string) => void
  isLoading: boolean
}

const AccentColorContext = createContext<AccentColorContextType>({
  accentColor: '#ef4444',
  setAccentColor: () => {},
  isLoading: true,
})

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColorState] = useState('#ef4444')
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function loadAccentColor() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setIsLoading(false)
          return
        }

        // Get player's discord_user_id
        const { data: player } = await supabase
          .from('players')
          .select('discord_user_id')
          .eq('id', user.id)
          .maybeSingle()

        if (player?.discord_user_id) {
          // Get user profile accent color
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('accent_color')
            .eq('discord_user_id', player.discord_user_id)
            .maybeSingle()

          if (profile?.accent_color) {
            setAccentColorState(profile.accent_color)
          }
        }
      } catch (error) {
        console.error('Error loading accent color:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadAccentColor()
  }, [supabase])

  const setAccentColor = (color: string) => {
    setAccentColorState(color)
  }

  useEffect(() => {
    // Set CSS variable for user's accent color
    document.documentElement.style.setProperty('--accent-color', accentColor)
  }, [accentColor])

  return (
    <AccentColorContext.Provider value={{ accentColor, setAccentColor, isLoading }}>
      {children}
    </AccentColorContext.Provider>
  )
}

export function useAccentColor() {
  return useContext(AccentColorContext)
}
