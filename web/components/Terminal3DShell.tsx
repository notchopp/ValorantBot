'use client'

import { motion } from 'framer-motion'
import { Terminal } from 'lucide-react'
import { useAccentColor } from '@/lib/AccentColorContext'
import { TerminalSidebar } from './terminal/TerminalSidebar'

interface Terminal3DShellProps {
  children: React.ReactNode
  discordUserId?: string
  isAdmin?: boolean
}

export function Terminal3DShell({ children, discordUserId, isAdmin }: Terminal3DShellProps) {
  const { accentColor } = useAccentColor()
  
  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* 3D Space Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)',
        }}
      >
        {/* Animated grid floor */}
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            background: `
              linear-gradient(90deg, ${accentColor}22 1px, transparent 1px),
              linear-gradient(${accentColor}22 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
            transform: 'perspective(500px) rotateX(60deg) translateY(-30%)',
            transformOrigin: 'center center',
          }}
        />
        
        {/* Secondary grid overlay for depth */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            background: `
              linear-gradient(90deg, ${accentColor}33 1px, transparent 1px),
              linear-gradient(${accentColor}33 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{ 
                backgroundColor: accentColor,
                left: `${10 + Math.random() * 80}%`,
                top: `${10 + Math.random() * 80}%`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [0.1, 0.4, 0.1],
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        
        {/* Central glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full opacity-[0.07] blur-[200px] pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />
        
        {/* Top edge glow */}
        <div 
          className="absolute top-0 left-0 right-0 h-[300px] opacity-[0.03] blur-[100px] pointer-events-none"
          style={{ 
            background: `linear-gradient(to bottom, ${accentColor}, transparent)` 
          }}
        />
      </div>

      {/* Main Layout */}
      <div className="relative z-10 w-full h-full flex flex-col p-2 sm:p-4 md:p-6">
        {/* Terminal Chrome - Top Bar with dots */}
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex-shrink-0 max-w-[1920px] mx-auto w-full"
        >
          <div 
            className="flex items-center gap-3 px-4 py-2 rounded-t-xl border-t border-l border-r"
            style={{ 
              borderColor: `${accentColor}30`,
              background: `linear-gradient(180deg, ${accentColor}08 0%, transparent 100%)`,
            }}
          >
            {/* Mac-style dots */}
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70 hover:bg-red-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70 hover:bg-yellow-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-green-500/70 hover:bg-green-500 transition-colors cursor-pointer" />
            </div>
            
            {/* Terminal title */}
            <div className="flex-1 text-center">
              <span className="text-[10px] font-mono text-white/30 tracking-wider">
                GRNDS_TERMINAL v2.0 // hub.grnds.xyz
              </span>
            </div>
            
            {/* Terminal icon */}
            <Terminal className="w-4 h-4 text-white/20" />
          </div>
        </motion.div>

        {/* Terminal Body - Sidebar + Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-1 max-w-[1920px] mx-auto w-full flex gap-4 rounded-b-xl border-b border-l border-r overflow-hidden p-4"
          style={{ 
            borderColor: `${accentColor}20`,
            background: 'linear-gradient(180deg, rgba(10,10,10,0.95) 0%, rgba(5,5,5,0.98) 100%)',
            boxShadow: `0 0 100px ${accentColor}10, 0 30px 60px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Sidebar */}
          <TerminalSidebar discordUserId={discordUserId} isAdmin={isAdmin} />
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl">
            {children}
          </div>
        </motion.div>
      </div>

      {/* Scan line effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-[60] opacity-[0.015]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />
    </div>
  )
}
