'use client'

import { useEffect, useState } from 'react'

interface SeasonCountdownProps {
  endDate: string
}

export function SeasonCountdown({ endDate }: SeasonCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    
    const calculateTimeLeft = () => {
      const difference = new Date(endDate).getTime() - new Date().getTime()
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        })
      }
    }
    
    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    
    return () => clearInterval(timer)
  }, [endDate])
  
  if (!mounted) {
    return (
      <div className="grid grid-cols-4 gap-2 md:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <div className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4 md:p-6">
              <div className="text-2xl md:text-4xl font-mono font-black text-[var(--term-accent)] mb-1">--</div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--term-muted)] font-mono">LOADING</div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-4 gap-2 md:gap-4">
      <div className="text-center">
        <div className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4 md:p-6">
          <div className="text-2xl md:text-4xl font-mono font-black text-[var(--term-accent)] mb-1 tabular-nums">{String(timeLeft.days).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--term-muted)] font-mono">DAYS</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4 md:p-6">
          <div className="text-2xl md:text-4xl font-mono font-black text-[var(--term-accent)] mb-1 tabular-nums">{String(timeLeft.hours).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--term-muted)] font-mono">HOURS</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4 md:p-6">
          <div className="text-2xl md:text-4xl font-mono font-black text-[var(--term-accent)] mb-1 tabular-nums">{String(timeLeft.minutes).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--term-muted)] font-mono">MINS</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4 md:p-6">
          <div className="text-2xl md:text-4xl font-mono font-black text-[var(--term-accent)] mb-1 tabular-nums">{String(timeLeft.seconds).padStart(2, '0')}</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--term-muted)] font-mono">SECS</div>
        </div>
      </div>
    </div>
  )
}
