interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
}

export function StatCard({ label, value, subtext, trend, icon }: StatCardProps) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-gray-500'
  }
  
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-6 backdrop-blur-xl hover:bg-white/[0.04] transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">
            {label}
          </p>
          <p className="text-3xl font-black text-white mb-1">
            {value}
          </p>
          {subtext && (
            <p className={`text-sm font-medium ${trend ? trendColors[trend] : 'text-gray-400'}`}>
              {subtext}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-[#ffd700] opacity-20">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
