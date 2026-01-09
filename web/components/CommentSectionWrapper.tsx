'use client'

import { CommentSection } from './CommentSection'
import { Comment } from '@/lib/types'

interface CommentSectionWrapperProps {
  targetType: 'profile' | 'match' | 'season'
  targetId: string
  comments: Comment[]
}

export function CommentSectionWrapper({ targetType, targetId, comments }: CommentSectionWrapperProps) {
  const handleSubmit = async (content: string) => {
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        target_type: targetType,
        target_id: targetId,
      }),
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to post comment')
    }
    
    // Reload the page to show the new comment
    window.location.reload()
  }
  
  return (
    <CommentSection
      targetType={targetType}
      targetId={targetId}
      comments={comments}
      onSubmit={handleSubmit}
    />
  )
}
