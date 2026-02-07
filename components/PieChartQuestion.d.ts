// components/PieChartQuestion.d.ts
import type { FC } from 'react'

interface PieChartQuestionProps {
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

declare const PieChartQuestion: FC<PieChartQuestionProps>
export default PieChartQuestion
