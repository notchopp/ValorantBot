'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RiotLoginForm() {
  const router = useRouter()
  const [riotName, setRiotName] = useState('')
  const [riotTag, setRiotTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/riot-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riotName: riotName.trim(),
          riotTag: riotTag.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to claim profile')
        setLoading(false)
        return
      }

      // Success - redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="riotName" className="block text-sm font-medium text-white/60 mb-2">
            Riot Name
          </label>
          <input
            id="riotName"
            type="text"
            value={riotName}
            onChange={(e) => setRiotName(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
            placeholder="Your Riot username"
          />
        </div>

        <div>
          <label htmlFor="riotTag" className="block text-sm font-medium text-white/60 mb-2">
            Riot Tag
          </label>
          <input
            id="riotTag"
            type="text"
            value={riotTag}
            onChange={(e) => setRiotTag(e.target.value)}
            required
            disabled={loading}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-red-500/50 focus:bg-white/10 transition-all disabled:opacity-50"
            placeholder="Your Riot tag (without #)"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !riotName.trim() || !riotTag.trim()}
        className="w-full px-6 py-4 bg-red-500 hover:bg-red-600 disabled:bg-white/10 disabled:text-white/40 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider rounded-xl transition-all"
      >
        {loading ? 'Claiming Profile...' : 'Claim Profile'}
      </button>

      <p className="text-xs text-white/40 text-center">
        By claiming this profile, you confirm this is your Riot account. False claims will result in a warning and ban.
      </p>
    </form>
  )
}
