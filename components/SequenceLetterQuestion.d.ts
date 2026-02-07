// components/SequenceLetterQuestion.d.ts
import type { FC } from 'react'

interface SequenceLetterQuestionProps {
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

declare const SequenceLetterQuestion: FC<SequenceLetterQuestionProps>
export default SequenceLetterQuestion
