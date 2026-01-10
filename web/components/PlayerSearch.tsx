'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { RankBadge } from './RankBadge'

interface SearchPlayer {
  id: string
  discord_user_id: string
  username: string
  mmr: number
  rank: string
  avatar_url?: string | null
}

export function PlayerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchPlayer[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search with debounce
  useEffect(() => {
    if (query.length < 1) {
      setResults([])
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search/players?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setResults(data.players || [])
        setIsOpen(true)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200) // 200ms debounce

    return () => clearTimeout(timer)
  }, [query])

  const handlePlayerClick = (discordUserId: string) => {
    router.push(`/profile/${discordUserId}`)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length > 0 && results.length > 0 && setIsOpen(true)}
          placeholder="Search players..."
          className="w-full max-w-xs px-4 py-2 pl-10 pr-10 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all text-sm"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-white/40 text-sm">Searching...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handlePlayerClick(player.discord_user_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-all group text-left"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {player.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={player.avatar_url}
                        alt={player.username}
                        className="w-10 h-10 rounded-full border border-white/10 group-hover:border-red-500/50 transition-colors"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/60 text-xs font-black group-hover:border-red-500/50 transition-colors">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-white text-sm mb-0.5 truncate group-hover:text-red-500 transition-colors">
                      {player.username}
                    </div>
                    <div className="flex items-center gap-2">
                      <RankBadge mmr={player.mmr} size="sm" />
                      <span className="text-xs text-white/40">{player.mmr} MMR</span>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <svg className="w-4 h-4 text-white/20 group-hover:text-red-500 transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
