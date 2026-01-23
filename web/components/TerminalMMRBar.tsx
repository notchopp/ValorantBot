import { getNextRank } from '@/lib/types'

interface TerminalMMRBarProps {
  currentMMR: number
  accentColor?: string
}

const RANK_THRESHOLDS = [
  0, 300, 600, 900, 1200, 1500, 1700, 1900, 2100, 2300,
  2400, 2500, 2600, 3000
]

export function TerminalMMRBar({ currentMMR, accentColor = '#22c55e' }: TerminalMMRBarProps) {
  const nextRank = getNextRank(currentMMR)

  if (!nextRank) {
    return (
      <div className="w-full">
        <div className="flex justify-between text-xs text-[var(--term-muted)] mb-1 font-mono">
          <span>MAX_RANK</span>
          <span style={{ color: accentColor }}>{currentMMR} MMR</span>
        </div>
        <div className="h-2 w-full bg-[var(--term-border)] rounded font-mono overflow-hidden">
          <div
            className="h-full rounded"
            style={{
              width: '100%',
              background: `linear-gradient(90deg, ${accentColor}88, ${accentColor}44)`
            }}
          />
        </div>
      </div>
    )
  }

  let low = 0
  let high = 200
  for (let i = 0; i < RANK_THRESHOLDS.length - 1; i++) {
    if (currentMMR >= RANK_THRESHOLDS[i] && currentMMR < RANK_THRESHOLDS[i + 1]) {
      low = RANK_THRESHOLDS[i]
      high = RANK_THRESHOLDS[i + 1]
      break
    }
  }
  const pct = Math.min(100, ((currentMMR - low) / (high - low)) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-[var(--term-muted)] mb-1 font-mono">
        <span>{nextRank.rank} {nextRank.tier}</span>
        <span style={{ color: accentColor }}>+{nextRank.mmrNeeded} MMR</span>
      </div>
      <div className="h-2 w-full bg-[var(--term-border)] rounded overflow-hidden font-mono flex">
        <div
          className="h-full rounded-l transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor}66)`
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[var(--term-muted)] mt-1 font-mono">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
}
