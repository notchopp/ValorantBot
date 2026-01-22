'use client'
import { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'

interface GRNDSLogo3DProps {
  onAnimationComplete?: () => void
}

// Particle component - orange particles that fly out on click
function Particle({ 
  position, 
  targetPosition,
  isClicked
}: {
  position: [number, number, number]
  targetPosition: [number, number, number]
  isClicked: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [currentPos, setCurrentPos] = useState(position)
  
  useEffect(() => {
    let animationFrame: number
    const startPos = [...position] as [number, number, number]
    const endPos = isClicked ? targetPosition : position
    const duration = isClicked ? 600 : 800
    
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      const eased = isClicked 
        ? 1 - Math.pow(1 - progress, 3)
        : 1 - Math.pow(1 - progress, 2)
      
      const newPos: [number, number, number] = [
        startPos[0] + (endPos[0] - startPos[0]) * eased,
        startPos[1] + (endPos[1] - startPos[1]) * eased,
        startPos[2] + (endPos[2] - startPos[2]) * eased
      ]
      
      setCurrentPos(newPos)
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }
    
    animationFrame = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [isClicked, position, targetPosition])
  
  useFrame(() => {
    if (!meshRef.current) return
    
    // Rotate particles
    meshRef.current.rotation.x += 0.01
    meshRef.current.rotation.y += 0.01
    
    // Update position
    meshRef.current.position.set(...currentPos)
  })
  
  return (
    <mesh ref={meshRef} position={currentPos}>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshStandardMaterial 
        color="#ff8c00"
        emissive="#ff8c00"
        emissiveIntensity={1.2}
        transparent
        opacity={isClicked ? 0.9 : 0}
      />
    </mesh>
  )
}

// Main G logo component with breathing and click particle effect
function GRNDSLogoModel(_props: GRNDSLogo3DProps) {
  const router = useRouter()
  const groupRef = useRef<THREE.Group>(null)
  const logoRef = useRef<HTMLImageElement>(null)
  const clickAreaRef = useRef<THREE.Mesh>(null)
  const [isClicked, setIsClicked] = useState(false)
  const [particles, setParticles] = useState<Array<{
    position: [number, number, number]
    targetPosition: [number, number, number]
  }>>([])
  
  useEffect(() => {
    // Generate particles that will fly out from the logo
    const newParticles = []
    const particleCount = 150
    
    for (let i = 0; i < particleCount; i++) {
      // Start position - around the logo center
      const angle = (i / particleCount) * Math.PI * 2
      const radius = 0.15 + Math.random() * 0.25
      const height = (Math.random() - 0.5) * 0.4
      
      const startPos: [number, number, number] = [
        Math.cos(angle) * radius,
        height,
        Math.sin(angle) * radius
      ]
      
      // Target position - particles fly outward
      const breakDistance = 0.8 + Math.random() * 1.2
      const breakAngle = angle + (Math.random() - 0.5) * 0.6
      
      const targetPos: [number, number, number] = [
        Math.cos(breakAngle) * breakDistance,
        height + (Math.random() - 0.5) * 0.6,
        Math.sin(breakAngle) * breakDistance
      ]
      
      newParticles.push({
        position: startPos,
        targetPosition: targetPos
      })
    }
    setParticles(newParticles)
  }, [])
  
  // Breathing animation - applied directly to the GIF
  useFrame((state) => {
    if (!logoRef.current || !groupRef.current) return
    
    const time = state.clock.elapsedTime
    
    // More organic breathing - multiple sine waves
    const breathe1 = Math.sin(time * 1.2) * 0.012
    const breathe2 = Math.sin(time * 0.8) * 0.008
    const breathe = 1 + breathe1 + breathe2
    logoRef.current.style.transform = `scale(${breathe})`
    
    // Subtle position breathing
    const breatheY = Math.sin(time * 1.0) * 0.008
    const breatheX = Math.cos(time * 0.7) * 0.005
    groupRef.current.position.y = breatheY
    groupRef.current.position.x = breatheX
    
    // Subtle glow pulsing with red tint
    const glow = 0.4 + Math.sin(time * 1.8) * 0.12
    logoRef.current.style.filter = `hue-rotate(-30deg) saturate(2.0) brightness(${1.0 + glow * 0.08})`
  })
  
  const handleLogoClick = () => {
    setIsClicked(!isClicked)
  }

  const handleEnterClick = () => {
    router.push('/auth/login')
  }

  return (
    <group ref={groupRef}>
      {/* Invisible click area for logo - large enough to catch click events */}
      <mesh
        ref={clickAreaRef}
        position={[0, 0.2, 0]}
        onClick={handleLogoClick}
      >
        <planeGeometry args={[2.5, 2.5]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Main G logo GIF - with breathing animation */}
      <Html
        transform
        position={[0, 0, 0]}
        distanceFactor={1}
        style={{
          pointerEvents: isClicked ? 'none' : 'auto',
          opacity: isClicked ? 0 : 1,
          transition: 'opacity 0.3s ease-out'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <img 
            ref={logoRef}
            src="/grnds-logo.gif" 
            alt="GRNDS Logo"
            style={{
              width: '500px',
              height: '500px',
              objectFit: 'contain',
              display: 'block',
              transition: 'transform 0.1s ease-out, filter 0.1s ease-out',
              pointerEvents: 'none',
              filter: 'hue-rotate(-30deg) saturate(2.0) brightness(1.0)'
            }}
          />
          {/* Enter #GRNDS text - clickable */}
          <div
            onClick={handleEnterClick}
            style={{
              color: '#ff0000',
              fontFamily: 'monospace',
              fontSize: '24px',
              marginTop: '20px',
              letterSpacing: '2px',
              opacity: isClicked ? 0 : 1,
              transition: 'opacity 0.3s ease-out, color 0.2s ease',
              cursor: 'pointer',
              userSelect: 'none',
              pointerEvents: 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ff3333'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#ff0000'
            }}
          >
            enter #GRNDS
          </div>
        </div>
      </Html>
      
      {/* Orange particles that fly out on click */}
      {particles.map((particle, i) => (
        <Particle
          key={i}
          position={particle.position}
          targetPosition={particle.targetPosition}
          isClicked={isClicked}
        />
      ))}
    </group>
  )
}

export function GRNDSLogo3D({ onAnimationComplete }: GRNDSLogo3DProps) {
  return (
    <div className="fixed inset-0 bg-black z-50">
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="text-white font-mono">Loading...</div>
        </div>
      }>
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={2} />
          <pointLight position={[-10, -10, -10]} intensity={1} color="#ff8c00" />
          <directionalLight position={[0, 5, 5]} intensity={1.2} />
          
          <GRNDSLogoModel onAnimationComplete={onAnimationComplete} />
        </Canvas>
      </Suspense>
    </div>
  )
}
