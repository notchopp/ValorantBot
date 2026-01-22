// GRNDS Rank Icon - Orange (#ff8c00)
// Foundation rank - Ground level, solid base, entry point

export function GRNDSIcon({ size = 100, className = '' }: { size?: number; className?: string }) {
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
        <linearGradient id="grnds-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff8c00" stopOpacity="1" />
          <stop offset="50%" stopColor="#ffa500" stopOpacity="1" />
          <stop offset="100%" stopColor="#ff8c00" stopOpacity="1" />
        </linearGradient>
        <filter id="grnds-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Base shield/badge shape - represents foundation */}
      <path
        d="M50 8 L75 15 L85 35 L85 65 L75 85 L50 92 L25 85 L15 65 L15 35 L25 15 Z"
        fill="url(#grnds-gradient)"
        stroke="#ff8c00"
        strokeWidth="1.5"
        filter="url(#grnds-glow)"
      />
      
      {/* Inner geometric pattern - foundation blocks */}
      <path
        d="M50 20 L65 25 L70 40 L70 60 L65 75 L50 80 L35 75 L30 60 L30 40 L35 25 Z"
        fill="#000000"
        opacity="0.25"
      />
      
      {/* Foundation lines */}
      <line x1="50" y1="20" x2="50" y2="80" stroke="#ff8c00" strokeWidth="0.5" opacity="0.4" />
      <line x1="30" y1="50" x2="70" y2="50" stroke="#ff8c00" strokeWidth="0.5" opacity="0.4" />
      
      {/* G letter - bold and centered */}
      <text
        x="50"
        y="58"
        textAnchor="middle"
        fill="#000000"
        fontSize="32"
        fontWeight="900"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="-1"
        stroke="#000000"
        strokeWidth="0.5"
      >
        G
      </text>
      
      {/* Corner accent dots */}
      <circle cx="25" cy="15" r="2" fill="#000000" opacity="0.6" />
      <circle cx="75" cy="15" r="2" fill="#000000" opacity="0.6" />
      <circle cx="85" cy="35" r="2" fill="#000000" opacity="0.6" />
      <circle cx="85" cy="65" r="2" fill="#000000" opacity="0.6" />
      <circle cx="75" cy="85" r="2" fill="#000000" opacity="0.6" />
      <circle cx="25" cy="85" r="2" fill="#000000" opacity="0.6" />
      <circle cx="15" cy="65" r="2" fill="#000000" opacity="0.6" />
      <circle cx="15" cy="35" r="2" fill="#000000" opacity="0.6" />
      
      {/* Outer glow ring */}
      <path
        d="M50 8 L75 15 L85 35 L85 65 L75 85 L50 92 L25 85 L15 65 L15 35 L25 15 Z"
        fill="none"
        stroke="#ff8c00"
        strokeWidth="0.5"
        opacity="0.3"
        transform="scale(1.05) translate(-2.5, -2.5)"
      />
    </svg>
  )
}
