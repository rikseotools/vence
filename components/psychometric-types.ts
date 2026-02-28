// components/psychometric-types.ts
// Tipos compartidos para todos los componentes de preguntas psicotécnicas
import { type ReactNode } from 'react'

// Datos de la pregunta psicotécnica (genérico, cubre todos los subtipos)
export interface PsychometricQuestionData {
  id: string
  question_text: string
  question_subtype: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: number
  explanation: string | null
  options?: { A?: string; B?: string; C?: string; D?: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content_data?: Record<string, any> | null
  psychometric_sections?: {
    display_name?: string
    psychometric_categories?: {
      display_name?: string
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// Props base para componentes que usan ChartQuestion (Group A)
export interface ChartBasedQuestionProps {
  question: PsychometricQuestionData
  onAnswer: (index: number, metadata?: Record<string, unknown> | null) => void
  selectedAnswer: number | null
  showResult: boolean
  isAnswering: boolean
  attemptCount?: number
  verifiedCorrectAnswer?: number | null
  verifiedExplanation?: string | null
  hideAIChat?: boolean
}

// Props para componentes standalone (Group B: sequences, word analysis)
export interface StandaloneQuestionProps {
  question: PsychometricQuestionData
  onAnswer: (index: number, metadata?: Record<string, unknown> | null) => void
  selectedAnswer: number | null
  showResult: boolean
  isAnswering: boolean
  attemptCount?: number
  verifiedCorrectAnswer?: number | null
  verifiedExplanation?: string | null
}
