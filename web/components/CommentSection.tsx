'use client'

import { useState } from 'react'
import { Comment } from '@/lib/types'

interface CommentSectionProps {
  targetType: 'profile' | 'match' | 'season'
  targetId: string
  comments: Comment[]
  onSubmit?: (content: string) => Promise<void>
}

export function CommentSection({ comments, onSubmit }: CommentSectionProps) {
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!content.trim()) {
      setError('Comment cannot be empty')
      return
    }
    
    if (content.length > 200) {
      setError('Comment must be 200 characters or less')
      return
    }
    
    if (!onSubmit) {
      setError('Not authenticated')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      await onSubmit(content)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="space-y-6">
      {/* Comment form */}
      {onSubmit && (
        <form onSubmit={handleSubmit} className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setError('')
            }}
            placeholder="Leave a comment... (200 chars max)"
            maxLength={200}
            rows={3}
            className="w-full bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <span className="text-xs text-gray-500">
                {content.length}/200
              </span>
              {error && (
                <span className="text-xs text-red-500">{error}</span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-[#ffd700] text-black font-semibold rounded-lg hover:bg-[#ccaa00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}
      
      {/* Comments list */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-4 backdrop-blur-xl"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-bold text-white">
                  {comment.author?.discord_username || 'Unknown User'}
                </h4>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {comment.content_censored}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
