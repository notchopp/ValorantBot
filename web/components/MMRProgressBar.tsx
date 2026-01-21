import { getNextRank } from '@/lib/types'

interface MMRProgressBarProps {
  currentMMR: number
  animated?: boolean
  accentColor?: string
}

export function MMRProgressBar({ currentMMR, animated = true, accentColor = '#ef4444' }: MMRProgressBarProps) {
  const nextRank = getNextRank(currentMMR)
  
  if (!nextRank) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white/40">MAX RANK</span>
          <span className="text-lg font-black" style={{ color: accentColor }}>{currentMMR} MMR</span>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full"
            style={{ 
              width: '100%',
              background: `linear-gradient(to right, ${accentColor}cc, ${accentColor}99)`
            }}
          />
        </div>
      </div>
    )
  }
  
  // Calculate progress within current rank tier
  const rankThresholds = [
    0, 300, 600, 900, 1200, 1500, 1700, 1900, 2100, 2300,
    2400, 2500, 2600, 3000
  ]
  
  let currentThreshold = 0
  let nextThreshold = 200
  
  for (let i = 0; i < rankThresholds.length - 1; i++) {
    if (currentMMR >= rankThresholds[i] && currentMMR < rankThresholds[i + 1]) {
      currentThreshold = rankThresholds[i]
      nextThreshold = rankThresholds[i + 1]
      break
    }
  }
  
  const progress = ((currentMMR - currentThreshold) / (nextThreshold - currentThreshold)) * 100
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white/40">
          {nextRank.rank} {nextRank.tier}
        </span>
        <span className="text-lg font-black" style={{ color: accentColor }}>
          +{nextRank.mmrNeeded} MMR
        </span>
      </div>
      <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`
            h-full
            ${animated ? 'transition-all duration-1000 ease-out' : ''}
          `}
          style={{ 
            width: `${Math.min(progress, 100)}%`,
            background: `linear-gradient(to right, ${accentColor}cc, ${accentColor}99)`
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-white/30">{currentThreshold} MMR</span>
        <span className="text-xs text-white/30">{nextThreshold} MMR</span>
      </div>
    </div>
  )
}
