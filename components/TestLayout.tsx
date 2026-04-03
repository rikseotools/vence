// components/TestLayout.tsx - FIX COMPLETO ANTI-DUPLICADOS
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useQuestionContext } from '../contexts/QuestionContext'
import PersistentRegistrationManager from './PersistentRegistrationManager'
import { usePathname } from 'next/navigation'
import { getOposicionSlugFromPathname } from '@/lib/config/oposiciones'
import { getValidHotArticleTargets } from '@/lib/config/exam-positions'
import QuestionEvolution from './QuestionEvolution'
import QuestionDispute from './QuestionDispute'
import ShareQuestion from './ShareQuestion'
import InteractiveBreadcrumbs from './InteractiveBreadcrumbs'
import MarkdownExplanation from './MarkdownExplanation'

// Imports modularizados
import {
  getDeviceInfo,
  createUserSession,
  createDetailedTestSession,
  updateTestScore
} from '../utils/testSession'
import type { TestSession, UserSession } from '../utils/testSession'
import {
  saveDetailedAnswer,
  saveDetailedAnswerWithRetry,
  calculateConfidence,
  createDetailedAnswer
} from '../utils/testAnswers'
import {
  formatTime
} from '../utils/testAnalytics'
import { testTracker } from '../utils/testTracking'
import { useTestCompletion } from '../hooks/useTestCompletion'
import { useDailyQuestionLimit } from '../hooks/useDailyQuestionLimit'
import { useDailyGoal } from '../hooks/useDailyGoal'
// DailyGoalBanner se muestra en el Header, no aquí (no molestar durante tests)
import { useBotDetection, useBehaviorAnalysis } from '../hooks/useBotDetection'
import { useInteractionTracker } from '../hooks/useInteractionTracker'
import DailyLimitBanner from './DailyLimitBanner'
import AdSenseComponent from './AdSenseComponent'
import UpgradeLimitModal from './UpgradeLimitModal'
import SessionExpiredModal from './SessionExpiredModal'
import { useOposicionPaths } from '@/hooks/useOposicionPaths'
// validateAnswer ya no se usa — validación es client-side
import { completeTestOnServer } from '@/lib/api/v2/complete-test/client'
import { enqueueAnswer } from '@/utils/answerSaveQueue'
import ContentDataRenderer from './ContentDataRenderer'

import type {
  TestQuestion,
  TestLayoutProps,
  TestLayoutConfig,
  AdaptiveCatalog,
  AdaptiveQuestionsInput,
  AnsweredQuestionEntry,
  DetailedAnswerEntry,
  HotArticleInfo,
  CompactStats,
} from './TestLayout.types'

// Type guard para distinguir entre TestQuestion[] y AdaptiveQuestionsInput
function isAdaptiveInput(q: TestQuestion[] | AdaptiveQuestionsInput): q is AdaptiveQuestionsInput {
  return !Array.isArray(q) && (q as AdaptiveQuestionsInput).isAdaptive === true
}

// Helper para convertir índice de respuesta a letra (0='A', 1='B', etc.)
function answerToLetter(index: number | null | undefined): string {
  if (index === null || index === undefined) return '?'
  const letters = ['A', 'B', 'C', 'D']
  return letters[index] || '?'
}

// 🏛️ Helper para verificar si una pregunta oficial es de la oposición del usuario
// MEJORADO: Usa exam_position (estructurado) como primera opción, fallback a exam_source (texto libre)
function isOfficialForUserOposicion(examSource: string | null, userOposicionSlug: string | null, examPosition: string | null = null): boolean {
  if (!userOposicionSlug) return true // Si no hay oposición de usuario, mostrar todo

  const normalizedUserSlug = userOposicionSlug.toLowerCase().replace(/-/g, '_')

  // 🏛️ PRIORIDAD 1: Usar exam_position (campo estructurado, más confiable)
  if (examPosition) {
    const normalizedExamPosition = examPosition.toLowerCase()
    // Mapeo: exam_position de la pregunta → positionTypes que deberían verla
    // TODO: Mover a lib/config/exam-positions.ts cuando se normalicen los datos en BD
    const positionToSlugs: Record<string, string[]> = {
      'auxiliar_administrativo_estado': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
      'auxiliar_administrativo': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
      'auxiliar_administrativo_madrid': ['auxiliar_administrativo_madrid'],
      'tramitacion_procesal': ['tramitacion_procesal'],
      'auxilio_judicial': ['auxilio_judicial'],
      'gestion_procesal': ['gestion_procesal'],
      'cuerpo_general_administrativo': ['cuerpo_general_administrativo', 'administrativo'],
      'cuerpo_gestion_administracion_civil': ['cuerpo_gestion_administracion_civil', 'gestion'],
    }

    const validSlugs = positionToSlugs[normalizedExamPosition]
    if (validSlugs) {
      return validSlugs.some(slug => normalizedUserSlug.includes(slug))
    }
    // Si exam_position no está en el mapeo, asumimos que es válida
    return true
  }

  // 🏛️ FALLBACK: Usar exam_source (texto libre, menos confiable)
  if (!examSource) return true // Si no hay exam_source, asumir que es válida

  // Mapeo de patrones en exam_source a slugs de oposición
  const sourceToOposicion = {
    'Tramitaci': ['tramitacion_procesal'],
    'Auxilio Judicial': ['auxilio_judicial'],
    'Auxiliar Administrativo Madrid': ['auxiliar_administrativo_madrid'],
    'Auxiliar Administrativo': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
    'Auxiliar Admin': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
    'Gestión Procesal': ['gestion_procesal'],
    'Cuerpo General Administrativo': ['cuerpo_general_administrativo'],
    'Cuerpo de Gestión': ['cuerpo_gestion_administracion_civil'],
  }

  // Verificar si el exam_source indica otra oposición
  for (const [pattern, validSlugs] of Object.entries(sourceToOposicion)) {
    if (examSource.includes(pattern)) {
      return validSlugs.some(slug => normalizedUserSlug.includes(slug))
    }
  }

  // Si no coincide con ningún patrón conocido, asumir que es válida
  return true
}

// 🏛️ Helper para formatear exam_source según la oposición del usuario
// Evita mostrar "Tramitación Procesal" a usuarios de Auxiliar Administrativo
function formatExamSource(examSource: string, userOposicionSlug: string | null): string | null {
  if (!examSource) return null

  // Mapeo de patrones a slugs de oposición
  const sourcePatterns = {
    'Tramitaci': ['tramitacion_procesal', 'tramitacion-procesal', 'gestion_procesal', 'gestion-procesal'],
    'Auxilio Judicial': ['auxilio_judicial', 'auxilio-judicial'],
    'Auxiliar Administrativo': ['auxiliar_administrativo', 'auxiliar-administrativo', 'auxiliar_administrativo_estado', 'auxiliar-administrativo-estado'],
    'Gestión Procesal': ['gestion_procesal', 'gestion-procesal'],
  }

  // Verificar si el exam_source coincide con la oposición del usuario
  for (const [pattern, validSlugs] of Object.entries(sourcePatterns)) {
    if (examSource.includes(pattern)) {
      // El exam_source es de esta oposición
      if (validSlugs.some(slug => userOposicionSlug?.includes(slug))) {
        // El usuario está en la misma oposición - mostrar completo
        return examSource
      } else {
        // El usuario está en otra oposición - mostrar genérico
        // No incluir año aquí - se muestra por separado desde exam_date
        return 'Examen oficial'
      }
    }
  }

  // No coincide con ningún patrón conocido - mostrar tal cual
  return examSource
}

// 🚫 LISTA DE CONTENIDO NO LEGAL (informática) - No mostrar artículo ni hot articles
const NON_LEGAL_CONTENT = [
  'Informática Básica',
  'Portal de Internet',
  'La Red Internet',
  'Windows 10',
  'Windows 11',
  'Explorador de Windows',
  'Hojas de cálculo. Excel',
  'Base de datos: Access',
  'Correo electrónico',
  'Procesadores de texto',
  'Administración electrónica y servicios al ciudadano (CSL)',
]

// 🔍 FUNCIÓN: Verificar si es contenido legal (artículo de ley real)
function isLegalArticle(lawShortName: string | null): boolean {
  if (!lawShortName) return false
  return !NON_LEGAL_CONTENT.includes(lawShortName)
}

// 🏛️ FUNCIÓN: Verificar si un hot article es válido para la oposición del usuario
// Usa mapeo centralizado de lib/config/exam-positions.ts
function isHotArticleForUserOposicion(targetOposicion: string | null, userOposicionSlug: string | null): boolean {
  if (!targetOposicion) return true
  if (!userOposicionSlug) return true
  const validTargets = getValidHotArticleTargets(userOposicionSlug)
  return validTargets.includes(targetOposicion.toLowerCase())
}

// 🔒 Validación segura de respuestas: usa lib/api/answers/client.ts
// (validateAnswer importado arriba — timeout 10s, retry x2, Zod)

