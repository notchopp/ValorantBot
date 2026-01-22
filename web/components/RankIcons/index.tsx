import { GRNDSIcon } from './GRNDS'
import { BREAKPOINTIcon } from './BREAKPOINT'
import { CHALLENGERIcon } from './CHALLENGER'
import { ABSOLUTEIcon } from './ABSOLUTE'
import { XIcon } from './X'

export { GRNDSIcon } from './GRNDS'
export { BREAKPOINTIcon } from './BREAKPOINT'
export { CHALLENGERIcon } from './CHALLENGER'
export { ABSOLUTEIcon } from './ABSOLUTE'
export { XIcon } from './X'

export type RankName = 'GRNDS' | 'BREAKPOINT' | 'CHALLENGER' | 'ABSOLUTE' | 'X'

export const RANK_COLORS = {
  GRNDS: '#ff8c00',
  BREAKPOINT: '#2a2a2a',
  CHALLENGER: '#dc2626',
  ABSOLUTE: '#f59e0b',
  X: '#ffffff'
} as const

export function getRankIcon(rank: RankName | string) {
  const rankName = rank.split(' ')[0] as RankName
  
  switch (rankName) {
    case 'GRNDS':
      return GRNDSIcon
    case 'BREAKPOINT':
      return BREAKPOINTIcon
    case 'CHALLENGER':
      return CHALLENGERIcon
    case 'ABSOLUTE':
      return ABSOLUTEIcon
    case 'X':
      return XIcon
    default:
      return GRNDSIcon
  }
}
