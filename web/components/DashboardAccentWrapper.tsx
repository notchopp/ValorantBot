'use client'

import { useAccentColor } from '@/lib/AccentColorContext'
import { ReactNode } from 'react'

interface DashboardAccentWrapperProps {
  children: ReactNode
}

export function DashboardAccentWrapper({ children }: DashboardAccentWrapperProps) {
  const { accentColor } = useAccentColor()
  
  return (
    <div style={{ '--user-accent-color': accentColor } as React.CSSProperties}>
      {children}
    </div>
  )
}
