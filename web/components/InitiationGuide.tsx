'use client'

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Terminal, MessageSquare, Trophy, Zap, CheckCircle, ExternalLink } from 'lucide-react'

interface InitiationGuideProps {
  username: string
}

const SECTIONS = [
  {
    id: 'welcome',
    title: 'SYSTEM_INIT',
    icon: Terminal,
    color: '#00ff88',
  },
  {
    id: 'what-is-grnds',
    title: 'ABOUT_GRNDS',
    icon: Zap,
    color: '#ff8c00',
  },
  {
    id: 'discord-commands',
    title: 'DISCORD_CMD',
    icon: MessageSquare,
    color: '#5865f2',
  },
  {
    id: 'rank-system',
    title: 'RANK_SYSTEM',
    icon: Trophy,
    color: '#dc2626',
  },
  {
    id: 'web-ui',
    title: 'WEB_INTERFACE',
    icon: ExternalLink,
    color: '#8b5cf6',
  },
  {
    id: 'getting-started',
    title: 'GET_STARTED',
    icon: CheckCircle,
    color: '#10b981',
  },
]

export function InitiationGuide({ username }: InitiationGuideProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(0)
  const [typingText, setTypingText] = useState('')
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Check if user has seen the initiation
    const hasSeen = localStorage.getItem('grnds_initiation_seen')
    if (!hasSeen) {
      // Small delay before showing
      const timeout = setTimeout(() => setIsOpen(true), 1000)
      return () => clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Type out the welcome message
      const welcomeText = `> WELCOME, ${username.toUpperCase()}...`
      let i = 0
      setTypingText('')
      setShowContent(false)
      
      const typeInterval = setInterval(() => {
        if (i < welcomeText.length) {
          setTypingText(prev => prev + welcomeText[i])
          i++
        } else {
          clearInterval(typeInterval)
          setTimeout(() => setShowContent(true), 300)
        }
      }, 50)
      
      return () => clearInterval(typeInterval)
    }
  }, [isOpen, username])

  const handleClose = () => {
    localStorage.setItem('grnds_initiation_seen', 'true')
    setIsOpen(false)
  }

  const handleNext = () => {
    if (activeSection < SECTIONS.length - 1) {
      setActiveSection(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (activeSection > 0) {
      setActiveSection(prev => prev - 1)
    }
  }

  if (!isOpen) return null

  const currentSection = SECTIONS[activeSection]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop with grid effect */}
      <div 
        className="absolute inset-0 bg-black/95"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
        onClick={handleClose}
      />
      
      {/* Glowing orb effect */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[100px] transition-colors duration-1000"
        style={{ backgroundColor: currentSection.color }}
      />
      
      {/* Main container */}
      <div className="relative w-full max-w-5xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div 
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ backgroundColor: currentSection.color }}
            />
            <h1 className="text-2xl md:text-4xl font-mono font-black text-white tracking-tighter">
              <span className="text-[#ff8c00]">#</span>GRNDS <span className="text-white/40">INITIATION</span>
            </h1>
          </div>
          
          <button
            onClick={handleClose}
            className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Typing intro */}
        <div className="font-mono text-[#00ff88] text-lg mb-8 h-8">
          {typingText}
          <span className="animate-pulse">_</span>
        </div>
        
        {showContent && (
          <>
            {/* Section tabs */}
            <div className="flex flex-wrap gap-2 mb-8">
              {SECTIONS.map((section, index) => {
                const Icon = section.icon
                const isActive = index === activeSection
                const isPast = index < activeSection
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(index)}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border rounded transition-all ${
                      isActive
                        ? 'border-current bg-current/10'
                        : isPast
                        ? 'border-white/20 text-white/60 bg-white/5'
                        : 'border-white/10 text-white/40 hover:border-white/30'
                    }`}
                    style={isActive ? { color: section.color, borderColor: section.color } : {}}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{section.title}</span>
                    <span className="sm:hidden">{index + 1}</span>
                  </button>
                )
              })}
            </div>
            
            {/* Content panel */}
            <div 
              className="bg-black/80 border rounded-lg overflow-hidden min-h-[400px] transition-colors duration-300"
              style={{ borderColor: `${currentSection.color}40` }}
            >
              {/* Panel header */}
              <div 
                className="flex items-center gap-2 px-4 py-3 border-b"
                style={{ 
                  backgroundColor: `${currentSection.color}10`,
                  borderColor: `${currentSection.color}40`
                }}
              >
                <currentSection.icon className="w-4 h-4" style={{ color: currentSection.color }} />
                <span className="text-xs font-mono uppercase tracking-wider" style={{ color: currentSection.color }}>
                  {currentSection.title}
                </span>
                <span className="text-xs text-white/30 ml-auto font-mono">
                  [{activeSection + 1}/{SECTIONS.length}]
                </span>
              </div>
              
              {/* Panel content */}
              <div className="p-6 overflow-y-auto max-h-[50vh]">
                <SectionContent section={currentSection.id} />
              </div>
            </div>
            
            {/* Navigation */}
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={handlePrev}
                disabled={activeSection === 0}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider border rounded transition-all ${
                  activeSection === 0
                    ? 'border-white/10 text-white/20 cursor-not-allowed'
                    : 'border-white/30 text-white hover:bg-white hover:text-black'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                PREV
              </button>
              
              <div className="flex gap-1">
                {SECTIONS.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === activeSection ? 'bg-white' : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>
              
              {activeSection === SECTIONS.length - 1 ? (
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider bg-[#00ff88] text-black rounded hover:bg-[#00ff88]/80 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  COMPLETE
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-mono uppercase tracking-wider border border-white/30 text-white rounded hover:bg-white hover:text-black transition-all"
                >
                  NEXT
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Skip button */}
            <div className="text-center mt-4">
              <button
                onClick={handleClose}
                className="text-xs text-white/30 hover:text-white/60 font-mono transition-colors"
              >
                [SKIP_INITIATION]
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SectionContent({ section }: { section: string }) {
  switch (section) {
    case 'welcome':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-2xl font-black text-white">
            Welcome to the <span className="text-[#ff8c00]">GRNDS</span> System
          </div>
          <p className="text-white/60 leading-relaxed">
            You&apos;ve successfully connected your Discord account. This initiation will guide you through everything you need to know to get started with GRNDS competitive customs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="p-4 border border-white/10 rounded bg-white/5">
              <div className="text-3xl mb-2">🎮</div>
              <div className="text-sm font-bold text-white">Competitive Customs</div>
              <div className="text-xs text-white/40 mt-1">Ranked 10-player matches</div>
            </div>
            <div className="p-4 border border-white/10 rounded bg-white/5">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm font-bold text-white">MMR System</div>
              <div className="text-xs text-white/40 mt-1">Performance-based rankings</div>
            </div>
            <div className="p-4 border border-white/10 rounded bg-white/5">
              <div className="text-3xl mb-2">🏆</div>
              <div className="text-sm font-bold text-white">Leaderboards</div>
              <div className="text-xs text-white/40 mt-1">Compete for top spots</div>
            </div>
          </div>
          <div className="text-xs text-[#00ff88] mt-6">
            &gt; PROCEED TO NEXT SECTION TO LEARN MORE...
          </div>
        </div>
      )
    
    case 'what-is-grnds':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-xl font-black text-white">
            What is <span className="text-[#ff8c00]">GRNDS</span>?
          </div>
          <p className="text-white/60 leading-relaxed">
            GRNDS (Grounds) is a competitive custom games platform for Valorant and Marvel Rivals. We organize balanced 5v5 matches using our custom MMR system.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 border border-[#ff8c00]/30 rounded bg-[#ff8c00]/5">
              <div className="text-2xl">⚔️</div>
              <div>
                <div className="text-sm font-bold text-[#ff8c00]">Balanced Matches</div>
                <div className="text-xs text-white/50 mt-1">Our algorithm creates fair teams based on player skill levels</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 border border-[#ff8c00]/30 rounded bg-[#ff8c00]/5">
              <div className="text-2xl">📈</div>
              <div>
                <div className="text-sm font-bold text-[#ff8c00]">Skill Progression</div>
                <div className="text-xs text-white/50 mt-1">Climb the ranks by winning matches and performing well</div>
              </div>
            </div>
            
            <div className="flex items-start gap-4 p-4 border border-[#ff8c00]/30 rounded bg-[#ff8c00]/5">
              <div className="text-2xl">🎯</div>
              <div>
                <div className="text-sm font-bold text-[#ff8c00]">Stats Tracking</div>
                <div className="text-xs text-white/50 mt-1">All your matches, K/D, and performance are tracked</div>
              </div>
            </div>
          </div>
        </div>
      )
    
    case 'discord-commands':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-xl font-black text-white">
            Discord Commands
          </div>
          <p className="text-white/60 leading-relaxed text-sm">
            Everything happens through Discord slash commands. Here are the essential ones:
          </p>
          
          <div className="space-y-3">
            <CommandItem 
              cmd="/account valorant link" 
              desc="Link your Riot ID for Valorant" 
              important 
            />
            <CommandItem 
              cmd="/account marvel link" 
              desc="Link your Marvel Rivals username" 
              important 
            />
            <CommandItem 
              cmd="/verify" 
              desc="Get your initial rank placement" 
              important 
            />
            <CommandItem 
              cmd="/queue join" 
              desc="Join the matchmaking queue" 
            />
            <CommandItem 
              cmd="/queue leave" 
              desc="Leave the queue" 
            />
            <CommandItem 
              cmd="/rank" 
              desc="View your current rank and MMR" 
            />
            <CommandItem 
              cmd="/leaderboard" 
              desc="View the top players" 
            />
            <CommandItem 
              cmd="/stats" 
              desc="View your match statistics" 
            />
            <CommandItem 
              cmd="/history" 
              desc="View your recent matches" 
            />
          </div>
          
          <div className="text-xs text-[#5865f2] p-3 border border-[#5865f2]/30 rounded bg-[#5865f2]/10">
            💡 TIP: Use Tab to autocomplete commands in Discord
          </div>
        </div>
      )
    
    case 'rank-system':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-xl font-black text-white">
            Rank System
          </div>
          <p className="text-white/60 leading-relaxed text-sm">
            GRNDS uses a custom rank system. Your initial placement is based on your in-game rank, capped at GRNDS V.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <RankItem rank="GRNDS I" mmr="0-299" color="#ff8c00" />
            <RankItem rank="GRNDS II" mmr="300-599" color="#ff8c00" />
            <RankItem rank="GRNDS III" mmr="600-899" color="#ff8c00" />
            <RankItem rank="GRNDS IV" mmr="900-1199" color="#ff8c00" />
            <RankItem rank="GRNDS V" mmr="1200-1499" color="#ff8c00" />
            <RankItem rank="BREAKPOINT I-V" mmr="1500-2399" color="#888888" />
            <RankItem rank="CHALLENGER I-III" mmr="2400-2999" color="#dc2626" />
            <RankItem rank="X" mmr="3000+" color="#ffffff" />
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[#00ff88]">↑</span>
              <span className="text-white/60">Win games to gain MMR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500">↓</span>
              <span className="text-white/60">Lose games to lose MMR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">★</span>
              <span className="text-white/60">MVP bonus MMR for top performers</span>
            </div>
          </div>
          
          <div className="text-xs text-[#dc2626] p-3 border border-[#dc2626]/30 rounded bg-[#dc2626]/10">
            ⚠️ Initial placement is capped at GRNDS V (1499 MMR). Climb through matches!
          </div>
        </div>
      )
    
    case 'web-ui':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-xl font-black text-white">
            Web Interface
          </div>
          <p className="text-white/60 leading-relaxed text-sm">
            The web UI provides detailed stats and features not available through Discord.
          </p>
          
          <div className="space-y-4">
            <WebFeature 
              title="Dashboard" 
              desc="Your personal hub with MMR, stats, and match history"
              current
            />
            <WebFeature 
              title="Profile" 
              desc="Customize your profile with bio, banner, and accent color"
            />
            <WebFeature 
              title="Leaderboard" 
              desc="Full rankings with detailed stats for all players"
            />
            <WebFeature 
              title="Season Stats" 
              desc="Track your performance across the season"
            />
          </div>
          
          <div className="text-xs text-[#8b5cf6] p-3 border border-[#8b5cf6]/30 rounded bg-[#8b5cf6]/10">
            🎨 TIP: Visit your profile to customize your appearance!
          </div>
        </div>
      )
    
    case 'getting-started':
      return (
        <div className="space-y-6 font-mono">
          <div className="text-xl font-black text-white">
            Getting Started Checklist
          </div>
          <p className="text-white/60 leading-relaxed text-sm">
            Complete these steps to start playing:
          </p>
          
          <div className="space-y-3">
            <ChecklistItem 
              step={1} 
              title="Link Your Game Account" 
              desc="Use /account valorant link or /account marvel link in Discord"
            />
            <ChecklistItem 
              step={2} 
              title="Get Verified" 
              desc="Run /verify to get your initial rank placement"
            />
            <ChecklistItem 
              step={3} 
              title="Join a Queue" 
              desc="Use /queue join to enter matchmaking"
            />
            <ChecklistItem 
              step={4} 
              title="Wait for 10 Players" 
              desc="Once queue fills, teams are balanced and match starts"
            />
            <ChecklistItem 
              step={5} 
              title="Play & Climb" 
              desc="Win matches to gain MMR and climb the ranks!"
            />
          </div>
          
          <div className="text-center mt-8 p-6 border border-[#00ff88]/30 rounded bg-[#00ff88]/10">
            <div className="text-2xl mb-2">🚀</div>
            <div className="text-lg font-bold text-[#00ff88]">YOU&apos;RE READY!</div>
            <div className="text-xs text-white/50 mt-2">Head to Discord and start your journey</div>
          </div>
        </div>
      )
    
    default:
      return null
  }
}

function CommandItem({ cmd, desc, important }: { cmd: string; desc: string; important?: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-3 rounded ${important ? 'bg-[#5865f2]/10 border border-[#5865f2]/30' : 'bg-white/5'}`}>
      <code className={`text-sm px-2 py-1 rounded ${important ? 'bg-[#5865f2]/20 text-[#5865f2]' : 'bg-white/10 text-white'}`}>
        {cmd}
      </code>
      <span className="text-xs text-white/50">{desc}</span>
      {important && <span className="text-[10px] text-[#5865f2] ml-auto">REQUIRED</span>}
    </div>
  )
}

function RankItem({ rank, mmr, color }: { rank: string; mmr: string; color: string }) {
  return (
    <div 
      className="p-2 rounded border"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
    >
      <div className="font-bold" style={{ color }}>{rank}</div>
      <div className="text-white/40 text-[10px]">{mmr} MMR</div>
    </div>
  )
}

function WebFeature({ title, desc, current }: { title: string; desc: string; current?: boolean }) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded ${current ? 'bg-[#8b5cf6]/10 border border-[#8b5cf6]/30' : 'bg-white/5 border border-white/10'}`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 ${current ? 'bg-[#8b5cf6] animate-pulse' : 'bg-white/30'}`} />
      <div>
        <div className={`text-sm font-bold ${current ? 'text-[#8b5cf6]' : 'text-white'}`}>
          {title}
          {current && <span className="text-[10px] ml-2 text-white/40">(YOU ARE HERE)</span>}
        </div>
        <div className="text-xs text-white/50 mt-1">{desc}</div>
      </div>
    </div>
  )
}

function ChecklistItem({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-white/5 rounded border border-white/10">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#00ff88]/20 border border-[#00ff88]/50 flex items-center justify-center text-[#00ff88] font-bold">
        {step}
      </div>
      <div>
        <div className="text-sm font-bold text-white">{title}</div>
        <div className="text-xs text-white/50 mt-1">{desc}</div>
      </div>
    </div>
  )
}
