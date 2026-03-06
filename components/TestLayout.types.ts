// components/TestLayout.types.ts
// Tipos para TestLayout.tsx — migración a TypeScript

import type { ReactNode } from 'react'
import type { TestLayoutQuestion } from '@/lib/api/tests/schemas'

// ============================================
// PREGUNTA LEGACY (formato antiguo option_a/b/c/d)
// ============================================

// TestLayout recibe preguntas en DOS formatos:
// 1. TestLayoutQuestion (v2): { question, options: [A,B,C,D] }
// 2. Legacy: { question_text, option_a, option_b, option_c, option_d }
// Muchos callers aún envían formato legacy

export interface LegacyQuestion {
  id: string
  question_text?: string
  question?: string
  option_a?: string
  option_b?: string
  option_c?: string
  option_d?: string
  options?: [string, string, string, string]
  explanation?: string | null
  difficulty?: string | null
  primary_article_id?: string | null
  correct_option?: number  // 0-3 (NUNCA debe exponerse al cliente antes de responder)
  is_official_exam?: boolean
  exam_source?: string | null
  exam_position?: string | null
  exam_date?: string | null
  global_difficulty_category?: string | null
  article_number?: string | null
  article?: {
    id?: string | null
    number?: string | null
    article_number?: string | null
    title?: string | null
    full_text?: string | null
    law_name?: string | null
    law_short_name?: string | null
    display_number?: string | null
    law?: {
      short_name?: string
      name?: string
    }
  } | null
  articles?: {
    id?: string
    article_number?: string
    title?: string | null
    content?: string | null
    laws?: { short_name?: string; name?: string }
  } | null
  law?: string | { short_name?: string; name?: string } | null
  source?: string | null
  correct?: number | null
  metadata?: Record<string, unknown> | null
  law_short_name?: string | null
  // Allow extra fields from various callers
  [key: string]: any  // eslint-disable-line @typescript-eslint/no-explicit-any
}

// LegacyQuestion is a superset with [key: string]: unknown — both v2 (TestLayoutQuestion)
// and legacy question objects are assignable to it. Using a single flexible type instead
// of a union avoids requiring type narrowing at every property access.
export type TestQuestion = LegacyQuestion

// ============================================
// CONFIG DEL TEST
// ============================================

export interface CustomNavigationLink {
  href: string
  label: string
  isPrimary?: boolean
  text?: string
}

export interface TestLayoutConfig {
  name: string
  description: string
  subtitle?: string
  icon?: string
  color?: string
  tema?: number
  isLawTest?: boolean
  isMultiLawTest?: boolean
  lawShortName?: string
  selectedLaws?: string[]
  numQuestions?: number
  onlyOfficial?: boolean
  customNavigationLinks?: Record<string, CustomNavigationLink>
  [key: string]: any  // eslint-disable-line @typescript-eslint/no-explicit-any — callers pass extra fields
}

// ============================================
// PROPS: MODO ADAPTATIVO
// ============================================

export interface AdaptiveCatalog {
  neverSeen: Record<string, TestQuestion[]>
  answered: Record<string, TestQuestion[]>
}

export interface AdaptiveQuestionsInput {
  isAdaptive: true
  adaptiveCatalog: AdaptiveCatalog
  activeQuestions: TestQuestion[]
  questionPool: TestQuestion[]
  length?: never  // discriminador: no tiene .length como un array
}

// ============================================
// PROPS DEL COMPONENTE
// ============================================

export interface TestLayoutProps {
  tema: number
  testNumber: number | string
  config: TestLayoutConfig
  questions: TestQuestion[] | AdaptiveQuestionsInput
  children?: ReactNode
}

// ============================================
// ESTADO INTERNO
// ============================================

export interface AnsweredQuestionEntry {
  question: number
  selectedAnswer: number
  correct: boolean
  timestamp: string
}

export interface DetailedAnswerEntry {
  questionIndex: number
  questionOrder?: number
  selectedAnswer: number
  correctAnswer: number
  isCorrect: boolean
  timeSpent: number
  timestamp: string
  questionData: {
    id: string | null
    question: string
    options: string[]
    correct: number
    article?: {
      id?: string | null
      number?: string | null
      law_short_name?: string | null
    } | null
    metadata?: Record<string, unknown> | null
  } | null
  confidence: string | null
  interactions: number
}

export interface HotArticleInfo {
  is_hot: boolean
  is_hot_article?: boolean
  total_official_appearances: number
  unique_exams_count: number
  priority_level: string
  hotness_score: number
  target_oposicion: string | null
  article_number: string | number
  law_name: string
  hot_message?: string
  type?: 'official_question' | 'hot_article'
  display_title?: string
  also_appears_in_other_oposiciones?: boolean
  curiosity_message?: string
  [key: string]: any  // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ValidateAnswerResponse {
  success?: boolean
  isCorrect?: boolean
  correctAnswer?: number
  explanation?: string | null
  articleNumber?: string | null
  lawShortName?: string | null
  error?: string
  message?: string
  usedFallback?: boolean
}

// ============================================
// STATS DE COMPLETADO
// ============================================

export interface CompactStats {
  percentage: number
  totalTime: number
  avgTimePerQuestion: number
  fastestTime: number
  slowestTime: number
  confidenceStats: Record<string, number>
  maxCorrectStreak: number
  maxIncorrectStreak: number
  efficiency: string
}

// ============================================
// HELPERS (module-level)
// ============================================

export interface HotArticleOposicionMap {
  [oposicionSlug: string]: string[]
}
