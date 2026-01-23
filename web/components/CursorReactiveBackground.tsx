'use client'

import { useEffect } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useAccentColor } from '@/lib/AccentColorContext'

export function CursorReactiveBackground() {
  const { accentColor } = useAccentColor()
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Use clientX/clientY for fixed positioned elements
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const spotlightX = useSpring(mouseX, { stiffness: 150, damping: 25 })
  const spotlightY = useSpring(mouseY, { stiffness: 150, damping: 25 })

  const radialMask = useTransform(
    [spotlightX, spotlightY],
    ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, black 0%, transparent 70%)`
  )

  return (
    <div 
      className="pointer-events-none bg-[#0d0d0d]"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        overflow: 'hidden'
      }}
    >
      {/* Base Pattern - Hexagonal Grid */}
      <div 
        className="absolute opacity-[0.03]" 
        style={{ 
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a1a1a' fill-opacity='0.4'%3E%3Cpath d='M10 0h40L50 10H20L10 0zm10 20h40l-10 10H20L10 20zm0 40h40l-10 10H20L10 40zM-10 40h40l-10 10H-10L-20 40z'/%3E%3Cpath d='M60 0h40L90 10H60L50 0zm0 20h40l-10 10H60L50 20zm0 40h40l-10 10H60L50 40z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '80px 80px'
        }}
      />
      
      {/* Cursor Reactive Pattern - highlights that follow cursor */}
      <motion.div 
        style={{ 
          position: 'absolute',
          inset: 0,
          WebkitMaskImage: radialMask,
          maskImage: radialMask,
          zIndex: 10
        }}
        className="hidden md:block"
      >
        {/* Accent Color Hexagonal Grid Lines */}
        <div 
          className="absolute opacity-[0.6]" 
          style={{ 
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(accentColor.replace('#', '%23'))}' fill-opacity='0.6'%3E%3Cpath d='M10 0h40L50 10H20L10 0zm10 20h40l-10 10H20L10 20zm0 40h40l-10 10H20L10 40zM-10 40h40l-10 10H-10L-20 40z'/%3E%3Cpath d='M60 0h40L90 10H60L50 0zm0 20h40l-10 10H60L50 20zm0 40h40l-10 10H60L50 40z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '80px 80px'
          }}
        />
        
        {/* Dynamic spotlight glow following cursor */}
        <motion.div 
          style={{ 
            position: 'absolute',
            left: spotlightX,
            top: spotlightY,
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 600,
            borderRadius: '50%',
            filter: 'blur(120px)',
            background: `radial-gradient(circle, ${accentColor}25 0%, ${accentColor}10 40%, transparent 70%)`,
          }}
        />
      </motion.div>

      {/* Subtle texture overlay */}
      <div 
        className="absolute opacity-[0.01] mix-blend-overlay pointer-events-none"
        style={{
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '250px 250px',
        }}
      />
    </div>
  )
}
