'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChevronRight, 
  Terminal, 
  MessageSquare, 
  Trophy, 
  Zap, 
  CheckCircle, 
  ExternalLink, 
  TrendingUp, 
  Swords, 
  Target, 
  Rocket,
  Command,
  Play,
  Loader2
} from 'lucide-react'

// GRNDS Red accent
const ACCENT = '#dc2626'

// Terminal commands that users will "type"
const TERMINAL_COMMANDS = [
  { cmd: 'grnds --init', response: 'Initializing GRNDS System...' },
  { cmd: 'load user.profile', response: 'Loading operative data...' },
  { cmd: 'connect discord.api', response: 'Connection established.' },
  { cmd: 'ready', response: 'SYSTEM READY. Welcome, Operative.' },
]

interface InitiationGuideProps {
  username: string
  forceOpen?: boolean
  onClose?: () => void
}

export function InitiationGuide({ username, forceOpen, onClose }: InitiationGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<'boot' | 'intro' | 'sections' | 'complete'>('boot')
  const [bootLine, setBootLine] = useState(0)
  const [typedCommand, setTypedCommand] = useState('')
  const [showResponse, setShowResponse] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [terminalHistory, setTerminalHistory] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)

  // Sections data
  const sections = [
    {
      id: 'about',
      title: 'ABOUT_GRNDS',
      icon: Zap,
      command: 'cat /docs/about.md',
      content: {
        title: 'What is GRNDS?',
        items: [
          { icon: Swords, label: 'Balanced Matches', desc: 'Fair 5v5 teams based on skill' },
          { icon: TrendingUp, label: 'MMR System', desc: 'Performance-based rankings' },
          { icon: Target, label: 'Stats Tracking', desc: 'K/D, matches, and more' },
        ]
      }
    },
    {
      id: 'commands',
      title: 'DISCORD_COMMANDS',
      icon: MessageSquare,
      command: 'grnds --help commands',
      content: {
        title: 'Essential Commands',
        commands: [
          { cmd: '/account link', desc: 'Link your game account', required: true },
          { cmd: '/verify', desc: 'Get your initial rank', required: true },
          { cmd: '/queue join', desc: 'Enter matchmaking', required: true },
          { cmd: '/rank', desc: 'View your current rank' },
          { cmd: '/stats', desc: 'View your statistics' },
          { cmd: '/leaderboard', desc: 'See top players' },
        ]
      }
    },
    {
      id: 'ranks',
      title: 'RANK_SYSTEM',
      icon: Trophy,
      command: 'grnds --show ranks',
      content: {
        title: 'Rank Tiers',
        ranks: [
          { tier: 'GRNDS I-V', mmr: '0 - 1499', color: '#ff8c00' },
          { tier: 'BREAKPOINT I-V', mmr: '1500 - 2399', color: '#888888' },
          { tier: 'CHALLENGER I-III', mmr: '2400 - 2999', color: '#dc2626' },
          { tier: 'X', mmr: '3000+', color: '#ffffff' },
        ]
      }
    },
    {
      id: 'web',
      title: 'WEB_INTERFACE',
      icon: ExternalLink,
      command: 'open hub.grnds.xyz',
      content: {
        title: 'Web Features',
        features: [
          { label: 'Dashboard', desc: 'Your personal stats hub', current: true },
          { label: 'Profile', desc: 'Customize your appearance' },
          { label: 'Leaderboard', desc: 'Full rankings' },
          { label: 'Season', desc: 'Track seasonal progress' },
        ]
      }
    },
    {
      id: 'start',
      title: 'GET_STARTED',
      icon: Rocket,
      command: 'grnds --start',
      content: {
        title: 'Quick Start Checklist',
        steps: [
          'Link your game account with /account link',
          'Run /verify to get your initial rank',
          'Use /queue join to find a match',
          'Play, win, and climb the ranks!',
        ]
      }
    },
  ]

  // Handle forceOpen prop
  useEffect(() => {
    if (forceOpen) {
      setPhase('boot')
      setBootLine(0)
      setActiveSection(0)
      setTerminalHistory([])
      setIsOpen(true)
    }
  }, [forceOpen])

  // Auto-show on first visit
  useEffect(() => {
    if (forceOpen) return
    const hasSeen = localStorage.getItem('grnds_initiation_seen')
    if (!hasSeen) {
      const timeout = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timeout)
    }
  }, [forceOpen])

  // Boot sequence
  useEffect(() => {
    if (!isOpen || phase !== 'boot') return
    
    if (bootLine < TERMINAL_COMMANDS.length) {
      const cmd = TERMINAL_COMMANDS[bootLine]
      setTypedCommand('')
      setShowResponse(false)
      setIsTyping(true)
      
      // Type out command
      let i = 0
      const typeInterval = setInterval(() => {
        if (i < cmd.cmd.length) {
          setTypedCommand(prev => prev + cmd.cmd[i])
          i++
        } else {
          clearInterval(typeInterval)
          setIsTyping(false)
          setTimeout(() => {
            setShowResponse(true)
            setTerminalHistory(prev => [...prev, `$ ${cmd.cmd}`, cmd.response])
            setTimeout(() => setBootLine(prev => prev + 1), 600)
          }, 300)
        }
      }, 40)
      
      return () => clearInterval(typeInterval)
    } else {
      // Boot complete, move to intro
      setTimeout(() => setPhase('intro'), 500)
    }
  }, [isOpen, phase, bootLine])

  // Intro phase with username
  useEffect(() => {
    if (phase !== 'intro') return
    
    const timer = setTimeout(() => setPhase('sections'), 2000)
    return () => clearTimeout(timer)
  }, [phase])

  const handleClose = useCallback(() => {
    localStorage.setItem('grnds_initiation_seen', 'true')
    setIsOpen(false)
    onClose?.()
  }, [onClose])

  const handleSectionClick = useCallback((index: number) => {
    setActiveSection(index)
    // Add to terminal history
    const section = sections[index]
    setTerminalHistory(prev => [...prev, `$ ${section.command}`, `Loading ${section.title}...`])
  }, [sections])

  const handleNext = useCallback(() => {
    if (activeSection < sections.length - 1) {
      setTimeout(() => {
        setActiveSection(prev => prev + 1)
        const section = sections[activeSection + 1]
        setTerminalHistory(prev => [...prev, `$ ${section.command}`, `Loading ${section.title}...`])
      }, 300)
    } else {
      setPhase('complete')
    }
  }, [activeSection, sections])

  const handleComplete = useCallback(() => {
    handleClose()
  }, [handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* 3D Space Background */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%)',
          perspective: '1000px',
        }}
      >
        {/* Animated grid floor */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: `
              linear-gradient(90deg, ${ACCENT}22 1px, transparent 1px),
              linear-gradient(${ACCENT}22 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            transform: 'rotateX(60deg) translateY(-50%)',
            transformOrigin: 'center center',
          }}
        />
        
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{ 
                backgroundColor: ACCENT,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>
        
        {/* Central glow */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full opacity-10 blur-[150px]"
          style={{ backgroundColor: ACCENT }}
        />
      </div>

      {/* Main Content */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {/* Boot Phase */}
          {phase === 'boot' && (
            <motion.div
              key="boot"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl"
              style={{ perspective: '1000px' }}
            >
              {/* 3D Terminal Window */}
              <motion.div
                className="relative"
                style={{
                  transformStyle: 'preserve-3d',
                }}
                animate={{
                  rotateX: [2, -2, 2],
                  rotateY: [-1, 1, -1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                {/* Terminal chrome */}
                <div 
                  className="rounded-xl overflow-hidden border shadow-2xl"
                  style={{ 
                    borderColor: `${ACCENT}40`,
                    boxShadow: `0 0 60px ${ACCENT}20, inset 0 1px 0 rgba(255,255,255,0.1)`,
                    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                  }}
                >
                  {/* Title bar */}
                  <div 
                    className="flex items-center gap-2 px-4 py-3 border-b"
                    style={{ 
                      borderColor: `${ACCENT}30`,
                      background: `linear-gradient(90deg, ${ACCENT}10, transparent)`,
                    }}
                  >
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                      <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 text-center">
                      <span className="text-xs font-mono text-white/40">GRNDS_TERMINAL v2.0</span>
                    </div>
                    <Terminal className="w-4 h-4 text-white/40" />
                  </div>
                  
                  {/* Terminal content */}
                  <div className="p-6 font-mono text-sm min-h-[300px]">
                    {/* GRNDS Logo */}
                    <div className="flex justify-center mb-6">
                      <motion.img
                        src="/grnds-logo.gif"
                        alt="GRNDS"
                        className="w-24 h-24 object-contain"
                        animate={{ 
                          filter: ['hue-rotate(-30deg) brightness(1)', 'hue-rotate(-30deg) brightness(1.2)', 'hue-rotate(-30deg) brightness(1)']
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                    
                    {/* Terminal history */}
                    <div className="space-y-1 mb-4">
                      {terminalHistory.map((line, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={line.startsWith('$') ? 'text-white/80' : 'text-green-400/80'}
                        >
                          {line}
                        </motion.div>
                      ))}
                    </div>
                    
                    {/* Current command line */}
                    {bootLine < TERMINAL_COMMANDS.length && (
                      <div className="flex items-center gap-2">
                        <span className="text-[#dc2626]">$</span>
                        <span className="text-white">{typedCommand}</span>
                        {isTyping && (
                          <motion.span
                            className="w-2 h-4 bg-white"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                          />
                        )}
                      </div>
                    )}
                    
                    {showResponse && bootLine < TERMINAL_COMMANDS.length && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-green-400 mt-1"
                      >
                        {TERMINAL_COMMANDS[bootLine].response}
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Intro Phase */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="text-center"
            >
              <motion.img
                src="/grnds-logo.gif"
                alt="GRNDS"
                className="w-32 h-32 mx-auto mb-6"
                animate={{ 
                  scale: [1, 1.1, 1],
                  filter: ['hue-rotate(-30deg) brightness(1)', 'hue-rotate(-30deg) brightness(1.3)', 'hue-rotate(-30deg) brightness(1)']
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.h1
                className="text-4xl md:text-6xl font-black font-mono mb-4"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                <span style={{ color: ACCENT }}>#</span>GRNDS
              </motion.h1>
              <motion.div
                className="text-xl font-mono text-white/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                WELCOME, <span style={{ color: ACCENT }}>{username.toUpperCase()}</span>
              </motion.div>
              <motion.div
                className="flex items-center justify-center gap-2 mt-6 text-white/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm font-mono">Initializing training modules...</span>
              </motion.div>
            </motion.div>
          )}

          {/* Sections Phase */}
          {phase === 'sections' && (
            <motion.div
              key="sections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-6xl mx-auto flex gap-6"
              style={{ perspective: '2000px' }}
            >
              {/* Left sidebar - Section navigation */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-64 flex-shrink-0"
              >
                <div 
                  className="rounded-xl overflow-hidden border"
                  style={{ 
                    borderColor: `${ACCENT}30`,
                    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                    boxShadow: `0 0 40px ${ACCENT}10`,
                  }}
                >
                  {/* Header */}
                  <div 
                    className="px-4 py-3 border-b flex items-center gap-2"
                    style={{ borderColor: `${ACCENT}30` }}
                  >
                    <Command className="w-4 h-4" style={{ color: ACCENT }} />
                    <span className="text-xs font-mono font-bold" style={{ color: ACCENT }}>MODULES</span>
                  </div>
                  
                  {/* Section list */}
                  <div className="p-2 space-y-1">
                    {sections.map((section, i) => {
                      const Icon = section.icon
                      const isActive = i === activeSection
                      const isCompleted = i < activeSection
                      
                      return (
                        <motion.button
                          key={section.id}
                          onClick={() => handleSectionClick(i)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all font-mono text-sm"
                          style={{
                            background: isActive ? `${ACCENT}20` : 'transparent',
                            borderLeft: isActive ? `3px solid ${ACCENT}` : '3px solid transparent',
                          }}
                          whileHover={{ x: 4 }}
                        >
                          <div 
                            className="w-6 h-6 rounded flex items-center justify-center"
                            style={{ 
                              background: isCompleted ? `${ACCENT}30` : isActive ? `${ACCENT}20` : 'rgba(255,255,255,0.05)',
                            }}
                          >
                            {isCompleted ? (
                              <CheckCircle className="w-3 h-3" style={{ color: ACCENT }} />
                            ) : (
                              <Icon className="w-3 h-3" style={{ color: isActive ? ACCENT : 'rgba(255,255,255,0.4)' }} />
                            )}
                          </div>
                          <span 
                            className="text-xs truncate"
                            style={{ color: isActive ? ACCENT : 'rgba(255,255,255,0.5)' }}
                          >
                            {section.title}
                          </span>
                          {isActive && (
                            <ChevronRight className="w-3 h-3 ml-auto" style={{ color: ACCENT }} />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                  
                  {/* Progress */}
                  <div className="px-4 py-3 border-t" style={{ borderColor: `${ACCENT}20` }}>
                    <div className="flex justify-between text-xs font-mono mb-2">
                      <span className="text-white/40">Progress</span>
                      <span style={{ color: ACCENT }}>{Math.round((activeSection / sections.length) * 100)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: ACCENT }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(activeSection / sections.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Main content area - 3D Terminal */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex-1"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <motion.div
                  animate={{
                    rotateX: [1, -1, 1],
                    rotateY: [-0.5, 0.5, -0.5],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div 
                    className="rounded-xl overflow-hidden border"
                    style={{ 
                      borderColor: `${ACCENT}40`,
                      boxShadow: `0 0 80px ${ACCENT}15, 0 20px 60px rgba(0,0,0,0.5)`,
                      background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                    }}
                  >
                    {/* Title bar */}
                    <div 
                      className="flex items-center gap-2 px-4 py-3 border-b"
                      style={{ 
                        borderColor: `${ACCENT}30`,
                        background: `linear-gradient(90deg, ${ACCENT}10, transparent)`,
                      }}
                    >
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="flex-1 text-center">
                        <span className="text-xs font-mono text-white/40">
                          {sections[activeSection].command}
                        </span>
                      </div>
                      <Play className="w-4 h-4" style={{ color: ACCENT }} />
                    </div>
                    
                    {/* Content */}
                    <div className="p-8 min-h-[400px]">
                      <AnimatePresence mode="wait">
                        <SectionContent
                          key={activeSection}
                          section={sections[activeSection]}
                          onNext={handleNext}
                          isLast={activeSection === sections.length - 1}
                        />
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Right sidebar - Mini terminal log */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="w-56 flex-shrink-0 hidden lg:block"
              >
                <div 
                  className="rounded-xl overflow-hidden border h-full"
                  style={{ 
                    borderColor: `${ACCENT}20`,
                    background: 'linear-gradient(180deg, #0d0d0d 0%, #080808 100%)',
                  }}
                >
                  <div 
                    className="px-4 py-3 border-b flex items-center gap-2"
                    style={{ borderColor: `${ACCENT}20` }}
                  >
                    <Terminal className="w-3 h-3 text-white/40" />
                    <span className="text-[10px] font-mono text-white/40">SYSTEM_LOG</span>
                  </div>
                  <div className="p-3 text-[10px] font-mono text-white/30 space-y-1 max-h-[400px] overflow-y-auto">
                    {terminalHistory.slice(-15).map((line, i) => (
                      <div 
                        key={i} 
                        className={line.startsWith('$') ? 'text-white/50' : 'text-green-400/50'}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.img
                src="/grnds-logo.gif"
                alt="GRNDS"
                className="w-40 h-40 mx-auto mb-6"
                animate={{ 
                  scale: [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Rocket className="w-16 h-16 mx-auto mb-4" style={{ color: ACCENT }} />
                <h2 className="text-3xl md:text-5xl font-black font-mono mb-4">
                  INITIATION <span style={{ color: ACCENT }}>COMPLETE</span>
                </h2>
                <p className="text-white/60 font-mono mb-8">
                  You&apos;re ready to compete, <span style={{ color: ACCENT }}>{username}</span>
                </p>
                <motion.button
                  onClick={handleComplete}
                  className="px-8 py-4 rounded-xl font-mono font-bold text-white border-2 transition-all"
                  style={{ 
                    borderColor: ACCENT,
                    background: `${ACCENT}20`,
                  }}
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: `0 0 30px ${ACCENT}40`,
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  ENTER THE GROUNDS
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Skip button - always visible */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        onClick={handleClose}
        className="fixed bottom-8 right-8 text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
      >
        [ESC] Skip initiation
      </motion.button>
    </div>
  )
}

// Section content component
interface SectionContentProps {
  section: {
    id: string
    title: string
    command: string
    content: {
      title: string
      items?: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; desc: string }[]
      commands?: { cmd: string; desc: string; required?: boolean }[]
      ranks?: { tier: string; mmr: string; color: string }[]
      features?: { label: string; desc: string; current?: boolean }[]
      steps?: string[]
    }
  }
  onNext: () => void
  isLast: boolean
}

function SectionContent({ section, onNext, isLast }: SectionContentProps) {
  const content = section.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Title */}
      <div className="flex items-center gap-3 mb-8">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${ACCENT}20` }}
        >
          <Terminal className="w-5 h-5" style={{ color: ACCENT }} />
        </div>
        <div>
          <h3 className="text-2xl font-black font-mono text-white">{content.title}</h3>
          <span className="text-xs font-mono text-white/40">$ {section.command}</span>
        </div>
      </div>

      {/* Items (About section) */}
      {content.items && (
        <div className="grid gap-4">
          {content.items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-4 rounded-lg border"
              style={{ 
                borderColor: `${ACCENT}30`,
                background: `${ACCENT}05`,
              }}
            >
              <item.icon className="w-6 h-6 flex-shrink-0" style={{ color: ACCENT }} />
              <div>
                <div className="font-bold text-white font-mono">{item.label}</div>
                <div className="text-sm text-white/50">{item.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Commands (Discord section) */}
      {content.commands && (
        <div className="space-y-2">
          {content.commands.map((cmd, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-lg"
              style={{ 
                background: cmd.required ? `${ACCENT}10` : 'rgba(255,255,255,0.03)',
                border: cmd.required ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <code 
                className="px-2 py-1 rounded text-sm font-mono"
                style={{ 
                  background: cmd.required ? `${ACCENT}20` : 'rgba(255,255,255,0.1)',
                  color: cmd.required ? ACCENT : 'white',
                }}
              >
                {cmd.cmd}
              </code>
              <span className="text-sm text-white/50 flex-1">{cmd.desc}</span>
              {cmd.required && (
                <span className="text-[10px] font-mono px-2 py-1 rounded" style={{ background: `${ACCENT}30`, color: ACCENT }}>
                  REQUIRED
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Ranks (Rank section) */}
      {content.ranks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {content.ranks.map((rank, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="p-4 rounded-lg border text-center"
              style={{ 
                borderColor: `${rank.color}40`,
                background: `${rank.color}10`,
              }}
            >
              <div className="font-bold font-mono" style={{ color: rank.color }}>{rank.tier}</div>
              <div className="text-xs text-white/40 mt-1">{rank.mmr} MMR</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Features (Web section) */}
      {content.features && (
        <div className="space-y-3">
          {content.features.map((feature, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 p-4 rounded-lg"
              style={{ 
                background: feature.current ? `${ACCENT}10` : 'rgba(255,255,255,0.03)',
                border: feature.current ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div 
                className="w-2 h-2 rounded-full"
                style={{ 
                  background: feature.current ? ACCENT : 'rgba(255,255,255,0.3)',
                  boxShadow: feature.current ? `0 0 10px ${ACCENT}` : 'none',
                }}
              />
              <div>
                <div className="font-bold text-white font-mono text-sm">
                  {feature.label}
                  {feature.current && <span className="text-xs ml-2 text-white/40">(YOU ARE HERE)</span>}
                </div>
                <div className="text-xs text-white/50">{feature.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Steps (Getting started section) */}
      {content.steps && (
        <div className="space-y-3">
          {content.steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-4 rounded-lg border"
              style={{ 
                borderColor: 'rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold font-mono"
                style={{ 
                  background: `${ACCENT}20`,
                  border: `1px solid ${ACCENT}50`,
                  color: ACCENT,
                }}
              >
                {i + 1}
              </div>
              <div className="text-white/80 font-mono text-sm pt-1">{step}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Next button */}
      <motion.button
        onClick={onNext}
        className="w-full mt-8 py-4 rounded-lg font-mono font-bold text-white flex items-center justify-center gap-2 transition-all"
        style={{ 
          background: `${ACCENT}20`,
          border: `1px solid ${ACCENT}50`,
        }}
        whileHover={{ 
          scale: 1.02,
          boxShadow: `0 0 20px ${ACCENT}30`,
        }}
        whileTap={{ scale: 0.98 }}
      >
        {isLast ? (
          <>
            <CheckCircle className="w-5 h-5" style={{ color: ACCENT }} />
            COMPLETE INITIATION
          </>
        ) : (
          <>
            CONTINUE
            <ChevronRight className="w-5 h-5" style={{ color: ACCENT }} />
          </>
        )}
      </motion.button>
    </motion.div>
  )
}
