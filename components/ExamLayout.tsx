
// components/ExamLayout.tsx - MODO EXAMEN (todas las preguntas a la vez)
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { usePathname } from 'next/navigation'
import MarkdownExplanation from './MarkdownExplanation'
import { generateLawSlug } from '@/lib/lawMappingUtils'
import { getOposicionSlugFromPathname } from '@/lib/config/oposiciones'

// Type for useAuth context (AuthContext is JS, so we type it manually)
interface AuthContextValue {
  user: {
    id: string
    email?: string
    user_metadata?: {
      full_name?: string
      name?: string
      avatar_url?: string
    }
  } | null
  userProfile: {
    username?: string
    avatar_url?: string
    current_streak_days?: number
  } | null
  loading: boolean
  supabase: ReturnType<typeof import('@supabase/supabase-js').createClient>
}
import ArticleModal from './ArticleModal'
import QuestionDispute from './QuestionDispute'
import MotivationalMessage from './MotivationalMessage'
import SharePrompt from './SharePrompt'
import ShareQuestion from './ShareQuestion'
import DailyLimitBanner from './DailyLimitBanner'
import UpgradeLimitModal from './UpgradeLimitModal'
import { useDailyQuestionLimit } from '../hooks/useDailyQuestionLimit'

// Imports modularizados
import {
  createDetailedTestSession,
  updateTestScore
} from '../utils/testSession'
import {
  completeDetailedTest,
  formatTime
} from '../utils/testAnalytics'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Estructura de un artículo de ley asociado a una pregunta */
interface QuestionArticle {
  id?: string
  article_number?: string
  laws?: {
    short_name?: string
  }
}

/** Estructura de una pregunta del examen */
interface ExamQuestion {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option?: number // 🔒 Solo disponible en servidor, no se usa en cliente
  explanation?: string
  difficulty?: string
  tema_number?: number
  primary_article_id?: string
  articles?: QuestionArticle
}

/** Configuración del examen */
interface ExamConfig {
  title?: string
  description?: string
  timeLimit?: number
  [key: string]: unknown
}

/** Props del componente ExamLayout */
interface ExamLayoutProps {
  tema: number | string
  testNumber?: number
  config?: ExamConfig
  questions: ExamQuestion[]
  children?: React.ReactNode
  /** ID del test para reanudar (si existe) */
  resumeTestId?: string | null
  /** Respuestas guardadas previamente para reanudar */
  initialAnswers?: Record<number, string> | null
  /** Tipo de oposición para generar URLs correctas */
  positionType?: string
}

/** Respuestas del usuario indexadas por número de pregunta */
type UserAnswers = Record<number, string>

/** Resultado validado de una pregunta individual (de la API) */
interface ValidatedQuestionResult {
  questionId: string
  userAnswer: string | null
  correctAnswer: string
  correctIndex: number
  isCorrect: boolean
  explanation?: string
}

/** Respuesta completa de la API /api/exam/validate */
interface ValidatedResults {
  success: boolean
  results: ValidatedQuestionResult[]
  summary: {
    totalQuestions: number
    totalAnswered: number
    totalCorrect: number
    percentage: number
  }
}

/** Sesión de test */
interface TestSession {
  id: string
  [key: string]: unknown
}

/** Datos del mensaje motivacional */
interface MotivationalData {
  emoji: string
  message: string
  color: string
  bgColor: string
  borderColor: string
}

/** Artículo seleccionado para el modal */
interface SelectedArticle {
  number: string | null
  lawSlug: string | null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * 🆕 API para guardar respuestas en tiempo real (permite reanudar exámenes)
 * 🔒 SEGURIDAD: NO enviamos correctAnswer - solo guardamos la respuesta del usuario
 */
async function saveAnswerToAPI(
  testId: string,
  question: ExamQuestion,
  questionIndex: number,
  selectedOption: string
): Promise<boolean> {
  try {
    const response = await fetch('/api/exam/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId,
        questionId: question.id || null,
        questionOrder: questionIndex + 1, // 1-indexed
        userAnswer: selectedOption,
        // 🔒 SEGURIDAD: correctAnswer se validará en /api/exam/validate al enviar el examen
        questionText: question.question_text || '',
        articleId: question.articles?.id || question.primary_article_id || null,
        articleNumber: question.articles?.article_number || null,
        lawName: question.articles?.laws?.short_name || null,
        temaNumber: question.tema_number || null,
        difficulty: question.difficulty || null,
        timeSpentSeconds: 0, // Se actualizará al corregir
        confidenceLevel: 'sure'
      })
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      console.error('❌ Error guardando respuesta en API:', {
        status: response.status,
        error: result.error,
        questionOrder: questionIndex + 1,
        testId
      })
      return false
    }

