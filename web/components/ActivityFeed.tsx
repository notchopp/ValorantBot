'use client'

import { ActivityFeed as ActivityFeedType } from '@/lib/types'
import { RankBadge } from './RankBadge'

interface ActivityFeedProps {
  activities: ActivityFeedType[]
  limit?: number
}

export function ActivityFeed({ activities, limit }: ActivityFeedProps) {
  const displayedActivities = limit ? activities.slice(0, limit) : activities
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'rank_up':
        return '📈'
      case 'rank_down':
        return '📉'
      case 'mvp':
        return '⭐'
      case 'big_mmr_gain':
        return '🔥'
      case 'big_mmr_loss':
        return '💔'
      default:
        return '🎮'
    }
  }
  
  const getActivityColor = (type: string) => {
    switch (type) {
      case 'rank_up':
        return 'border-green-500/20 bg-green-500/5'
      case 'rank_down':
        return 'border-red-500/20 bg-red-500/5'
      case 'mvp':
        return 'border-yellow-500/20 bg-yellow-500/5'
      case 'big_mmr_gain':
        return 'border-orange-500/20 bg-orange-500/5'
      case 'big_mmr_loss':
        return 'border-blue-500/20 bg-blue-500/5'
      default:
        return 'border-white/5 bg-white/[0.02]'
    }
  }
  
  if (displayedActivities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No activity yet. Start playing to build your feed!</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      {displayedActivities.map((activity) => (
        <div
          key={activity.id}
          className={`border rounded-xl p-4 backdrop-blur-xl transition-all duration-200 hover:scale-[1.02] ${getActivityColor(activity.activity_type)}`}
        >
          <div className="flex items-start gap-4">
            <span className="text-2xl">{getActivityIcon(activity.activity_type)}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-bold text-white">
                  {activity.player?.discord_username || 'Unknown Player'}
                </h4>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(activity.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-semibold text-[#ffd700] mb-1">
                {activity.title}
              </p>
              {activity.description && (
                <p className="text-sm text-gray-400">
                  {activity.description}
                </p>
              )}
              {activity.metadata && activity.activity_type === 'rank_up' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">+{activity.metadata.mmr_change} MMR</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
