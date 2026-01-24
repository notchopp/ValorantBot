'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAccentColor } from '@/lib/AccentColorContext'
import { useInitiation } from '@/lib/InitiationContext'
import { PlayerSearch } from '@/components/PlayerSearch'

interface TerminalSidebarProps {
  discordUserId?: string
  isAdmin?: boolean
}

interface FileNode {
  id: string
  name: string
  type: 'dir' | 'exe' | 'log' | 'dat' | 'sys'
  path: string
  href: string
  adminOnly?: boolean
  size?: string
  modified?: string
}

const fileSystem: FileNode[] = [
  { id: 'dashboard', name: 'dashboard', type: 'exe', path: '/root/dashboard', href: '/dashboard', size: '2.4K', modified: 'NOW' },
  { id: 'season', name: 'season.log', type: 'log', path: '/root/season.log', href: '/season', size: '847B', modified: '2h' },
  { id: 'leaderboard', name: 'leaderboard.dat', type: 'dat', path: '/root/leaderboard.dat', href: '/leaderboard', size: '12K', modified: '5m' },
  { id: 'profile', name: 'user.profile', type: 'sys', path: '/root/user.profile', href: '', size: '1.2K', modified: 'NOW' },
  { id: 'hq', name: '.admin', type: 'dir', path: '/root/.admin', href: '/hq', adminOnly: true, size: '4.0K', modified: '1d' },
]

const fileTypeColors: Record<string, string> = {
  exe: '#22c55e',
  log: '#eab308', 
  dat: '#3b82f6',
  sys: '#a855f7',
  dir: '#ef4444',
}

const fileTypeIcons: Record<string, string> = {
  exe: '>>',
  log: '[]',
  dat: '{}',
  sys: '<>',
  dir: '[]',
}

// Glitch text effect component
function GlitchText({ text, className = '' }: { text: string; className?: string }) {
  const [glitchText, setGlitchText] = useState(text)
  const [isGlitching, setIsGlitching] = useState(false)
  
  useEffect(() => {
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?0123456789'
    let timeout: NodeJS.Timeout
    
    const doGlitch = () => {
      if (Math.random() > 0.97) {
        setIsGlitching(true)
        let iterations = 0
        const maxIterations = 3
        
        const interval = setInterval(() => {
          setGlitchText(text.split('').map((char) => {
            if (Math.random() > 0.7) {
              return glitchChars[Math.floor(Math.random() * glitchChars.length)]
            }
            return char
          }).join(''))
          
          iterations++
          if (iterations >= maxIterations) {
            clearInterval(interval)
            setGlitchText(text)
            setIsGlitching(false)
          }
        }, 50)
      }
      timeout = setTimeout(doGlitch, 100)
    }
    
    doGlitch()
    return () => clearTimeout(timeout)
  }, [text])
  
  return (
    <span className={`${className} ${isGlitching ? 'text-red-500' : ''}`}>
      {glitchText}
    </span>
  )
}

