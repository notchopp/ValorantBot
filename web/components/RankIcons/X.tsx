// X Rank Icon - White (#ffffff)
// Ultimate rank - Perfect circle, pure, minimal, absolute peak

export function XIcon({ size = 100, className = '' }: { size?: number; className?: string }) {
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
        <radialGradient id="x-gradient" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="50%" stopColor="#f5f5f5" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </radialGradient>
        <filter id="x-glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Perfect circle - ultimate simplicity and perfection */}
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="url(#x-gradient)"
        stroke="#ffffff"
        strokeWidth="2"
        opacity="0.98"
        filter="url(#x-glow)"
      />
      
      {/* Inner circle - depth */}
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="#000000"
        opacity="0.25"
      />
      
      {/* Concentric rings - perfection */}
      <circle
        cx="50"
        cy="50"
        r="22"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.5"
        opacity="0.3"
      />
      <circle
        cx="50"
        cy="50"
        r="16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.5"
        opacity="0.2"
      />
      
      {/* X letter - bold, centered, ultimate */}
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fill="#000000"
        fontSize="38"
        fontWeight="900"
        fontFamily="'JetBrains Mono', 'Courier New', monospace"
        letterSpacing="-2"
        stroke="#000000"
        strokeWidth="0.8"
      >
        X
      </text>
      
      {/* Outer glow ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1"
        opacity="0.4"
      />
      
      {/* Corner accent lines - precision */}
      <line x1="8" y1="8" x2="18" y2="18" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <line x1="92" y1="8" x2="82" y2="18" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <line x1="8" y1="92" x2="18" y2="82" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      <line x1="92" y1="92" x2="82" y2="82" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
      
      {/* Small precision dots */}
      <circle cx="50" cy="8" r="1.5" fill="#ffffff" opacity="0.8" />
      <circle cx="92" cy="50" r="1.5" fill="#ffffff" opacity="0.8" />
      <circle cx="50" cy="92" r="1.5" fill="#ffffff" opacity="0.8" />
      <circle cx="8" cy="50" r="1.5" fill="#ffffff" opacity="0.8" />
    </svg>
  )
}
