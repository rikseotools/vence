'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const QuestionContext = createContext(null)

export function QuestionProvider({ children }) {
  const [currentQuestionContext, setCurrentQuestionContext] = useState(null)

  // Normalizar respuesta correcta a número (0-3)
  // IMPORTANTE: La base de datos usa 0-indexed (0=A, 1=B, 2=C, 3=D)
  // Mantenemos como número para compatibilidad con chat-v2
  const normalizeCorrectAnswer = (correct) => {
    if (correct === null || correct === undefined) return null

    // Si ya es un número válido (0-3), devolverlo
    if (typeof correct === 'number' && correct >= 0 && correct <= 3) {
      return correct
    }

    // Si es una letra, convertir a número: A->0, B->1, C->2, D->3
    if (typeof correct === 'string' && /^[a-dA-D]$/.test(correct)) {
      const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
      return letterMap[correct.toUpperCase()]
    }

    // Si es un string numérico, parsearlo
    const num = parseInt(correct, 10)
    if (!isNaN(num) && num >= 0 && num <= 3) {
      return num
    }

    return null
  }

  // Convertir número a letra para mostrar al usuario
  const numberToLetter = (num) => {
    if (num === null || num === undefined) return null
    const letters = ['A', 'B', 'C', 'D']
    return letters[num] || null
  }

  // Establecer contexto de pregunta actual (desde TestLayout o PsychometricTestLayout)
  const setQuestionContext = useCallback((questionData) => {
    if (questionData) {
      setCurrentQuestionContext({
        id: questionData.id,
        questionText: questionData.question_text || questionData.question,
        options: {
          a: questionData.option_a,
          b: questionData.option_b,
          c: questionData.option_c,
          d: questionData.option_d
        },
        correctAnswer: normalizeCorrectAnswer(questionData.correct),
        explanation: questionData.explanation,
        // Campos para tests de leyes
        lawName: questionData.law?.short_name || questionData.law?.name || questionData.law || null,
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

export function useQuestionContext() {
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
export function answerToLetter(answer) {
  if (answer === null || answer === undefined) return null
  if (typeof answer === 'string' && /^[a-dA-D]$/.test(answer)) {
    return answer.toUpperCase()
  }
  const num = typeof answer === 'number' ? answer : parseInt(answer, 10)
  if (!isNaN(num) && num >= 0 && num <= 3) {
    const letters = ['A', 'B', 'C', 'D']
    return letters[num]
  }
  return null
}
