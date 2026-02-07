// components/LineChartQuestion.d.ts
import type { FC } from 'react'

interface LineChartQuestionProps {
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

declare const LineChartQuestion: FC<LineChartQuestionProps>
export default LineChartQuestion
