// components/ExamLayout.d.ts - Type declarations

import type { FC, ReactNode } from 'react'

export interface QuestionArticle {
  id?: string
  article_number?: string
  title?: string | null
  content?: string | null
  laws?: {
    short_name: string
    name?: string
  }
}

export interface ExamQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option?: number
  explanation?: string | null | undefined
  difficulty?: string | null | undefined
  tema_number?: number
  primary_article_id?: string
  articles?: QuestionArticle
  is_official_exam?: boolean | null
  source_topic?: number
  [key: string]: unknown
}

export interface ExamConfig {
  title?: string
  name?: string
  description?: string
  subtitle?: string
  icon?: string
  color?: string
  timeLimit?: number
  [key: string]: unknown
}

export interface ExamLayoutProps {
  tema: number | string
  testNumber?: number
  config?: ExamConfig
  questions: ExamQuestion[]
  children?: ReactNode
  resumeTestId?: string | null
  initialAnswers?: Record<number, string> | null
}

declare const ExamLayout: FC<ExamLayoutProps>
export default ExamLayout
