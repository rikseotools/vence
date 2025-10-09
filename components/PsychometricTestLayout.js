'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import PieChartQuestion from './PieChartQuestion'

export default function PsychometricTestLayout({
  categoria,
  config,
  questions
}) {
  const { user, supabase } = useAuth()

  // Estados del test básicos
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [startTime, setStartTime] = useState(Date.now())
  const [testSession, setTestSession] = useState(null)
  const [isAnswering, setIsAnswering] = useState(false)

  // Anti-duplicados
  const answeringTimeouts = useRef(new Map())
  const answeredQuestionsGlobal = useRef(new Set())

  const currentQ = questions[currentQuestion]
  const totalQuestions = questions.length

  // Crear sesión de test al iniciar
  useEffect(() => {
    async function createTestSession() {
      if (!user || !questions.length) return

      const sessionData = {
        user_id: user.id,
        category_id: questions[0].category_id,
        session_type: 'psychometric',
        total_questions: questions.length,
        questions_data: { question_ids: questions.map(q => q.id) },
        start_time: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('psychometric_test_sessions')
        .insert(sessionData)
        .select()
        .single()

      if (data) {
        setTestSession(data)
        console.log('✅ Psychometric test session created:', data.id)
      }
    }

    createTestSession()
  }, [user, questions, supabase])

  const handleAnswer = async (optionIndex) => {
    if (!currentQ || isAnswering || answeredQuestionsGlobal.current.has(currentQ.id)) {
      console.log('🚫 Answer blocked - already answered or processing')
      return
    }

    const timeoutKey = `${currentQ.id}_${optionIndex}`
    if (answeringTimeouts.current.has(timeoutKey)) {
      console.log('🚫 Answer blocked - timeout exists')
      return
    }

    setIsAnswering(true)
    setSelectedAnswer(optionIndex)
    answeredQuestionsGlobal.current.add(currentQ.id)

    // Timeout para evitar respuestas duplicadas
    const timeout = setTimeout(() => {
      answeringTimeouts.current.delete(timeoutKey)
    }, 2000)
    answeringTimeouts.current.set(timeoutKey, timeout)

    try {
      const isCorrect = optionIndex === currentQ.correct_option
      const timeTaken = Math.floor((Date.now() - startTime) / 1000)

      // Actualizar score
      if (isCorrect) {
        setScore(prev => prev + 1)
      }

      // Guardar respuesta en base de datos
      if (testSession && user) {
        const answerData = {
          session_id: testSession.id,
          question_id: currentQ.id,
          user_id: user.id,
          user_answer: optionIndex,
          is_correct: isCorrect,
          time_taken_seconds: timeTaken,
          question_order: currentQuestion + 1,
          answered_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('psychometric_test_answers')
          .insert(answerData)

        if (error) {
          console.error('❌ Error saving answer:', error)
        }
      }

      // Actualizar estado de preguntas respondidas
      setAnsweredQuestions(prev => [
        ...prev,
        {
          questionId: currentQ.id,
          userAnswer: optionIndex,
          isCorrect,
          timeTaken
        }
      ])

      setShowResult(true)

    } catch (error) {
      console.error('❌ Error processing answer:', error)
    } finally {
      setIsAnswering(false)
    }
  }

  const nextQuestion = () => {
    if (currentQuestion < totalQuestions - 1) {
      setCurrentQuestion(prev => prev + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setStartTime(Date.now())
    } else {
      // Test completado
      completeTest()
    }
  }

  const completeTest = async () => {
    if (testSession) {
      await supabase
        .from('psychometric_test_sessions')
        .update({
          is_completed: true,
          score: score,
          end_time: new Date().toISOString()
        })
        .eq('id', testSession.id)
    }

    // Redirigir a resultados o página principal
    window.location.href = '/auxiliar-administrativo-estado/test'
  }

  const renderQuestion = () => {
    if (!currentQ) return null

    // Renderizar según el tipo de pregunta
    switch (currentQ.question_subtype) {
      case 'pie_chart':
        return (
          <PieChartQuestion
            question={currentQ}
            onAnswer={handleAnswer}
            selectedAnswer={selectedAnswer}
            showResult={showResult}
            isAnswering={isAnswering}
          />
        )
      
      default:
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">
              Tipo de pregunta no soportado: {currentQ.question_subtype}
            </p>
          </div>
        )
    }
  }

  if (!questions.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">No hay preguntas disponibles</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href="/auxiliar-administrativo-estado/test"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
              >
                ← Volver a Tests
              </Link>
              <h1 className="text-xl font-bold text-gray-900 mt-2">
                Test Psicotécnico - {categoria.replace('-', ' ')}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">
                Pregunta {currentQuestion + 1} de {totalQuestions}
              </div>
              <div className="text-lg font-semibold text-blue-600">
                Puntuación: {score}/{totalQuestions}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / totalQuestions) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderQuestion()}
      </div>

      {/* Next Button */}
      {showResult && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <button
              onClick={nextQuestion}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {currentQuestion < totalQuestions - 1 ? 'Siguiente Pregunta' : 'Finalizar Test'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}