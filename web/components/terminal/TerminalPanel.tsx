'use client'

import { motion } from 'framer-motion'
import { Terminal, ChevronRight } from 'lucide-react'
import { useAccentColor } from '@/lib/AccentColorContext'
import { ReactNode } from 'react'

interface TerminalPanelProps {
  children: ReactNode
  title?: string
  command?: string
  icon?: ReactNode
  className?: string
  noPadding?: boolean
  glowIntensity?: 'low' | 'medium' | 'high'
  animate?: boolean
  headerExtra?: ReactNode
}

export function TerminalPanel({ 
  children, 
  title, 
  command,
  icon,
  className = '',
  noPadding = false,
  glowIntensity = 'medium',
  animate = true,
  headerExtra
}: TerminalPanelProps) {
  const { accentColor } = useAccentColor()
  
  const glowMap = {
    low: `0 0 20px ${accentColor}08`,
    medium: `0 0 40px ${accentColor}12, 0 10px 30px rgba(0,0,0,0.4)`,
    high: `0 0 60px ${accentColor}20, 0 15px 40px rgba(0,0,0,0.5)`,
  }
  
  const Container = animate ? motion.div : 'div'
  const animationProps = animate ? {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 }
  } : {}
  
  return (
    <Container
      {...animationProps}
      className={`rounded-xl overflow-hidden border ${className}`}
      style={{ 
        borderColor: `${accentColor}30`,
        background: 'linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)',
        boxShadow: glowMap[glowIntensity],
      }}
    >
      {/* Terminal Header */}
      {(title || command) && (
        <div 
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ 
            borderColor: `${accentColor}20`,
            background: `linear-gradient(90deg, ${accentColor}08, transparent)`,
          }}
        >
          {/* Mac-style dots */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          
          {/* Title/Command area */}
          <div className="flex-1 flex items-center gap-2 font-mono">
            {icon && (
              <span style={{ color: accentColor }}>{icon}</span>
            )}
            {title && (
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: accentColor }}>
                {title}
              </span>
            )}
            {command && (
              <span className="text-[10px] text-white/30">
                {"// "}{command}
              </span>
            )}
          </div>
          
          {headerExtra && (
            <div className="flex items-center gap-2">
              {headerExtra}
            </div>
          )}
          
          <Terminal className="w-3.5 h-3.5 text-white/20" />
        </div>
      )}
      
      {/* Content */}
      <div className={noPadding ? '' : 'p-4 sm:p-6'}>
        {children}
      </div>
    </Container>
  )
}

// Terminal text with prompt
interface TerminalTextProps {
  children: ReactNode
  prompt?: string
  className?: string
  muted?: boolean
}

export function TerminalText({ children, prompt = '>', className = '', muted = false }: TerminalTextProps) {
  const { accentColor } = useAccentColor()
  
  return (
    <div className={`flex items-start gap-2 font-mono ${className}`}>
      <span style={{ color: accentColor }}>{prompt}</span>
      <span className={muted ? 'text-white/40' : 'text-white/80'}>{children}</span>
    </div>
  )
}

// Terminal command line output style
interface TerminalOutputProps {
  label: string
  value: ReactNode
  className?: string
}

export function TerminalOutput({ label, value, className = '' }: TerminalOutputProps) {
  const { accentColor } = useAccentColor()
  
  return (
    <div className={`flex items-center gap-2 font-mono text-sm ${className}`}>
      <span className="text-white/30">$</span>
      <span className="text-white/50">{label}:</span>
      <span style={{ color: accentColor }}>{value}</span>
    </div>
  )
}

// Terminal stat block
interface TerminalStatProps {
  label: string
  value: string | number
  subValue?: string
  trend?: 'up' | 'down' | 'neutral'
}

export function TerminalStat({ label, value, subValue, trend }: TerminalStatProps) {
  const { accentColor } = useAccentColor()
  
  const trendColors = {
    up: 'text-green-400',
    down: 'text-red-400',
    neutral: 'text-white/40'
  }
  
  return (
    <div className="font-mono">
      <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
        <span style={{ color: accentColor }}>$</span>
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-white">{value}</span>
        {subValue && (
          <span className={`text-xs ${trend ? trendColors[trend] : 'text-white/40'}`}>
            {subValue}
          </span>
        )}
      </div>
    </div>
  )
}

// Terminal list item
interface TerminalListItemProps {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  icon?: ReactNode
}

export function TerminalListItem({ children, active, onClick, icon }: TerminalListItemProps) {
  const { accentColor } = useAccentColor()
  
  return (
    <motion.button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all font-mono text-sm"
      style={{
        background: active ? `${accentColor}15` : 'transparent',
        borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
      }}
      whileHover={{ x: 4, backgroundColor: `${accentColor}08` }}
    >
      <span className="text-white/30">[</span>
      {icon && (
        <span style={{ color: active ? accentColor : 'rgba(255,255,255,0.4)' }}>
          {icon}
        </span>
      )}
      <span 
        className="flex-1 text-xs font-bold uppercase tracking-wide"
        style={{ color: active ? accentColor : 'rgba(255,255,255,0.5)' }}
      >
        {children}
      </span>
      <span className="text-white/30">]</span>
      {active && (
        <ChevronRight className="w-3 h-3" style={{ color: accentColor }} />
      )}
    </motion.button>
  )
}

// Terminal progress bar
interface TerminalProgressProps {
  value: number
  max?: number
  label?: string
  showPercent?: boolean
}

export function TerminalProgress({ value, max = 100, label, showPercent = true }: TerminalProgressProps) {
  const { accentColor } = useAccentColor()
  const percent = Math.round((value / max) * 100)
  
  return (
    <div className="font-mono">
      {(label || showPercent) && (
        <div className="flex justify-between text-xs mb-2">
          {label && <span className="text-white/40">{label}</span>}
          {showPercent && <span style={{ color: accentColor }}>{percent}%</span>}
        </div>
      )}
      <div className="h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: accentColor }}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// Terminal divider
export function TerminalDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-white/10" />
      {label && (
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
          {"// "}{label}
        </span>
      )}
      <div className="flex-1 h-px bg-white/10" />
    </div>
  )
}

// Terminal badge
interface TerminalBadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}

export function TerminalBadge({ children, variant = 'default' }: TerminalBadgeProps) {
  const { accentColor } = useAccentColor()
  
  const variants = {
    default: { bg: `${accentColor}20`, color: accentColor, border: `${accentColor}40` },
    success: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'rgba(34,197,94,0.4)' },
    warning: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', border: 'rgba(234,179,8,0.4)' },
    error: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'rgba(239,68,68,0.4)' },
  }
  
  const v = variants[variant]
  
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border"
      style={{ 
        backgroundColor: v.bg, 
        color: v.color,
        borderColor: v.border,
      }}
    >
      {children}
    </span>
  )
}
