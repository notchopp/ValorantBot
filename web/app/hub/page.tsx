'use client'
import { useEffect } from 'react'
import { GRNDSLogo3D } from '@/components/3D/GRNDSLogo3D'

export default function HubPage() {
  // Auto-enter fullscreen on first visit
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
        }
      } catch {
        // Fullscreen may be blocked by browser - that's okay
      }
    }
    enterFullscreen()
  }, [])

  return (
    <GRNDSLogo3D />
  )
}
