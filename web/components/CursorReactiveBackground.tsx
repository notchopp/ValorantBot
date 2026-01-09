'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

export function CursorReactiveBackground() {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e
      mouseX.set(clientX)
      mouseY.set(clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const spotlightX = useSpring(mouseX, { stiffness: 150, damping: 25 })
  const spotlightY = useSpring(mouseY, { stiffness: 150, damping: 25 })

  const radialMask = useTransform(
    [spotlightX, spotlightY],
    ([x, y]) => `radial-gradient(500px circle at ${x}px ${y}px, black 0%, transparent 70%)`
  )

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-black overflow-hidden">
      {/* Simple clean background - subtle hex pattern */}
      <div className="absolute inset-0 opacity-[0.015]">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 215, 0, 0.1) 60deg, transparent 120deg),
              repeating-conic-gradient(from 30deg at 50% 50%, transparent 0deg, rgba(255, 215, 0, 0.08) 45deg, transparent 90deg)
            `,
            backgroundSize: '200px 200px, 150px 150px',
          }}
        />
      </div>
      
      {/* Cursor-reactive yellow highlight */}
      <motion.div 
        style={{ 
          WebkitMaskImage: radialMask,
          maskImage: radialMask
        }}
        className="absolute inset-0 z-10 hidden md:block"
      >
        {/* Yellow hexagonal pattern that lights up */}
        <div 
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage: `
              repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 215, 0, 0.4) 60deg, transparent 120deg),
              repeating-conic-gradient(from 30deg at 50% 50%, transparent 0deg, rgba(255, 215, 0, 0.3) 45deg, transparent 90deg)
            `,
            backgroundSize: '200px 200px, 150px 150px',
          }}
        />
        
        {/* Soft yellow glow following cursor */}
        <motion.div 
          style={{ 
            left: spotlightX,
            top: spotlightY,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 215, 0, 0.12) 0%, rgba(255, 215, 0, 0.06) 40%, transparent 70%)',
          }}
          className="absolute w-[500px] h-[500px] rounded-full blur-[120px]"
        />
      </motion.div>

      {/* Subtle grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.008] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '300px 300px',
        }}
      />
    </div>
  )
}
