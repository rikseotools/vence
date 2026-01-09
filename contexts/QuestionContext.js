'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const QuestionContext = createContext(null)

export function QuestionProvider({ children }) {
  const [currentQuestionContext, setCurrentQuestionContext] = useState(null)

  // Convertir respuesta correcta a letra (A, B, C, D)
  // IMPORTANTE: La base de datos usa 0-indexed (0=A, 1=B, 2=C, 3=D)
  const formatCorrectAnswer = (correct) => {
    if (correct === null || correct === undefined) return null

    // Si ya es una letra, devolverla en mayúscula
    if (typeof correct === 'string' && /^[a-dA-D]$/.test(correct)) {
      return correct.toUpperCase()
    }

    // Si es un número, convertir usando 0-indexed: 0->A, 1->B, 2->C, 3->D
    const num = parseInt(correct, 10)
    if (!isNaN(num) && num >= 0 && num <= 3) {
      const letters = ['A', 'B', 'C', 'D']
      return letters[num]
    }

    return String(correct).toUpperCase()
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
        correctAnswer: formatCorrectAnswer(questionData.correct),
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
