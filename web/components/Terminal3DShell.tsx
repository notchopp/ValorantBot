'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useAccentColor } from '@/lib/AccentColorContext'
import { TerminalSidebar } from './terminal/TerminalSidebar'

interface Terminal3DShellProps {
  children: React.ReactNode
  discordUserId?: string
  isAdmin?: boolean
}

// Data stream characters
const DATA_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'

// Floating data stream component
function DataStream({ delay = 0, left = '10%' }: { delay?: number; left?: string }) {
  const [chars, setChars] = useState<string[]>([])
  
  useEffect(() => {
    const newChars = Array.from({ length: 20 }, () => 
      DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)]
    )
    setChars(newChars)
    
    const interval = setInterval(() => {
      setChars(prev => {
        const updated = [...prev]
        const randomIndex = Math.floor(Math.random() * updated.length)
        updated[randomIndex] = DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)]
        return updated
      })
    }, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <motion.div
      className="absolute top-0 font-mono text-[10px] leading-tight pointer-events-none select-none"
      style={{ left }}
      initial={{ y: -200, opacity: 0 }}
      animate={{ y: '100vh', opacity: [0, 0.3, 0.3, 0] }}
      transition={{ 
        duration: 8 + Math.random() * 4, 
        repeat: Infinity, 
        delay,
        ease: 'linear'
      }}
    >
      {chars.map((char, i) => (
        <div key={i} className="text-green-500/30">{char}</div>
      ))}
    </motion.div>
  )
}

// Glitch overlay effect
function GlitchOverlay() {
  const [glitchActive, setGlitchActive] = useState(false)
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.95) {
        setGlitchActive(true)
        setTimeout(() => setGlitchActive(false), 100 + Math.random() * 100)
      }
    }, 200)
    return () => clearInterval(interval)
  }, [])
  
  if (!glitchActive) return null
  
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[70]"
      style={{
        background: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(255,0,0,0.03) 2px,
          rgba(255,0,0,0.03) 4px
        )`,
        transform: `translateX(${Math.random() * 4 - 2}px)`,
      }}
    />
  )
}

export function Terminal3DShell({ children, discordUserId, isAdmin }: Terminal3DShellProps) {
  const { accentColor } = useAccentColor()
  const [bootSequence, setBootSequence] = useState(true)
  const [bootText, setBootText] = useState<string[]>([])
  
  // Boot sequence animation
  useEffect(() => {
    const bootMessages = [
      '[INIT] Loading kernel...',
      '[BOOT] Mounting /root filesystem...',
      '[AUTH] Establishing secure connection...',
      '[SYNC] Syncing player data...',
      '[DONE] System ready.',
    ]
    
    let currentIndex = 0
    const interval = setInterval(() => {
      if (currentIndex < bootMessages.length) {
        setBootText(prev => [...prev, bootMessages[currentIndex]])
        currentIndex++
      } else {
        clearInterval(interval)
        setTimeout(() => setBootSequence(false), 300)
      }
    }, 150)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      {/* Boot Sequence Overlay */}
      {bootSequence && (
        <motion.div 
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
          exit={{ opacity: 0 }}
        >
          <div className="font-mono text-xs text-green-500/80 max-w-md">
            {bootText.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-1"
              >
                {line}
              </motion.div>
            ))}
            <motion.span
              className="inline-block w-2 h-3 bg-green-500/80 ml-1"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}

      {/* Background Layer */}
      <div className="absolute inset-0">
        {/* Deep black with subtle noise texture */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 0%, #0a0808 0%, #000000 50%, #000000 100%)',
          }}
        />
        
        {/* Hexagonal grid pattern - Watch Dogs style */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5'%3E%3Cpath d='M30 0L60 15V45L30 60L0 45V15Z'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        
        {/* Perspective grid floor */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: `
              linear-gradient(90deg, ${accentColor}40 1px, transparent 1px),
              linear-gradient(0deg, ${accentColor}40 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
            transform: 'perspective(400px) rotateX(75deg) translateY(-50%)',
            transformOrigin: 'center top',
          }}
        />
        
        {/* Data streams - Matrix/Watch Dogs style */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <DataStream delay={0} left="5%" />
          <DataStream delay={2} left="15%" />
          <DataStream delay={4} left="85%" />
          <DataStream delay={6} left="92%" />
        </div>
        
        {/* Accent color glow spots */}
        <div 
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.02] blur-[150px] pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />
        <div 
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03] blur-[120px] pointer-events-none"
          style={{ backgroundColor: accentColor }}
        />
        
        {/* Edge vignette */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)',
          }}
        />
      </div>

      {/* Main Layout */}
      <motion.div 
        className="relative z-10 w-full h-full flex flex-col p-2 sm:p-3 md:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: bootSequence ? 0 : 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        {/* Top Status Bar */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex-shrink-0 max-w-[1920px] mx-auto w-full mb-3"
        >
          <div className="flex items-center justify-between px-4 py-2 font-mono text-[10px] border-b border-white/5">
            {/* Left - System info */}
            <div className="flex items-center gap-4 text-white/30">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>SYSTEM:ONLINE</span>
              </span>
              <span className="hidden sm:inline text-white/10">|</span>
              <span className="hidden sm:inline">UPTIME:24:07:33</span>
            </div>
            
            {/* Center - Title */}
            <div className="flex items-center gap-2">
              <span style={{ color: accentColor }}>[</span>
              <span className="text-white/50 tracking-widest">GRNDS_TERMINAL</span>
              <span style={{ color: accentColor }}>]</span>
            </div>
            
            {/* Right - Connection info */}
            <div className="flex items-center gap-4 text-white/30">
              <span className="hidden sm:inline">LATENCY:12ms</span>
              <span className="text-white/10 hidden sm:inline">|</span>
              <span className="flex items-center gap-1">
                <span style={{ color: accentColor }}>&#x25CF;</span>
                <span>SECURE</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Main Content Area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="flex-1 max-w-[1920px] mx-auto w-full flex gap-3 overflow-hidden"
        >
          {/* Sidebar */}
          <TerminalSidebar discordUserId={discordUserId} isAdmin={isAdmin} />
          
          {/* Main Content */}
          <div 
            className="flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-white/5"
            style={{
              background: 'linear-gradient(180deg, rgba(8,8,8,0.95) 0%, rgba(3,3,3,0.98) 100%)',
            }}
          >
            {children}
          </div>
        </motion.div>

        {/* Bottom Status Bar */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex-shrink-0 max-w-[1920px] mx-auto w-full mt-3"
        >
          <div className="flex items-center justify-between px-4 py-1.5 font-mono text-[9px] text-white/20 border-t border-white/5">
            <span>hub.grnds.xyz</span>
            <span className="flex items-center gap-4">
              <span className="hidden sm:inline">MEM:847MB</span>
              <span className="hidden sm:inline">CPU:12%</span>
              <span>v2.0.0</span>
            </span>
            <span>sys.author = &quot;chopp&quot;</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Scan lines overlay */}
      <div 
        className="fixed inset-0 pointer-events-none z-[60] opacity-[0.02]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)',
        }}
      />
      
      {/* Random glitch effect */}
      <GlitchOverlay />
      
      {/* CRT screen curve effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-[50] opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </div>
  )
}
