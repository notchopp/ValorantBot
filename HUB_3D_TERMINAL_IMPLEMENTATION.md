# Hub.GRNDS.xyz - Full 3D Terminal Dashboard Implementation

## Vision

A fully interactive 3D terminal-style dashboard where users land on `hub.grnds.xyz` and see their rank badge breaking apart into pieces (like igloo.inc's igloo breaking up), then enter a terminal interface with portal-style navigation animations.

## Rank System

**5 Rank Icons Needed (not tiers, just ranks):**
1. **GRNDS** - Orange (#ff8c00)
2. **BREAKPOINT** - Dark Grey (#2a2a2a)
3. **CHALLENGER** - Red (#dc2626)
4. **ABSOLUTE** - Gold/Amber (#f59e0b)
5. **X** - White (#ffffff)

## Architecture Overview

```
hub.grnds.xyz
├── Landing Page (3D Rank Badge Breaking Animation)
│   ├── Rank badge 3D model breaks into pieces
│   ├── Particles fly out
│   ├── Transition to terminal interface
│   └── Portal animation to dashboard
│
├── Terminal Dashboard (Main Interface)
│   ├── 3D terminal environment
│   ├── Monospace typography
│   ├── Command-line interface
│   ├── Real-time data visualization
│   └── Portal navigation system
│
└── 3D Components
    ├── RankBadge3D.tsx (Breaking animation)
    ├── Terminal3D.tsx (Main terminal scene)
    ├── Portal.tsx (Navigation portals)
    ├── NetworkGraph.tsx (Player connections)
    └── ParticleSystem.tsx (Background effects)
```

## Phase 1: Landing Page - Rank Badge Breaking Animation

### Component: `RankBadge3D.tsx`

**Concept:**
- User lands on hub.grnds.xyz
- Their rank badge (GRNDS/BREAKPOINT/CHALLENGER/ABSOLUTE/X) appears as a 3D wireframe model
- Badge breaks apart into individual pieces
- Pieces fly outward with particle trails
- Transition to terminal interface

**Implementation:**

```tsx
// web/components/3D/RankBadge3D.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Text, Mesh, Group } from '@react-three/drei'
import * as THREE from 'three'

interface RankBadge3DProps {
  rank: 'GRNDS' | 'BREAKPOINT' | 'CHALLENGER' | 'ABSOLUTE' | 'X'
  onAnimationComplete?: () => void
}

// Rank colors
const RANK_COLORS = {
  GRNDS: '#ff8c00',
  BREAKPOINT: '#2a2a2a',
  CHALLENGER: '#dc2626',
  ABSOLUTE: '#f59e0b',
  X: '#ffffff'
}

// Badge piece component
function BadgePiece({ 
  position, 
  rotation, 
  velocity,
  color,
  delay 
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  velocity: [number, number, number]
  color: string
  delay: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [visible, setVisible] = useState(false)
  
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  
  useFrame((state, delta) => {
    if (!meshRef.current || !visible) return
    
    // Apply velocity
    meshRef.current.position.x += velocity[0] * delta
    meshRef.current.position.y += velocity[1] * delta
    meshRef.current.position.z += velocity[2] * delta
    
    // Rotation
    meshRef.current.rotation.x += delta * 0.5
    meshRef.current.rotation.y += delta * 0.3
    
    // Fade out
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    if (material) {
      material.opacity = Math.max(0, material.opacity - delta * 0.2)
    }
  })
  
  if (!visible) return null
  
  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={0.5}
        transparent
        opacity={1}
      />
    </mesh>
  )
}

// Main badge component
function RankBadgeModel({ rank, onAnimationComplete }: RankBadge3DProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [isBreaking, setIsBreaking] = useState(false)
  const [pieces, setPieces] = useState<Array<{
    position: [number, number, number]
    rotation: [number, number, number]
    velocity: [number, number, number]
    delay: number
  }>>([])
  
  const color = RANK_COLORS[rank]
  
  useEffect(() => {
    // Initial display - badge appears
    const showTimer = setTimeout(() => {
      setIsBreaking(true)
      
      // Generate pieces
      const newPieces = []
      for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2
        const radius = 0.5 + Math.random() * 0.5
        const height = (Math.random() - 0.5) * 1
        
        newPieces.push({
          position: [
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
          ] as [number, number, number],
          rotation: [
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          ] as [number, number, number],
          velocity: [
            (Math.random() - 0.5) * 5,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 5
          ] as [number, number, number],
          delay: Math.random() * 0.5
        })
      }
      setPieces(newPieces)
    }, 1000)
    
    // Animation complete
    const completeTimer = setTimeout(() => {
      onAnimationComplete?.()
    }, 3000)
    
    return () => {
      clearTimeout(showTimer)
      clearTimeout(completeTimer)
    }
  }, [rank, onAnimationComplete])
  
  return (
    <group ref={groupRef}>
      {/* Main badge (disappears when breaking) */}
      {!isBreaking && (
        <group>
          {/* Badge shape - wireframe box */}
          <mesh>
            <boxGeometry args={[2, 1, 0.2]} />
            <meshStandardMaterial 
              color={color}
              emissive={color}
              emissiveIntensity={0.8}
              wireframe
            />
          </mesh>
          
          {/* Rank text */}
          <Text
            position={[0, 0, 0.15]}
            fontSize={0.5}
            color={color}
            font="/fonts/JetBrainsMono-Bold.woff"
            anchorX="center"
            anchorY="middle"
          >
            {rank}
          </Text>
        </group>
      )}
      
      {/* Breaking pieces */}
      {isBreaking && pieces.map((piece, i) => (
        <BadgePiece
          key={i}
          position={piece.position}
          rotation={piece.rotation}
          velocity={piece.velocity}
          color={color}
          delay={piece.delay}
        />
      ))}
    </group>
  )
}

export function RankBadge3D({ rank, onAnimationComplete }: RankBadge3DProps) {
  return (
    <div className="fixed inset-0 bg-black z-50">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color={RANK_COLORS[rank]} />
        
        <RankBadgeModel rank={rank} onAnimationComplete={onAnimationComplete} />
      </Canvas>
    </div>
  )
}
```

## Phase 2: Terminal Dashboard Interface

### Component: `Terminal3D.tsx`

**Concept:**
- 3D terminal environment
- Monospace typography
- Command-line interface
- Real-time data visualization
- Portal navigation

**Implementation:**

```tsx
// web/components/3D/Terminal3D.tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import { TerminalScene } from './TerminalScene'
import { Portal } from './Portal'

export function Terminal3D() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas camera={{ position: [0, 2, 5], fov: 50 }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, 10, -10]} intensity={0.5} color="#dc143c" />
        
        <TerminalScene />
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  )
}
```

### Terminal Scene with Command Interface

```tsx
// web/components/3D/TerminalScene.tsx
'use client'
import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'

export function TerminalScene() {
  const [command, setCommand] = useState('')
  const [output, setOutput] = useState<string[]>([])
  const cursorRef = useRef(true)
  
  useEffect(() => {
    // Blinking cursor
    const interval = setInterval(() => {
      cursorRef.current = !cursorRef.current
    }, 530)
    return () => clearInterval(interval)
  }, [])
  
  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase()
    
    switch (trimmed) {
      case 'help':
        setOutput([...output, 'Available commands:', '  - stats', '  - matches', '  - leaderboard', '  - queue', '  - exit'])
        break
      case 'stats':
        setOutput([...output, 'Loading stats...'])
        // Fetch stats
        break
      case 'matches':
        setOutput([...output, 'Loading match history...'])
        break
      default:
        setOutput([...output, `Unknown command: ${cmd}`])
    }
    setCommand('')
  }
  
  return (
    <group>
      {/* Terminal screen */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#0a0a0a" emissive="#dc143c" emissiveIntensity={0.1} />
      </mesh>
      
      {/* Terminal content */}
      <Html
        position={[0, 0, 0.1]}
        transform
        occlude
        style={{
          width: '800px',
          height: '600px',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#00ff00',
          fontSize: '14px',
          padding: '20px',
          background: 'rgba(10, 10, 10, 0.9)',
        }}
      >
        <div className="terminal-content">
          <div className="text-green-400 mb-4">
            #GRNDS Terminal v1.0.0
          </div>
          <div className="text-white mb-4">
            {output.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <div className="flex items-center">
            <span className="text-green-400">$</span>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCommand(command)}
              className="ml-2 bg-transparent border-none outline-none text-white flex-1"
              autoFocus
            />
            <span className={`text-green-400 ${cursorRef.current ? 'opacity-100' : 'opacity-0'}`}>
              █
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}
```

## Phase 3: Portal Navigation System

### Component: `Portal.tsx`

**Concept:**
- Portal-style animations for navigation
- Like igloo.inc's LinkedIn portal
- Smooth transitions between sections

```tsx
// web/components/3D/Portal.tsx
'use client'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'

interface PortalProps {
  position: [number, number, number]
  destination: string
  label: string
  color?: string
}

export function Portal({ position, destination, label, color = '#dc143c' }: PortalProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const router = useRouter()
  
  useFrame((state) => {
    if (!meshRef.current) return
    
    // Rotating portal effect
    meshRef.current.rotation.z += 0.01
    
    // Pulsing glow
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    if (material) {
      material.emissiveIntensity = hovered ? 1.5 : 0.8 + Math.sin(state.clock.elapsedTime * 2) * 0.2
    }
  })
  
  const handleClick = () => {
    // Portal animation
    // Then navigate
    router.push(destination)
  }
  
  return (
    <group position={position}>
      {/* Portal ring */}
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
      >
        <torusGeometry args={[1, 0.1, 16, 100]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1.5 : 0.8}
        />
      </mesh>
      
      {/* Portal center (void effect) */}
      <mesh>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial
          color="#000000"
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Label */}
      <Text
        position={[0, -1.5, 0]}
        fontSize={0.2}
        color={color}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}
```

## Phase 4: Rank Icons (SVG/3D Models)

### Create 5 Rank Icons

Each rank needs a unique icon design:

```tsx
// web/components/RankIcons/index.tsx
export { GRNDSIcon } from './GRNDS'
export { BREAKPOINTIcon } from './BREAKPOINT'
export { CHALLENGERIcon } from './CHALLENGER'
export { ABSOLUTEIcon } from './ABSOLUTE'
export { XIcon } from './X'
```

**Example: GRNDS Icon**
```tsx
// web/components/RankIcons/GRNDS.tsx
export function GRNDSIcon({ size = 100 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* GRNDS icon design - geometric, angular */}
      <path
        d="M50 10 L80 30 L80 70 L50 90 L20 70 L20 30 Z"
        fill="#ff8c00"
        stroke="#ff8c00"
        strokeWidth="2"
      />
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fill="#000"
        fontSize="24"
        fontWeight="bold"
        fontFamily="monospace"
      >
        G
      </text>
    </svg>
  )
}
```

## Phase 5: Landing Page Implementation

```tsx
// web/app/hub/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RankBadge3D } from '@/components/3D/RankBadge3D'
import { createClient } from '@/lib/supabase/client'

export default function HubPage() {
  const [rank, setRank] = useState<'GRNDS' | 'BREAKPOINT' | 'CHALLENGER' | 'ABSOLUTE' | 'X' | null>(null)
  const [loading, setLoading] = useState(true)
  const [animationComplete, setAnimationComplete] = useState(false)
  const router = useRouter()
  
  useEffect(() => {
    // Fetch user's rank
    const fetchRank = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Get player rank
        const { data: player } = await supabase
          .from('players')
          .select('discord_rank')
          .eq('id', user.id)
          .single()
        
        if (player?.discord_rank) {
          const rankName = player.discord_rank.split(' ')[0] as typeof rank
          setRank(rankName)
        }
      }
      
      setLoading(false)
    }
    
    fetchRank()
  }, [])
  
  const handleAnimationComplete = () => {
    setAnimationComplete(true)
    // Transition to dashboard
    setTimeout(() => {
      router.push('/dashboard')
    }, 500)
  }
  
  if (loading || !rank) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white font-mono">Loading...</div>
      </div>
    )
  }
  
  return (
    <>
      <RankBadge3D rank={rank} onAnimationComplete={handleAnimationComplete} />
      {animationComplete && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-white font-mono text-2xl animate-pulse">
            Entering Terminal...
          </div>
        </div>
      )}
    </>
  )
}
```

## Dependencies Required

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "three": "^0.158.0"
  }
}
```

## Implementation Timeline

### Week 1: Foundation
- [ ] Install Three.js dependencies
- [ ] Create rank icons (5 icons)
- [ ] Build RankBadge3D component
- [ ] Implement breaking animation

### Week 2: Terminal Interface
- [ ] Build Terminal3D component
- [ ] Create command-line interface
- [ ] Add real-time data integration
- [ ] Implement monospace styling

### Week 3: Portal System
- [ ] Build Portal component
- [ ] Create navigation system
- [ ] Add transition animations
- [ ] Integrate with Next.js routing

### Week 4: Polish & Integration
- [ ] Connect to Supabase data
- [ ] Add loading states
- [ ] Performance optimization
- [ ] Mobile fallback (2D version)

## File Structure

```
web/
├── app/
│   ├── hub/
│   │   └── page.tsx (Landing page with breaking animation)
│   └── dashboard/
│       └── page.tsx (Terminal dashboard)
├── components/
│   ├── 3D/
│   │   ├── RankBadge3D.tsx
│   │   ├── Terminal3D.tsx
│   │   ├── TerminalScene.tsx
│   │   ├── Portal.tsx
│   │   └── NetworkGraph.tsx
│   └── RankIcons/
│       ├── GRNDS.tsx
│       ├── BREAKPOINT.tsx
│       ├── CHALLENGER.tsx
│       ├── ABSOLUTE.tsx
│       └── X.tsx
└── lib/
    └── three/
        └── utils.ts
```

## Performance Considerations

1. **Lazy Loading:** Load 3D components only when needed
2. **Mobile Fallback:** Show 2D version on mobile devices
3. **Asset Optimization:** Compress 3D models and textures
4. **Frame Rate:** Target 60fps, reduce quality if needed
5. **Bundle Splitting:** Code-split Three.js components

## Next Steps

1. **Install dependencies:** `npm install @react-three/fiber @react-three/drei three`
2. **Create rank icons:** Design 5 unique rank icons
3. **Build RankBadge3D:** Start with breaking animation
4. **Test on hub.grnds.xyz:** Deploy and iterate

This creates a fully immersive 3D terminal experience that matches the igloo.inc aesthetic while being uniquely #GRNDS!