    return true
  } catch (error) {
    console.error('❌ Error guardando respuesta en API:', error)
    return false
  }
}

/**
 * 🆕 API para cargar respuestas guardadas (para reanudar exámenes)
 */
async function loadSavedAnswers(testId: string): Promise<UserAnswers | null> {
  try {
    const response = await fetch(`/api/exam/progress?testId=${testId}`)

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    if (result.success && result.answers) {
      return result.answers
    }
    return null
  } catch (error) {
    console.error('❌ Error cargando respuestas guardadas:', error)
    return null
  }
}

/** 🚫 LISTA DE CONTENIDO NO LEGAL (informática) - No mostrar botón "Ver artículo" */
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

/** 🔍 FUNCIÓN: Verificar si es contenido legal (artículo de ley real) */
function isLegalArticle(lawShortName: string | undefined): boolean {
  if (!lawShortName) return false
  return !NON_LEGAL_CONTENT.includes(lawShortName)
}

/** 🎉 FUNCIÓN: Obtener mensaje motivacional según puntuación */
function getMotivationalMessage(notaSobre10: string | number, userName: string | null): MotivationalData {
  const nota = typeof notaSobre10 === 'string' ? parseFloat(notaSobre10) : notaSobre10
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

/** Helper para convertir índice de respuesta a letra (0='A', 1='B', etc.) */
function answerToLetter(index: number | null | undefined): string {
  if (index === null || index === undefined) return '?'
  const letters = ['A', 'B', 'C', 'D']
  return letters[index] || '?'
}

/** Formatear tiempo para el cronómetro */
function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Convertir número de tema interno a número de display
 * Ejemplo: 301 → 1, 402 → 2, pero 1-11 se mantienen igual
 */
function getDisplayTemaNumber(temaNumber: number | string): number {
  const num = typeof temaNumber === 'string' ? parseInt(temaNumber) : temaNumber
  if (isNaN(num)) return 0
  // Bloque I: 1-11 se mantienen
  if (num >= 1 && num <= 99) return num
  // Bloques II-VI: 201→1, 302→2, etc.
  return num % 100
}

// getOposicionSlugFromPathname importado de @/lib/config/oposiciones

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ExamLayout({
  tema,
  testNumber,
  config,
  questions,
  children,
  resumeTestId = null,
  initialAnswers = null,
  positionType
}: ExamLayoutProps) {
  const { user, userProfile, loading: authLoading, supabase } = useAuth() as AuthContextValue
  const {
    hasLimit,
    isLimitReached,
    questionsToday,
    questionsRemaining,
    dailyLimit,
    resetTime,
    loading: limitLoading,
    showUpgradeModal,
    setShowUpgradeModal,
    recordAnswer,
    refreshStatus
  } = useDailyQuestionLimit()

  // Estados del examen
  const [userAnswers, setUserAnswers] = useState<UserAnswers>(initialAnswers || {})
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [startTime] = useState(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isResuming] = useState(!!resumeTestId)

  // 🔒 Estados para límite de preguntas (usuarios FREE)
  const [effectiveQuestions, setEffectiveQuestions] = useState<ExamQuestion[]>(questions || [])
  const [wasLimited, setWasLimited] = useState(false)
  const [originalCount, setOriginalCount] = useState(questions?.length || 0)

  // Estados de sesión
  const [currentTestSession, setCurrentTestSession] = useState<TestSession | null>(null)
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null)

  // Control de guardado
  const [isSaving, setIsSaving] = useState(false)

  // 🔒 SEGURIDAD: Estado para respuestas validadas por API
  const [validatedResults, setValidatedResults] = useState<ValidatedResults | null>(null)

  // Estados del modal de artículo
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<SelectedArticle>({ number: null, lawSlug: null })
  const [selectedQuestionForModal, setSelectedQuestionForModal] = useState<ExamQuestion | null>(null)
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null)

  // 📤 Estado para compartir resultado
  const [showSharePrompt, setShowSharePrompt] = useState(false)

  // 📤 Estado para compartir pregunta individual
  const [shareQuestionData, setShareQuestionData] = useState<ExamQuestion | null>(null)

  // Hook para obtener la URL actual
  const pathname = usePathname()

  // Refs para tracking
  const pageLoadTime = useRef(Date.now())
  const sessionCreationRef = useRef(false)
  const currentTestSessionRef = useRef<TestSession | null>(null)

  // 🔒 LIMITAR PREGUNTAS para usuarios FREE según su límite diario
  useEffect(() => {
    if (limitLoading || !questions?.length) return
    if (isSubmitted) return

    if (!hasLimit) {
      setEffectiveQuestions(questions)
      setWasLimited(false)
      setOriginalCount(questions.length)
      return
    }

    if (isLimitReached || questionsRemaining <= 0) {
      setEffectiveQuestions([])
      setWasLimited(true)
      setOriginalCount(questions.length)
      return
    }

    const maxQuestions = Math.min(questions.length, questionsRemaining)

    if (maxQuestions < questions.length) {
      console.log(`🔒 Limitando examen de ${questions.length} a ${maxQuestions} preguntas`)
      setEffectiveQuestions(questions.slice(0, maxQuestions))
      setWasLimited(true)
      setOriginalCount(questions.length)
    } else {
      setEffectiveQuestions(questions)
      setWasLimited(false)
      setOriginalCount(questions.length)
    }
  }, [questions, hasLimit, isLimitReached, questionsRemaining, limitLoading, isSubmitted])

  // ✅ CRONÓMETRO: Actualizar cada segundo
  useEffect(() => {
    if (isSubmitted) return

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [isSubmitted, startTime])

  // ✅ INICIALIZAR SESIÓN AL MONTAR
  useEffect(() => {
    if (authLoading || !questions?.length) return

    if (sessionCreationRef.current) {
      console.log('⏭️ Sesión de examen ya iniciada, omitiendo (Strict Mode)')
      return
    }

    sessionCreationRef.current = true

    if (resumeTestId) {
      console.log('🔄 Reanudando examen existente:', resumeTestId)
      setCurrentTestSession({ id: resumeTestId })
      currentTestSessionRef.current = { id: resumeTestId }
    } else {
      initializeExamSession()
    }
  }, [authLoading, questions?.length, tema, resumeTestId])

  // ✅ FUNCIÓN: Inicializar sesión de examen
  async function initializeExamSession(): Promise<void> {
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

      const testSessionData = await createDetailedTestSession(
        user?.id || '',
        tema ?? 'exam',
        testNumber || 1,
        questions,
        config,
        startTime,
        pageLoadTime.current,
        null,
        'exam'
      )

      console.log('')
      console.log('📦 Resultado de createDetailedTestSession:')
      console.log('   - testSessionData:', testSessionData)
      console.log('   - testSessionData?.id:', testSessionData?.id)
      console.log('')

      if (testSessionData === null || testSessionData === undefined) {
        console.error('❌ CRITICAL: createDetailedTestSession devolvió null/undefined')
      } else if (!testSessionData.id) {
        console.error('❌ CRITICAL: testSessionData no tiene ID')
      } else {
        console.log('✅ Test session creada con ID:', testSessionData.id)
        currentTestSessionRef.current = testSessionData

        // Las preguntas se guardan en test_questions solo cuando el usuario responde
        // (via saveAnswer en /api/exam/answer). La lista de question_ids se preserva
        // en tests.questions_metadata para poder reanudar el examen.
        console.log(`✅ Examen iniciado con ${questions?.length ?? 0} preguntas (question_ids en metadata)`)
      }

      setCurrentTestSession(testSessionData)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    } catch (error) {
      console.error('❌ EXCEPCIÓN EN initializeExamSession:', error)
    }
  }

  // ✅ FUNCIÓN: Manejar selección de respuesta
  async function handleAnswerSelect(questionIndex: number, option: string): Promise<void> {
    if (isSubmitted) return

    setUserAnswers(prev => ({
      ...prev,
      [questionIndex]: option
    }))

    const testId = currentTestSession?.id || currentTestSessionRef.current?.id
    if (testId && effectiveQuestions[questionIndex]) {
      const question = effectiveQuestions[questionIndex]
      saveAnswerToAPI(testId, question, questionIndex, option)
        .then(success => {
          if (success) {
            console.log(`💾 Respuesta ${questionIndex + 1} guardada en API`)
          }
        })
    }
  }

  // 📤 FUNCIÓN: Compartir pregunta individual directo a redes
  const handleQuickShareQuestion = async (platform: string, question: ExamQuestion): Promise<void> => {
    if (!question) return
    const questionText = question.question_text || ''
    const shortQuestion = questionText.length > 100 ? questionText.substring(0, 100) + '...' : questionText
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=question_share`
    const url = `https://www.vence.es?${utmParams}`
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

    if (user && shareUrl) {
      try {
        await supabase.from('share_events').insert({
          user_id: user.id,
          share_type: 'question_quiz',
          platform: platform,
          share_text: shareText,
          share_url: shareUrl,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          }
        })
        console.log('📤 Share pregunta registrado:', platform)
      } catch (error) {
        console.error('Error registrando share pregunta:', error)
      }
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  // 📤 FUNCIÓN: Compartir resultado directo a redes
  const handleQuickShareResult = async (platform: string): Promise<void> => {
    const nota = isSubmitted ? Math.max(0, ((correctCount - (incorrectCount / 3)) / totalQuestions) * 10).toFixed(2) : '0'
    const utmParams = `utm_source=${platform}&utm_medium=social&utm_campaign=exam_share&utm_content=score_${nota}`
    const url = `https://www.vence.es?${utmParams}`
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

    if (user && shareUrl) {
      try {
        await supabase.from('share_events').insert({
          user_id: user.id,
          share_type: 'exam_result',
          platform: platform,
          score: parseFloat(nota),
          test_session_id: currentTestSession?.id || null,
          share_text: shareText,
          share_url: shareUrl,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          }
        })
        console.log('📤 Share registrado:', platform, nota)
      } catch (error) {
        console.error('Error registrando share:', error)
      }
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }
  }

  // ✅ FUNCIÓN: Corregir examen (VALIDACIÓN SEGURA VIA API)
  async function handleSubmitExam(): Promise<void> {
    if (hasLimit && isLimitReached) {
      setShowUpgradeModal(true)
      return
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 INICIANDO CORRECCIÓN DE EXAMEN (API SEGURA)')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const endTime = Date.now()
    const totalTimeSeconds = Math.round((endTime - startTime) / 1000)

    console.log(`⏱️  Tiempo total: ${totalTimeSeconds} segundos`)
    console.log(`📝 Total preguntas: ${effectiveQuestions.length}`)
    console.log(`📋 Test Session ID: ${currentTestSession?.id || 'NO DISPONIBLE'}`)

    setIsSaving(true)

    try {
      const answersForApi = effectiveQuestions.map((question, index) => ({
        questionId: question.id,
        userAnswer: userAnswers[index] || null
      }))

      console.log('🔒 Enviando respuestas a API /api/exam/validate...')

      // 🔴 FIX: Incluir testId para que la API marque el test como completado
      const testId = currentTestSession?.id || currentTestSessionRef.current?.id
      const response = await fetch('/api/exam/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId, // 🔴 FIX: El test se marca como completado en la API
          answers: answersForApi
        })
      })

      const apiResult: ValidatedResults = await response.json()

      if (!apiResult.success) {
        console.error('❌ Error validando examen:', apiResult)
        setIsSubmitted(true)
        setIsSaving(false)
        return
      }

      setValidatedResults(apiResult)

      const correctCount = apiResult.summary.totalCorrect

      for (let i = 0; i < apiResult.results.length; i++) {
        const result = apiResult.results[i]
        const icon = result.isCorrect ? '✅' : result.userAnswer ? '❌' : '⚪'
        const userAns = result.userAnswer ? result.userAnswer.toUpperCase() : 'SIN RESPUESTA'
        const correctAns = result.correctAnswer.toUpperCase()
        console.log(`${icon} Pregunta ${i + 1}: Usuario=${userAns} | Correcta=${correctAns}`)
      }

      console.log(`📊 RESULTADO: ${correctCount}/${effectiveQuestions.length} correctas`)

      setScore(correctCount)
      setIsSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })

      saveExamInBackground(correctCount, totalTimeSeconds, apiResult).then(async () => {
        console.log('✅ GUARDADO EN SEGUNDO PLANO COMPLETADO')

        if (hasLimit) {
          const answeredCount = Object.keys(userAnswers).length
          for (let i = 0; i < answeredCount; i++) {
            await recordAnswer()
          }
          refreshStatus()
        }
      }).catch(err => {
        console.error('❌ ERROR EN GUARDADO:', err)
      })

    } catch (error) {
      console.error('❌ Error en validación de examen:', error)
      setIsSaving(false)
    }
  }

  // 🔄 FUNCIÓN AUXILIAR: Guardar en segundo plano
  async function saveExamInBackground(
    correctCount: number,
    totalTimeSeconds: number,
    apiResult: ValidatedResults
  ): Promise<void> {
    console.log('💾 INICIANDO GUARDADO EN SEGUNDO PLANO')

    try {
      const timePerQuestion = Math.round(totalTimeSeconds / effectiveQuestions.length)

      interface AnswerData {
        questionIndex: number
        selectedAnswer: number
        correctAnswer: number
        isCorrect: boolean
        timeSpent: number
        confidence: string
        questionData: {
          id: string
          question: string
          options: string[]
          correctAnswer: number
          explanation?: string
          article: {
            id?: string
            number?: string
            law_short_name?: string
          }
          metadata: {
            id: string
            difficulty?: string
            question_type: string
          }
          tema: number | string
        }
      }

      const allAnswers: AnswerData[] = []

      for (let i = 0; i < effectiveQuestions.length; i++) {
        const question = effectiveQuestions[i]
        const selectedOption = userAnswers[i]
        const answerIndex = selectedOption ? selectedOption.charCodeAt(0) - 97 : -1

        const apiResultForQuestion = apiResult?.results?.[i]
        const correctIndex = apiResultForQuestion?.correctIndex ?? 0
        const isCorrect = apiResultForQuestion?.isCorrect ?? false

        const questionData = {
          id: question.id,
          question: question.question_text,
          options: [question.option_a, question.option_b, question.option_c, question.option_d],
          correctAnswer: correctIndex,
          explanation: apiResultForQuestion?.explanation || question.explanation,
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

        const answerData: AnswerData = {
          questionIndex: i,
          selectedAnswer: answerIndex,
          correctAnswer: correctIndex,
          isCorrect: isCorrect,
          timeSpent: timePerQuestion,
          confidence: selectedOption ? 'sure' : 'guessing',
          questionData: questionData
        }

        allAnswers.push(answerData)
      }

      console.log(`✅ ${allAnswers.length} respuestas preparadas para análisis`)

      if (currentTestSession?.id) {
        const scorePercentage = Math.round((correctCount / effectiveQuestions.length) * 100)
        await updateTestScore(currentTestSession.id, scorePercentage)
        console.log(`✅ Score actualizado: ${scorePercentage}%`)
      }

      if (currentTestSession?.id) {
        console.log(`🏁 Marcando test como completado...`)

        const result = await completeDetailedTest(
          currentTestSession.id,
          correctCount,
          allAnswers as any[],
          effectiveQuestions as any[],
          startTime,
          [],
          { user_id: user?.id }
        )

        if (result.success) {
          console.log(`✅ Test completado y analizado en BD`)
        } else {
          console.error(`❌ Error completando test:`, result.status)
        }
      }

      setSaveStatus('success')
      console.log(`💾 Score final: ${correctCount}/${effectiveQuestions.length}`)

      window.dispatchEvent(new CustomEvent('examCompleted'))

    } catch (error) {
      console.error('❌ ERROR CRÍTICO EN GUARDADO:', error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  // ✅ FUNCIÓN: Abrir modal de artículo
  function openArticleModal(
    articleNumber: string | undefined,
    lawName: string | undefined,
    question: ExamQuestion | null = null,
    questionIndex: number | null = null
  ): void {
    const lawSlug = (question as any)?.articles?.laws?.slug || (lawName ? generateLawSlug(lawName) : 'ley-desconocida')
    setSelectedArticle({ number: articleNumber || null, lawSlug })
    setSelectedQuestionForModal(question)
    setSelectedQuestionIndex(questionIndex)
    setModalOpen(true)
  }

  // ✅ FUNCIÓN: Cerrar modal de artículo
  function closeArticleModal(): void {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
    setSelectedQuestionForModal(null)
    setSelectedQuestionIndex(null)
  }

  // ✅ LOADING STATE
  if (limitLoading || !questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando examen...</p>
        </div>
      </div>
    )
  }

  // 🔒 Si el usuario llegó al límite
  if (hasLimit && effectiveQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Límite diario alcanzado</h2>
          <p className="text-gray-600 mb-4">
            Has respondido {dailyLimit} preguntas hoy. El límite se reinicia a medianoche.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold py-3 px-6 rounded-lg"
          >
            ⭐ Hazte Premium
          </button>
          <Link href="/auxiliar-administrativo-estado" className="block mt-3 text-blue-600 hover:underline text-sm">
            ← Volver al menú
          </Link>
        </div>
      </div>
    )
  }

  const totalQuestions = effectiveQuestions.length
  const answeredCount = Object.keys(userAnswers).length
  const accuracy = isSubmitted && totalQuestions > 0 ? (score / totalQuestions * 100).toFixed(1) : 0

  const correctCount = score
  const incorrectCount = answeredCount - score
  const blankCount = totalQuestions - answeredCount

  const puntosBrutos = correctCount - (incorrectCount / 3)
  const notaSobre10 = isSubmitted
    ? Math.max(0, (puntosBrutos / totalQuestions) * 10).toFixed(2)
    : '0'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* ✅ HEADER DEL EXAMEN */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6">
          <div className="mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📝 Modo Examen</h1>
            <p className="text-sm text-gray-600">Tema {tema} - {totalQuestions} preguntas</p>
          </div>

          {wasLimited && totalQuestions > 0 && !isSubmitted && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <span className="font-medium">⚠️ Examen reducido:</span> Solo puedes hacer {totalQuestions} preguntas hoy.
                {' '}
                <button onClick={() => setShowUpgradeModal(true)} className="text-amber-700 underline font-medium">
                  Hazte Premium
                </button>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center px-3 py-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-600 font-medium mb-1">⏱️ Tiempo</div>
              <div className="text-xl sm:text-2xl font-bold text-purple-700 font-mono">
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>

            <div className="text-center px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-xs text-blue-600 font-medium mb-1">📝 Respondidas</div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">
                {answeredCount}/{totalQuestions}
              </div>
            </div>
          </div>

          {!isSubmitted && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              ></div>
            </div>
          )}

          {isSubmitted && (() => {
            const motivationalData = getMotivationalMessage(
              notaSobre10,
              user?.user_metadata?.full_name || user?.email?.split('@')[0] || null
            )
            const showConfetti = parseFloat(notaSobre10) >= 9

            return (
              <div className="relative">
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

                <div className={`relative bg-gradient-to-r ${motivationalData.bgColor} border-2 ${motivationalData.borderColor} rounded-xl p-6 mb-6`}>
                  <div className="text-center mb-4">
                    <div className="text-6xl mb-3 animate-bounce">{motivationalData.emoji}</div>
                    <div className={`text-3xl sm:text-4xl font-bold ${motivationalData.color} mb-4`}>
                      {motivationalData.message}
                    </div>
                    <div className={`text-6xl font-bold ${motivationalData.color} mb-2`}>{notaSobre10}</div>
                    <div className="text-xl text-gray-700 font-medium">sobre 10</div>
                    <div className="text-sm text-gray-500 mt-2">(Cada 3 fallos restan 1 correcta)</div>

                    {/* Compartir resultado - oculto temporalmente */}
                  </div>

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

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">{correctCount}</div>
                    <div className="text-sm text-green-700 font-medium">✅ Correctas</div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">{incorrectCount}</div>
                    <div className="text-sm text-red-700 font-medium">❌ Incorrectas</div>
                    {incorrectCount > 0 && (
                      <div className="text-xs text-red-600 mt-1">(-{(incorrectCount / 3).toFixed(2)} pts)</div>
                    )}
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-gray-600 mb-1">{blankCount}</div>
                    <div className="text-sm text-gray-700 font-medium">⚪ En blanco</div>
                  </div>
                </div>

                {isSaving && (
                  <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Guardando resultados...</span>
                  </div>
                )}
                {!isSaving && saveStatus === 'success' && (
                  <div className="mb-4 text-sm text-green-600 font-medium text-center">✓ Resultados guardados</div>
                )}

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

                <div className="text-center">
                  <Link
                    href={tema && tema !== 0
                      ? `/${getOposicionSlugFromPathname(pathname)}/test/tema/${tema}`
                      : `/${getOposicionSlugFromPathname(pathname)}/test`
                    }
                    className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          {effectiveQuestions.map((question, index) => {
            const selectedOption = userAnswers[index]
            const validatedResult = validatedResults?.results?.[index]
            const correctOptionLetter = validatedResult?.correctAnswer || null
            const isCorrect = validatedResult?.isCorrect ?? false
            const showFeedback = isSubmitted && validatedResult

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

                <div className="mb-6">
                  <p className="text-lg text-gray-900 leading-relaxed">{question.question_text}</p>
                </div>

                <div className="space-y-3">
                  {(['a', 'b', 'c', 'd'] as const).map(option => {
                    const optionKey = `option_${option}` as keyof ExamQuestion
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
                          <span className="font-bold text-gray-700 mr-3">{option.toUpperCase()})</span>
                          <span className="text-gray-900 flex-1">{question[optionKey] as string}</span>
                          {showFeedback && isCorrectOption && (
                            <span className="ml-2 text-green-600 font-bold">✓</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {showFeedback && question.explanation && (
                  <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="font-semibold text-blue-900 mb-3 text-base">📖 Explicación:</div>
                    <MarkdownExplanation
                      content={question.explanation}
                      className="text-blue-800 text-base"
                    />
                    <button
                      onClick={() => {
                        const correctAnswer = validatedResults?.results?.[index]?.correctIndex
                        const correctLetter = answerToLetter(correctAnswer)
                        window.dispatchEvent(new CustomEvent('openAIChat', {
                          detail: {
                            message: `Explícame por qué la respuesta correcta es "${correctLetter}" en la pregunta: "${question.question_text.substring(0, 100)}..."`,
                            suggestion: 'explicar_respuesta'
                          }
                        }))
                      }}
                      className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                    >
                      <span>✨</span>
                      <span>Explicación con chat IA</span>
                    </button>
                  </div>
                )}

                {showFeedback && question.articles && isLegalArticle(question.articles.laws?.short_name) && (
                  <button
                    onClick={() => openArticleModal(
                      question.articles?.article_number,
                      question.articles?.laws?.short_name || 'Ley',
                      question,
                      index
                    )}
                    className="mt-4 text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    Ver 📚 {question.articles.laws?.short_name || 'Ley'} - Artículo {question.articles.article_number}
                    <span className="text-xs">▸</span>
                  </button>
                )}

                {showFeedback && (
                  <div className="flex flex-wrap gap-2 items-center mt-4">
                    <QuestionDispute questionId={question.id} user={user} />
                    {/* Compartir pregunta - oculto temporalmente */}
                    <div className="hidden">
                      <button
                        onClick={() => setShareQuestionData(question)}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
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

        {!isSubmitted && (
          <div className="mt-8 mb-8">
            <button
              onClick={handleSubmitExam}
              disabled={isSaving}
              className={`w-full py-4 rounded-lg font-bold text-white text-lg shadow-lg transition-all ${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-3">
                  <span className="animate-spin inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                  Corrigiendo examen...
                </span>
              ) : (
                <>Corregir Examen ({answeredCount}/{totalQuestions} respondidas)</>
              )}
            </button>
          </div>
        )}

        {isSubmitted && (
          <div className="mt-8 mb-28 text-center">
            <Link
              href={tema && tema !== 0
                ? `/${getOposicionSlugFromPathname(pathname)}/test/tema/${tema}`
                : `/${getOposicionSlugFromPathname(pathname)}/test`
              }
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md"
            >
              {tema && tema !== 0 ? `← Volver al tema ${getDisplayTemaNumber(tema)}` : '← Volver a tests'}
            </Link>
          </div>
        )}
      </div>

      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
        questionText={selectedQuestionForModal?.question_text}
        correctAnswer={selectedQuestionIndex !== null ? validatedResults?.results?.[selectedQuestionIndex]?.correctIndex : null}
        options={selectedQuestionForModal ? [
          selectedQuestionForModal.option_a,
          selectedQuestionForModal.option_b,
          selectedQuestionForModal.option_c,
          selectedQuestionForModal.option_d
        ] : null}
      />

      {showSharePrompt && isSubmitted && (
        <SharePrompt
          score={parseFloat(notaSobre10)}
          testSessionId={currentTestSession?.id}
          onClose={() => setShowSharePrompt(false)}
        />
      )}

      <ShareQuestion
        question={shareQuestionData}
        isOpen={!!shareQuestionData}
        onClose={() => setShareQuestionData(null)}
      />

      {hasLimit && <DailyLimitBanner />}

      <UpgradeLimitModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        questionsAnswered={questionsToday}
        resetTime={resetTime}
        supabase={supabase}
        userId={user?.id}
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name}
      />
    </div>
  )
}
