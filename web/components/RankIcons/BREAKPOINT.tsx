// BREAKPOINT Rank Icon - Dark Grey (#2a2a2a)
// Breaking through barriers - Shattered, angular, breakthrough

export function BREAKPOINTIcon({ size = 100, className = '' }: { size?: number; className?: string }) {
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
        <linearGradient id="breakpoint-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2a2a2a" stopOpacity="1" />
          <stop offset="50%" stopColor="#3a3a3a" stopOpacity="1" />
          <stop offset="100%" stopColor="#2a2a2a" stopOpacity="1" />
        </linearGradient>
        <filter id="breakpoint-glow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Shattered barrier shape - breaking through */}
      <path
        d="M15 20 L45 12 L85 20 L92 50 L85 80 L45 88 L15 80 L8 50 Z"
        fill="url(#breakpoint-gradient)"
        stroke="#ffffff"
        strokeWidth="1.5"
        opacity="0.95"
        filter="url(#breakpoint-glow)"
      />
      
      {/* Break lines - creating shattered effect */}
      <line x1="50" y1="12" x2="50" y2="88" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
      <line x1="15" y1="50" x2="85" y2="50" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
      <line x1="30" y1="25" x2="70" y2="75" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" />
      <line x1="70" y1="25" x2="30" y2="75" stroke="#ffffff" strokeWidth="0.8" opacity="0.3" />
      
      {/* Additional fracture lines */}
      <line x1="30" y1="12" x2="30" y2="88" stroke="#ffffff" strokeWidth="0.5" opacity="0.2" />
      <line x1="70" y1="12" x2="70" y2="88" stroke="#ffffff" strokeWidth="0.5" opacity="0.2" />
      
      {/* Inner broken shape */}
      <path
        d="M30 30 L50 28 L70 30 L72 50 L70 70 L50 72 L30 70 L28 50 Z"
        fill="#000000"
        opacity="0.3"
      />
      
      {/* B letter - bold and angular */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="30"
        fontWeight="900"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="-1"
        stroke="#ffffff"
        strokeWidth="0.3"
      >
        B
      </text>
      
      {/* Sharp corner accents - representing break points */}
      <polygon points="15,20 20,20 15,25" fill="#ffffff" opacity="0.5" />
      <polygon points="85,20 80,20 85,25" fill="#ffffff" opacity="0.5" />
      <polygon points="85,80 80,80 85,75" fill="#ffffff" opacity="0.5" />
      <polygon points="15,80 20,80 15,75" fill="#ffffff" opacity="0.5" />
      
      {/* Energy cracks */}
      <path d="M8 50 L15 45 L12 50 L15 55 Z" fill="#ffffff" opacity="0.3" />
      <path d="M92 50 L85 45 L88 50 L85 55 Z" fill="#ffffff" opacity="0.3" />
    </svg>
  )
}
