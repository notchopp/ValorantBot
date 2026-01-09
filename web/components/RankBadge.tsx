import { getRankFromMMR } from '@/lib/types'

interface RankBadgeProps {
  mmr: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTier?: boolean
}

export function RankBadge({ mmr, size = 'md', showTier = true }: RankBadgeProps) {
  const rankInfo = getRankFromMMR(mmr)
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
    xl: 'px-6 py-3 text-xl'
  }
  
  const getRankColor = (rank: string) => {
    if (rank === 'X') return 'bg-white text-black'
    if (rank === 'CHALLENGER') return 'bg-red-600 text-white'
    if (rank === 'BREAKPOINT') return 'bg-black text-white border border-white/20'
    if (rank === 'GRNDS') return 'bg-orange-500 text-black'
    return 'bg-gray-700 text-white'
  }
  
  const displayText = showTier && rankInfo.tier
    ? `${rankInfo.rank} ${rankInfo.tier}`
    : rankInfo.rank
  
  return (
    <span 
      className={`
        inline-flex items-center justify-center
        font-black tracking-wider uppercase
        rounded-lg
        ${sizeClasses[size]}
        ${getRankColor(rankInfo.rank)}
        transition-all duration-200
      `}
    >
      {displayText}
    </span>
  )
}
