'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Sparkles,
  Command,
  Play,
  Loader2,
  X,
  Brain,
  Users,
  Shield,
  Award,
  ArrowRight
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

// Interactive info popups for each element
const INFO_DETAILS: Record<string, { title: string; description: string; tips?: string[] }> = {
  // About items
  'balanced-matches': {
    title: 'Fair Play, Every Match',
    description: 'Our system analyzes every player\'s skill level and creates teams that are as balanced as possible. No more lopsided stomps - every match is competitive.',
    tips: ['Teams are balanced by total MMR', 'Similar skill players face off', 'Win or lose, it\'s always close']
  },
  'mmr-system': {
    title: 'Your True Skill Rating',
    description: 'MMR (Match Making Rating) is your hidden skill score. It goes up when you win and down when you lose, with performance bonuses for standout games.',
    tips: ['Based on wins, losses, and performance', 'Updates after every match', 'AI analyzes your gameplay patterns']
  },
  'stats-tracking': {
    title: 'Every Stat, Tracked',
    description: 'Your entire competitive history is recorded and analyzed. See your K/D, win streaks, rank progression, and more.',
    tips: ['View detailed match history', 'Track your improvement over time', 'Compare with other players']
  },
  // Commands
  '/account link': {
    title: 'Link Your Identity',
    description: 'Connect your game account (Valorant/Marvel Rivals) to your Discord. This is how we track your stats and verify your rank.',
    tips: ['Only needs to be done once', 'Unlocks all features', 'Your data stays private']
  },
  '/verify': {
    title: 'Get Your Starting Rank',
    description: 'After linking, verify pulls your current rank from the game and calculates your initial GRNDS rating. This is your starting point.',
    tips: ['Based on your actual game rank', 'Sets your MMR baseline', 'Can be updated anytime']
  },
  '/queue join': {
    title: 'Enter the Arena',
    description: 'Jump into matchmaking! You\'ll be placed in a balanced team with other players of similar skill.',
    tips: ['Games pop when 10 players ready', 'Teams auto-balanced by AI', 'Voice channels auto-created']
  },
  '/rank': {
    title: 'Check Your Standing',
    description: 'See your current GRNDS rank, MMR, and division. Track your progress through the tiers.',
    tips: ['Shows rank + MMR', 'See games until next tier', 'Beautiful rank card image']
  },
  '/stats': {
    title: 'Deep Dive Analytics',
    description: 'Get the full breakdown - K/D ratio, win rate, total games, and more. Know exactly where you stand.',
    tips: ['Complete stat overview', 'Historical performance', 'Comparison metrics']
  },
  '/leaderboard': {
    title: 'The Best of the Best',
    description: 'See who\'s dominating the GRNDS ladder. Compete for top spots and seasonal rewards.',
    tips: ['Top 50 players shown', 'Updated in real-time', 'Seasonal rankings']
  },
  // Ranks
  'grnds': {
    title: 'GRNDS Tier (0-1499 MMR)',
    description: 'Where every operative begins their journey. Five divisions (I-V) to climb through as you learn the system and prove yourself.',
    tips: ['Entry tier for all players', 'Learn the ropes here', 'Focus on fundamentals']
  },
  'breakpoint': {
    title: 'BREAKPOINT Tier (1500-2399 MMR)',
    description: 'You\'ve broken through. This is where competition gets serious. Five divisions of skilled players fighting for the next level.',
    tips: ['Competitive middle ground', 'Games get intense', 'Strategy matters more']
  },
  'challenger': {
    title: 'CHALLENGER Tier (2400-2999 MMR)',
    description: 'The elite. Three divisions of the best players on the platform. Only the dedicated reach this level.',
    tips: ['Top ~10% of players', 'Highest competition', 'Prestigious status']
  },
  'x-rank': {
    title: 'X RANK (3000+ MMR)',
    description: 'The pinnacle. No divisions, just pure dominance. Reserved for the absolute best operatives on GRNDS.',
    tips: ['Invite to exclusive matches', 'Featured on leaderboard', 'Ultimate bragging rights']
  },
  // Web features
  'dashboard': {
    title: 'Your Command Center',
    description: 'One place to see everything - your stats, recent matches, rank progress, and quick actions. This is home base.',
    tips: ['Quick overview of everything', 'One-click actions', 'Personalized for you']
  },
  'profile': {
    title: 'Make It Yours',
    description: 'Customize your appearance, set your banner, add a bio. Let other operatives know who you are.',
    tips: ['Custom profile picture', 'Bio and social links', 'Achievement showcase']
  },
  'leaderboard-web': {
    title: 'Full Rankings View',
    description: 'The complete leaderboard with filtering, search, and detailed stats for every player.',
    tips: ['Search any player', 'Filter by rank tier', 'Click to view profiles']
  },
  'season': {
    title: 'Seasonal Tracking',
    description: 'Track your progress through the current season. See rewards, milestones, and time remaining.',
    tips: ['Season rewards preview', 'Personal milestones', 'Countdown timer']
  },
  // AI Features
  'ai-balancing': {
    title: 'AI-Powered Team Balancing',
    description: 'Our AI doesn\'t just look at MMR - it analyzes play styles, recent performance, and chemistry to create the most balanced teams possible.',
    tips: ['Machine learning algorithms', 'Gets smarter over time', 'Fair matches guaranteed']
  },
  'ai-analysis': {
    title: 'Smart Performance Analysis',
    description: 'After each match, AI reviews your performance and adjusts your rating based on how you played, not just the outcome.',
    tips: ['Performance-based adjustments', 'Recognizes improvement', 'Detailed breakdowns']
  },
  'ai-predictions': {
    title: 'Match Predictions',
    description: 'Before each match, see AI-predicted win chances and key matchups. Understand the battlefield before you enter.',
    tips: ['Win probability shown', 'Key player matchups', 'Strategic insights']
  }
}

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
  const [activeInfo, setActiveInfo] = useState<string | null>(null)

  // Sections data - memoized to prevent re-renders
  const sections = useMemo(() => [
    {
      id: 'welcome',
      title: 'WELCOME',
      icon: Zap,
      command: 'cat /docs/welcome.md',
      content: {
        title: 'What is #GRNDS?',
        subtitle: 'A new way to compete.',
        description: 'GRNDS is your private competitive arena. We take the chaos of ranked matchmaking and transform it into fair, balanced, skill-based competition. Every match matters. Every player is tracked. Every game is an opportunity to prove yourself.',
        items: [
          { id: 'balanced-matches', icon: Swords, label: 'Fair Matches', desc: 'AI-balanced teams every game' },
          { id: 'mmr-system', icon: TrendingUp, label: 'Skill Rating', desc: 'Your true competitive level' },
          { id: 'stats-tracking', icon: Target, label: 'Full Tracking', desc: 'Every stat, every match' },
        ]
      }
    },
    {
      id: 'howto',
      title: 'HOW_IT_WORKS',
      icon: MessageSquare,
      command: 'grnds --help',
      content: {
        title: 'Your First Steps',
        subtitle: 'Getting started is easy.',
        description: 'Everything runs through Discord commands. Link your account, verify your rank, and queue up. The system handles the rest - team creation, voice channels, result tracking, and MMR updates.',
        commands: [
          { cmd: '/account link', desc: 'Connect your game account', required: true },
          { cmd: '/verify', desc: 'Get your initial rank', required: true },
          { cmd: '/queue join', desc: 'Jump into matchmaking', required: true },
          { cmd: '/rank', desc: 'See your current standing' },
          { cmd: '/stats', desc: 'View your statistics' },
          { cmd: '/leaderboard', desc: 'Check top players' },
        ]
      }
    },
    {
      id: 'ranks',
      title: 'RANK_SYSTEM',
      icon: Trophy,
      command: 'grnds --show tiers',
      content: {
        title: 'The Rank Ladder',
        subtitle: 'Your journey from rookie to legend.',
        description: 'Climb through four distinct tiers, each with multiple divisions. Your MMR (skill rating) determines your rank. Win to climb, lose to fall. Simple. The only way up is through performance.',
        ranks: [
          { id: 'grnds', tier: 'GRNDS I-V', mmr: '0 - 1499', color: '#ff8c00', desc: 'Starting tier' },
          { id: 'breakpoint', tier: 'BREAKPOINT I-V', mmr: '1500 - 2399', color: '#888888', desc: 'Competitive tier' },
          { id: 'challenger', tier: 'CHALLENGER I-III', mmr: '2400 - 2999', color: '#dc2626', desc: 'Elite tier' },
          { id: 'x-rank', tier: 'X', mmr: '3000+', color: '#ffffff', desc: 'The pinnacle' },
        ]
      }
    },
    {
      id: 'ai',
      title: 'AI_FEATURES',
      icon: Brain,
      command: 'grnds --ai status',
      content: {
        title: 'Powered by Intelligence',
        subtitle: 'The system learns and adapts.',
        description: 'GRNDS isn\'t just a queue bot - it\'s a smart competitive platform. AI analyzes matches, balances teams, and tracks performance in ways traditional systems can\'t match.',
        features: [
          { id: 'ai-balancing', icon: Users, label: 'Smart Team Balancing', desc: 'AI creates fair matchups every game' },
          { id: 'ai-analysis', icon: Sparkles, label: 'Performance Analysis', desc: 'Your play is analyzed, not just W/L' },
          { id: 'ai-predictions', icon: Shield, label: 'Match Insights', desc: 'Predicted outcomes and key matchups' },
        ]
      }
    },
    {
      id: 'web',
      title: 'WEB_HUB',
      icon: ExternalLink,
      command: 'open hub.grnds.xyz',
      content: {
        title: 'The Web Interface',
        subtitle: 'Beyond Discord.',
        description: 'This website is your extended command center. Check stats on the go, browse the full leaderboard, customize your profile, and track seasonal progress. It\'s all connected.',
        webFeatures: [
          { id: 'dashboard', label: 'Dashboard', desc: 'Your personal overview', current: true },
          { id: 'profile', label: 'Profile', desc: 'Customize your identity' },
          { id: 'leaderboard-web', label: 'Leaderboard', desc: 'Full competitive standings' },
          { id: 'season', label: 'Season', desc: 'Track seasonal progress' },
        ]
      }
    },
    {
      id: 'start',
      title: 'BEGIN',
      icon: Award,
      command: 'grnds --start',
      content: {
        title: 'Ready to Compete?',
        subtitle: 'Your initiation is almost complete.',
        description: 'You now understand the system. The only thing left is to enter the arena. Link your account, verify your rank, and queue up. The ladder awaits.',
        steps: [
          'Run /account link in Discord',
          'Use /verify to get your starting rank',
          'Join the queue with /queue join',
          'Win, climb, dominate.',
        ]
      }
    },
  ], [])

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

  const handleInfoClick = useCallback((id: string) => {
    setActiveInfo(activeInfo === id ? null : id)
  }, [activeInfo])

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

      {/* Developed by Chopp - Always present, terminal style, subliminal */}
      <div className="fixed bottom-4 left-4 z-[250] font-mono text-[10px] text-white/15 flex items-center gap-2">
        <Terminal className="w-3 h-3" />
        <span>sys.author = &quot;chopp&quot;</span>
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
                <span className="text-sm font-mono">Preparing initiation sequence...</span>
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
                    <div className="p-8 min-h-[450px] max-h-[60vh] overflow-y-auto">
                      <AnimatePresence mode="wait">
                        <SectionContent
                          key={activeSection}
                          section={sections[activeSection]}
                          onNext={handleNext}
                          isLast={activeSection === sections.length - 1}
                          activeInfo={activeInfo}
                          onInfoClick={handleInfoClick}
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

          {/* Complete Phase - Terminal Style */}
          {phase === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-lg"
            >
              {/* Terminal window for completion */}
              <motion.div
                className="rounded-xl overflow-hidden border"
                style={{ 
                  borderColor: `${ACCENT}40`,
                  boxShadow: `0 0 80px ${ACCENT}20`,
                  background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
                }}
                animate={{
                  rotateX: [1, -1, 1],
                  rotateY: [-0.5, 0.5, -0.5],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: 'easeInOut',
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
                    <span className="text-xs font-mono text-white/40">INITIATION_COMPLETE</span>
                  </div>
                  <Terminal className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                
                {/* Content */}
                <div className="p-8">
                  <motion.img
                    src="/grnds-logo.gif"
                    alt="GRNDS"
                    className="w-32 h-32 mx-auto mb-6"
                    animate={{ 
                      scale: [1, 1.05, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  <div className="font-mono space-y-2 mb-8">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-green-400"
                    >
                      &gt; initiation.status = COMPLETE
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-white/60"
                    >
                      &gt; user.ready = true
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="text-2xl md:text-3xl font-black text-white mt-4"
                    >
                      YOU ARE READY TO <span style={{ color: ACCENT }}>COMPETE</span>
                    </motion.div>
                  </div>
                  
                  <motion.button
                    onClick={handleComplete}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="w-full py-4 rounded-lg font-mono font-bold text-white flex items-center justify-center gap-3 transition-all"
                    style={{ 
                      background: `${ACCENT}20`,
                      border: `2px solid ${ACCENT}`,
                    }}
                    whileHover={{ 
                      scale: 1.02,
                      boxShadow: `0 0 30px ${ACCENT}40`,
                    }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span style={{ color: ACCENT }}>&gt;</span>
                    ENTER GRNDS
                    <ArrowRight className="w-5 h-5" style={{ color: ACCENT }} />
                  </motion.button>
                </div>
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
      subtitle?: string
      description?: string
      items?: { id: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; desc: string }[]
      commands?: { cmd: string; desc: string; required?: boolean }[]
      ranks?: { id: string; tier: string; mmr: string; color: string; desc?: string }[]
      features?: { id: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; desc: string }[]
      webFeatures?: { id: string; label: string; desc: string; current?: boolean }[]
      steps?: string[]
    }
  }
  onNext: () => void
  isLast: boolean
  activeInfo: string | null
  onInfoClick: (id: string) => void
}

function SectionContent({ section, onNext, isLast, activeInfo, onInfoClick }: SectionContentProps) {
  const content = section.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Title with subtitle and description */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}20` }}
          >
            <Terminal className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h3 className="text-2xl font-black font-mono text-white">{content.title}</h3>
            {content.subtitle && (
              <span className="text-sm font-mono text-white/40">{content.subtitle}</span>
            )}
          </div>
        </div>
        {content.description && (
          <p className="text-white/60 text-sm leading-relaxed mt-4 pl-[52px]">
            {content.description}
          </p>
        )}
      </div>

      {/* Items (About section) - Interactive */}
      {content.items && (
        <div className="grid gap-4">
          {content.items.map((item, i) => {
            const isActive = activeInfo === item.id
            const info = INFO_DETAILS[item.id]
            
            return (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <motion.button
                  onClick={() => onInfoClick(item.id)}
                  className="w-full flex items-start gap-4 p-4 rounded-lg border text-left transition-all"
                  style={{ 
                    borderColor: isActive ? ACCENT : `${ACCENT}30`,
                    background: isActive ? `${ACCENT}15` : `${ACCENT}05`,
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <item.icon className="w-6 h-6 flex-shrink-0" style={{ color: ACCENT }} />
                  <div className="flex-1">
                    <div className="font-bold text-white font-mono flex items-center gap-2">
                      {item.label}
                      <span className="text-[10px] text-white/30">[CLICK FOR MORE]</span>
                    </div>
                    <div className="text-sm text-white/50">{item.desc}</div>
                  </div>
                  <ChevronRight 
                    className="w-5 h-5 transition-transform" 
                    style={{ 
                      color: ACCENT,
                      transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)'
                    }} 
                  />
                </motion.button>
                
                {/* Expanded info */}
                <AnimatePresence>
                  {isActive && info && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div 
                        className="p-4 mt-2 rounded-lg border-l-2"
                        style={{ 
                          borderColor: ACCENT,
                          background: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="text-white font-bold font-mono mb-2">{info.title}</div>
                        <div className="text-white/60 text-sm mb-3">{info.description}</div>
                        {info.tips && (
                          <div className="space-y-1">
                            {info.tips.map((tip, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs text-white/40">
                                <CheckCircle className="w-3 h-3" style={{ color: ACCENT }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Commands (Discord section) - Interactive */}
      {content.commands && (
        <div className="space-y-2">
          {content.commands.map((cmd, i) => {
            const isActive = activeInfo === cmd.cmd
            const info = INFO_DETAILS[cmd.cmd]
            
            return (
              <motion.div key={i}>
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onInfoClick(cmd.cmd)}
                  className="w-full flex items-center gap-4 p-3 rounded-lg text-left transition-all"
                  style={{ 
                    background: cmd.required ? `${ACCENT}10` : 'rgba(255,255,255,0.03)',
                    border: isActive ? `1px solid ${ACCENT}` : cmd.required ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.05)',
                  }}
                  whileHover={{ scale: 1.01 }}
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
                </motion.button>
                
                {/* Expanded info */}
                <AnimatePresence>
                  {isActive && info && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div 
                        className="p-4 mt-2 rounded-lg border-l-2"
                        style={{ 
                          borderColor: ACCENT,
                          background: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="text-white font-bold font-mono mb-2">{info.title}</div>
                        <div className="text-white/60 text-sm mb-3">{info.description}</div>
                        {info.tips && (
                          <div className="space-y-1">
                            {info.tips.map((tip, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs text-white/40">
                                <CheckCircle className="w-3 h-3" style={{ color: ACCENT }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Ranks (Rank section) - Interactive */}
      {content.ranks && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {content.ranks.map((rank, i) => {
            const isActive = activeInfo === rank.id
            const info = INFO_DETAILS[rank.id]
            
            return (
              <motion.div key={i} className="relative">
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onInfoClick(rank.id)}
                  className="w-full p-4 rounded-lg border text-center transition-all"
                  style={{ 
                    borderColor: isActive ? rank.color : `${rank.color}40`,
                    background: `${rank.color}10`,
                  }}
                  whileHover={{ scale: 1.05 }}
                >
                  <div className="font-bold font-mono" style={{ color: rank.color }}>{rank.tier}</div>
                  <div className="text-xs text-white/40 mt-1">{rank.mmr} MMR</div>
                  <div className="text-[10px] text-white/30 mt-1">[TAP]</div>
                </motion.button>
                
                {/* Popup info for ranks */}
                <AnimatePresence>
                  {isActive && info && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute z-50 top-full left-0 right-0 mt-2"
                    >
                      <div 
                        className="p-4 rounded-lg border shadow-xl"
                        style={{ 
                          borderColor: rank.color,
                          background: '#1a1a1a',
                        }}
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); onInfoClick(rank.id) }}
                          className="absolute top-2 right-2"
                        >
                          <X className="w-4 h-4 text-white/40 hover:text-white" />
                        </button>
                        <div className="text-white font-bold font-mono text-sm mb-2">{info.title}</div>
                        <div className="text-white/60 text-xs mb-2">{info.description}</div>
                        {info.tips && (
                          <div className="space-y-1">
                            {info.tips.map((tip, j) => (
                              <div key={j} className="flex items-center gap-2 text-[10px] text-white/40">
                                <CheckCircle className="w-2 h-2" style={{ color: rank.color }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* AI Features - Interactive */}
      {content.features && (
        <div className="grid gap-4">
          {content.features.map((feature, i) => {
            const isActive = activeInfo === feature.id
            const info = INFO_DETAILS[feature.id]
            
            return (
              <motion.div
                key={i}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <motion.button
                  onClick={() => onInfoClick(feature.id)}
                  className="w-full flex items-start gap-4 p-4 rounded-lg border text-left transition-all"
                  style={{ 
                    borderColor: isActive ? ACCENT : `${ACCENT}30`,
                    background: isActive ? `${ACCENT}15` : `${ACCENT}05`,
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <feature.icon className="w-6 h-6 flex-shrink-0" style={{ color: ACCENT }} />
                  <div className="flex-1">
                    <div className="font-bold text-white font-mono flex items-center gap-2">
                      {feature.label}
                      <span className="text-[10px] text-white/30">[CLICK]</span>
                    </div>
                    <div className="text-sm text-white/50">{feature.desc}</div>
                  </div>
                  <ChevronRight 
                    className="w-5 h-5 transition-transform" 
                    style={{ 
                      color: ACCENT,
                      transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)'
                    }} 
                  />
                </motion.button>
                
                {/* Expanded info */}
                <AnimatePresence>
                  {isActive && info && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div 
                        className="p-4 mt-2 rounded-lg border-l-2"
                        style={{ 
                          borderColor: ACCENT,
                          background: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="text-white font-bold font-mono mb-2">{info.title}</div>
                        <div className="text-white/60 text-sm mb-3">{info.description}</div>
                        {info.tips && (
                          <div className="space-y-1">
                            {info.tips.map((tip, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs text-white/40">
                                <CheckCircle className="w-3 h-3" style={{ color: ACCENT }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Web Features - Interactive */}
      {content.webFeatures && (
        <div className="space-y-3">
          {content.webFeatures.map((feature, i) => {
            const isActive = activeInfo === feature.id
            const info = INFO_DETAILS[feature.id]
            
            return (
              <motion.div key={i}>
                <motion.button
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => onInfoClick(feature.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all"
                  style={{ 
                    background: feature.current ? `${ACCENT}10` : 'rgba(255,255,255,0.03)',
                    border: isActive ? `1px solid ${ACCENT}` : feature.current ? `1px solid ${ACCENT}40` : '1px solid rgba(255,255,255,0.05)',
                  }}
                  whileHover={{ scale: 1.01 }}
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ 
                      background: feature.current ? ACCENT : 'rgba(255,255,255,0.3)',
                      boxShadow: feature.current ? `0 0 10px ${ACCENT}` : 'none',
                    }}
                  />
                  <div className="flex-1">
                    <div className="font-bold text-white font-mono text-sm">
                      {feature.label}
                      {feature.current && <span className="text-xs ml-2 text-white/40">(YOU ARE HERE)</span>}
                    </div>
                    <div className="text-xs text-white/50">{feature.desc}</div>
                  </div>
                  <span className="text-[10px] text-white/30">[TAP]</span>
                </motion.button>
                
                {/* Expanded info */}
                <AnimatePresence>
                  {isActive && info && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div 
                        className="p-4 mt-2 rounded-lg border-l-2"
                        style={{ 
                          borderColor: ACCENT,
                          background: 'rgba(0,0,0,0.3)',
                        }}
                      >
                        <div className="text-white font-bold font-mono mb-2">{info.title}</div>
                        <div className="text-white/60 text-sm mb-3">{info.description}</div>
                        {info.tips && (
                          <div className="space-y-1">
                            {info.tips.map((tip, j) => (
                              <div key={j} className="flex items-center gap-2 text-xs text-white/40">
                                <CheckCircle className="w-3 h-3" style={{ color: ACCENT }} />
                                {tip}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
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
