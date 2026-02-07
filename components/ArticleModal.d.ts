// components/ArticleModal.d.ts - Type declarations

import type { FC } from 'react'

export interface ArticleModalProps {
  isOpen: boolean
  onClose: () => void
  articleNumber?: string | null
  lawSlug?: string | null
  /** Optional question text for intelligent highlighting */
  questionText?: string | null
  /** Correct answer index (0-3) for highlighting */
  correctAnswer?: number | null
  /** Options array for highlighting context */
  options?: string[] | null
}

declare const ArticleModal: FC<ArticleModalProps>
export default ArticleModal
