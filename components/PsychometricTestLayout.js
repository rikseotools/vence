'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import PieChartQuestion from './PieChartQuestion'
import DataTableQuestion from './DataTableQuestion'
import PsychometricRegistrationManager from './PsychometricRegistrationManager'
import { getDifficultyInfo, formatDifficultyDisplay, isFirstAttempt } from '../lib/psychometricDifficulty'

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
  
  // Estados para usuarios no logueados (igual que TestLayout)
  const [detailedAnswers, setDetailedAnswers] = useState([])
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  
  // Estados para dificultad adaptativa
  const [difficultyInfo, setDifficultyInfo] = useState(null)
  const [isFirstTime, setIsFirstTime] = useState(true)

  // Anti-duplicados
  const answeringTimeouts = useRef(new Map())
  const answeredQuestionsGlobal = useRef(new Set())

  const currentQ = questions[currentQuestion]
  const totalQuestions = questions.length

  // Crear sesión de test al iniciar (solo para usuarios logueados)
  useEffect(() => {
    async function createTestSession() {
      if (!user || !questions.length) {
        console.log('📊 No user logged in, running in guest mode')
        return
      }

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

  // Cargar información de dificultad cuando cambie la pregunta
  useEffect(() => {
    async function loadDifficultyInfo() {
      if (!currentQ || !user || !supabase) return

      try {
        console.log('🎯 Loading difficulty info for question:', currentQ.id)
        
        // Cargar información de dificultad
        const diffInfo = await getDifficultyInfo(supabase, currentQ.id, user.id)
        setDifficultyInfo(diffInfo)
        
        // Verificar si es primera vez para este usuario
        const firstTime = await isFirstAttempt(supabase, user.id, currentQ.id)
        setIsFirstTime(firstTime)
        
        console.log('✅ Difficulty info loaded:', diffInfo)
        console.log('🆕 Is first time:', firstTime)
      } catch (error) {
        console.error('❌ Error loading difficulty info:', error)
      }
    }

    loadDifficultyInfo()
  }, [currentQuestion, currentQ, user, supabase])

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
      const questionTime = Date.now() - questionStartTime
      const timeTakenSeconds = Math.floor(questionTime / 1000)

      // Actualizar score
      if (isCorrect) {
        setScore(prev => prev + 1)
      }

      // Crear objeto de respuesta detallada (para usuarios logueados y no logueados)
      const detailedAnswer = {
        questionId: currentQ.id,
        questionText: currentQ.question_text,
        userAnswer: optionIndex,
        correctAnswer: currentQ.correct_option,
        isCorrect,
        timeSpent: timeTakenSeconds,
        timestamp: new Date().toISOString(),
        questionOrder: currentQuestion + 1
      }

      // Guardar respuesta en base de datos (solo para usuarios logueados)
      if (testSession && user) {
        const answerData = {
          session_id: testSession.id,
          question_id: currentQ.id,
          user_id: user.id,
          user_answer: optionIndex,
          is_correct: isCorrect,
          time_taken_seconds: timeTakenSeconds,
          question_order: currentQuestion + 1,
          answered_at: new Date().toISOString()
        }

        const { error } = await supabase
          .from('psychometric_test_answers')
          .insert(answerData)

        if (error) {
          console.error('❌ Error saving answer:', error)
        } else {
          console.log('✅ Answer saved to database')
        }
      } else {
        console.log('📊 Guest mode: answer saved locally')
      }

      // Actualizar estado de preguntas respondidas (ambos tipos de usuario)
      setAnsweredQuestions(prev => [...prev, detailedAnswer])
      setDetailedAnswers(prev => [...prev, detailedAnswer])

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
      setQuestionStartTime(Date.now()) // Reset timer para nueva pregunta
      // Limpiar estados de dificultad para la nueva pregunta
      setDifficultyInfo(null)
      setIsFirstTime(true)
    } else {
      // Test completado
      completeTest()
    }
  }

  const completeTest = async () => {
    if (testSession && user) {
      // Usuario logueado - guardar sesión completada
      await supabase
        .from('psychometric_test_sessions')
        .update({
          is_completed: true,
          score: score,
          end_time: new Date().toISOString()
        })
        .eq('id', testSession.id)
      
      console.log('✅ Test session completed and saved')
      // Redirigir a resultados o página principal
      window.location.href = '/auxiliar-administrativo-estado/test'
    } else {
      // Usuario no logueado - el PsychometricRegistrationManager se encarga del modal
      console.log('📊 Guest user completed test, registration manager will handle prompt')
      // No hacer nada específico, el manager detectará isTestCompleted
    }
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
      
      case 'data_tables':
        return (
          <DataTableQuestion
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
    <PsychometricRegistrationManager
      categoria={categoria}
      currentQuestion={currentQuestion}
      totalQuestions={totalQuestions}
      answeredQuestions={answeredQuestions}
      showResult={showResult}
      score={score}
      startTime={startTime}
      isTestCompleted={currentQuestion === totalQuestions - 1 && showResult}
      enabled={true}
    >
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

      {/* Difficulty Info */}
      {difficultyInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{formatDifficultyDisplay(difficultyInfo).icon}</span>
                <div>
                  <span className={`font-medium ${formatDifficultyDisplay(difficultyInfo).color}`}>
                    {formatDifficultyDisplay(difficultyInfo).displayText}
                  </span>
                  {formatDifficultyDisplay(difficultyInfo).showAdaptiveBadge && (
                    <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      🧠 Adaptativa
                    </span>
                  )}
                </div>
              </div>
              
              {isFirstTime && (
                <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                  <span>🆕</span>
                  <span className="font-medium">Primera vez</span>
                </div>
              )}
            </div>
            
            {formatDifficultyDisplay(difficultyInfo).tooltip && (
              <div className="mt-2 text-sm text-gray-600">
                💡 {formatDifficultyDisplay(difficultyInfo).tooltip}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {renderQuestion()}
      </div>

      {/* Next Button - Separado del contenido de la pregunta */}
      {showResult && (
        <div className="bg-gray-50 border-t border-gray-200 py-6">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <button
                onClick={nextQuestion}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-lg flex items-center justify-center gap-2"
              >
                {currentQuestion < totalQuestions - 1 ? (
                  <>
                    Siguiente Pregunta 
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                ) : (
                  <>
                    Finalizar Test 
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Espaciado inferior para evitar problemas con footer */}
      <div className="h-16"></div>
      
      </div>
    </PsychometricRegistrationManager>
  )
}