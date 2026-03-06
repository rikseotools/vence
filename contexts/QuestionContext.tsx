'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ============================================
// TIPOS
// ============================================

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

// ============================================
// CONTEXT
// ============================================

const QuestionContext = createContext<QuestionContextValue | null>(null)

export function QuestionProvider({ children }: { children: ReactNode }) {
  const [currentQuestionContext, setCurrentQuestionContext] = useState<CurrentQuestionContext | null>(null)

  // Normalizar respuesta correcta a número (0-3)
  // IMPORTANTE: La base de datos usa 0-indexed (0=A, 1=B, 2=C, 3=D)
  // Mantenemos como número para compatibilidad con chat-v2
  const normalizeCorrectAnswer = (correct: number | string | null | undefined): number | null => {
    if (correct === null || correct === undefined) return null

    // Si ya es un número válido (0-3), devolverlo
    if (typeof correct === 'number' && correct >= 0 && correct <= 3) {
      return correct
    }

    // Si es una letra, convertir a número: A->0, B->1, C->2, D->3
    if (typeof correct === 'string' && /^[a-dA-D]$/.test(correct)) {
      const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
      return letterMap[correct.toUpperCase()]
    }

    // Si es un string numérico, parsearlo
    const num = parseInt(String(correct), 10)
    if (!isNaN(num) && num >= 0 && num <= 3) {
      return num
    }

    return null
  }

  // Establecer contexto de pregunta actual (desde TestLayout o PsychometricTestLayout)
  const setQuestionContext = useCallback((questionData: QuestionContextData | null) => {
    if (questionData) {
      const law = questionData.law
      setCurrentQuestionContext({
        id: questionData.id,
        questionText: questionData.question_text || questionData.question || '',
        options: {
          a: questionData.option_a || '',
          b: questionData.option_b || '',
          c: questionData.option_c || '',
          d: questionData.option_d || ''
        },
        correctAnswer: normalizeCorrectAnswer(questionData.correct),
        explanation: questionData.explanation || null,
        // Campos para tests de leyes
        lawName: typeof law === 'object' && law !== null
          ? (law.short_name || law.name || null)
          : (typeof law === 'string' ? law : null),
        articleNumber: questionData.article_number || null,
        difficulty: questionData.difficulty || null,
        source: questionData.source || null,
        // Campos para psicotécnicos
        isPsicotecnico: questionData.isPsicotecnico || false,
        questionSubtype: questionData.questionSubtype || null,
        questionTypeName: questionData.questionTypeName || null,
        categoria: questionData.categoria || null,
        // Datos del contenido (gráficos, series, tablas, etc.)
        contentData: questionData.contentData || null
      })
    } else {
      setCurrentQuestionContext(null)
    }
  }, [])

  // Limpiar contexto (cuando sale del test)
  const clearQuestionContext = useCallback(() => {
    setCurrentQuestionContext(null)
  }, [])

  return (
    <QuestionContext.Provider value={{
      currentQuestionContext,
      setQuestionContext,
      clearQuestionContext
    }}>
      {children}
    </QuestionContext.Provider>
  )
}

export function useQuestionContext(): QuestionContextValue {
  const context = useContext(QuestionContext)
  if (!context) {
    // Devolver valores por defecto si no hay provider (para evitar errores)
    return {
      currentQuestionContext: null,
      setQuestionContext: () => {},
      clearQuestionContext: () => {}
    }
  }
  return context
}

// Helper para convertir número de respuesta (0-3) a letra (A-D)
// Útil para mostrar al usuario
export function answerToLetter(answer: number | string | null | undefined): string | null {
  if (answer === null || answer === undefined) return null
  if (typeof answer === 'string' && /^[a-dA-D]$/.test(answer)) {
    return answer.toUpperCase()
  }
  const num = typeof answer === 'number' ? answer : parseInt(String(answer), 10)
  if (!isNaN(num) && num >= 0 && num <= 3) {
    const letters = ['A', 'B', 'C', 'D']
    return letters[num]
  }
  return null
}
