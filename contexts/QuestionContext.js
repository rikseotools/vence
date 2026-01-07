'use client'

import { createContext, useContext, useState, useCallback } from 'react'

const QuestionContext = createContext(null)

export function QuestionProvider({ children }) {
  const [currentQuestionContext, setCurrentQuestionContext] = useState(null)

  // Establecer contexto de pregunta actual (desde TestLayout)
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
        correctAnswer: questionData.correct,
        explanation: questionData.explanation,
        lawName: questionData.law?.short_name || questionData.law?.name || null,
        articleNumber: questionData.article_number || null,
        difficulty: questionData.difficulty || null,
        source: questionData.source || null
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
