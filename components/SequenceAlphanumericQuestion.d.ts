// components/SequenceAlphanumericQuestion.d.ts
import type { FC } from 'react'

interface SequenceAlphanumericQuestionProps {
  question: unknown
  onAnswer: (index: number) => void | Promise<void>
  selectedAnswer: number | null
  showResult: boolean
  isAnswering: boolean
  attemptCount?: number
  verifiedCorrectAnswer?: number | null
  verifiedExplanation?: string | null
  hideAIChat?: boolean
}

declare const SequenceAlphanumericQuestion: FC<SequenceAlphanumericQuestionProps>
export default SequenceAlphanumericQuestion
