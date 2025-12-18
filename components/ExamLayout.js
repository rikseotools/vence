// components/ExamLayout.js - MODO EXAMEN (todas las preguntas a la vez)
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { usePathname } from 'next/navigation'
import ArticleModal from './ArticleModal'
import QuestionDispute from './QuestionDisputeFixed'
import MotivationalMessage from './MotivationalMessage'
import SharePrompt from './SharePrompt'
import ShareQuestion from './ShareQuestion'

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

// 🚫 LISTA DE CONTENIDO NO LEGAL (informática) - No mostrar botón "Ver artículo"
const NON_LEGAL_CONTENT = [
  'Informática Básica',
  'Portal de Internet',
  'La Red Internet',
  'Windows 10',
  'Explorador de Windows',
  'Hojas de cálculo. Excel',
  'Base de datos: Access',
  'Correo electrónico',
  'Procesadores de texto',
  'Administración electrónica y servicios al ciudadano (CSL)',
]

// 🔍 FUNCIÓN: Verificar si es contenido legal (artículo de ley real)
function isLegalArticle(lawShortName) {
  if (!lawShortName) return false
  return !NON_LEGAL_CONTENT.includes(lawShortName)
}

/// 🎉 FUNCIÓN: Obtener mensaje motivacional según puntuación
function getMotivationalMessage(notaSobre10, userName) {
  const nota = parseFloat(notaSobre10)
  const nombre = userName || 'allí'

  if (nota === 10) {
    return {
      emoji: '🏆',
      message: `¡PERFECTO, ${nombre}!`,
      color: 'text-yellow-600',
      bgColor: 'from-yellow-50 to-amber-50',
      borderColor: 'border-yellow-300'
    }
  } else if (nota >= 9) {
    return {
      emoji: '🎉',
      message: `¡EXCELENTE, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-emerald-50',
      borderColor: 'border-green-300'
    }
  } else if (nota >= 8) {
    return {
      emoji: '✨',
      message: `¡MUY BIEN, ${nombre}!`,
      color: 'text-green-600',
      bgColor: 'from-green-50 to-teal-50',
      borderColor: 'border-green-200'
    }
  } else if (nota >= 7) {
    return {
      emoji: '👏',
      message: `¡BIEN HECHO, ${nombre}!`,
      color: 'text-blue-600',
      bgColor: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-200'
    }
  } else if (nota >= 6) {
    return {
      emoji: '💪',
      message: `¡BUEN INTENTO, ${nombre}!`,
      color: 'text-orange-600',
      bgColor: 'from-orange-50 to-amber-50',
      borderColor: 'border-orange-200'
    }
  } else if (nota >= 5) {
    return {
      emoji: '📚',
      message: `Sigue practicando, ${nombre}`,
      color: 'text-orange-500',
      bgColor: 'from-orange-50 to-yellow-50',
      borderColor: 'border-orange-200'
    }
  } else {
    return {
      emoji: '🎯',
      message: `¡No te rindas, ${nombre}!`,
      color: 'text-gray-600',
      bgColor: 'from-gray-50 to-slate-50',
      borderColor: 'border-gray-300'
    }
  }
}

export default function ExamLayout({
  tema,
  testNumber,
  config,
  questions,
  children
}) {
  const { user, userProfile, loading: authLoading, supabase } = useAuth()

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
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState(null) // 🎨 Para resaltado inteligente

  // 📤 Estado para compartir resultado
  const [showSharePrompt, setShowSharePrompt] = useState(false)

  // 📤 Estado para compartir pregunta individual
  const [shareQuestionData, setShareQuestionData] = useState(null)

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

  // 📤 FUNCIÓN: Compartir pregunta individual directo a redes
  const handleQuickShareQuestion = (platform, question) => {
    if (!question) return
    const questionText = question.question_text || question.text || 'Pregunta de oposiciones'
    const shortQuestion = questionText.length > 100 ? questionText.substring(0, 100) + '...' : questionText
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=question_share`
    const url = `https://vence.es?${utmParams}`
    const shareText = `🤔 ¿Sabrías responder esta pregunta de oposiciones?\n\n"${shortQuestion}"`
    let shareUrl = ''

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n\n' + url)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  // 📤 FUNCIÓN: Compartir resultado directo a redes
  const handleQuickShareResult = (platform) => {
    const nota = isSubmitted ? Math.max(0, ((correctCount - (incorrectCount / 3)) / totalQuestions) * 10).toFixed(2) : '0'
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=exam_share&utm_content=score_${nota}`
    const url = `https://vence.es?${utmParams}`
    const shareText = `¡Acabo de sacar un ${nota}/10 en mi test de oposiciones! 💪`
    let shareUrl = ''

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n\n' + url)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(shareText)}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`
        break
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
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

    // 📤 El usuario puede compartir manualmente con el botón "Compartir resultado"

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
  function openArticleModal(articleNumber, lawName, question = null) {
    // Convertir nombre de ley a slug (espacios a guiones, barras a guiones)
    const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') || 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setSelectedQuestionForModal(question) // 🎨 Guardar pregunta para resaltado
    setModalOpen(true)
  }

  // ✅ FUNCIÓN: Cerrar modal de artículo
  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
    setSelectedQuestionForModal(null) // 🎨 Limpiar pregunta
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
          {isSubmitted && (() => {
            const motivationalData = getMotivationalMessage(notaSobre10, user?.user_metadata?.full_name || user?.email?.split('@')[0])
            const showConfetti = parseFloat(notaSobre10) >= 9
            return (
              <div className="relative">
                {/* 🎉 CONFETTI PARA 9-10 */}
                {showConfetti && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="confetti-container">
                      {[...Array(50)].map((_, i) => (
                        <div
                          key={i}
                          className="confetti"
                          style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 3}s`,
                            backgroundColor: ['#fbbf24', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)]
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Nota destacada sobre 10 con mensaje motivacional */}
                <div className={`relative bg-gradient-to-r ${motivationalData.bgColor} border-2 ${motivationalData.borderColor} rounded-xl p-6 mb-6`}>
                  <div className="text-center mb-4">
                    {/* Mensaje motivacional personalizado */}
                    <div className="text-6xl mb-3 animate-bounce">
                      {motivationalData.emoji}
                    </div>
                    <div className={`text-3xl sm:text-4xl font-bold ${motivationalData.color} mb-4`}>
                      {motivationalData.message}
                    </div>

                    {/* Nota numérica */}
                    <div className={`text-6xl font-bold ${motivationalData.color} mb-2`}>
                      {notaSobre10}
                    </div>
                    <div className="text-xl text-gray-700 font-medium">
                      sobre 10
                    </div>
                    <div className="text-sm text-gray-500 mt-2">
                      (Cada 3 fallos restan 1 correcta)
                    </div>

                    {/* 📤 BOTÓN COMPARTIR + ICONOS DIRECTOS - Debajo de la puntuación */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => setShowSharePrompt(true)}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all shadow-md hover:shadow-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                        </svg>
                        <span className="text-sm font-medium">Compartir</span>
                      </button>
                      {/* Iconos directos de redes sociales */}
                      <button onClick={() => handleQuickShareResult('whatsapp')} className="p-2 rounded-full hover:bg-green-50 transition-colors" title="WhatsApp">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleQuickShareResult('telegram')} className="p-2 rounded-full hover:bg-cyan-50 transition-colors" title="Telegram">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#0088cc">
                          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleQuickShareResult('facebook')} className="p-2 rounded-full hover:bg-blue-50 transition-colors" title="Facebook">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1877F2">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </button>
                      <button onClick={() => handleQuickShareResult('twitter')} className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="X">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </button>
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

              {/* Mensaje Motivacional Personalizado */}
              <div className="mb-6">
                <MotivationalMessage
                  category="exam_result"
                  context={{
                    nombre: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Estudiante',
                    accuracy: parseFloat(notaSobre10) * 10,
                    nota: notaSobre10,
                    racha: userProfile?.current_streak_days || 0,
                    preguntas: totalQuestions
                  }}
                  hideShareButton={true}
                />
              </div>

              {/* Botón volver */}
              <div className="text-center">
                <Link
                  href={tema && tema !== 0 ? `/auxiliar-administrativo-estado/test/tema/${tema}` : '/auxiliar-administrativo-estado/test'}
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  ← Volver a tests
                </Link>
              </div>
            </div>
            )
          })()}
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

                {/* Información del artículo (solo después de corregir y si es contenido legal) */}
                {showFeedback && question.articles && isLegalArticle(question.articles.laws?.short_name) && (
                  <button
                    onClick={() => openArticleModal(
                      question.articles.article_number,
                      question.articles.laws?.short_name || 'Ley',
                      question // 🎨 Pasar pregunta completa para resaltado inteligente
                    )}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors flex items-center gap-1"
                  >
                    Ver 📚 {question.articles.laws?.short_name || 'Ley'} - Artículo {question.articles.article_number}
                    <span className="text-xs">▸</span>
                  </button>
                )}

                {/* Botones de acción (solo después de corregir) */}
                {showFeedback && (
                  <div className="flex flex-wrap gap-2 items-center mt-4">
                    <QuestionDispute
                      questionId={question.id}
                      user={user}
                      supabase={supabase}
                    />

                    {/* Botón compartir pregunta + iconos directos */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShareQuestionData(question)}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Compartir esta pregunta"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                        </svg>
                        <span>Compartir</span>
                      </button>
                      <button onClick={() => handleQuickShareQuestion('whatsapp', question)} className="p-1.5 rounded-full hover:bg-green-50" title="WhatsApp">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShareQuestion('telegram', question)} className="p-1.5 rounded-full hover:bg-cyan-50" title="Telegram">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShareQuestion('facebook', question)} className="p-1.5 rounded-full hover:bg-blue-50" title="Facebook">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </button>
                      <button onClick={() => handleQuickShareQuestion('twitter', question)} className="p-1.5 rounded-full hover:bg-gray-100" title="X">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </button>
                    </div>
                  </div>
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

        {/* ✅ BOTÓN VOLVER A TESTS (al final de todo) */}
        {isSubmitted && (
          <div className="mt-8 mb-8 text-center">
            <Link
              href={tema && tema !== 0 ? `/auxiliar-administrativo-estado/test/tema/${tema}` : '/auxiliar-administrativo-estado/test'}
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-md"
            >
              {tema && tema !== 0 ? `← Volver al tema ${tema}` : '← Volver a tests'}
            </Link>
          </div>
        )}
      </div>

      {/* ✅ MODAL DE ARTÍCULO CON RESALTADO INTELIGENTE */}
      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
        // 🎨 Pasar datos de la pregunta para resaltado inteligente
        questionText={selectedQuestionForModal?.question_text}
        correctAnswer={selectedQuestionForModal?.correct_option}
        options={selectedQuestionForModal ? [
          selectedQuestionForModal.option_a,
          selectedQuestionForModal.option_b,
          selectedQuestionForModal.option_c,
          selectedQuestionForModal.option_d
        ] : null}
      />

      {/* 📤 Prompt inteligente para compartir */}
      {showSharePrompt && isSubmitted && (
        <SharePrompt
          score={notaSobre10}
          testSessionId={currentTestSession?.id}
          onClose={() => setShowSharePrompt(false)}
        />
      )}

      {/* 📤 Modal para compartir pregunta individual */}
      <ShareQuestion
        question={shareQuestionData}
        lawName={config?.title || tema || ''}
        isOpen={!!shareQuestionData}
        onClose={() => setShareQuestionData(null)}
      />
    </div>
  )
}
