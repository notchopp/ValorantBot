'use client'

import { useEffect } from 'react'

interface ProfileAccentColorProps {
  accentColor: string
}

export function ProfileAccentColor({ accentColor }: ProfileAccentColorProps) {
  useEffect(() => {
    // Apply profile owner's accent color as CSS variable for this profile view
    // This overrides the user's own accent color when viewing someone else's profile
    document.documentElement.style.setProperty('--profile-accent-color', accentColor)
    
    return () => {
      // Reset on unmount - restore user's own accent color
      const userAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#ef4444'
      document.documentElement.style.setProperty('--profile-accent-color', userAccentColor)
    }
  }, [accentColor])

  return null
}
