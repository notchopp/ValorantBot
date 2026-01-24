'use client'

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react'
import { InitiationGuide } from '@/components/InitiationGuide3D'

interface InitiationContextType {
  openGuide: () => void
  isOpen: boolean
}

const InitiationContext = createContext<InitiationContextType | null>(null)

export function useInitiation() {
  const context = useContext(InitiationContext)
  return context // Returns null if not within provider
}

interface InitiationProviderProps {
  children: ReactNode
  username: string
}

export function InitiationProvider({ children, username }: InitiationProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [forceOpen, setForceOpen] = useState(false)

  const openGuide = useCallback(() => {
    setForceOpen(true)
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setForceOpen(false)
    setIsOpen(false)
  }, [])

  // Auto-enter fullscreen on mount (first login)
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
    <InitiationContext.Provider value={{ openGuide, isOpen }}>
      <InitiationGuide 
        username={username} 
        forceOpen={forceOpen}
        onClose={handleClose}
      />
      {children}
    </InitiationContext.Provider>
  )
}
