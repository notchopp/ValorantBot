// CHALLENGER Rank Icon - Red (#dc2626)
// Dynamic and powerful - Diamond shape, energy, competition

export function CHALLENGERIcon({ size = 100, className = '' }: { size?: number; className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="challenger-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="1" />
          <stop offset="50%" stopColor="#ef4444" stopOpacity="1" />
          <stop offset="100%" stopColor="#dc143c" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="challenger-radial" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="1" />
        </radialGradient>
        <filter id="challenger-glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Dynamic diamond - represents challenge and competition */}
      <path
        d="M50 5 L95 50 L50 95 L5 50 Z"
        fill="url(#challenger-gradient)"
        stroke="#dc143c"
        strokeWidth="2"
        opacity="0.98"
        filter="url(#challenger-glow)"
      />
      
      {/* Inner energy core */}
      <path
        d="M50 20 L80 50 L50 80 L20 50 Z"
        fill="url(#challenger-radial)"
        opacity="0.4"
      />
      
      {/* Energy lines radiating outward */}
      <line x1="50" y1="5" x2="50" y2="95" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
      <line x1="5" y1="50" x2="95" y2="50" stroke="#ffffff" strokeWidth="1" opacity="0.3" />
      <line x1="20" y1="20" x2="80" y2="80" stroke="#ffffff" strokeWidth="0.8" opacity="0.25" />
      <line x1="80" y1="20" x2="20" y2="80" stroke="#ffffff" strokeWidth="0.8" opacity="0.25" />
      
      {/* C letter - bold and powerful */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="32"
        fontWeight="900"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="-1"
        stroke="#ffffff"
        strokeWidth="0.5"
      >
        C
      </text>
      
      {/* Corner energy highlights */}
      <circle cx="50" cy="5" r="4" fill="#ffffff" opacity="0.7" />
      <circle cx="95" cy="50" r="4" fill="#ffffff" opacity="0.7" />
      <circle cx="50" cy="95" r="4" fill="#ffffff" opacity="0.7" />
      <circle cx="5" cy="50" r="4" fill="#ffffff" opacity="0.7" />
      
      {/* Outer energy ring */}
      <path
        d="M50 5 L95 50 L50 95 L5 50 Z"
        fill="none"
        stroke="#dc143c"
        strokeWidth="1"
        opacity="0.4"
        transform="scale(1.08) translate(-4, -4)"
      />
      
      {/* Small energy particles */}
      <circle cx="30" cy="30" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="70" cy="30" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="70" cy="70" r="1.5" fill="#ffffff" opacity="0.6" />
      <circle cx="30" cy="70" r="1.5" fill="#ffffff" opacity="0.6" />
    </svg>
  )
}
