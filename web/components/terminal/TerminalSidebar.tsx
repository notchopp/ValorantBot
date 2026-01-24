'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Trophy, Users, User, LogOut, Shield, HelpCircle, 
  Terminal, Command, ChevronRight, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccentColor } from '@/lib/AccentColorContext'
import { useInitiation } from '@/lib/InitiationContext'
import { PlayerSearch } from '@/components/PlayerSearch'

interface TerminalSidebarProps {
  discordUserId?: string
  isAdmin?: boolean
}

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  href: string
  adminOnly?: boolean
  command?: string
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard, href: '/dashboard', command: 'cd /dashboard' },
  { id: 'season', label: 'SEASON', icon: Trophy, href: '/season', command: 'cat season.log' },
  { id: 'leaderboard', label: 'LEADERBOARD', icon: Users, href: '/leaderboard', command: 'top --sort=mmr' },
  { id: 'profile', label: 'PROFILE', icon: User, href: '', command: 'whoami --stats' },
  { id: 'hq', label: 'HQ', icon: Shield, href: '/hq', adminOnly: true, command: 'sudo admin' },
]

export function TerminalSidebar({ discordUserId, isAdmin = false }: TerminalSidebarProps) {
  const pathname = usePathname()
  const { accentColor } = useAccentColor()
  const initiation = useInitiation()
  const openGuide = initiation?.openGuide
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = navItems.filter(item => !item.adminOnly || isAdmin)

  const getActiveId = (): string => {
    if (pathname?.startsWith('/dashboard')) return 'dashboard'
    if (pathname?.startsWith('/season')) return 'season'
    if (pathname?.startsWith('/leaderboard')) return 'leaderboard'
    if (pathname?.startsWith('/profile')) return 'profile'
    if (pathname?.startsWith('/hq')) return 'hq'
    return 'dashboard'
  }

  const activeId = getActiveId()
  const activeItem = visibleItems.find(item => item.id === activeId)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const SidebarContent = () => (
    <>
      {/* Logo & Brand */}
      <div className="p-4 border-b" style={{ borderColor: `${accentColor}20` }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <motion.div whileHover={{ scale: 1.05 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/grnds-logo-3d.gif" 
              alt="GRNDS" 
              className="w-10 h-10 object-contain"
            />
          </motion.div>
          <div className="font-mono">
            <div className="flex items-center gap-1">
              <span className="text-white/30">$</span>
              <span className="text-sm font-bold" style={{ color: accentColor }}>grnds</span>
            </div>
            <div className="text-[10px] text-white/30">v2.0 // hub</div>
          </div>
        </Link>
      </div>

      {/* Search */}
      <div className="p-3 border-b" style={{ borderColor: `${accentColor}15` }}>
        <PlayerSearch />
      </div>

      {/* Current Command */}
      {activeItem && (
        <div className="px-4 py-3 border-b font-mono" style={{ borderColor: `${accentColor}15` }}>
          <div className="text-[10px] text-white/30 mb-1">CURRENT_CMD</div>
          <div className="flex items-center gap-2 text-xs">
            <span style={{ color: accentColor }}>$</span>
            <span className="text-white/60">{activeItem.command}</span>
            <motion.span 
              className="w-2 h-3 ml-1"
              style={{ backgroundColor: accentColor }}
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 p-3">
        <div className="text-[10px] font-mono text-white/30 px-3 mb-2 flex items-center gap-2">
          <Command className="w-3 h-3" style={{ color: accentColor }} />
          MODULES
        </div>
        <div className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon
            const isActive = activeId === item.id
            const href = item.id === 'profile' && discordUserId ? `/profile/${discordUserId}` : item.href

            return (
              <Link
                key={item.id}
                href={href}
                onClick={() => setMobileOpen(false)}
              >
                <motion.div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all font-mono text-sm cursor-pointer"
                  style={{
                    background: isActive ? `${accentColor}15` : 'transparent',
                    borderLeft: isActive ? `3px solid ${accentColor}` : '3px solid transparent',
                  }}
                  whileHover={{ x: 4, backgroundColor: isActive ? undefined : `${accentColor}08` }}
                >
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ 
                      background: isActive ? `${accentColor}25` : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Icon 
                      className="w-3.5 h-3.5"
                      style={{ color: isActive ? accentColor : 'rgba(255,255,255,0.4)' }}
                    />
                  </div>
                  <span 
                    className="flex-1 text-xs font-bold uppercase tracking-wide"
                    style={{ color: isActive ? accentColor : 'rgba(255,255,255,0.5)' }}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3" style={{ color: accentColor }} />
                  )}
                </motion.div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: `${accentColor}15` }}>
        {/* Help Button */}
        {openGuide && (
          <motion.button
            onClick={() => { openGuide(); setMobileOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-sm transition-all"
            style={{ background: 'rgba(255,255,255,0.03)' }}
            whileHover={{ backgroundColor: `${accentColor}10` }}
          >
            <HelpCircle className="w-4 h-4 text-white/40" />
            <span className="text-xs text-white/40 uppercase tracking-wide">Initiation Guide</span>
          </motion.button>
        )}
        
        {/* Sign Out */}
        <motion.button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-sm transition-all group"
          style={{ background: 'rgba(255,255,255,0.03)' }}
          whileHover={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
        >
          <LogOut className="w-4 h-4 text-white/40 group-hover:text-red-400 transition-colors" />
          <span className="text-xs text-white/40 group-hover:text-red-400 uppercase tracking-wide transition-colors">
            Sign Out
          </span>
        </motion.button>
      </div>

      {/* System Info */}
      <div className="px-4 py-3 border-t font-mono text-[10px]" style={{ borderColor: `${accentColor}10` }}>
        <div className="flex items-center gap-2 text-white/20">
          <Terminal className="w-3 h-3" />
          <span>sys.author = &quot;chopp&quot;</span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden md:flex flex-col w-64 flex-shrink-0 rounded-xl overflow-hidden border"
        style={{ 
          borderColor: `${accentColor}25`,
          background: 'linear-gradient(180deg, rgba(15,15,15,0.98) 0%, rgba(8,8,8,0.99) 100%)',
          boxShadow: `0 0 40px ${accentColor}08`,
        }}
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Menu Button */}
      <button 
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-[90] p-3 rounded-xl border"
        style={{ 
          background: 'rgba(0,0,0,0.9)',
          borderColor: `${accentColor}30`,
        }}
      >
        <Menu className="w-5 h-5" style={{ color: accentColor }} />
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
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 z-[110] flex flex-col rounded-r-xl overflow-hidden border-r"
              style={{ 
                borderColor: `${accentColor}30`,
                background: 'linear-gradient(180deg, rgba(10,10,10,0.99) 0%, rgba(5,5,5,1) 100%)',
              }}
            >
              {/* Close button */}
              <button 
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5 text-white/40" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
