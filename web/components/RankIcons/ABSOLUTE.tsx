// ABSOLUTE Rank Icon - Gold/Amber (#f59e0b)
// Elite and prestigious - Star shape, radiant, absolute power

export function ABSOLUTEIcon({ size = 100, className = '' }: { size?: number; className?: string }) {
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
        <linearGradient id="absolute-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="1" />
          <stop offset="50%" stopColor="#ffd700" stopOpacity="1" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="absolute-radial" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="1" />
        </radialGradient>
        <filter id="absolute-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Elite star/pentagon - represents absolute power */}
      <path
        d="M50 2 L68 28 L98 36 L78 58 L82 88 L50 76 L18 88 L22 58 L2 36 L32 28 Z"
        fill="url(#absolute-gradient)"
        stroke="#ffd700"
        strokeWidth="2"
        opacity="0.98"
        filter="url(#absolute-glow)"
      />
      
      {/* Inner star - depth and prestige */}
      <path
        d="M50 15 L62 32 L82 38 L68 52 L71 72 L50 64 L29 72 L32 52 L18 38 L38 32 Z"
        fill="url(#absolute-radial)"
        opacity="0.5"
      />
      
      {/* Radiant lines */}
      <line x1="50" y1="2" x2="50" y2="76" stroke="#ffd700" strokeWidth="0.8" opacity="0.4" />
      <line x1="68" y1="28" x2="22" y2="58" stroke="#ffd700" strokeWidth="0.8" opacity="0.3" />
      <line x1="98" y1="36" x2="2" y2="36" stroke="#ffd700" strokeWidth="0.8" opacity="0.3" />
      <line x1="78" y1="58" x2="22" y2="58" stroke="#ffd700" strokeWidth="0.8" opacity="0.3" />
      <line x1="82" y1="88" x2="18" y2="88" stroke="#ffd700" strokeWidth="0.8" opacity="0.3" />
      
      {/* A letter - absolute authority */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fill="#000000"
        fontSize="30"
        fontWeight="900"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="-1"
        stroke="#000000"
        strokeWidth="0.5"
      >
        A
      </text>
      
      {/* Radiant glow points at star tips */}
      <circle cx="50" cy="2" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="68" cy="28" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="98" cy="36" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="78" cy="58" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="82" cy="88" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="50" cy="76" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="18" cy="88" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="22" cy="58" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="2" cy="36" r="3" fill="#ffd700" opacity="0.9" />
      <circle cx="32" cy="28" r="3" fill="#ffd700" opacity="0.9" />
      
      {/* Outer radiant ring */}
      <path
        d="M50 2 L68 28 L98 36 L78 58 L82 88 L50 76 L18 88 L22 58 L2 36 L32 28 Z"
        fill="none"
        stroke="#ffd700"
        strokeWidth="1"
        opacity="0.4"
        transform="scale(1.1) translate(-5, -5)"
      />
    </svg>
  )
}
