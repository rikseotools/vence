// components/TestConfigurator.d.ts - Type declarations

import type { FC } from 'react'

export interface LawData {
  law_short_name: string
  display_name: string
  total_articles: number
  questions_count: number
  articles_with_questions: number
}

export interface UserStats {
  totalAnswered?: number
  correctAnswers?: number
  accuracy?: number
  [key: string]: unknown
}

export interface TestConfig {
  tema?: number | null
  numQuestions: number
  excludeRecent?: boolean
  recentDays?: number
  difficultyMode: string
  adaptiveMode?: boolean
  timeLimit?: number | null
  onlyFailedQuestions?: boolean
  failedQuestionIds?: string[]
  failedQuestionsOrder?: string
  selectedLaws?: string[]
  selectedArticlesByLaw?: Record<string, string[]>
  selectedSectionsByLaw?: Record<string, string[]>
  onlyOfficialQuestions?: boolean
  focusEssentialArticles?: boolean
  testMode?: string
  positionType?: string
  [key: string]: unknown
}

export interface TestConfiguratorProps {
  tema?: number | null
  temaDisplayName?: string | null
  totalQuestions?: number
  onStartTest?: (config: TestConfig) => void
  userStats?: UserStats | null
  loading?: boolean
  currentUser?: { id: string; email?: string } | null
  lawsData?: LawData[]
  preselectedLaw?: string | null
  hideOfficialQuestions?: boolean
  hideEssentialArticles?: boolean
  officialQuestionsCount?: number
  testMode?: 'practica' | 'examen'
  positionType?: string
}

declare const TestConfigurator: FC<TestConfiguratorProps>
export default TestConfigurator
