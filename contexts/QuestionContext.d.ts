// contexts/QuestionContext.d.ts - Type declarations for QuestionContext

import type { ReactNode } from 'react'

export interface QuestionOptions {
  a: string
  b: string
  c: string
  d: string
}

export interface CurrentQuestionContext {
  id: string
  questionText: string
  options: QuestionOptions
  correctAnswer: number | null
  explanation: string | null
  lawName: string | null
  articleNumber: string | null
  difficulty: string | null
  source: string | null
  isPsicotecnico: boolean
  questionSubtype: string | null
  questionTypeName: string | null
  categoria: string | null
  contentData: unknown | null
}

export interface QuestionContextData {
  id: string
  question_text?: string
  question?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  correct?: number | string | null
  explanation?: string | null
  law?: { short_name?: string; name?: string } | string | null
  article_number?: string | null
  difficulty?: string | null
  source?: string | null
  isPsicotecnico?: boolean
  questionSubtype?: string | null
  questionTypeName?: string | null
  categoria?: string | null
  contentData?: unknown | null
}

export interface QuestionContextValue {
  currentQuestionContext: CurrentQuestionContext | null
  setQuestionContext: (questionData: QuestionContextData | null) => void
  clearQuestionContext: () => void
}

export function QuestionProvider(props: { children: ReactNode }): JSX.Element
export function useQuestionContext(): QuestionContextValue
export function answerToLetter(answer: number | string | null | undefined): string | null
