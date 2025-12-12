// components/ExamLayout.js - MODO EXAMEN (todas las preguntas a la vez)
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { usePathname } from 'next/navigation'
import ArticleModal from './ArticleModal'

// Imports modularizados
import {
  getDeviceInfo,
  createUserSession,
  createDetailedTestSession,
  updateTestScore
} from '../utils/testSession.js'
import {
  saveDetailedAnswer,
  calculateConfidence,
  createDetailedAnswer
} from '../utils/testAnswers.js'
import {
  completeDetailedTest,
  formatTime
} from '../utils/testAnalytics.js'

export default function ExamLayout({
  tema,
  testNumber,
  config,
  questions,
  children
}) {
  const { user, loading: authLoading, supabase } = useAuth()

  // Estados del examen
  const [userAnswers, setUserAnswers] = useState({}) // { questionIndex: selectedOption }
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0) // Tiempo transcurrido en segundos

  // Estados de sesión
  const [currentTestSession, setCurrentTestSession] = useState(null)
  const [userSession, setUserSession] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)

  // Control de guardado
  const [isSaving, setIsSaving] = useState(false)

  // Estados del modal de artículo
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState({ number: null, lawSlug: null })

  // Hook para obtener la URL actual
  const pathname = usePathname()

  // Refs para tracking
  const pageLoadTime = useRef(Date.now())
  const sessionCreationRef = useRef(false) // ✅ Cambiar a boolean simple
  const currentTestSessionRef = useRef(null) // ✅ Ref para mantener el test ID

  // ✅ CRONÓMETRO: Actualizar cada segundo
  useEffect(() => {
    if (isSubmitted) return // No actualizar si ya terminó

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isSubmitted, startTime])

  // ✅ INICIALIZAR SESIÓN AL MONTAR
  useEffect(() => {
    if (authLoading || !questions?.length) return

    // ✅ Control anti-duplicados mejorado (para React Strict Mode)
    if (sessionCreationRef.current) {
      console.log('⏭️ Sesión de examen ya iniciada, omitiendo (Strict Mode)')
      return
    }

    sessionCreationRef.current = true
    initializeExamSession()

    // No limpiar el flag en cleanup para evitar doble creación
  }, [authLoading, questions?.length, tema])

  // ✅ FUNCIÓN: Inicializar sesión de examen
  async function initializeExamSession() {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🎯 INICIANDO SESIÓN DE EXAMEN')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('📋 Parámetros:')
      console.log('   - User ID:', user?.id || 'NULL')
      console.log('   - Tema:', tema)
      console.log('   - Test Number:', testNumber || 1)
      console.log('   - Questions Count:', questions?.length || 0)
      console.log('   - Test Type: exam')
      console.log('')

      // Crear test_session con tipo 'exam' (sin user_session para simplificar)
      const testSessionData = await createDetailedTestSession(
        user?.id || null,
        tema,
        testNumber || 1,
        questions,
        config,
        startTime,
        pageLoadTime.current,
        null, // Sin userSession para simplificar
        'exam' // 🆕 Pasar test_type como 'exam'
      )

      console.log('')
      console.log('📦 Resultado de createDetailedTestSession:')
      console.log('   - testSessionData:', testSessionData)
      console.log('   - testSessionData?.id:', testSessionData?.id)
      console.log('   - typeof:', typeof testSessionData)
      console.log('   - is null?:', testSessionData === null)
      console.log('   - is undefined?:', testSessionData === undefined)
      console.log('')

      if (testSessionData === null || testSessionData === undefined) {
        console.error('❌ CRITICAL: createDetailedTestSession devolvió null/undefined')
        console.error('   Esto causará que NO se guarden las preguntas')
      } else if (!testSessionData.id) {
        console.error('❌ CRITICAL: testSessionData no tiene ID')
        console.error('   Full object:', JSON.stringify(testSessionData, null, 2))
      } else {
        console.log('✅ Test session creada con ID:', testSessionData.id)
        // ✅ Guardar en ref para persistencia
        currentTestSessionRef.current = testSessionData
      }

      setCurrentTestSession(testSessionData)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ EXCEPCIÓN EN initializeExamSession:', error)
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  // ✅ FUNCIÓN: Manejar selección de respuesta
  function handleAnswerSelect(questionIndex, option) {
    if (isSubmitted) return // No permitir cambios después de corregir

    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }))
  }

  // ✅ FUNCIÓN: Corregir examen (NO BLOQUEANTE - muestra resultados inmediatamente)
  function handleSubmitExam() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 INICIANDO CORRECCIÓN DE EXAMEN')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // 🚀 CALCULAR RESULTADOS INMEDIATAMENTE (sin await)
    let correctCount = 0
    const endTime = Date.now()
    const totalTimeSeconds = Math.round((endTime - startTime) / 1000)

    console.log(`⏱️  Tiempo total: ${totalTimeSeconds} segundos (${Math.round(totalTimeSeconds / 60)} min)`)
    console.log(`📝 Total preguntas: ${questions.length}`)
    console.log(`📋 Test Session ID: ${currentTestSession?.id || 'NO DISPONIBLE'}`)
    console.log('')

    // Calcular correctas sin guardar todavía
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const selectedOption = userAnswers[i]
      const correctIndex = typeof question.correct_option === 'number'
        ? question.correct_option
        : 0
      const correctOptionLetter = String.fromCharCode(97 + correctIndex)
      const isCorrect = selectedOption ? selectedOption === correctOptionLetter : false

      const icon = isCorrect ? '✅' : selectedOption ? '❌' : '⚪'
      const userAns = selectedOption ? selectedOption.toUpperCase() : 'SIN RESPUESTA'
      const correctAns = correctOptionLetter.toUpperCase()

      console.log(`${icon} Pregunta ${i + 1}: Usuario=${userAns} | Correcta=${correctAns} | ${isCorrect ? 'CORRECTA' : 'INCORRECTA'}`)

      if (isCorrect) correctCount++
    }

    console.log('')
    console.log(`📊 RESULTADO CALCULADO: ${correctCount}/${questions.length} correctas (${Math.round((correctCount / questions.length) * 100)}%)`)
    console.log('')

    // ✅ MOSTRAR RESULTADOS INMEDIATAMENTE (sin esperar guardado)
    setScore(correctCount)
    setIsSubmitted(true)
    setIsSaving(true) // Mostrar "Guardando en segundo plano..."
    window.scrollTo({ top: 0, behavior: 'smooth' })

    console.log(`🚀 MOSTRANDO RESULTADOS AL USUARIO (sin esperar guardado)`)
    console.log(`💾 Iniciando guardado en segundo plano...`)
    console.log('')

    // 🔄 GUARDAR EN SEGUNDO PLANO (async, no bloqueante)
    saveExamInBackground(correctCount, totalTimeSeconds).then(() => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('✅ GUARDADO EN SEGUNDO PLANO COMPLETADO')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }).catch(err => {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('❌ ERROR EN GUARDADO EN SEGUNDO PLANO:', err)
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    })
  }

  // 🔄 FUNCIÓN AUXILIAR: Guardar en segundo plano
  async function saveExamInBackground(correctCount, totalTimeSeconds) {
    console.log('💾 ═══════════════════════════════════════════')
    console.log('💾 INICIANDO GUARDADO EN SEGUNDO PLANO')
    console.log('💾 ═══════════════════════════════════════════')

    try {
      const timePerQuestion = Math.round(totalTimeSeconds / questions.length)
      console.log(`⏱️  Tiempo por pregunta (promedio): ${timePerQuestion}s`)
      console.log(`📋 Test Session ID: ${currentTestSession?.id}`)
      console.log('')

      let savedCount = 0
      let errorCount = 0
      const allAnswers = [] // Array para completeDetailedTest

      // Guardar todas las preguntas
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const selectedOption = userAnswers[i]
        const answerIndex = selectedOption ? selectedOption.charCodeAt(0) - 97 : null
        const correctIndex = typeof question.correct_option === 'number'
          ? question.correct_option
          : 0
        const correctOptionLetter = String.fromCharCode(97 + correctIndex)
        const isCorrect = selectedOption ? selectedOption === correctOptionLetter : false

        console.log(`📝 PREGUNTA ${i + 1}/${questions.length}`)
        console.log(`   Respuesta usuario: ${selectedOption ? selectedOption.toUpperCase() : 'NO RESPONDIDA'} (índice: ${answerIndex})`)
        console.log(`   Respuesta correcta: ${correctOptionLetter.toUpperCase()} (índice: ${correctIndex})`)
        console.log(`   ¿Correcta?: ${isCorrect ? 'SÍ ✅' : 'NO ❌'}`)
        console.log(`   Tiempo: ${timePerQuestion}s`)

        const questionData = {
          id: question.id,
          question: question.question_text,
          options: [question.option_a, question.option_b, question.option_c, question.option_d],
          correctAnswer: correctIndex,
          explanation: question.explanation,
          article: {
            id: question.articles?.id || question.primary_article_id,
            number: question.articles?.article_number,
            law_short_name: question.articles?.laws?.short_name
          },
          metadata: {
            id: question.id,
            difficulty: question.difficulty,
            question_type: 'single'
          },
          tema: tema
        }

        const answerData = {
          questionIndex: i,
          selectedAnswer: answerIndex !== null ? answerIndex : -1,
          correctAnswer: correctIndex,
          isCorrect: isCorrect,
          timeSpent: timePerQuestion,
          confidence: selectedOption ? 'sure' : 'guessing',
          questionData: questionData
        }

        // Agregar al array para completeDetailedTest
        allAnswers.push(answerData)

        if (currentTestSession?.id) {
          try {
            console.log(`   💾 Guardando en BD...`)
            const result = await saveDetailedAnswer(
              currentTestSession.id,
              questionData,
              answerData,
              tema,
              selectedOption ? 'sure' : 'guessing',
              0,
              startTime,
              null,
              [],
              [],
              []
            )

            if (result?.success) {
              savedCount++
              console.log(`   ✅ Guardada exitosamente (${savedCount}/${questions.length})`)
            } else {
              errorCount++
              console.log(`   ⚠️  Error al guardar (acción: ${result?.action})`)
            }
          } catch (err) {
            errorCount++
            console.error(`   ❌ Excepción al guardar:`, err.message)
          }
        } else {
          console.log(`   ⚠️  NO SE GUARDÓ - No hay test session`)
        }
      }

      console.log('')
      console.log(`───────────────────────────────────────────`)
      console.log(`📊 RESUMEN DE GUARDADO:`)
      console.log(`   Guardadas exitosamente: ${savedCount}/${questions.length}`)
      console.log(`   Con errores: ${errorCount}`)
      console.log('')

      // Actualizar score del test
      if (currentTestSession?.id) {
        console.log(`🔢 Actualizando score del test...`)
        console.log(`   Test ID: ${currentTestSession.id}`)
        console.log(`   Score: ${correctCount}/${questions.length}`)

        await updateTestScore(currentTestSession.id, correctCount)
        console.log(`✅ Score actualizado en BD`)
      }

      // 🎯 Completar test con análisis completo
      if (currentTestSession?.id) {
        console.log(`🏁 Marcando test como completado...`)

        const result = await completeDetailedTest(
          currentTestSession.id,
          correctCount,
          allAnswers,
          questions,
          startTime,
          [], // interactionEvents - no los tenemos en modo examen
          userSession
        )

        if (result.success) {
          console.log(`✅ Test completado y analizado en BD`)
        } else {
          console.error(`❌ Error completando test:`, result.status)
        }
      }

      setSaveStatus('success')
      console.log('')
      console.log(`💾 ═══════════════════════════════════════════`)
      console.log(`💾 GUARDADO COMPLETADO`)
      console.log(`💾 Total guardadas: ${savedCount}/${questions.length}`)
      console.log(`💾 Score final: ${correctCount}/${questions.length} (${Math.round((correctCount / questions.length) * 100)}%)`)
      console.log(`💾 ═══════════════════════════════════════════`)

    } catch (error) {
      console.error('')
      console.error('💾 ═══════════════════════════════════════════')
      console.error('❌ ERROR CRÍTICO EN GUARDADO:', error)
      console.error('💾 ═══════════════════════════════════════════')
      setSaveStatus('error')
      // No mostramos alert porque el usuario ya está viendo sus resultados
    } finally {
      setIsSaving(false)
    }
  }

  // ✅ FUNCIÓN: Abrir modal de artículo
  function openArticleModal(articleNumber, lawName) {
    // Convertir nombre de ley a slug (espacios a guiones, barras a guiones)
    const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setModalOpen(true)
  }

  // ✅ FUNCIÓN: Cerrar modal de artículo
  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
  }

  // ✅ FUNCIÓN: Formatear tiempo para el cronómetro
  function formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ✅ LOADING STATE
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen...</p>
        </div>
      </div>
    )
  }

  const totalQuestions = questions.length
  const answeredCount = Object.keys(userAnswers).length
  const accuracy = isSubmitted && totalQuestions > 0 ? (score / totalQuestions * 100).toFixed(1) : 0

  // 🎯 Calcular desglose de resultados
  const correctCount = score
  const incorrectCount = answeredCount - score
  const blankCount = totalQuestions - answeredCount

  // 📊 Calcular nota sobre 10 (cada 3 fallos restan 1 correcta)
  const puntosBrutos = correctCount - (incorrectCount / 3)
  const notaSobre10 = isSubmitted
    ? Math.max(0, (puntosBrutos / totalQuestions) * 10).toFixed(2)
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* ✅ HEADER DEL EXAMEN */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          {/* Título */}
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📝 Modo Examen</h1>
            <p className="text-sm text-gray-600">Tema {tema} - {totalQuestions} preguntas</p>
          </div>

          {/* Grid de métricas: Cronómetro + Respondidas (responsive) */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {/* ⏱️ CRONÓMETRO */}
            <div className="text-center px-3 py-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-600 font-medium mb-1">⏱️ Tiempo</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700 font-mono">
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>

            {/* 📝 RESPONDIDAS */}
            <div className="text-center px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-600 font-medium mb-1">📝 Respondidas</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">
                {answeredCount}/{totalQuestions}
              </div>
            </div>
          </div>

          {/* Barra de progreso */}
          {!isSubmitted && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              ></div>
            </div>
          )}

          {/* Resultado después de corregir */}
          {isSubmitted && (
            <div>
              {/* Nota destacada sobre 10 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">
                    {notaSobre10 >= 8 ? '🎉' : notaSobre10 >= 5 ? '👍' : '📚'}
                  </div>
                  <div className="text-6xl font-bold text-blue-600 mb-2">
                    {notaSobre10}
                  </div>
                  <div className="text-xl text-gray-700 font-medium">
                    sobre 10
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    (Cada 3 fallos restan 1 correcta)
                  </div>
                </div>

                {/* ⏱️ TIEMPO EMPLEADO */}
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-purple-600 font-medium">⏱️ Tiempo empleado:</span>
                    <span className="text-2xl font-bold text-purple-700 font-mono">
                      {formatElapsedTime(elapsedTime)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 text-center mt-2">
                    Promedio: {Math.round(elapsedTime / totalQuestions)}s por pregunta
                  </div>
                </div>
              </div>

              {/* Desglose de resultados */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Correctas */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {correctCount}
                  </div>
                  <div className="text-sm text-green-700 font-medium">
                    ✅ Correctas
                  </div>
                </div>

                {/* Incorrectas */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-red-600 mb-1">
                    {incorrectCount}
                  </div>
                  <div className="text-sm text-red-700 font-medium">
                    ❌ Incorrectas
                  </div>
                  {incorrectCount > 0 && (
                    <div className="text-xs text-red-600 mt-1">
                      (-{(incorrectCount / 3).toFixed(2)} pts)
                    </div>
                  )}
                </div>

                {/* En blanco */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-gray-600 mb-1">
                    {blankCount}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">
                    ⚪ En blanco
                  </div>
                </div>
              </div>

              {/* Indicador de guardado */}
              {isSaving && (
                <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Guardando resultados...</span>
                </div>
              )}
              {!isSaving && saveStatus === 'success' && (
                <div className="mb-4 text-sm text-green-600 font-medium text-center">
                  ✓ Resultados guardados
                </div>
              )}

              {/* Botón volver */}
              <div className="text-center">
                <Link
                  href={`/auxiliar-administrativo-estado/test/tema/${tema}`}
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ← Volver al tema
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ✅ LISTA DE PREGUNTAS */}
        <div className="space-y-6">
          {questions.map((question, index) => {
            const selectedOption = userAnswers[index]
            // Convertir correct_option numérico a letra
            const correctIndex = typeof question.correct_option === 'number'
              ? question.correct_option
              : 0
            const correctOptionLetter = String.fromCharCode(97 + correctIndex)
            const isCorrect = selectedOption === correctOptionLetter
            const showFeedback = isSubmitted

            return (
              <div
                key={index}
                className={`bg-white rounded-lg shadow-sm p-6 border-2 transition-all ${
                  showFeedback
                    ? isCorrect
                      ? 'border-green-500'
                      : selectedOption
                        ? 'border-red-500'
                        : 'border-gray-200'
                    : selectedOption
                      ? 'border-blue-500'
                      : 'border-gray-200'
                }`}
              >
                {/* Número de pregunta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-gray-600">
                    Pregunta {index + 1} de {totalQuestions}
                  </div>
                  {showFeedback && (
                    <div className={`text-sm font-bold ${isCorrect ? 'text-green-600' : selectedOption ? 'text-red-600' : 'text-gray-400'}`}>
                      {isCorrect ? '✅ Correcta' : selectedOption ? '❌ Incorrecta' : '⚪ No respondida'}
                    </div>
                  )}
                </div>

                {/* Texto de la pregunta */}
                <div className="mb-6">
                  <p className="text-lg text-gray-900 leading-relaxed">
                    {question.question_text}
                  </p>
                </div>

                {/* Opciones de respuesta */}
                <div className="space-y-3">
                  {['a', 'b', 'c', 'd'].map(option => {
                    const optionKey = `option_${option}`
                    const isSelected = selectedOption === option
                    const isCorrectOption = option === correctOptionLetter

                    let buttonStyle = 'border-gray-300 bg-white hover:bg-gray-50'

                    if (showFeedback) {
                      if (isCorrectOption) {
                        buttonStyle = 'border-green-500 bg-green-50'
                      } else if (isSelected && !isCorrect) {
                        buttonStyle = 'border-red-500 bg-red-50'
                      } else {
                        buttonStyle = 'border-gray-200 bg-gray-50'
                      }
                    } else if (isSelected) {
                      buttonStyle = 'border-blue-500 bg-blue-50'
                    }

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(index, option)}
                        disabled={isSubmitted}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${buttonStyle} ${
                          isSubmitted ? 'cursor-default' : 'cursor-pointer'
                        }`}
                      >
                        <div className="flex items-start">
                          {/* Radio button visual */}
                          <div className="flex items-center mr-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                              showFeedback
                                ? isCorrectOption
                                  ? 'border-green-500 bg-green-50'
                                  : isSelected && !isCorrect
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-300 bg-white'
                                : isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && !showFeedback && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
                              )}
                              {showFeedback && isCorrectOption && (
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                              )}
                              {showFeedback && isSelected && !isCorrect && (
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                              )}
                            </div>
                          </div>
                          <span className="font-bold text-gray-700 mr-3">
                            {option.toUpperCase()})
                          </span>
                          <span className="text-gray-900 flex-1">
                            {question[optionKey]}
                          </span>
                          {showFeedback && isCorrectOption && (
                            <span className="ml-2 text-green-600 font-bold">✓</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Explicación (solo después de corregir) */}
                {showFeedback && question.explanation && (
                  <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-semibold text-blue-900 mb-3 text-base">📖 Explicación:</div>
                    <p className="text-blue-800 text-base leading-loose whitespace-pre-line">
                      {question.explanation}
                    </p>
                  </div>
                )}

                {/* Información del artículo (solo después de corregir) */}
                {showFeedback && question.articles && (
                  <button
                    onClick={() => openArticleModal(
                      question.articles.article_number,
                      question.articles.laws?.short_name || 'Ley'
                    )}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-1"
                  >
                    📚 {question.articles.laws?.short_name || 'Ley'} - Artículo {question.articles.article_number}
                    <span className="text-xs">▸</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* ✅ BOTÓN FINAL (si no está corregido) */}
        {!isSubmitted && (
          <div className="mt-8 mb-8">
            <button
              onClick={handleSubmitExam}
              className="w-full py-4 rounded-lg font-bold text-white text-lg transition-colors shadow-lg bg-green-600 hover:bg-green-700"
            >
              ✅ Corregir Examen ({answeredCount}/{totalQuestions} respondidas)
            </button>
          </div>
        )}

        {/* ✅ BOTÓN VOLVER AL TEMA (al final de todo) */}
        {isSubmitted && (
          <div className="mt-8 mb-8 text-center">
            <Link
              href={`/auxiliar-administrativo-estado/test/tema/${tema}`}
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
            >
              ← Volver al tema {tema}
            </Link>
          </div>
        )}
      </div>

      {/* ✅ MODAL DE ARTÍCULO */}
      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
      />
    </div>
  )
}
