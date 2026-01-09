'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProfileEditFormProps {
  initialProfile: {
    display_name: string
    bio: string
    favorite_agent: string
    favorite_map: string
  }
  discordUserId: string
}

export function ProfileEditForm({ initialProfile, discordUserId }: ProfileEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const [formData, setFormData] = useState({
    display_name: initialProfile.display_name || '',
    bio: initialProfile.bio || '',
    favorite_agent: initialProfile.favorite_agent || '',
    favorite_map: initialProfile.favorite_map || '',
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          discord_user_id: discordUserId,
          ...formData,
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update profile')
      }
      
      setSuccess(true)
      setTimeout(() => {
        router.push(`/profile/${discordUserId}`)
        router.refresh()
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      setLoading(false)
    }
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="glass rounded-2xl p-6 md:p-8 border border-white/5 space-y-6">
        {/* Display Name */}
        <div>
          <label htmlFor="display_name" className="block text-sm font-black uppercase tracking-wider text-white/60 mb-2">
            Display Name
          </label>
          <input
            type="text"
            id="display_name"
            value={formData.display_name}
            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
            placeholder="Your display name (shown in hub)"
            maxLength={32}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
          />
          <p className="text-xs text-white/40 mt-2">This name will be shown in the hub top right and on your profile</p>
        </div>
        
        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-black uppercase tracking-wider text-white/60 mb-2">
            Bio
          </label>
          <textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            placeholder="Tell the community about yourself..."
            maxLength={200}
            rows={4}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
          />
          <p className="text-xs text-white/40 mt-2">{formData.bio.length}/200 characters</p>
        </div>
        
        {/* Favorite Agent */}
        <div>
          <label htmlFor="favorite_agent" className="block text-sm font-black uppercase tracking-wider text-white/60 mb-2">
            Favorite Agent
          </label>
          <input
            type="text"
            id="favorite_agent"
            value={formData.favorite_agent}
            onChange={(e) => setFormData({ ...formData, favorite_agent: e.target.value })}
            placeholder="Jett, Sova, Omen..."
            maxLength={20}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
          />
        </div>
        
        {/* Favorite Map */}
        <div>
          <label htmlFor="favorite_map" className="block text-sm font-black uppercase tracking-wider text-white/60 mb-2">
            Favorite Map
          </label>
          <input
            type="text"
            id="favorite_map"
            value={formData.favorite_map}
            onChange={(e) => setFormData({ ...formData, favorite_map: e.target.value })}
            placeholder="Bind, Haven, Ascent..."
            maxLength={20}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all"
          />
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <p className="text-sm text-green-400 font-medium">Profile updated successfully! Redirecting...</p>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/profile/${discordUserId}`}
          className="px-6 py-3 text-sm font-black uppercase tracking-wider text-white/60 hover:text-white transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading || success}
          className="px-8 py-3 bg-red-500 text-white font-black uppercase tracking-wider text-sm rounded-xl hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
        >
          {loading ? 'Saving...' : success ? 'Saved!' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}
