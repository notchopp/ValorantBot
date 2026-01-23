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
    <div className="space-y-4">
      {/* Comment form */}
      {onSubmit && (
        <form onSubmit={handleSubmit} className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4">
          <div className="text-[10px] font-mono text-[var(--term-muted)] mb-2">&gt; ENTER_COMMENT:</div>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              setError('')
            }}
            placeholder="Type your message here..."
            maxLength={200}
            rows={3}
            className="w-full bg-[var(--term-bg)] border border-[var(--term-border)] text-white placeholder-[var(--term-muted)] resize-none focus:outline-none focus:border-[var(--term-accent)] p-3 font-mono text-sm"
          />
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono text-[var(--term-muted)]">
                [{content.length}/200]_CHARS
              </span>
              {error && (
                <span className="text-[10px] font-mono text-[var(--term-accent)]">[ERROR] {error}</span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 border border-[var(--term-accent)] text-[var(--term-accent)] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[var(--term-accent)] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? '[POSTING...]' : '[SUBMIT]'}
            </button>
          </div>
        </form>
      )}
      
      {/* Comments list */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[var(--term-muted)] font-mono text-sm">[NO_COMMENTS]</div>
            <div className="text-[10px] text-[var(--term-muted)] font-mono mt-1">Be the first to comment!</div>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-[var(--term-panel)] border border-[var(--term-border)] p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="font-mono font-bold text-[var(--term-accent)] text-sm">
                  @{comment.author?.discord_username || 'Unknown'}
                </h4>
                <span className="text-[10px] font-mono text-[var(--term-muted)] whitespace-nowrap">
                  [{new Date(comment.created_at).toLocaleDateString()}]
                </span>
              </div>
              <p className="text-sm text-white/80 font-mono whitespace-pre-wrap">
                {comment.content_censored}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
