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
    ([x, y]) => `radial-gradient(650px circle at ${x}px ${y}px, black 0%, transparent 75%)`
  )

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-black overflow-hidden">
      {/* Base Pattern - Rank Tier Diagonal Stripes (GRNDS Orange, BREAKPOINT Black, CHALLENGER Red, X White) */}
      <div className="absolute inset-0 opacity-[0.02]">
        {/* Tier progression stripes - each tier has unique angle/pattern */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                35deg,
                transparent,
                transparent 75px,
                rgba(255, 140, 0, 0.4) 75px,
                rgba(255, 140, 0, 0.4) 76px
              ),
              repeating-linear-gradient(
                -55deg,
                transparent,
                transparent 95px,
                rgba(0, 0, 0, 0.5) 95px,
                rgba(255, 255, 255, 0.1) 96px
              ),
              repeating-linear-gradient(
                125deg,
                transparent,
                transparent 115px,
                rgba(255, 0, 0, 0.3) 115px,
                rgba(255, 0, 0, 0.3) 116px
              )
            `,
            backgroundSize: '250% 250%',
            backgroundPosition: '0% 0%',
          }}
        />
        
        {/* Rank tier radial gradients for depth */}
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 800px 600px at 25% 35%, rgba(255, 140, 0, 0.04) 0%, transparent 50%),
              radial-gradient(ellipse 600px 800px at 75% 65%, rgba(0, 0, 0, 0.8) 0%, transparent 55%),
              radial-gradient(ellipse 700px 700px at 50% 50%, rgba(255, 0, 0, 0.03) 0%, transparent 60%),
              radial-gradient(ellipse 400px 400px at 80% 20%, rgba(255, 255, 255, 0.02) 0%, transparent 40%)
            `,
          }}
        />
      </div>
      
      {/* Cursor Reactive Pattern - Competitive highlights that follow cursor */}
      <motion.div 
        style={{ 
          WebkitMaskImage: radialMask,
          maskImage: radialMask
        }}
        className="absolute inset-0 z-10 hidden md:block"
      >
        {/* Rank tier stripes that illuminate on cursor */}
        <div 
          className="absolute inset-0 opacity-[0.6]"
          style={{
            backgroundImage: `
              repeating-linear-gradient(
                35deg,
                transparent,
                transparent 75px,
                rgba(255, 140, 0, 0.8) 75px,
                rgba(255, 140, 0, 0.8) 76px
              ),
              repeating-linear-gradient(
                -55deg,
                transparent,
                transparent 95px,
                rgba(255, 255, 255, 0.6) 95px,
                rgba(0, 0, 0, 0.9) 96px
              ),
              repeating-linear-gradient(
                125deg,
                transparent,
                transparent 115px,
                rgba(255, 0, 0, 0.7) 115px,
                rgba(255, 0, 0, 0.7) 116px
              )
            `,
            backgroundSize: '250% 250%',
          }}
        />
        
        {/* Competitive rank tier orbs that pulse */}
        <div 
          className="absolute inset-0 opacity-[0.8]"
          style={{
            backgroundImage: `
              radial-gradient(circle 8px at 20% 25%, rgba(255, 140, 0, 1) 0%, transparent 12px),
              radial-gradient(circle 6px at 60% 45%, rgba(0, 0, 0, 0.9) 0%, rgba(255, 255, 255, 0.3) 10px, transparent 15px),
              radial-gradient(circle 10px at 40% 70%, rgba(255, 0, 0, 0.9) 0%, transparent 14px),
              radial-gradient(circle 12px at 85% 30%, rgba(255, 255, 255, 0.8) 0%, transparent 16px),
              radial-gradient(circle 7px at 15% 80%, rgba(255, 140, 0, 0.7) 0%, transparent 11px),
              radial-gradient(circle 9px at 75% 60%, rgba(255, 0, 0, 0.6) 0%, transparent 13px)
            `,
            backgroundSize: '180px 180px, 200px 200px, 160px 160px, 190px 190px, 170px 170px, 210px 210px',
            backgroundPosition: '0% 0%, 33% 33%, 66% 66%, 20% 80%, 80% 20%, 50% 50%',
          }}
        />
        
        {/* Dynamic spotlight glow following cursor - GRNDS orange primary */}
        <motion.div 
          style={{ 
            left: spotlightX,
            top: spotlightY,
            transform: 'translate(-50%, -50%)',
            background: 'radial-gradient(circle, rgba(255, 140, 0, 0.25) 0%, rgba(255, 140, 0, 0.15) 30%, rgba(255, 0, 0, 0.08) 50%, rgba(255, 255, 255, 0.04) 70%, transparent 100%)',
          }}
          className="absolute w-[650px] h-[650px] rounded-full blur-[140px]"
        />
      </motion.div>

      {/* Subtle texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.01] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '250px 250px',
        }}
      />
    </div>
  )
}
