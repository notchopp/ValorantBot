import { getNextRank } from '@/lib/types'

interface MMRProgressBarProps {
  currentMMR: number
  animated?: boolean
}

export function MMRProgressBar({ currentMMR, animated = true }: MMRProgressBarProps) {
  const nextRank = getNextRank(currentMMR)
  
  if (!nextRank) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-400">MAX RANK</span>
          <span className="text-lg font-black text-[#ffd700]">{currentMMR} MMR</span>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#ffd700] to-[#ffed4e]"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    )
  }
  
  // Calculate progress within current rank tier
  const rankThresholds = [
    0, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 
    2000, 2200, 2400, 2600, 2800, 3000
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
        <span className="text-sm font-medium text-gray-400">
          {nextRank.rank} {nextRank.tier}
        </span>
        <span className="text-lg font-black text-[#ffd700]">
          +{nextRank.mmrNeeded} MMR
        </span>
      </div>
      <div className="relative w-full h-3 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`
            h-full bg-gradient-to-r from-[#ffd700] to-[#ffed4e]
            ${animated ? 'transition-all duration-1000 ease-out' : ''}
          `}
          style={{ width: `${Math.min(progress, 100)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-500">{currentThreshold} MMR</span>
        <span className="text-xs text-gray-500">{nextThreshold} MMR</span>
      </div>
    </div>
  )
}
