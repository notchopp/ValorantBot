'use client'

import { ActivityFeed as ActivityFeedType } from '@/lib/types'

interface ActivityFeedProps {
  activities: ActivityFeedType[]
  limit?: number
}

export function ActivityFeed({ activities, limit }: ActivityFeedProps) {
  const displayedActivities = limit ? activities.slice(0, limit) : activities
  
  // Terminal-style type indicators
  const getActivityIndicator = (type: string) => {
    switch (type) {
      case 'rank_up':
        return { text: '[++]', color: '#22c55e' }
      case 'rank_down':
        return { text: '[--]', color: '#ef4444' }
      case 'mvp':
        return { text: '[MVP]', color: '#eab308' }
      case 'big_mmr_gain':
        return { text: '[+MMR]', color: '#22c55e' }
      case 'big_mmr_loss':
        return { text: '[-MMR]', color: '#ef4444' }
      default:
        return { text: '[LOG]', color: 'var(--term-muted)' }
    }
  }
  
  if (displayedActivities.length === 0) {
    return (
      <div className="text-center py-12 font-mono">
        <div className="text-[var(--term-muted)] text-sm">[NO_ACTIVITY]</div>
        <div className="text-[10px] text-[var(--term-muted)] mt-1">No events logged. Start playing to populate feed.</div>
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      {displayedActivities.map((activity) => {
        const indicator = getActivityIndicator(activity.activity_type)
        return (
          <div
            key={activity.id}
            className="p-3 bg-[var(--term-panel)] border border-[var(--term-border)] hover:border-[var(--term-accent)]/30 transition-all font-mono"
          >
            <div className="flex items-start gap-3">
              <span 
                className="text-xs font-bold shrink-0"
                style={{ color: indicator.color }}
              >
                {indicator.text}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-bold text-white truncate">
                    {activity.player?.discord_username || 'Unknown'}
                  </span>
                  <span className="text-[10px] text-[var(--term-muted)] whitespace-nowrap">
                    [{new Date(activity.created_at).toLocaleDateString()}]
                  </span>
                </div>
                <p className="text-xs text-[var(--term-accent)] mb-1">
                  {activity.title}
                </p>
                {activity.description && (
                  <p className="text-[10px] text-[var(--term-muted)]">
                    {activity.description}
                  </p>
                )}
                {activity.metadata && activity.activity_type === 'rank_up' && (
                  <div className="mt-1 text-[10px] text-[#22c55e]">
                    +{(activity.metadata as { mmr_change?: number }).mmr_change || 0} MMR
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
