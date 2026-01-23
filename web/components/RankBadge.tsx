import { getRankFromMMR } from '@/lib/types'

interface RankBadgeProps {
  mmr: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showTier?: boolean
  rankLabel?: string | null
}

export function RankBadge({ mmr, size = 'md', showTier = true, rankLabel }: RankBadgeProps) {
  const rankInfo = getRankFromMMR(mmr)
  const label = rankLabel || `${rankInfo.rank}${rankInfo.tier ? ` ${rankInfo.tier}` : ''}`
  const rankKey = rankLabel ? rankLabel.split(' ')[0] : rankInfo.rank
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-xl'
  }
  
  // Terminal style - colored text, transparent background
  const getRankTextColor = (rank: string) => {
    if (rank === 'X') return '#ffffff'
    if (rank === 'ABSOLUTE') return '#f59e0b'
    if (rank === 'CHALLENGER') return '#dc2626'
    if (rank === 'BREAKPOINT') return '#888888'
    if (rank === 'GRNDS') return '#ff8c00'
    return '#666666'
  }
  
  const displayText = showTier ? label : rankKey
  
  return (
    <span 
      className={`
        inline-flex items-center justify-center
        font-black tracking-wider uppercase font-mono
        ${sizeClasses[size]}
        transition-all duration-200
      `}
      style={{ color: getRankTextColor(rankKey) }}
    >
      [{displayText}]
    </span>
  )
}
