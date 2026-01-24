'use client'

import { usePathname } from 'next/navigation'
import { Terminal3DShell } from './Terminal3DShell'

interface Terminal3DShellWrapperProps {
  children: React.ReactNode
}

export function Terminal3DShellWrapper({ children }: Terminal3DShellWrapperProps) {
  const pathname = usePathname()
  
  // Don't wrap certain pages in the terminal shell
  const excludedPaths = ['/auth/login', '/hub', '/auth/callback']
  const shouldExclude = excludedPaths.some(path => pathname?.startsWith(path))
  
  if (shouldExclude) {
    return <>{children}</>
  }
  
  return (
    <Terminal3DShell>
      {children}
    </Terminal3DShell>
  )
}
