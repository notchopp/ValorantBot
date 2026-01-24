'use client'

import { usePathname } from 'next/navigation'
import { Terminal3DShell } from './Terminal3DShell'

interface Terminal3DShellClientProps {
  children: React.ReactNode
  discordUserId?: string
  isAdmin?: boolean
}

export function Terminal3DShellClient({ children, discordUserId, isAdmin }: Terminal3DShellClientProps) {
  const pathname = usePathname()
  
  // Don't wrap certain pages in the terminal shell
  const excludedPaths = ['/auth/login', '/hub', '/auth/callback']
  const shouldExclude = excludedPaths.some(path => pathname?.startsWith(path))
  
  if (shouldExclude) {
    return <>{children}</>
  }
  
  return (
    <Terminal3DShell discordUserId={discordUserId} isAdmin={isAdmin}>
      {children}
    </Terminal3DShell>
  )
}
