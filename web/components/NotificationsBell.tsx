'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccentColor } from '@/lib/AccentColorContext'
import Link from 'next/link'

export function NotificationsBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const { accentColor } = useAccentColor()
  const supabase = createClient()

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (isPlaying || typeof window === 'undefined') return
    
    setIsPlaying(true)
    try {
      // Create a simple beep sound using Web Audio API
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        setIsPlaying(false)
        return
      }
      
      const audioContext = new AudioContextClass()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
      
      setTimeout(() => setIsPlaying(false), 300)
    } catch (error) {
      console.error('Error playing notification sound:', error)
      setIsPlaying(false)
    }
  }, [isPlaying])

  useEffect(() => {
    async function checkForNewComments() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Get player's discord_user_id
        const { data: player } = await supabase
          .from('players')
          .select('discord_user_id, id')
          .eq('id', user.id)
          .maybeSingle()

        if (!player) return

        // Get the last checked timestamp from localStorage (only available in browser)
        const lastCheckedKey = `last_comment_check_${player.id}`
        const lastChecked = typeof window !== 'undefined' ? localStorage.getItem(lastCheckedKey) : null
        
        // Get comments on this user's profile
        const { data: comments, error } = await supabase
          .from('comments')
          .select('id, created_at, author:players!comments_author_id_fkey(discord_username)')
          .eq('target_type', 'profile')
          .eq('target_id', player.id)
          .order('created_at', { ascending: false })
          .limit(50)

        if (error) {
          console.error('Error fetching comments:', error)
          return
        }

        if (comments && comments.length > 0) {
          // Filter for unread comments (created after last check)
          const unreadComments = lastChecked
            ? comments.filter(c => new Date(c.created_at) > new Date(lastChecked))
            : comments.slice(0, 5) // First time: show last 5 as unread

          const newCount = unreadComments.length

          // If there are new comments and count changed, play sound
          if (newCount > 0 && newCount !== unreadCount && lastChecked) {
            playNotificationSound()
          }

          setUnreadCount(newCount)

          // Update last checked timestamp (only in browser)
          if (typeof window !== 'undefined') {
            localStorage.setItem(lastCheckedKey, new Date().toISOString())
          }
        } else {
          setUnreadCount(0)
        }
      } catch (error) {
        console.error('Error checking notifications:', error)
      }
    }

    // Check immediately
    checkForNewComments()

    // Check every 30 seconds for new comments
    const interval = setInterval(checkForNewComments, 30000)

    return () => clearInterval(interval)
  }, [supabase, unreadCount, playNotificationSound])

  // Get current user's profile link
  const [profileLink, setProfileLink] = useState('#')

  useEffect(() => {
    async function getProfileLink() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: player } = await supabase
        .from('players')
        .select('discord_user_id')
        .eq('id', user.id)
        .maybeSingle()

      if (player?.discord_user_id) {
        setProfileLink(`/profile/${player.discord_user_id}`)
      }
    }

    getProfileLink()
  }, [supabase])

  return (
    <Link
      href={profileLink}
      className="relative p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
      style={{ '--accent-color': accentColor } as React.CSSProperties}
      title={unreadCount > 0 ? `${unreadCount} new comment${unreadCount > 1 ? 's' : ''} on your profile` : 'No new comments'}
    >
      <Bell className="w-5 h-5 text-white/60 group-hover:text-[var(--accent-color)] transition-colors" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-black text-white flex items-center justify-center"
          style={{ backgroundColor: accentColor }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
