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

  const gridMask = useTransform(
    [spotlightX, spotlightY],
    ([x, y]) => `radial-gradient(500px circle at ${x}px ${y}px, black 0%, transparent 100%)`
  )

  return (
    <div className="fixed inset-0 z-0 pointer-events-none bg-[#020202]">
      {/* Base Grid (Static & Dark) */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Cursor Reactive Grid (Lights up Gold) - Hidden on mobile for performance */}
      <motion.div 
        style={{ 
          WebkitMaskImage: gridMask,
          maskImage: gridMask
        }}
        className="absolute inset-0 z-10 hidden md:block"
      >
        {/* Gold Grid Lines */}
        <div 
          className="absolute inset-0 opacity-[0.4]" 
          style={{ 
            backgroundImage: `linear-gradient(to right, #ffd700 1px, transparent 1px), linear-gradient(to bottom, #ffd700 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
        
        {/* Gold Intersection Dots/Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ffd700_1px,transparent_1px)] bg-[length:40px_40px] opacity-[0.6]" />
        
        {/* Soft Center Glow */}
        <motion.div 
          style={{ 
            left: spotlightX,
            top: spotlightY,
            transform: 'translate(-50%, -50%)'
          }}
          className="absolute w-[500px] h-[500px] bg-[#ffd700]/15 rounded-full blur-[100px]"
        />
      </motion.div>

      {/* Global Grain Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.01] mix-blend-overlay" />
    </div>
  )
}
