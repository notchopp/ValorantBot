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
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="text-center">
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
              <div className="text-4xl font-black text-[#ffd700] mb-2">--</div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Loading</div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="text-center">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
          <div className="text-4xl font-black text-[#ffd700] mb-2">{timeLeft.days}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Days</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
          <div className="text-4xl font-black text-[#ffd700] mb-2">{timeLeft.hours}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Hours</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
          <div className="text-4xl font-black text-[#ffd700] mb-2">{timeLeft.minutes}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Minutes</div>
        </div>
      </div>
      <div className="text-center">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl">
          <div className="text-4xl font-black text-[#ffd700] mb-2">{timeLeft.seconds}</div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Seconds</div>
        </div>
      </div>
    </div>
  )
}