export default function TestLayout({
  tema,
  testNumber,
  config,
  questions,
  children
}: TestLayoutProps) {
  const { user, loading: authLoading, supabase, isPremium } = useAuth()
  const { setQuestionContext, clearQuestionContext } = useQuestionContext()
  const { notifyTestCompletion } = useTestCompletion()
  const {
    hasLimit,
    isLimitReached,
    questionsToday,
    resetTime,
    showUpgradeModal,
    setShowUpgradeModal,
    recordAnswer
  } = useDailyQuestionLimit()

  // 📊 Meta diaria de estudio (solo para registrar respuestas)
  const { recordAnswerForGoal } = useDailyGoal()

  // 🤖 Detección de bots y análisis de comportamiento (solo usuarios autenticados)
  const { isBot, botScore } = useBotDetection(user?.id ?? null)
  const {
    suspicionScore,
    recordAnswer: recordBehavior
  } = useBehaviorAnalysis(user?.id ?? null)

  // 📊 Tracking de interacciones de usuario
  const { trackTestAction } = useInteractionTracker()

  // 🏛️ Oposición del usuario (para formatear exam_source correctamente)
  const { slug: userOposicionSlug } = useOposicionPaths()

  // 🔒 Sesión expirada durante test
  const [showSessionExpired, setShowSessionExpired] = useState(false)

  // Estados del test básicos
  const [currentQuestion, setCurrentQuestion] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState<boolean>(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState<number | null>(null) // 🔒 Respuesta correcta validada por API
  const [score, setScore] = useState<number>(0)
  const [answeredQuestions, setAnsweredQuestions] = useState<AnsweredQuestionEntry[]>([])
  const [startTime, setStartTime] = useState<number>(Date.now())

  // Estado del modo adaptativo
  const [isAdaptiveMode, setIsAdaptiveMode] = useState<boolean>(false)

  // Estados de tracking avanzado
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now())
  const [firstInteractionTime, setFirstInteractionTime] = useState<number | null>(null)
  const [interactionCount, setInteractionCount] = useState<number>(0)
  const [confidenceLevel, setConfidenceLevel] = useState<string | null>(null)
  const [detailedAnswers, setDetailedAnswers] = useState<DetailedAnswerEntry[]>([])

  // Estados de sesión - SIMPLIFICADOS
  const [currentTestSession, setCurrentTestSession] = useState<TestSession | null>(null)
  const [userSession, setUserSession] = useState<UserSession | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)

  // Control explícito de finalización
  const [isExplicitlyCompleted, setIsExplicitlyCompleted] = useState<boolean>(false)

  // Estado para notificación de guardado exitoso
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string>('')

  // Estados para hot articles
  const [hotArticleInfo, setHotArticleInfo] = useState<HotArticleInfo | null>(null)
  const [showHotAlert, setShowHotAlert] = useState<boolean>(false)

  // 📤 Estado para compartir pregunta
  const [showShareQuestion, setShowShareQuestion] = useState<boolean>(false)

  // 🧠 Estados para modo adaptativo
  const [adaptiveMode, setAdaptiveMode] = useState<boolean>(false)
  const [activeQuestions, setActiveQuestions] = useState<TestQuestion[]>([])
  const [questionPool, setQuestionPool] = useState<TestQuestion[]>([])
  const [adaptiveCatalog, setAdaptiveCatalog] = useState<AdaptiveCatalog | null>(null)
  const [currentDifficulty, setCurrentDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [showCuriosityDetails, setShowCuriosityDetails] = useState<boolean>(false)
  const [currentQuestionUuid, setCurrentQuestionUuid] = useState<string | null>(null)
  const [lastAdaptedQuestion, setLastAdaptedQuestion] = useState<number>(-999) // 🔥 Evitar adaptaciones múltiples seguidas

  // Estados anti-duplicados
  const [validationError, setValidationError] = useState<string | null>(null)
  const [lastProcessedAnswer, setLastProcessedAnswer] = useState<string | null>(null)

  // Estado para configuración de scroll automático
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true)
  const [showScrollFeedback, setShowScrollFeedback] = useState<boolean>(false)

  // Refs para tracking y control
  const pageLoadTime = useRef<number>(Date.now())
  const explanationRef = useRef<HTMLDivElement | null>(null)
  const questionHeaderRef = useRef<HTMLDivElement | null>(null)
  const sessionCreationRef = useRef<Set<string>>(new Set())
  const registrationProcessingRef = useRef<Set<string>>(new Set())

  // Hook para obtener la URL actual
  const pathname = usePathname()
  
  // Detectar si estamos en /test-oposiciones/ para desactivar modal de registro
  const isTestOposicionesSection = pathname?.startsWith('/test-oposiciones/')

  // ✅ MOVER CÁLCULO DE ESTADOS DERIVADOS DESPUÉS DE DECLARACIONES
  // Estados calculados - MOVIDO AQUÍ PARA EVITAR ERRORES DE ORDEN
  // Type narrowing: en modo adaptativo usa activeQuestions (state), en normal usa questions (si es array)
  const effectiveQuestions: TestQuestion[] = adaptiveMode
    ? activeQuestions
    : (Array.isArray(questions) ? questions : questions.activeQuestions)
  const isTestCompleted = isExplicitlyCompleted || (currentQuestion === effectiveQuestions.length - 1 && showResult)
  const currentQ = effectiveQuestions[currentQuestion] as TestQuestion | undefined

  // Helper para formatear nombre de tema (101 → "Bloque II - Tema 1", 1 → "Tema 1")
  const formatTemaName = (temaNumber: number | null | undefined): string => {
    if (!temaNumber) return 'Tema'
    if (temaNumber >= 101) {
      return `Bloque II - Tema ${temaNumber - 100}`
    }
    return `Tema ${temaNumber}`
  }

  // 🔄 PERSISTENCIA DE TEST PARA USUARIOS ANÓNIMOS
  const PENDING_TEST_KEY = 'vence_pending_test'

  // Guardar estado del test en localStorage (solo para usuarios no logueados)
  const savePendingTestState = (newAnsweredQuestions: AnsweredQuestionEntry[], newScore: number, newDetailedAnswers: DetailedAnswerEntry[]): void => {
    if (user) return // No guardar si ya está logueado

    try {
      const pendingTest = {
        tema,
        testNumber,
        config,
        questions: effectiveQuestions?.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correct: q.correct,
          article: q.article,
          metadata: q.metadata
        })),
        currentQuestion,
        answeredQuestions: newAnsweredQuestions,
        score: newScore,
        detailedAnswers: newDetailedAnswers,
        startTime,
        savedAt: Date.now(),
        pageUrl: pathname
      }
      localStorage.setItem(PENDING_TEST_KEY, JSON.stringify(pendingTest))
      console.log('💾 Test guardado en localStorage para usuario anónimo')
    } catch (e) {
      console.warn('⚠️ Error guardando test en localStorage:', e)
    }
  }

  // Limpiar test pendiente (cuando se completa o el usuario se loguea)
  const clearPendingTest = (): void => {
    try {
      localStorage.removeItem(PENDING_TEST_KEY)
      console.log('🗑️ Test pendiente eliminado de localStorage')
    } catch (e) {
      console.warn('⚠️ Error limpiando test pendiente:', e)
    }
  }

  // Limpiar test pendiente cuando el usuario se loguea
  useEffect(() => {
    if (user) {
      // No limpiar inmediatamente - el callback lo procesará
      // Solo limpiar si ya pasaron 5 minutos (test ya fue procesado o abandonado)
      const pendingTest = localStorage.getItem(PENDING_TEST_KEY)
      if (pendingTest) {
        try {
          const parsed = JSON.parse(pendingTest)
          const age = Date.now() - parsed.savedAt
          if (age > 5 * 60 * 1000) { // 5 minutos
            clearPendingTest()
          }
        } catch (e) {
          clearPendingTest()
        }
      }
    }
  }, [user])

  // 🎯 Cargar preferencia de scroll automático desde localStorage
  useEffect(() => {
    const savedPreference = localStorage.getItem('autoScrollEnabled')
    if (savedPreference !== null) {
      setAutoScrollEnabled(savedPreference === 'true')
    }
  }, [])

  // 🧠 CONFIGURAR CATÁLOGO ADAPTATIVO SI ESTÁ DISPONIBLE
  useEffect(() => {
    if (isAdaptiveInput(questions) && questions.adaptiveCatalog) {
      console.log('🧠 DETECTADO CATÁLOGO ADAPTATIVO - Configurando sistema inteligente')
      setAdaptiveCatalog(questions.adaptiveCatalog)
      setAdaptiveMode(true)

      console.log('🧠 Catálogo recibido:', {
        neverSeenEasy: questions.adaptiveCatalog.neverSeen.easy?.length ?? 0,
        neverSeenMedium: questions.adaptiveCatalog.neverSeen.medium?.length ?? 0,
        neverSeenHard: questions.adaptiveCatalog.neverSeen.hard?.length ?? 0
      })
    }
  }, [questions])

  // Validación de props al inicio
  useEffect(() => {

    if (!questions || (Array.isArray(questions) && questions.length === 0)) {
      console.error('❌ TestLayout: No hay preguntas disponibles')
      return
    }

    // ✅ CORRECCIÓN: Validar tema puede ser 0 (válido para artículos dirigidos)
    if (tema === null || tema === undefined || !testNumber || !config) {
      console.error('❌ TestLayout: Props obligatorias faltantes:', { tema, testNumber, config })
      return
    }

    // 🧠 Inicializar modo adaptativo si detectado
    if (isAdaptiveInput(questions)) {
      console.log('🧠 Modo adaptativo disponible (pool cargado)')
      setAdaptiveMode(true)
      setIsAdaptiveMode(false) // 🔥 NO MOSTRAR INDICADOR AL INICIO
      setActiveQuestions(questions.activeQuestions)
      setQuestionPool(questions.questionPool)
      setCurrentDifficulty('medium') // Empezar en nivel medio
      console.log('🧠 Pool cargado:', questions.questionPool.length, 'preguntas')
    } else {
      // Modo normal
      setAdaptiveMode(false)
      setIsAdaptiveMode(false)
      setActiveQuestions(questions as TestQuestion[])
      setQuestionPool([])
    }

  }, [tema, testNumber, config, questions])

  // 🧠 Detectar automáticamente si debe activarse el modo adaptativo
  useEffect(() => {
    if (!adaptiveMode && user && answeredQuestions.length >= 2) {
      // Calcular porcentaje de aciertos en TODO el test hasta ahora
      const correctAnswers = answeredQuestions.filter(q => q.correct).length
      const accuracy = correctAnswers / answeredQuestions.length
      
      // 🧠 SMART LOGIC: Activar indicador cuando detecta bajo rendimiento
      if (accuracy < 0.6 && !isAdaptiveMode && answeredQuestions.length >= 2) {
        console.log(`🧠 Detectado rendimiento bajo (${Math.round(accuracy * 100)}%), ACTIVANDO indicador adaptativo`)
        setIsAdaptiveMode(true) // 🔥 MOSTRAR: Necesita adaptación
        
        // Mostrar mensaje temporal
        setSuccessMessage(`✨ Adaptando las preguntas a tu nivel (${Math.round(accuracy * 100)}% aciertos)`)
        setShowSuccessMessage(true)
        setTimeout(() => setShowSuccessMessage(false), 4000)
      } else if (accuracy >= 0.65 && isAdaptiveMode && answeredQuestions.length >= 3) {
        // 🎯 OCULTAR: Si accuracy mejora significativamente
        console.log(`🎯 Accuracy mejorada a ${Math.round(accuracy * 100)}%, ocultando indicador adaptativo`)
        setIsAdaptiveMode(false) // 🔥 OCULTAR: Ya no necesita adaptación
      }
    }
  }, [answeredQuestions, adaptiveMode, user, isAdaptiveMode])

  // 💬 Actualizar contexto de pregunta para el chat AI
  // 🔒 SEGURIDAD: Solo exponer la respuesta correcta DESPUÉS de que el usuario haya respondido
  useEffect(() => {
    const currentQ = effectiveQuestions?.[currentQuestion]
    if (currentQ) {
      // Guardar ID de pregunta actual en localStorage para detección en FeedbackModal
      try {
        localStorage.setItem('currentQuestionId', currentQ.id)
      } catch (e) {
        // Ignorar errores de localStorage
      }

      // Los fetchers pueden devolver diferentes formatos:
      // - question_text o question (transformado)
      // - option_a/b/c/d o options[] array
      // - law directo o article.law
      setQuestionContext({
        id: currentQ.id,
        question_text: currentQ.question_text || currentQ.question,
        option_a: currentQ.option_a || currentQ.options?.[0],
        option_b: currentQ.option_b || currentQ.options?.[1],
        option_c: currentQ.option_c || currentQ.options?.[2],
        option_d: currentQ.option_d || currentQ.options?.[3],
        // 🔒 Solo exponer la respuesta correcta después de responder
        correct: showResult ? verifiedCorrectAnswer : null,
        explanation: currentQ.explanation,
        law: (currentQ.law || currentQ.article?.law?.short_name || currentQ.article?.law?.name || currentQ.article?.law_short_name || currentQ.article?.law_name) as string | null,
        article_number: currentQ.article_number || currentQ.article?.article_number || currentQ.article?.number,
        difficulty: (currentQ.difficulty || currentQ.metadata?.difficulty) as string | null,
        source: (currentQ.source || currentQ.metadata?.exam_source) as string | null
      })
    }

    // Limpiar contexto al desmontar el componente
    return () => {
      clearQuestionContext()
    }
  }, [currentQuestion, effectiveQuestions, setQuestionContext, clearQuestionContext, showResult, verifiedCorrectAnswer])

  // Guardar respuestas previas al registrarse
  const savePreviousAnswersOnRegistration = async (userId: string, previousAnswers: DetailedAnswerEntry[]): Promise<boolean> => {
    try {
      
      if (previousAnswers.length === 0) {
        return true
      }
      
      // Protección: Verificar que no haya sesión de test ya creada
      if (currentTestSession) {
        console.log('⚠️ Ya existe sesión de test, cancelando guardado de respuestas previas')
        return true
      }
      
      // Protección: Crear sesión SOLO UNA VEZ
      const sessionKey = `${userId}-${tema}-${testNumber}-${startTime}`
      
      if (sessionCreationRef.current.has(sessionKey)) {
        console.log('🚫 SESIÓN YA EN CREACIÓN:', sessionKey)
        return false
      }
      
      sessionCreationRef.current.add(sessionKey)

      try {
        // Crear sesión de test - usar activeQuestions si es modo adaptativo
        const questionsToSave = isAdaptiveInput(questions) ? questions.activeQuestions : questions
        const session = await createDetailedTestSession(userId, tema, testNumber, questionsToSave as any, config as any, startTime, pageLoadTime.current)
        if (!session) {
          console.error('❌ No se pudo crear sesión para respuestas previas')
          return false
        }
        
        setCurrentTestSession(session)
        console.log('✅ Sesión de test creada para respuestas previas:', session.id)
        
        // Guardar todas las respuestas previas
        let savedCount = 0
        for (const answer of previousAnswers) {
          // Verificar que no sea una respuesta duplicada por tiempo
          const existingAnswer = previousAnswers.filter(a => 
            a.questionIndex === answer.questionIndex && 
            a.selectedAnswer === answer.selectedAnswer
          )
          
          if (existingAnswer.length > 1) {
            console.log('🚫 Respuesta duplicada detectada, omitiendo...')
            continue
          }
          
          const success = await saveDetailedAnswer(
            session.id,
            (answer.questionData || {}) as Parameters<typeof saveDetailedAnswer>[1],
            answer as unknown as Parameters<typeof saveDetailedAnswer>[2],
            tema,
            answer.confidence ?? 'unknown',
            answer.interactions ?? 0,
            questionStartTime,
            firstInteractionTime,
            testTracker.interactionEvents,
            testTracker.mouseEvents,
            testTracker.scrollEvents
          )
          if (success && success.action !== 'prevented_duplicate') {
            savedCount++
          }
        }

        // Score = COUNT de aciertos (no porcentaje). El % se deriva en stats.
        await updateTestScore(session.id, score)

        console.log(`✅ Guardadas ${savedCount}/${previousAnswers.length} respuestas previas únicas`)
        
        // Mostrar notificación de éxito
        if (savedCount > 0) {
          setSuccessMessage(`¡Tu progreso anterior (${savedCount} respuestas) ha sido guardado!`)
          setShowSuccessMessage(true)
          
          // Auto-ocultar después de 5 segundos
          setTimeout(() => {
            setShowSuccessMessage(false)
          }, 5000)
        }
        
        return true
        
      } finally {
        sessionCreationRef.current.delete(sessionKey)
      }
      
    } catch (error) {
      console.error('❌ Error guardando respuestas previas:', error)
      return false
    }
  }

  // Función para verificar artículos hot
  const checkHotArticle = async (articleId: string, _userId: string, isOfficialExam: boolean = false): Promise<void> => {
    if (!articleId) return

    try {
      const currentSlug = getOposicionSlugFromPathname(pathname)
      const res = await fetch(`/api/v2/hot-articles/check?${new URLSearchParams({
        articleId,
        userOposicion: userOposicionSlug,
        currentOposicion: currentSlug,
      })}`)

      if (!res.ok) return
      const result = await res.json()

      if (result.success && result.isHot) {
        // Mapear respuesta API al formato de HotArticleInfo
        const hotData: HotArticleInfo = {
          is_hot: true,
          hotness_score: result.hotnessScore,
          priority_level: result.priorityLevel,
          hot_message: result.hotMessage,
          target_oposicion: currentSlug,
          user_oposicion: result.userOposicion,
          also_appears_in_other_oposiciones: result.alsoAppearsInOtherOposiciones,
          other_oposiciones_info: result.otherOposicionesInfo,
          curiosity_message: result.curiosityMessage,
          total_official_appearances: 0,
          unique_exams_count: 0,
          article_number: '',
          law_name: '',
        }

        if (isOfficialExam) {
          setHotArticleInfo({
            ...hotData,
            type: 'official_question',
            hot_message: `PREGUNTA DE EXAMEN OFICIAL\n${hotData.hot_message}`,
            display_title: '¡Esta pregunta apareció en un examen oficial!'
          })
        } else {
          setHotArticleInfo({
            ...hotData,
            type: 'hot_article',
            display_title: '¡Artículo súper importante para memorizar!'
          })
        }

        setShowHotAlert(true)
        setShowCuriosityDetails(false)
      }

    } catch (error) {
      console.error('Error en checkHotArticle:', error)
    }
  }

  // Función para hacer scroll suave al resultado
  const scrollToResult = (): void => {
    if (!autoScrollEnabled) return // 🎯 Respetar preferencia del usuario

    setTimeout(() => {
      if (explanationRef.current) {
        const element = explanationRef.current
        const offsetTop = element.offsetTop - 100
        window.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        })
      }
    }, 150)
  }

  // 🎯 Toggle para activar/desactivar scroll automático
  const toggleAutoScroll = (): void => {
    const newValue = !autoScrollEnabled
    setAutoScrollEnabled(newValue)
    localStorage.setItem('autoScrollEnabled', String(newValue))
    console.log('🎯 Scroll automático:', newValue ? 'ACTIVADO' : 'DESACTIVADO')

    // 🎯 Mostrar feedback temporal
    setShowScrollFeedback(true)
    setTimeout(() => {
      setShowScrollFeedback(false)
    }, 3000)
  }

  // 🔄 NUEVA FUNCIÓN: Guardar respuestas faltantes en segundo plano
  const saveAnswersInBackground = async (sessionId: string, allAnswers: DetailedAnswerEntry[], questions: TestQuestion[], temaId: number, testStartTime: number): Promise<void> => {
    console.log('💾 ═══════════════════════════════════════════')
    console.log('💾 GUARDADO EN SEGUNDO PLANO INICIADO')
    console.log('💾 ═══════════════════════════════════════════')

    try {
      // Obtener qué preguntas ya están guardadas
      const { data: savedQuestions } = await supabase
        .from('test_questions')
        .select('question_order')
        .eq('test_id', sessionId)

      const savedOrders = new Set<number>(savedQuestions?.map((q: any) => q.question_order as number) || [])
      console.log(`📊 Question_orders ya guardados:`, Array.from(savedOrders).sort((a, b) => a - b))

      let savedCount = 0
      let errorCount = 0
      const timePerQuestion = Math.round((Date.now() - testStartTime) / allAnswers.length)

      // Intentar guardar cada respuesta que falta
      for (let i = 0; i < allAnswers.length; i++) {
        const questionOrder = i + 1

        // Si ya está guardada, skip
        if (savedOrders.has(questionOrder)) {
          console.log(`✅ Pregunta ${questionOrder} ya guardada, skip`)
          continue
        }

        const answer = allAnswers[i]
        const question = questions[i]

        console.log(`───────────────────────────────────────────`)
        console.log(`💾 Guardando pregunta ${questionOrder} (faltante)`)

        const questionData = {
          id: question.id,
          question: question.question_text,
          options: [question.option_a, question.option_b, question.option_c, question.option_d],
          correctAnswer: question.correct_option ?? question.correct ?? 0,
          explanation: question.explanation,
          article: {
            id: question.primary_article_id,
            number: question.article_number,
            law_short_name: question.law_short_name
          },
          metadata: {
            id: question.id,
            difficulty: question.difficulty,
            question_type: 'single'
          },
          tema: temaId
        }

        try {
          const result = await saveDetailedAnswer(
            sessionId,
            questionData,
            answer,
            temaId,
            answer.confidence || 'sure',
            0,
            testStartTime,
            null,
            [],
            [],
            []
          )

          if (result?.success) {
            savedCount++
            console.log(`   ✅ Guardada exitosamente`)
          } else {
            errorCount++
            console.error(`   ❌ Error guardando:`, result)
          }
        } catch (err) {
          errorCount++
          console.error(`   ❌ Excepción guardando:`, err)
        }
      }

      console.log('')
      console.log('💾 ═══════════════════════════════════════════')
      console.log(`✅ GUARDADO EN SEGUNDO PLANO COMPLETADO`)
      console.log(`   - Guardadas: ${savedCount}`)
      console.log(`   - Errores: ${errorCount}`)
      console.log('💾 ═══════════════════════════════════════════')

      // return value not used — fire and forget
    } catch (error) {
      console.error('❌ Error en guardado en segundo plano:', error)
    }
  }

  // Compartir rápido sin abrir modal
  const handleQuickShare = async (platform: string): Promise<void> => {
    const currentQ = effectiveQuestions?.[currentQuestion]
    if (!currentQ) return

    const questionText = currentQ.question || ''
    const options = currentQ.options || []
    const questionId = currentQ.id

    const shareText = `🤔 ¿Sabrías responder esta pregunta?\n\n${questionText}\n\nA) ${options[0] || ''}\nB) ${options[1] || ''}\nC) ${options[2] || ''}\nD) ${options[3] || ''}\n\n¿Cuál es la respuesta correcta?`

    const cleanUrl = questionId ? `https://www.vence.es/pregunta/${questionId}` : 'https://www.vence.es'
    const utmUrl = `${cleanUrl}?utm_source=${platform}&utm_medium=social&utm_campaign=question_share`

    let shareUrl = ''

    switch (platform) {
      case 'whatsapp':
        const whatsappLink = cleanUrl.replace('https://', '')
        const whatsappMessage = `${shareText}\n\n${whatsappLink}`
        shareUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
        break
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(cleanUrl)}&text=${encodeURIComponent(shareText)}`
        break
      case 'twitter':
        const twitterText = `🤔 ¿Sabrías responder?\n\n${questionText.substring(0, 180)}${questionText.length > 180 ? '...' : ''}\n\nA, B, C o D?`
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(utmUrl)}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(utmUrl)}&quote=${encodeURIComponent(shareText)}`
        break
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400')
    }

    // Registrar intento de share
    if (user && supabase) {
      try {
        await supabase.from('share_events').insert({
          user_id: user.id,
          share_type: 'question_quiz',
          platform: platform,
          share_text: shareText,
          share_url: cleanUrl,
          device_info: {
            screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
          }
        })
        console.log('📤 Share pregunta registrado:', platform)
      } catch (error) {
        console.error('Error registrando share:', error)
      }
    }
  }

  // Manejar respuesta — validación client-side instantánea + guardado en background
  const handleAnswerClick = (answerIndex: number): void => {
    if (showResult) return

    // Verificar limite diario para usuarios FREE
    if (hasLimit && isLimitReached) {
      setShowUpgradeModal(true)
      return
    }

    if (!effectiveQuestions || !effectiveQuestions[currentQuestion]) {
      console.error('❌ No hay pregunta actual disponible')
      return
    }

    const currentQ = effectiveQuestions[currentQuestion]

    // Anti-duplicados (por índice de pregunta)
    if (answeredQuestions.some(aq => aq.question === currentQuestion)) return

    setSelectedAnswer(answerIndex)
    setInteractionCount(prev => prev + 1)

    // Tracking de interacciones (client-only)
    if (!firstInteractionTime) {
      setFirstInteractionTime(Date.now())
      testTracker.trackInteraction('first_answer_click', { selected_option: answerIndex }, currentQuestion)
    } else {
      testTracker.trackInteraction('answer_change', { from_option: selectedAnswer, to_option: answerIndex }, currentQuestion)
    }
    trackTestAction('answer_selected', currentQ?.id, {
      answerIndex, questionIndex: currentQuestion,
      timeToDecide: Date.now() - questionStartTime, isChange: selectedAnswer !== null
    })

    const timeToDecide = Date.now() - questionStartTime
    const newConfidence = calculateConfidence(timeToDecide, interactionCount)
    setConfidenceLevel(newConfidence)
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
    const responseTimeMs = Date.now() - questionStartTime

    // ═══════════════════════════════════════════════════════════════
    // VALIDACIÓN INSTANTÁNEA CLIENT-SIDE
    // ═══════════════════════════════════════════════════════════════
    const correctOption = currentQ.correct_option ?? currentQ.correct ?? null
    const isCorrect = correctOption !== null && answerIndex === correctOption
    const newScore = isCorrect ? score + 1 : score

    // Actualizar UI inmediatamente — sin esperar al servidor
    if (validationError) setValidationError(null)
    setVerifiedCorrectAnswer(correctOption)
    setShowResult(true)
    scrollToResult()
    setScore(newScore)

    // Tracking de resultado
    if (isCorrect) {
      testTracker.trackInteraction('answer_correct', { time_spent: timeSpent, confidence: newConfidence }, currentQuestion)
    } else {
      testTracker.trackInteraction('answer_incorrect', { time_spent: timeSpent, confidence: newConfidence, correct_answer: correctOption }, currentQuestion)
    }

    // Fraud detection (client-only)
    if (user?.id) recordBehavior(responseTimeMs)

    // Construir datos locales de respuesta
    const detailedAnswer = createDetailedAnswer(
      currentQuestion, answerIndex, correctOption ?? 0, isCorrect,
      timeSpent, currentQ, newConfidence, interactionCount
    ) as unknown as DetailedAnswerEntry

    const newAnsweredQuestions: AnsweredQuestionEntry[] = [...answeredQuestions, {
      question: currentQuestion, selectedAnswer: answerIndex,
      correct: isCorrect, timestamp: new Date().toISOString()
    }]
    const newDetailedAnswers = [...detailedAnswers, detailedAnswer]

    setAnsweredQuestions(newAnsweredQuestions)
    setDetailedAnswers(newDetailedAnswers)
    savePendingTestState(newAnsweredQuestions, newScore, newDetailedAnswers)

    // ═══════════════════════════════════════════════════════════════
    // GUARDADO EN BACKGROUND (fire-and-forget via cola offline)
    // ═══════════════════════════════════════════════════════════════
    const session = currentTestSession
    if (user && session) {
      enqueueAnswer({
        questionId: currentQ.id,
        userAnswer: answerIndex,
        sessionId: session.id,
        questionIndex: currentQuestion,
        questionText: currentQ.question_text || currentQ.question || '',
        options: currentQ.options || [currentQ.option_a, currentQ.option_b, currentQ.option_c, currentQ.option_d].filter(Boolean),
        tema,
        questionType: (currentQ.question_type === 'psychometric' ? 'psychometric' : 'legislative'),
        article: currentQ.article ? {
          id: currentQ.article.id || currentQ.primary_article_id || null,
          number: currentQ.article.number || currentQ.article_number || null,
          law_id: null,
          law_short_name: currentQ.article.law_short_name || currentQ.law_short_name || null,
        } : currentQ.primary_article_id ? {
          id: currentQ.primary_article_id,
          number: currentQ.article_number || null,
          law_id: null,
          law_short_name: currentQ.law_short_name || null,
        } : null,
        metadata: {
          id: currentQ.id,
          difficulty: currentQ.difficulty || null,
          question_type: currentQ.question_type || null,
          tags: null,
        },
        explanation: currentQ.explanation || null,
        timeSpent,
        confidenceLevel: newConfidence,
        interactionCount,
        questionStartTime,
        firstInteractionTime: firstInteractionTime || 0,
        interactionEvents: testTracker.interactionEvents.slice(-10),
        mouseEvents: testTracker.mouseEvents.slice(-50),
        scrollEvents: testTracker.scrollEvents.slice(-50),
        currentScore: score,
      })

      // Registrar respuesta en contador diario (solo usuarios FREE)
      if (hasLimit) recordAnswer().catch(() => {})
      // Registrar para meta diaria (todos los usuarios)
      recordAnswerForGoal()

      // Crear sesión de usuario si no existe
      if (!userSession) {
        createUserSession(user.id).then(s => { if (s) setUserSession(s) }).catch(() => {})
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // MODO ADAPTATIVO (client-only)
    // ═══════════════════════════════════════════════════════════════
    if (adaptiveMode) {
      const totalAnswered = newAnsweredQuestions.length
      const totalCorrect = newAnsweredQuestions.filter(q => q.correct).length
      const currentAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 100
      const questionsSinceLastAdaptation = currentQuestion - lastAdaptedQuestion

      if (currentAccuracy < 60 && totalAnswered >= 3 && questionsSinceLastAdaptation >= 3) {
        setIsAdaptiveMode(true)
        adaptDifficulty('easier')
        setLastAdaptedQuestion(currentQuestion)
        setTimeout(() => setIsAdaptiveMode(false), 4000)
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // FINALIZACIÓN DEL TEST
    // ═══════════════════════════════════════════════════════════════
    const allQuestionsAnswered = newDetailedAnswers.length >= effectiveQuestions.length

    if (currentQuestion === effectiveQuestions.length - 1 || allQuestionsAnswered) {
      setIsExplicitlyCompleted(true)

      trackTestAction('test_completed', undefined, {
        totalQuestions: effectiveQuestions.length, correctAnswers: newScore,
        accuracy: Math.round((newScore / effectiveQuestions.length) * 100),
        totalTimeMs: Date.now() - startTime, testType: tema ? 'tema' : 'general'
      })

      if (user && session) {
        setSaveStatus('saving')

        completeTestOnServer({
          sessionId: session.id,
          finalScore: newScore,
          totalQuestions: effectiveQuestions.length,
          detailedAnswers: newDetailedAnswers.map(a => ({
            questionIndex: a.questionIndex ?? 0,
            selectedAnswer: a.selectedAnswer ?? -1,
            isCorrect: !!a.isCorrect,
            timeSpent: a.timeSpent ?? 0,
            confidence: (['very_sure', 'sure', 'unsure', 'guessing', 'unknown'].includes(a.confidence as string)
              ? a.confidence : 'unknown') as 'very_sure' | 'sure' | 'unsure' | 'guessing' | 'unknown',
            interactions: a.interactions ?? 1,
            questionData: a.questionData ? {
              id: a.questionData.id ?? null,
              metadata: a.questionData.metadata ? {
                difficulty: (['easy', 'medium', 'hard', 'extreme'].includes(a.questionData.metadata.difficulty as string)
                  ? a.questionData.metadata.difficulty : null) as 'easy' | 'medium' | 'hard' | 'extreme' | null,
              } : null,
              article: a.questionData.article ? {
                id: a.questionData.article.id ?? null,
                number: a.questionData.article.number != null ? String(a.questionData.article.number) : null,
                law_short_name: a.questionData.article.law_short_name ?? null,
              } : null,
            } : null,
          })),
          startTime,
          interactionEvents: testTracker.interactionEvents.slice(-500),
          userSessionId: userSession?.id ?? null,
          tema: typeof tema === 'number' ? tema : null,
        })
          .then(result => {
            setSaveStatus(result.status as 'saving' | 'saved' | 'error')
            if (result.success && tema && typeof tema === 'number') {
              const accuracy = Math.round((newScore / effectiveQuestions.length) * 100)
              notifyTestCompletion(tema, accuracy, effectiveQuestions.length).catch(() => {})
            }
          })
          .catch(err => {
            console.error('❌ Error en finalización de test (server-side):', err)
            setSaveStatus('error')
          })
      }
    }

    if (currentQuestion >= effectiveQuestions.length - 1) {
      setIsExplicitlyCompleted(true)
    }

    // Hot article check (client-only, no bloquea)
    const questionLawName = (currentQ.law_short_name || currentQ.article?.law_short_name || currentQ.law) as string | null
    if (user && currentQ.primary_article_id && isLegalArticle(questionLawName)) {
      checkHotArticle(currentQ.primary_article_id, user.id, !!(currentQ.is_official_exam || currentQ.metadata?.is_official_exam)).catch(() => {})
    }
  }

  // Navegación a siguiente pregunta con scroll específico
  const handleNextQuestion = (): void => {
    // Prevenir navegación si ya está completado
    if (isExplicitlyCompleted) {
      console.warn('⚠️ Test ya completado, ignorando navegación')
      return
    }
    
    if (currentQuestion < effectiveQuestions.length - 1) {
      testTracker.trackInteraction('next_question', {
        completed_question: currentQuestion + 1,
        was_correct: selectedAnswer === effectiveQuestions[currentQuestion].correct
      }, currentQuestion)

      // 📊 Tracking de navegación
      trackTestAction('navigation_next', effectiveQuestions[currentQuestion]?.id, {
        fromQuestion: currentQuestion,
        toQuestion: currentQuestion + 1,
        totalQuestions: effectiveQuestions.length
      })

      console.log('📍 Navegando a pregunta:', currentQuestion + 2, '/', effectiveQuestions.length)
      
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowResult(false)
      setVerifiedCorrectAnswer(null) // 🔒 Resetear respuesta verificada
      setValidationError(null) // Limpiar error de validación de pregunta anterior
      setQuestionStartTime(Date.now())
      setFirstInteractionTime(null)
      setInteractionCount(0)
      setConfidenceLevel(null)
      setCurrentQuestionUuid(null) 
      
      // Limpiar localStorage al cambiar de pregunta
      try {
        localStorage.removeItem('currentQuestionId')
      } catch (e) {
        console.warn('⚠️ No se pudo limpiar question_id de localStorage:', e)
      }
      
      // Ocultar alerta hot al cambiar de pregunta
      setShowHotAlert(false)
      setHotArticleInfo(null)
      setShowCuriosityDetails(false)
      
      // 🎯 Scroll específico al header de la nueva pregunta (solo si está habilitado)
      if (autoScrollEnabled) {
        setTimeout(() => {
          if (questionHeaderRef.current) {
            const headerTop = questionHeaderRef.current.offsetTop - 100
            window.scrollTo({
              top: headerTop,
              behavior: 'smooth'
            })
          }
        }, 150)
      }
    } else {
      console.warn('⚠️ Intentando navegar más allá de la última pregunta')
      setIsExplicitlyCompleted(true)
    }
  }

  // Función para calcular estadísticas compactas
  const calculateCompactStats = (): CompactStats => {
    const totalTime = Math.floor((Date.now() - startTime) / 1000)
    const avgTimePerQuestion = Math.round(totalTime / effectiveQuestions.length)
    const percentage = Math.round((score / effectiveQuestions.length) * 100)
    
    // Tiempo por pregunta
    const timeStats = detailedAnswers.map(a => a.timeSpent || 0)
    const fastestTime = timeStats.length > 0 ? Math.min(...timeStats) : 0
    const slowestTime = timeStats.length > 0 ? Math.max(...timeStats) : 0
    
    // Análisis de confianza
    const confidenceStats = detailedAnswers.reduce<Record<string, number>>((acc, answer) => {
      const conf = answer.confidence || 'unknown'
      acc[conf] = (acc[conf] || 0) + 1
      return acc
    }, {})
    
    // Racha de aciertos/fallos
    let currentStreak = 0
    let maxCorrectStreak = 0
    let maxIncorrectStreak = 0
    let tempIncorrectStreak = 0
    
    detailedAnswers.forEach(answer => {
      if (answer.isCorrect) {
        currentStreak++
        maxCorrectStreak = Math.max(maxCorrectStreak, currentStreak)
        tempIncorrectStreak = 0
      } else {
        tempIncorrectStreak++
        maxIncorrectStreak = Math.max(maxIncorrectStreak, tempIncorrectStreak)
        currentStreak = 0
      }
    })
    
    return {
      percentage,
      totalTime,
      avgTimePerQuestion,
      fastestTime,
      slowestTime,
      confidenceStats,
      maxCorrectStreak,
      maxIncorrectStreak,
      efficiency: avgTimePerQuestion <= 60 ? 'Alta' : avgTimePerQuestion <= 120 ? 'Media' : 'Baja'
    }
  }

  // Función para formatear tiempo
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins === 0) return `${secs}s`
    if (secs === 0) return `${mins}m`
    return `${mins}m ${secs}s`
  }

  // ✅ ESCUCHAR CAMBIOS DE USUARIO CON PROTECCIÓN MEJORADA
  useEffect(() => {
    if (!user || authLoading) return

    // Protección global: Evitar ejecución múltiple
    const userRegistrationKey = `registration-${user.id}-${tema}-${testNumber}`
    
    if (registrationProcessingRef.current.has(userRegistrationKey)) {
      console.log('🚫 REGISTRO YA EN PROCESO PARA:', userRegistrationKey)
      return
    }
    
    // Marcar como en proceso
    registrationProcessingRef.current.add(userRegistrationKey)

    // Cleanup function para limpiar flags
    const cleanup = () => {
      registrationProcessingRef.current.delete(userRegistrationKey)
    }

    // Lógica simplificada: Solo crear sesión de usuario si no existe
    const handleUserRegistration = async () => {
      try {
        
        // Si ya hay sesión de test, no hacer nada más
        if (currentTestSession) {
          console.log('✅ Ya hay sesión de test, no se requiere acción')
          cleanup()
          return
        }
        
        // Si hay respuestas detalladas pero no sesión de test = usuario se registró durante test
        if (detailedAnswers.length > 0) {
          console.log('🎉 Usuario se registró durante el test, guardando respuestas previas...')
          const success = await savePreviousAnswersOnRegistration(user.id, detailedAnswers)
          if (success) {
            console.log('✅ Respuestas previas guardadas correctamente')
          }
        }
        
        // Crear sesión de usuario si no existe
        if (!userSession) {
          console.log('🔄 Creando sesión de usuario...')
          const newUserSession = await createUserSession(user.id)
          if (newUserSession) {
            setUserSession(newUserSession)
            console.log('✅ Sesión de usuario creada')
          }
        }
        
      } catch (error) {
        console.error('❌ Error en handleUserRegistration:', error)
      } finally {
        cleanup()
      }
    }

    // Ejecutar con delay para evitar race conditions
    const timeoutId = setTimeout(handleUserRegistration, 100)

    // Cleanup al desmontar
    return () => {
      clearTimeout(timeoutId)
      cleanup()
    }
  }, [user, authLoading])

  // Tracking de eventos del navegador
  useEffect(() => {
    const cleanup = testTracker.setupBrowserTracking(currentQuestion, (type, details) => {
      testTracker.trackInteraction(type, details, currentQuestion)
    })

    return cleanup
  }, [currentQuestion])

  // 🧠 Función INTELIGENTE para adaptar dificultad respetando nunca vistas
  const adaptDifficulty = (direction: 'easier' | 'harder' = 'easier'): void => {
    try {
      if (!adaptiveCatalog) {
        console.log('🧠 Sin catálogo adaptativo - usando sistema legacy')
        return adaptDifficultyLegacy(direction)
      }

      const remainingQuestions = effectiveQuestions.length - currentQuestion - 1
      if (remainingQuestions <= 0) {
        console.log('🧠 No hay preguntas restantes para adaptar')
        return
      }

      // 🔥 CRÍTICO: Obtener IDs de preguntas ya en activeQuestions para excluirlas
      const existingQuestionIds = new Set(effectiveQuestions.map(q => q.id))
      console.log(`🔍 Preguntas ya en test: ${existingQuestionIds.size} IDs`)

      // Determinar dificultad objetivo
      let targetDifficulty: 'easy' | 'medium' | 'hard' = direction === 'easier' ? 'easy' : 'medium'

      console.log(`🧠 ADAPTACIÓN INTELIGENTE: Necesita preguntas ${targetDifficulty}`)

      // 🎯 PRIORIDAD 1: Nunca vistas de la dificultad objetivo (filtrar duplicados)
      const neverSeenTarget = (adaptiveCatalog.neverSeen[targetDifficulty] || [])
        .filter(q => !existingQuestionIds.has(q.id))
      console.log(`   👁️ Nunca vistas ${targetDifficulty} (sin duplicados): ${neverSeenTarget.length}`)

      if (neverSeenTarget.length >= remainingQuestions) {
        console.log(`✅ PERFECTO: Suficientes nunca vistas ${targetDifficulty}`)
        const selectedQuestions = neverSeenTarget.slice(0, remainingQuestions)

        console.log(`📋 Preguntas seleccionadas (IDs): ${selectedQuestions.map(q => q.id).join(', ')}`)
        console.log(`📋 Preguntas seleccionadas (primeras palabras): ${selectedQuestions.map(q => q.question?.substring(0, 30) + '...').join(' | ')}`)

        const newActiveQuestions = [
          ...effectiveQuestions.slice(0, currentQuestion + 1),
          ...selectedQuestions
        ]

        setActiveQuestions(newActiveQuestions)
        setCurrentDifficulty(targetDifficulty)
        console.log(`🧠 Adaptación exitosa: ${selectedQuestions.length} preguntas nunca vistas ${targetDifficulty}`)
        console.log(`🔍 Total preguntas después de adaptar: ${newActiveQuestions.length}`)
        return
      }
      
      // 🎯 PRIORIDAD 2: Combinar nunca vistas de diferentes dificultades (filtrar duplicados)
      console.log(`⚠️ Solo ${neverSeenTarget.length} nunca vistas ${targetDifficulty}, combinando...`)

      const secondaryDifficulty = direction === 'easier' ? 'medium' : 'easy'
      const neverSeenSecondary = (adaptiveCatalog.neverSeen[secondaryDifficulty] || [])
        .filter(q => !existingQuestionIds.has(q.id))

      const allNeverSeen = [
        ...neverSeenTarget,
        ...neverSeenSecondary
      ]

      console.log(`   📊 Total nunca vistas combinadas (sin duplicados): ${allNeverSeen.length}`)

      if (allNeverSeen.length >= remainingQuestions) {
        console.log(`✅ BUENA OPCIÓN: Suficientes nunca vistas combinadas`)
        const selectedQuestions = allNeverSeen.slice(0, remainingQuestions)

        const newActiveQuestions = [
          ...effectiveQuestions.slice(0, currentQuestion + 1),
          ...selectedQuestions
        ]

        setActiveQuestions(newActiveQuestions)
        setCurrentDifficulty(targetDifficulty)
        console.log(`🧠 Adaptación combinada: ${selectedQuestions.length} preguntas nunca vistas mixtas`)
        return
      }

      // 🎯 PRIORIDAD 3: Solo como último recurso - ya respondidas (filtrar duplicados)
      console.log(`⚠️ FALLBACK: Incluyendo algunas preguntas ya respondidas`)
      const answeredTarget = (adaptiveCatalog.answered[targetDifficulty] || [])
        .filter(q => !existingQuestionIds.has(q.id))

      const finalSelection = [
        ...allNeverSeen,
        ...answeredTarget.slice(0, remainingQuestions - allNeverSeen.length)
      ]

      const newActiveQuestions = [
        ...effectiveQuestions.slice(0, currentQuestion + 1),
        ...finalSelection.slice(0, remainingQuestions)
      ]

      setActiveQuestions(newActiveQuestions)
      setCurrentDifficulty(targetDifficulty)

      console.log(`🧠 Adaptación con fallback: ${allNeverSeen.length} nunca vistas + ${finalSelection.length - allNeverSeen.length} ya respondidas`)
      
    } catch (error) {
      console.error('❌ Error en adaptación inteligente:', error)
    }
  }
  
  // 🔄 Sistema legacy para compatibilidad
  const adaptDifficultyLegacy = (direction: 'easier' | 'harder'): void => {
    console.log('🧠 Usando sistema adaptativo legacy')
    // Aquí iría el código original si es necesario
  }

  // Verificación de datos antes de renderizar
  if (!questions || (Array.isArray(questions) && questions.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Sin Preguntas Disponibles</h2>
          <p className="text-gray-600 dark:text-gray-400">TestLayout no recibió preguntas válidas para mostrar.</p>
        </div>
      </div>
    )
  }

  // ✅ CORRECCIÓN: Validar tema puede ser 0 (válido para artículos dirigidos)
  if (tema === null || tema === undefined || !testNumber || !config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">⚙️</span>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">Configuración Incompleta</h2>
          <p className="text-gray-600 dark:text-gray-400">TestLayout requiere tema, testNumber y config válidos.</p>
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            <p>tema: {tema}, testNumber: {testNumber}, config: {config ? 'OK' : 'MISSING'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Componente de notificación hot article
  const HotArticleNotification = (): React.ReactElement | null => {

    if (!showHotAlert || !hotArticleInfo) return null

    // Diferentes estilos según tipo
    const isOfficialQuestion = hotArticleInfo.type === 'official_question'
    const bgColor = isOfficialQuestion 
      ? 'from-purple-600 to-blue-600 dark:from-purple-700 dark:to-blue-700'
      : 'from-orange-500 to-red-500 dark:from-orange-600 dark:to-red-600'

    return (
      <div className={`mb-6 bg-gradient-to-r ${bgColor} text-white p-4 rounded-lg shadow-lg`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Título principal según tipo */}
            <div className="font-bold mb-2 text-lg">
              {String(hotArticleInfo.display_title ?? '')}
            </div>
            
            {/* Mensaje específico */}
            <div className="mb-2 text-sm opacity-90 whitespace-pre-line">
              {hotArticleInfo.hot_message as string}
            </div>

            {/* Botón expandible para curiosidad */}
            {hotArticleInfo.also_appears_in_other_oposiciones && hotArticleInfo.curiosity_message && (
              <div className="mt-3">
                <button
                  onClick={() => setShowCuriosityDetails(!showCuriosityDetails)}
                  className="text-sm underline opacity-90 hover:opacity-100 transition-opacity flex items-center space-x-2"
                >
                  <span>{showCuriosityDetails ? '🔼' : '🔽'}</span>
                  <span>{showCuriosityDetails ? 'Ocultar curiosidad' : 'Ver en qué otras oposiciones aparece'}</span>
                </button>

                {/* Contenido expandible */}
                {showCuriosityDetails && (
                 <div className="mt-3 p-3 bg-black/20 dark:bg-black/40 rounded-lg text-sm">
                    <div className="opacity-95">
                      {hotArticleInfo.curiosity_message as string}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Botón cerrar */}
          <button 
            onClick={() => setShowHotAlert(false)}
            className="text-white hover:text-gray-200 dark:hover:text-gray-300 text-xl font-bold ml-4 opacity-90 hover:opacity-100"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <PersistentRegistrationManager
      tema={tema}
      testNumber={testNumber}
      currentQuestion={currentQuestion}
      totalQuestions={effectiveQuestions.length}
      answeredQuestions={answeredQuestions}
      showResult={showResult}
      score={score}
      startTime={startTime}
      isTestCompleted={isTestCompleted}
      enabled={!isTestOposicionesSection}
      externalUser={user}
      externalAuthLoading={authLoading}
    >
      {/* Fondo con dark mode */}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">

            {/* Migas de pan para navegación */}
            <div className="mb-4">
              <InteractiveBreadcrumbs />
            </div>

            {/* Banner de éxito con dark mode */}
            {showSuccessMessage && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600 text-white p-4 rounded-lg mb-6 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <div className="font-bold">¡Progreso Guardado!</div>
                    <div className="text-sm opacity-90">{successMessage}</div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-white hover:text-gray-200 dark:hover:text-gray-300 text-xl font-bold"
                >
                  ×
                </button>
              </div>
            )}

            {/* Header del test con dark mode */}
            <div className="text-center mb-8">
              <div className={`inline-flex items-center space-x-2 px-4 py-2 rounded-full text-white text-sm font-semibold bg-gradient-to-r ${config.color} mb-4 shadow-lg`}>
                <span>{config.icon}</span>
                <span>{config.name}{config.description ? `: ${config.description}` : ''}</span>
                {user && currentTestSession && <span className="ml-2">💾</span>}
              </div>
              <p className="text-gray-600 dark:text-gray-400">{config.subtitle}</p>
            </div>

            {/* Barra de progreso con dark mode */}
            <div className="mb-8">
              {/* Primera fila: Info de pregunta */}
              <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Pregunta {currentQuestion + 1} de {effectiveQuestions.length}
                  {user && currentTestSession && (
                    <span className="ml-2 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                      ✅ Guardado completo
                    </span>
                  )}
                  {/* ✨ Indicador de modo adaptativo */}
                  {isAdaptiveMode && (
                    <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full animate-pulse">
                      ✨ Adaptándose a tu nivel
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100)}%
                </span>
              </div>

              {/* Segunda fila: Botones de acción */}
              <div className="flex items-center gap-2 mb-2 w-full">
                {/* Botón "Volver a Tests" a la izquierda */}
                {!isTestCompleted && (
                  <button
                    onClick={() => {
                      if (config.customNavigationLinks?.backToLaw) {
                        window.location.href = config.customNavigationLinks.backToLaw.href
                      } else {
                        window.location.href = config.isLawTest ? '/leyes' : `/${getOposicionSlugFromPathname(pathname)}/test`
                      }
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm border border-gray-700"
                  >
                    <span>←</span>
                    <span>{config.customNavigationLinks?.backToLaw?.text || 'Volver a Tests'}</span>
                  </button>
                )}
                {/* 🎯 Botón de configuración de scroll automático a la derecha */}
                <div className="relative flex-1">
                  <button
                    onClick={toggleAutoScroll}
                    title={autoScrollEnabled ? 'Desactivar scroll automático' : 'Activar scroll automático'}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm border ${
                      autoScrollEnabled
                        ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600 hover:shadow-md'
                        : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <span className="text-sm">{autoScrollEnabled ? '📜' : '🚫'}</span>
                    <span>{autoScrollEnabled ? 'Auto-scroll' : 'No scroll'}</span>
                  </button>
                  {/* 🎯 Feedback temporal */}
                  {showScrollFeedback && (
                    <div className={`absolute top-full mt-2 right-0 px-3 py-2 rounded-lg shadow-lg text-xs font-medium whitespace-nowrap z-50 ${
                      autoScrollEnabled
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-white'
                    }`}>
                      {autoScrollEnabled
                        ? '✅ Scroll automático activado'
                        : '⏸️ No scroll al responder'}
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div 
                  className={`bg-gradient-to-r ${config.color} h-3 rounded-full transition-all duration-500`}
                  style={{ width: `${((currentQuestion + (showResult ? 1 : 0)) / effectiveQuestions.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Contenido principal con dark mode */}
            <div 
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-gray-900/20 p-8 mb-8 border border-gray-100 dark:border-gray-700"
              data-question-id={currentQuestionUuid || effectiveQuestions[currentQuestion]?.id}
            >
              
              {/* Pregunta actual con dark mode */}
              <div className="mb-6">
                <div className="mb-4">
                  <h2
                    ref={questionHeaderRef}
                    className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2"
                  >
                    Pregunta {currentQuestion + 1}
                  </h2>
                  {/* 🚫 ELIMINADO: No mostrar artículo antes de responder (da pistas) */}
                </div>
                
                {/* Contenido visual: imagen, tabla, instrucciones */}
                <ContentDataRenderer
                  contentData={currentQ?.content_data as Record<string, unknown> | null}
                  imageUrl={currentQ?.image_url as string | null}
                />

                <div
                  className="prose max-w-none dark:prose-invert select-none"
                  onCopy={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <p className="text-lg text-gray-800 dark:text-gray-200 leading-relaxed">
                    {currentQ?.question}
                  </p>
                </div>
              </div>

              {/* Opciones de respuesta con dark mode - Anti-copia */}
              <div
                className="space-y-3 mb-6 select-none"
                onCopy={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              >
                {currentQ?.options?.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => !showResult && handleAnswerClick(index)}
                    disabled={showResult}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      showResult && verifiedCorrectAnswer !== null
                        ? index === verifiedCorrectAnswer
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer
                          ? 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        : selectedAnswer === index
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-800 dark:text-gray-200'
                    } ${!showResult ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="inline-flex items-center">
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-sm font-bold mr-3 ${
                        showResult && verifiedCorrectAnswer !== null
                          ? index === verifiedCorrectAnswer
                            ? 'border-green-500 bg-green-500 text-white'
                            : index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer
                            ? 'border-red-500 bg-red-500 text-white'
                            : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                          : selectedAnswer === index
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-500 text-gray-600 dark:text-gray-400'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      {option}
                    </span>
                    
                    {showResult && verifiedCorrectAnswer !== null && (
                      <span className="float-right">
                        {index === verifiedCorrectAnswer ? (
                          <span className="text-green-600 dark:text-green-400">✅</span>
                        ) : index === selectedAnswer && selectedAnswer !== verifiedCorrectAnswer ? (
                          <span className="text-red-600 dark:text-red-400">❌</span>
                        ) : null}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Error de validación API */}
              {validationError && !showResult && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm text-center">
                  {validationError}
                </div>
              )}

              {/* Botones de respuesta rápida A/B/C/D + Compartir - Solo si no se ha respondido */}
              {!showResult && currentQ?.options && (
                <div className="mb-6">
                  {/* Botones A/B/C/D */}
                  <div className="flex justify-center space-x-4">
                    {currentQ.options.map((option, index) => (
                      <button
                        key={`quick-${index}`}
                        onClick={() => handleAnswerClick(index)}
                        className={`w-14 h-14 rounded-lg border-2 font-bold text-lg transition-all duration-200 ${
                          selectedAnswer === index
                            ? 'border-blue-600 bg-blue-600 text-white shadow-lg transform scale-110'
                            : 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800/30 text-blue-700 dark:text-blue-300 hover:shadow-lg'
                        }`}
                      >
                        {String.fromCharCode(65 + index)}
                      </button>
                    ))}
                  </div>
                  {/* 📤 Compartir pregunta - oculto temporalmente */}
                </div>
              )}

              {/* Resultado y explicación con dark mode */}
              {showResult && (
                <div>
                  {/* Ref aquí - justo donde terminan las preguntas */}
                  <div ref={explanationRef}></div>
                  
                  <div className="border-t dark:border-gray-600 pt-6">
                    <div className={`p-4 rounded-lg mb-4 ${
                      selectedAnswer === verifiedCorrectAnswer
                        ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700'
                        : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700'
                    }`}>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">
                          {selectedAnswer === verifiedCorrectAnswer ? '🎉' : '😔'}
                        </span>
                        <span className={`font-bold ${
                          selectedAnswer === verifiedCorrectAnswer
                            ? 'text-green-800 dark:text-green-300'
                            : 'text-red-800 dark:text-red-300'
                        }`}>
                          {selectedAnswer === verifiedCorrectAnswer ? '¡Correcto!' : 'Incorrecto'}
                        </span>
                      </div>
                      <p className={`text-sm ${
                        selectedAnswer === verifiedCorrectAnswer
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}>
                        La respuesta correcta es: <strong>{verifiedCorrectAnswer !== null ? String.fromCharCode(65 + verifiedCorrectAnswer) : '?'}</strong>
                      </p>
                    </div>

                    {/* Explicación con dark mode - Anti-copia */}
                    {Boolean(currentQ?.explanation) && (
                      <div
                        className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 select-none"
                        onCopy={(e) => e.preventDefault()}
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                      >
                        {/* Header con título y botón IA arriba a la derecha */}
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-blue-800 dark:text-blue-300">📖 Explicación:</h4>
                          <button
                            onClick={() => {
                              const questionText = currentQ?.question_text || currentQ?.question || ''
                              const correctLetter = answerToLetter(verifiedCorrectAnswer)
                              window.dispatchEvent(new CustomEvent('openAIChat', {
                                detail: {
                                  message: `Explícame por qué la respuesta correcta es "${correctLetter}" en la pregunta: "${questionText.substring(0, 100)}..."`,
                                  suggestion: 'explicar_respuesta'
                                }
                              }))
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-medium"
                          >
                            <span>✨</span>
                            <span>Explicación con chat IA</span>
                          </button>
                        </div>

                        <MarkdownExplanation
                          content={currentQ!.explanation as string}
                          className="text-blue-700 dark:text-blue-400 text-sm"
                        />

                        {/* 🤖 Botón también al final de la explicación */}
                        <button
                          onClick={() => {
                            const questionText = currentQ?.question_text || currentQ?.question || ''
                            const correctLetter = answerToLetter(verifiedCorrectAnswer)
                            window.dispatchEvent(new CustomEvent('openAIChat', {
                              detail: {
                                message: `Explícame por qué la respuesta correcta es "${correctLetter}" en la pregunta: "${questionText.substring(0, 100)}..."`,
                                suggestion: 'explicar_respuesta'
                              }
                            }))
                          }}
                          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <span>✨</span>
                          <span>Explicación con chat IA</span>
                        </button>
                      </div>
                    )}

                    {/* Información de procedencia oficial - Solo si es de la oposición del usuario */}
                      {!!currentQ?.metadata?.is_official_exam && isOfficialForUserOposicion(currentQ?.metadata?.exam_source as string | null, userOposicionSlug, currentQ?.metadata?.exam_position as string | null) && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">🏛️</div>
                            <div className="flex-1">
                              <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">
                                Pregunta de Examen Oficial Real
                              </h4>
                              <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                                {!!currentQ.metadata!.exam_source && (() => {
                                  const sources = (currentQ.metadata!.exam_source as string).split(' | ').map(s => formatExamSource(s.trim(), userOposicionSlug)).filter(Boolean)
                                  return sources.length > 0 && (
                                    <div className="flex items-start space-x-2">
                                      <span className="mt-0.5">📋</span>
                                      <div>
                                        <strong>Examen{sources.length > 1 ? 'es' : ''}:</strong>
                                        {sources.map((s, i) => (
                                          <div key={i}>{s}</div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })()}
                                {!!currentQ.metadata!.exam_date && (
                                  <div className="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span><strong>Año:</strong> {new Date(currentQ.metadata!.exam_date as string).getFullYear()}</span>
                                  </div>
                                )}
                                {!!currentQ.metadata!.exam_entity && (
                                  <div className="flex items-center space-x-2">
                                    <span>🏢</span>
                                    <span><strong>Oposición:</strong> {currentQ.metadata!.exam_entity as string}</span>
                                  </div>
                                )}
                                <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs text-purple-800 dark:text-purple-300">
                                  <strong>💡 Valor especial:</strong> Esta pregunta apareció textualmente en un examen oficial. 
                                  Dominar este tipo de preguntas es crucial para tu preparación.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 🆕 ADEMÁS - Para artículos que aparecen en exámenes (aunque esta pregunta específica no sea oficial) */}
                      {/* Solo mostrar si is_hot=true (ya filtrado por oposición del usuario en la función RPC) */}
                      {!currentQ?.metadata?.is_official_exam && currentQ?.primary_article_id && hotArticleInfo?.is_hot && (
                        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">🔥</div>
                            <div className="flex-1">
                              <h4 className="font-bold text-orange-800 dark:text-orange-300 mb-2">
                                Artículo Muy Importante para Exámenes
                              </h4>
                              <div className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
                                {hotArticleInfo.hot_message && (
                                  <div className="whitespace-pre-line">
                                    {hotArticleInfo.hot_message.replace(/🔥+\s*/g, '')}
                                  </div>
                                )}
                                <div className="mt-3 p-2 bg-orange-100 dark:bg-orange-800/30 rounded text-xs text-orange-800 dark:text-orange-300">
                                  <strong>🎯 Recomendación:</strong> Este artículo ha aparecido múltiples veces en exámenes oficiales.
                                  Asegúrate de dominarlo completamente.
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Botón de impugnación */}
                    <QuestionDispute
                      questionId={currentQuestionUuid || effectiveQuestions[currentQuestion]?.id}
                      user={user}
                    />

                    {/* Notificación de artículo hot */}
                    <HotArticleNotification />

                    {/* Sección de navegación y finalización actualizada */}
                      <div className="mb-6">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          {confidenceLevel && (
                            <span>🎯 Confianza: {
                              confidenceLevel === 'very_sure' ? 'Muy seguro' :
                              confidenceLevel === 'sure' ? 'Seguro' :
                              confidenceLevel === 'unsure' ? 'Inseguro' :
                              'Adivinando'
                            }</span>
                          )}
                        </div>

                        {/* Anuncio AdSense después de cada respuesta - Solo usuarios FREE */}
                        {!isPremium && currentQuestion > 0 && (
                          <div className="my-6 text-center">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Publicidad</p>
                            <AdSenseComponent
                              adType="TEST_AFTER_ANSWER"
                              className="max-w-lg mx-auto"
                            />
                          </div>
                        )}

                        {/* Condición mejorada: Solo mostrar botón si NO es la última pregunta */}
                        {!isExplicitlyCompleted && currentQuestion < effectiveQuestions.length - 1 ? (
                          <div className="space-y-3">
                            <button
                              onClick={handleNextQuestion}
                              className={`w-full px-6 py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl text-lg`}
                            >
                              Siguiente Pregunta → ({currentQuestion + 2}/{effectiveQuestions.length})
                            </button>
                            {/* 📤 Compartir - oculto temporalmente */}
                          </div>
                      ) : (
                        /* Pantalla de finalización con estadísticas compactas */
                        <div className="text-center w-full">

                          {/* Título de finalización */}
                          <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
                            🏁 ¡Test Completado!
                          </div>
                          
                          {/* Puntuación destacada */}
                          <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                            {score}/{effectiveQuestions.length}
                          </div>
                          
                          {/* Porcentaje principal */}
                          <div className="text-xl text-gray-600 dark:text-gray-400 mb-4">
                            {Math.round((score / effectiveQuestions.length) * 100)}% de aciertos
                          </div>

                          {/* Estadísticas compactas y de valor */}
                          {(() => {
                            const stats = calculateCompactStats()
                            return (
                              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  {/* Tiempo total */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">⏱️</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Tiempo</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {formatTime(stats.totalTime)}
                                    </div>
                                  </div>

                                  {/* Tiempo promedio */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">📊</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Promedio</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {formatTime(stats.avgTimePerQuestion)}
                                    </div>
                                  </div>

                                  {/* Eficiencia */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">⚡</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Eficiencia</div>
                                    <div className={`font-semibold ${
                                      stats.efficiency === 'Alta' ? 'text-green-600 dark:text-green-400' :
                                      stats.efficiency === 'Media' ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-red-600 dark:text-red-400'
                                    }`}>
                                      {stats.efficiency}
                                    </div>
                                  </div>

                                  {/* Racha máxima */}
                                  <div className="text-center">
                                    <div className="font-bold text-gray-800 dark:text-gray-200">🔥</div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">Racha</div>
                                    <div className="font-semibold text-gray-700 dark:text-gray-300">
                                      {stats.maxCorrectStreak > 0 ? `${stats.maxCorrectStreak} ✅` : '0'}
                                    </div>
                                  </div>
                                </div>

                                {/* Detalles adicionales en una línea compacta */}
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 flex justify-center space-x-4">
                                  {stats.fastestTime > 0 && (
                                    <span>🚀 Más rápida: {formatTime(stats.fastestTime)}</span>
                                  )}
                                  {stats.slowestTime > 0 && (
                                    <span>🐌 Más lenta: {formatTime(stats.slowestTime)}</span>
                                  )}
                                  {stats.confidenceStats.very_sure > 0 && (
                                    <span>🎯 Seguras: {stats.confidenceStats.very_sure}</span>
                                  )}
                                </div>
                              </div>
                            )
                          })()}
                          
                          {/* Mensaje de guardado si aplica */}
                          {saveStatus === 'saved' && (
                            <div className="text-sm text-green-600 dark:text-green-400 mb-4 flex items-center justify-center space-x-2">
                              <span>✅</span>
                              <span>Progreso guardado en tu perfil</span>
                            </div>
                          )}
                          
                          {/* Mensaje motivacional basado en puntuación */}
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            {score === effectiveQuestions.length ? (
                              "🎉 ¡Perfecto! Dominas este tema completamente"
                            ) : score >= Math.ceil(effectiveQuestions.length * 0.8) ? (
                              "🎯 ¡Excelente! Muy buen dominio del tema"
                            ) : score >= Math.ceil(effectiveQuestions.length * 0.6) ? (
                              "👍 ¡Bien! Sigue practicando para mejorar"
                            ) : (
                              "📚 Repasa el temario y vuelve a intentarlo"
                            )}
                          </div>

                          {/* Anuncio AdSense al finalizar test - Solo usuarios FREE */}
                          {!isPremium && (
                            <div className="my-8 text-center">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Publicidad</p>
                              <AdSenseComponent
                                adType="TEST_COMPLETION"
                                className="max-w-2xl mx-auto"
                              />
                            </div>
                          )}

                          {/* Botón de revisar fallos */}
                          {currentTestSession && score < effectiveQuestions.length && (
                            <div className="mb-4">
                              <Link
                                href={`/revisar/${currentTestSession.id}`}
                                className="inline-flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold text-white transition-all bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg hover:shadow-xl text-base"
                              >
                                <span>📊</span>
                                <span>Revisar fallos</span>
                              </Link>
                            </div>
                          )}
                          {/* Si test perfecto, mostrar repetir */}
                          {score === effectiveQuestions.length && (
                            <div className="mb-4">
                              <button
                                onClick={() => window.location.reload()}
                                className="inline-flex items-center space-x-2 px-8 py-3 rounded-lg font-semibold text-white transition-all bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl text-base"
                              >
                                <span>🎉</span>
                                <span>Repetir test</span>
                              </button>
                            </div>
                          )}

                          {/* Botones de navegación */}
                          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">

                            {/* ✅ LÓGICA CONDICIONAL PARA TESTS DE LEY vs TESTS DE TEMA */}
                            {(config?.isLawTest || tema === 0) ? (
                              // 🏛️ NAVEGACIÓN PARA TESTS DE LEY
                              <>
                                {/* Botón principal: Volver a la ley específica */}
                                {config.customNavigationLinks?.backToLaw && (
                                  <Link
                                    href={config.customNavigationLinks.backToLaw.href}
                                    className={`px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto`}
                                  >
                                    <span>📚</span>
                                    <span className="text-center">{config.customNavigationLinks.backToLaw.label}</span>
                                  </Link>
                                )}
                                
                                {/* Botón secundario: Ir a tests por tema */}
                                {config.customNavigationLinks?.backToTests && (
                                  <Link
                                    href={config.customNavigationLinks.backToTests.href}
                                    className="px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base w-full sm:w-auto"
                                  >
                                    <span>🗂️</span>
                                    <span>{config.customNavigationLinks.backToTests.label}</span>
                                  </Link>
                                )}

                                {/* Botón terciario: Volver al temario (si viene de estudiar) */}
                                {config.customNavigationLinks?.backToTemario && (
                                  <Link
                                    href={config.customNavigationLinks.backToTemario.href}
                                    className="px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base w-full sm:w-auto"
                                  >
                                    <span>📖</span>
                                    <span>{config.customNavigationLinks.backToTemario.label}</span>
                                  </Link>
                                )}

                                {/* Fallback para tema = 0 sin customNavigationLinks */}
                                {tema === 0 && !config.customNavigationLinks?.backToLaw && (
                                  <Link
                                    href={config.isLawTest ? "/leyes" : `/${getOposicionSlugFromPathname(pathname)}/test`}
                                    className={`px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color || 'from-blue-500 to-cyan-600'} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base w-full sm:w-auto`}
                                  >
                                    <span>📚</span>
                                    <span>{config.isLawTest ? "Volver a Leyes" : "Volver a Tests"}</span>
                                  </Link>
                                )}
                              </>
                            ) : (
                              // 🎯 NAVEGACIÓN ORIGINAL PARA TESTS DE TEMA
                              <>
                                {/* Botón principal: Volver al Tema */}
                                <Link
                                  href={`/${getOposicionSlugFromPathname(pathname)}/test/tema/${tema}`}
                                  className={`px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base w-full sm:w-auto`}
                                >
                                  <span>📚</span>
                                  <span>Volver al {formatTemaName(tema)}</span>
                                </Link>
                                
                                {/* Botón secundario: Ir a Otros Temas */}
                                <Link
                                  href={`/${getOposicionSlugFromPathname(pathname)}/test`}
                                  className="px-8 py-4 rounded-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                                >
                                  <span>🗂️</span>
                                  <span>Ver Otros Temas</span>
                                </Link>
                              </>
                            )}
                            
                          </div>
                          
                          {/* Información adicional para motivar */}
                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                              {user ? (
                                <div>💾 Tu progreso se guarda automáticamente</div>
                              ) : !authLoading ? (
                                <div>
                                  <span>👤 </span>
                                  <button
                                    onClick={() => window.location.href = '/login'}
                                    className="underline hover:text-blue-600 dark:hover:text-blue-400"
                                  >
                                    Regístrate gratis
                                  </button>
                                  <span> para guardar tu progreso</span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Evolución de la pregunta - sección unificada */}
                    {user && currentQuestionUuid && (
                      <>
                        {/* QuestionEvolution - Evolución compacta */}
                        <QuestionEvolution
                          userId={user.id}
                          questionId={currentQuestionUuid}
                          currentResult={{
                            is_correct: verifiedCorrectAnswer !== null && selectedAnswer === verifiedCorrectAnswer,
                            timeSpent: Math.round((Date.now() - questionStartTime) / 1000),
                            confidence: confidenceLevel
                          }}
                        />
                      </>
                    )}

                    {/* Información del artículo desplegable (solo si es contenido legal) */}
                    {currentQ?.article?.full_text && isLegalArticle(currentQ.article.law_short_name ?? null) && (
                      <ArticleDropdown
                        article={currentQ.article}
                        currentQuestion={currentQ}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            

            {/* Children para contenido personalizado */}
            {children}
          </div>
        </main>

      </div>

      {/* 📤 Modal para compartir pregunta */}
      {effectiveQuestions && effectiveQuestions[currentQuestion] && (
        <ShareQuestion
          question={effectiveQuestions[currentQuestion]}
          isOpen={showShareQuestion}
          onClose={() => setShowShareQuestion(false)}
        />
      )}

      {/* Banner de limite diario (solo usuarios FREE) */}
      {hasLimit && <DailyLimitBanner />}

      {/* Banner de meta diaria se muestra en el Header, no durante tests */}

      {/* Modal de upgrade cuando se alcanza el limite */}
      <UpgradeLimitModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        questionsAnswered={questionsToday}
        resetTime={resetTime}
        supabase={supabase}
        userId={user?.id}
        userName={user?.user_metadata?.full_name || user?.user_metadata?.name}
      />

      {/* Celebración de meta diaria se maneja via confetti en DailyGoalBanner (Header) */}

      {/* Modal de sesión expirada durante test */}
      <SessionExpiredModal
        isOpen={showSessionExpired}
        onReLogin={() => {
          setShowSessionExpired(false)
          window.location.href = '/login'
        }}
        onDismiss={() => setShowSessionExpired(false)}
      />
    </PersistentRegistrationManager>
  )
}

// Componente para mostrar artículo desplegable con resaltado inteligente
interface ArticleDropdownProps {
  article: NonNullable<import('./TestLayout.types').LegacyQuestion['article']>
  currentQuestion: TestQuestion
}

function ArticleDropdown({ article, currentQuestion }: ArticleDropdownProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  // Función para extraer palabras clave de la pregunta y respuesta correcta
  const extractKeywords = (question: string | undefined, correctAnswer: number | null | undefined, options: string[] | undefined): string[] => {
    const keywords = new Set<string>()
    
    // Extraer palabras clave de la pregunta (filtrar palabras comunes)
    const questionWords = question
      ?.toLowerCase()
      .replace(/[¿?¡!,.:;]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['tienen', 'como', 'para', 'sobre', 'entre', 'según', 'donde', 'cuando', 'cual', 'esta', 'este', 'estos', 'estas', 'pero', 'sino', 'aunque'].includes(word)
      ) || []
    
    questionWords.forEach(word => keywords.add(word))
    
    // Extraer palabras clave de la respuesta correcta
    const correctAnswerText = correctAnswer != null ? options?.[correctAnswer] : undefined
    if (correctAnswerText) {
      const answerWords = correctAnswerText
        .toLowerCase()
        .replace(/[,.:;]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 3)

      answerWords.forEach((word: string) => keywords.add(word))
    }
    
    return Array.from(keywords).filter(word => word.length > 2)
  }

  // Función para formatear texto plano a HTML legible con resaltado inteligente
  const formatTextContent = (content: string | null | undefined, question: string | undefined, correctAnswer: number | null | undefined, options: string[] | undefined): string => {
    if (!content) return 'Contenido no disponible'
    
    let formattedContent = content
      // Convertir saltos de línea a <br>
      .replace(/\n/g, '<br>')
      // Convertir números de punto (1., 2., etc.) en párrafos numerados
      .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
      // Convertir letras de punto (a), b), etc.) en sub-párrafos  
      .replace(/([a-z]\)\s)/g, '<br>&nbsp;&nbsp;<strong>$1</strong>')
      // Agregar espaciado después de puntos finales seguidos de mayúscula
      .replace(/\.\s+(?=[A-Z])/g, '.<br><br>')
      // Limpiar múltiples <br> consecutivos
      .replace(/(<br>\s*){3,}/g, '<br><br>')
      // Limpiar <br> al inicio
      .replace(/^(<br>\s*)+/, '')

    // NUEVO: Resaltar específicamente partes clave según el tipo de pregunta
    
    // Para preguntas sobre alto cargo
    if (question?.toLowerCase().includes('alto cargo') || question?.toLowerCase().includes('condición')) {
      const specificHighlights = [
        {
          pattern: /(Los órganos superiores y directivos tienen además la condición de alto cargo, excepto los Subdirectores generales y asimilados[^.]*\.)/gi,
          replacement: '<mark style="background-color: #fef3c7; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #92400e; border-left: 4px solid #f59e0b;">🎯 $1</mark>'
        },
        {
          pattern: /(excepto los Subdirectores generales y asimilados)/gi,
          replacement: '<mark style="background-color: #fee2e2; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #dc2626;">⚠️ $1</mark>'
        }
      ]
      
      specificHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Para preguntas sobre organización/estructura
    if (question?.toLowerCase().includes('órganos') || question?.toLowerCase().includes('organización')) {
      const organizationHighlights = [
        {
          pattern: /(Órganos superiores:[^b]*)/gi,
          replacement: '<mark style="background-color: #ddd6fe; padding: 2px 4px; border-radius: 3px; color: #5b21b6;">$1</mark>'
        },
        {
          pattern: /(Órganos directivos:[^\.]*\.)/gi,
          replacement: '<mark style="background-color: #dcfce7; padding: 2px 4px; border-radius: 3px; color: #166534;">$1</mark>'
        }
      ]
      
      organizationHighlights.forEach(({ pattern, replacement }) => {
        formattedContent = formattedContent.replace(pattern, replacement)
      })
    }

    // Resaltar términos específicos de la pregunta de forma más sutil
    const keywords = extractKeywords(question, correctAnswer, options)
    keywords.forEach(keyword => {
      if (keyword.length > 4 && !formattedContent.includes(`<mark`) && !formattedContent.includes(`style="background-color: #fef3c7`)) {
        const regex = new RegExp(`\\b(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
        formattedContent = formattedContent.replace(regex, (match) => {
          return `<span style="background-color: #e0f2fe; padding: 1px 2px; border-radius: 2px; color: #0277bd;">${match}</span>`
        })
      }
    })

    // Resaltar referencias a leyes y normativas
    formattedContent = formattedContent
      .replace(/(Ley\s+\d+\/\d+)/gi, '<strong style="color: #2563eb; background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">📋 $1</strong>')
      .replace(/(Real Decreto\s+\d+\/\d+)/gi, '<strong style="color: #16a34a; background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">📜 $1</strong>')
      .replace(/(artículo\s+\d+)/gi, '<strong style="color: #9333ea; background-color: #faf5ff; padding: 1px 3px; border-radius: 2px;">📄 $1</strong>')

    return formattedContent
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-4">
      {/* Header clickeable */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">📚</span>
          <h4 className="font-bold text-gray-800 dark:text-gray-200">
            Ver Artículo Completo: {article.display_number || article.article_number}
          </h4>
          {/* Indicador de contenido relevante */}
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
            🎯 Contiene respuesta
          </span>
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenido desplegable con formato mejorado */}
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
          
          {/* Título del artículo */}
          {article.title && (
            <div className="mt-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h5 className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                📋 {article.title}
              </h5>
            </div>
          )}

          {/* Leyenda de colores - solo si hay resaltados */}
          {(currentQuestion?.question?.toLowerCase().includes('alto cargo') || 
            currentQuestion?.question?.toLowerCase().includes('órganos')) && (
            <div className="mt-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <h6 className="font-bold text-amber-800 dark:text-amber-300 text-xs mb-2">🎯 Guía de lectura:</h6>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fef3c7', padding: '1px 4px', borderRadius: '2px', color: '#92400e', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Respuesta directa</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fee2e2', padding: '1px 4px', borderRadius: '2px', color: '#dc2626', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Excepciones clave</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '2px', color: '#0277bd'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Términos relacionados</span>
                </span>
              </div>
            </div>
          )}
          
          {/* Contenido del artículo con formato mejorado */}
          <div className="mt-3">
            <div 
              className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{ 
                __html: formatTextContent(
                  article.full_text || (article as any).content || 'Contenido no disponible',
                  currentQuestion?.question,
                  currentQuestion?.correct,
                  currentQuestion?.options as string[] | undefined
                ) 
              }}
            />
          </div>

          {/* Información adicional del artículo */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">📖 Ley:</span> LRJSP
              </div>
              <div>
                <span className="font-medium">📄 Artículo:</span> {article.article_number || article.display_number}
              </div>
            </div>
            
            {/* Tip para el usuario */}
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-400">
              💡 <strong>Tip:</strong> Lee las partes resaltadas para encontrar rápidamente la respuesta. Los colores te ayudan a identificar la información clave.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function para generar ID único de pregunta
function generateQuestionId(questionData: TestQuestion | null | undefined, tema: number, questionIndex: number): string {
  // Genera un ID único basado en el contenido de la pregunta
  const content = questionData?.question || questionData?.question_text || ''
  const articleInfo = questionData?.article?.display_number || questionData?.primary_article_id || ''
  return `tema-${tema}-q${questionIndex}-${content.slice(0, 20).replace(/\s+/g, '-')}-${articleInfo}`.toLowerCase()
}

