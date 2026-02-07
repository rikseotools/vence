// components/ExamLoadingIndicator.d.ts - Type declarations

import type { FC } from 'react'

export interface LoadingProgress {
  currentPhase: string
  currentMapping: number
  totalMappings: number
  currentLaw: string
  questionsFound: number
  message: string
}

export interface ExamLoadingIndicatorProps {
  numQuestions?: number
  numThemes?: number
  themeNames?: string[]
  progress?: LoadingProgress | null
}

declare const ExamLoadingIndicator: FC<ExamLoadingIndicatorProps>
export default ExamLoadingIndicator