export function TerminalSidebar({ discordUserId, isAdmin = false }: TerminalSidebarProps) {
  const pathname = usePathname()
  const { accentColor } = useAccentColor()
  const initiation = useInitiation()
  const openGuide = initiation?.openGuide
  const [mobileOpen, setMobileOpen] = useState(false)
  const [bootComplete, setBootComplete] = useState(false)
  const [typedPath, setTypedPath] = useState('')

  const visibleFiles = fileSystem.filter(file => !file.adminOnly || isAdmin)

  const getActiveId = (): string => {
    if (pathname?.startsWith('/dashboard')) return 'dashboard'
    if (pathname?.startsWith('/season')) return 'season'
    if (pathname?.startsWith('/leaderboard')) return 'leaderboard'
    if (pathname?.startsWith('/profile')) return 'profile'
    if (pathname?.startsWith('/hq')) return 'hq'
    return 'dashboard'
  }

  const activeId = getActiveId()
  const activeFile = visibleFiles.find(f => f.id === activeId)
  const currentPath = activeFile?.path || '/root'

  // Typing animation for current path
  useEffect(() => {
    setTypedPath('')
    let i = 0
    const interval = setInterval(() => {
      if (i < currentPath.length) {
        setTypedPath(currentPath.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
      }
    }, 30)
    return () => clearInterval(interval)
  }, [currentPath])

  // Boot sequence
  useEffect(() => {
    const timer = setTimeout(() => setBootComplete(true), 500)
    return () => clearTimeout(timer)
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const SidebarContent = () => (
    <div className="h-full flex flex-col font-mono text-[11px]">
      {/* Header - System Info */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/grnds-logo-3d.gif" 
              alt="GRNDS" 
              className="w-8 h-8 object-contain"
            />
            <div>
              <div className="text-white/90 font-bold tracking-wider">GRNDS</div>
              <div className="text-white/30 text-[9px]">v2.0_TERMINAL</div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-white/30">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>CONN:SECURE</span>
          <span className="text-white/10">|</span>
          <span>PID:7742</span>
        </div>
      </div>

      {/* Current Path */}
      <div className="px-3 py-2 bg-black/30 border-b border-white/5">
        <div className="flex items-center gap-1">
          <span className="text-green-500">root@grnds</span>
          <span className="text-white/30">:</span>
          <span className="text-blue-400">~</span>
          <span className="text-white/50">{typedPath}</span>
          <motion.span
            className="w-2 h-3 bg-white/70 ml-0.5"
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-white/5">
        <div className="text-[9px] text-white/30 mb-1 px-1">$ grep -r &quot;player&quot;</div>
        <PlayerSearch />
      </div>

      {/* File Explorer */}
      <div className="flex-1 overflow-y-auto">
        {/* Directory Header */}
        <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ color: accentColor }}>[</span>
            <span className="text-white/50">ls -la</span>
            <span style={{ color: accentColor }}>]</span>
          </div>
          <span className="text-white/20">{visibleFiles.length} items</span>
        </div>

        {/* File List */}
        <div className="p-1">
          {bootComplete && visibleFiles.map((file, index) => {
            const isActive = activeId === file.id
            const href = file.id === 'profile' && discordUserId ? `/profile/${discordUserId}` : file.href
            const typeColor = fileTypeColors[file.type]
            const typeIcon = fileTypeIcons[file.type]

            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                >
                  <motion.div
                    className={`
                      flex items-center gap-2 px-2 py-1.5 rounded transition-all cursor-pointer
                      ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}
                    `}
                    whileHover={{ x: 2 }}
                  >
                    {/* Selection indicator */}
                    <span className={`text-[10px] ${isActive ? 'text-green-500' : 'text-white/10'}`}>
                      {isActive ? '>' : ' '}
                    </span>
                    
                    {/* Permissions */}
                    <span className="text-white/20 text-[9px] w-16 hidden sm:inline">
                      {file.type === 'dir' ? 'drwxr-x' : '-rwxr--'}
                    </span>
                    
                    {/* Type icon */}
                    <span 
                      className="text-[10px] font-bold w-6"
                      style={{ color: typeColor }}
                    >
                      {typeIcon}
                    </span>
                    
                    {/* Filename */}
                    <span 
                      className={`flex-1 truncate ${isActive ? 'text-white' : 'text-white/60'}`}
                      style={{ color: isActive ? accentColor : undefined }}
                    >
                      {file.name}
                    </span>
                    
                    {/* Size */}
                    <span className="text-white/20 text-[9px] w-10 text-right">
                      {file.size}
                    </span>
                    
                    {/* Modified */}
                    <span className="text-white/20 text-[9px] w-8 text-right">
                      {file.modified}
                    </span>
                  </motion.div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-white/5 bg-black/40">
        {/* Quick Actions */}
        <div className="p-2 space-y-1">
          {openGuide && (
            <motion.button
              onClick={() => { openGuide(); setMobileOpen(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-white/40 hover:text-white/70 hover:bg-white/5 transition-all text-left"
              whileHover={{ x: 2 }}
            >
              <span className="text-yellow-500/70">[?]</span>
              <span>./help --guide</span>
            </motion.button>
          )}
          
          <motion.button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all text-left"
            whileHover={{ x: 2 }}
          >
            <span className="text-red-500/70">[X]</span>
            <span>exit --logout</span>
          </motion.button>
        </div>

        {/* System Footer */}
        <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between text-[9px]">
          <GlitchText text="sys.author" className="text-white/20" />
          <span className="text-white/30">=</span>
          <span style={{ color: accentColor }}>&quot;chopp&quot;</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden md:flex flex-col w-64 flex-shrink-0 rounded-lg overflow-hidden border border-white/10"
        style={{ 
          background: 'linear-gradient(180deg, rgba(8,8,8,0.98) 0%, rgba(3,3,3,0.99) 100%)',
          boxShadow: `0 0 60px ${accentColor}05, inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Menu Button */}
      <button 
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[90] p-2.5 rounded-lg border border-white/10 bg-black/90"
      >
        <div className="flex flex-col gap-1">
          <span className="w-4 h-0.5 bg-white/50" />
          <span className="w-4 h-0.5 bg-white/50" />
          <span className="w-3 h-0.5 bg-white/50" />
        </div>
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-[110] flex flex-col border-r border-white/10"
              style={{ 
                background: 'linear-gradient(180deg, rgba(5,5,5,0.99) 0%, rgba(0,0,0,1) 100%)',
              }}
            >
              {/* Close button */}
              <button 
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded text-white/30 hover:text-white/60 hover:bg-white/5"
              >
                <span className="text-xs font-mono">[X]</span>
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
