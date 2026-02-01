// components/TestLayout.js - FIX COMPLETO ANTI-DUPLICADOS
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '../contexts/AuthContext'
import { useQuestionContext } from '../contexts/QuestionContext'
import PersistentRegistrationManager from './PersistentRegistrationManager'
import { usePathname } from 'next/navigation'
import QuestionEvolution from './QuestionEvolution'
import QuestionDispute from './QuestionDispute'
import ShareQuestion from './ShareQuestion'
import InteractiveBreadcrumbs from './InteractiveBreadcrumbs'


// Imports modularizados
import { 
  getDeviceInfo, 
  createUserSession, 
  createDetailedTestSession, 
  updateTestScore 
} from '../utils/testSession'
import { 
  saveDetailedAnswer, 
  calculateConfidence, 
  createDetailedAnswer 
} from '../utils/testAnswers.js'
import { 
  completeDetailedTest, 
  formatTime 
} from '../utils/testAnalytics.js'
import { testTracker } from '../utils/testTracking.js'
import { useTestCompletion } from '../hooks/useTestCompletion'
import { useDailyQuestionLimit } from '../hooks/useDailyQuestionLimit'
import { useBotDetection, useBehaviorAnalysis } from '../hooks/useBotDetection'
import { useInteractionTracker } from '../hooks/useInteractionTracker'
import DailyLimitBanner from './DailyLimitBanner'
import AdSenseComponent from './AdSenseComponent'
import UpgradeLimitModal from './UpgradeLimitModal'
import { useUserOposicion } from './useUserOposicion'

// Helper para convertir índice de respuesta a letra (0='A', 1='B', etc.)
function answerToLetter(index) {
  if (index === null || index === undefined) return '?'
  const letters = ['A', 'B', 'C', 'D']
  return letters[index] || '?'
}

// 🏛️ Helper para verificar si una pregunta oficial es de la oposición del usuario
// MEJORADO: Usa exam_position (estructurado) como primera opción, fallback a exam_source (texto libre)
function isOfficialForUserOposicion(examSource, userOposicionSlug, examPosition = null) {
  if (!userOposicionSlug) return true // Si no hay oposición de usuario, mostrar todo

  const normalizedUserSlug = userOposicionSlug.toLowerCase().replace(/-/g, '_')

  // 🏛️ PRIORIDAD 1: Usar exam_position (campo estructurado, más confiable)
  if (examPosition) {
    const normalizedExamPosition = examPosition.toLowerCase()
    // Mapeo de exam_position a slugs de URL válidos
    const positionToSlugs = {
      'auxiliar_administrativo_estado': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
      'auxiliar_administrativo': ['auxiliar_administrativo', 'auxiliar_administrativo_estado'],
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
function formatExamSource(examSource, userOposicionSlug) {
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

// 🚫 LISTA DE CONTENIDO NO LEGAL (informática) - No mostrar artículo
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

// 🏛️ FUNCIÓN: Verificar si un hot article es válido para la oposición del usuario
// Mapeo de slugs de URL a valores de target_oposicion en hot_articles
const HOT_ARTICLE_OPOSICION_MAP = {
  'auxiliar-administrativo-estado': ['auxiliar_administrativo_estado', 'auxiliar_administrativo'],
  'auxiliar_administrativo': ['auxiliar_administrativo_estado', 'auxiliar_administrativo'],
  'tramitacion-procesal': ['tramitacion_procesal'],
  'tramitacion_procesal': ['tramitacion_procesal'],
  'auxilio-judicial': ['auxilio_judicial'],
  'auxilio_judicial': ['auxilio_judicial'],
  'gestion-procesal': ['gestion_procesal'],
  'gestion_procesal': ['gestion_procesal'],
  'cuerpo-general-administrativo': ['cuerpo_general_administrativo', 'administrativo'],
  'cuerpo_general_administrativo': ['cuerpo_general_administrativo', 'administrativo'],
}

function isHotArticleForUserOposicion(targetOposicion, userOposicionSlug) {
  // Si no hay target_oposicion definido, es válido para todas (legacy)
  if (!targetOposicion) return true
  // Si no hay oposición de usuario, mostrar todos
  if (!userOposicionSlug) return true

  const normalized = userOposicionSlug.toLowerCase().replace(/-/g, '_')
  const validTargets = HOT_ARTICLE_OPOSICION_MAP[normalized] || [normalized]

  return validTargets.includes(targetOposicion.toLowerCase())
}

// 🔒 FUNCIÓN: Validar respuesta de forma segura via API
// Fase 2 de migración: usa API con fallback a validación local
async function validateAnswerSecure(questionId, userAnswer, localCorrectAnswer) {
  // Si no hay questionId válido, usar fallback local
  if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
    console.log('⚠️ [SecureAnswer] Sin questionId válido, usando fallback local')
    return {
      isCorrect: userAnswer === localCorrectAnswer,
      correctAnswer: localCorrectAnswer,
      explanation: null,
      usedFallback: true
    }
  }

  try {
    const response = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, userAnswer })
    })

    if (!response.ok) {
      console.warn('⚠️ [SecureAnswer] API error, usando fallback local')
      return {
        isCorrect: userAnswer === localCorrectAnswer,
        correctAnswer: localCorrectAnswer,
        explanation: null,
        usedFallback: true
      }
    }

    const data = await response.json()

    if (data.success) {
      console.log('✅ [SecureAnswer] Respuesta validada via API')
      return {
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        articleNumber: data.articleNumber,
        lawShortName: data.lawShortName,
        usedFallback: false
      }
    }

    // Si la API no encuentra la pregunta, fallback
    console.warn('⚠️ [SecureAnswer] Pregunta no encontrada en API, usando fallback')
    return {
      isCorrect: userAnswer === localCorrectAnswer,
      correctAnswer: localCorrectAnswer,
      explanation: null,
      usedFallback: true
    }

  } catch (error) {
    console.error('❌ [SecureAnswer] Error llamando API:', error)
    // Fallback a validación local en caso de error
    return {
      isCorrect: userAnswer === localCorrectAnswer,
      correctAnswer: localCorrectAnswer,
      explanation: null,
      usedFallback: true
    }
  }
}

export default function TestLayout({
  tema,
  testNumber,
  config,
  questions,
  children
}) {
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

  // 🤖 Detección de bots y análisis de comportamiento (solo usuarios autenticados)
  const { isBot, botScore } = useBotDetection(user?.id)
  const {
    suspicionScore,
    recordAnswer: recordBehavior
  } = useBehaviorAnalysis(user?.id)

  // 📊 Tracking de interacciones de usuario
  const { trackTestAction } = useInteractionTracker()

  // 🏛️ Oposición del usuario (para formatear exam_source correctamente)
  const { userOposicion } = useUserOposicion()
  const userOposicionSlug = userOposicion?.slug || null

  // Estados del test básicos
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [showResult, setShowResult] = useState(false)
  const [verifiedCorrectAnswer, setVerifiedCorrectAnswer] = useState(null) // 🔒 Respuesta correcta validada por API
  const [score, setScore] = useState(0)
  const [answeredQuestions, setAnsweredQuestions] = useState([])
  const [startTime, setStartTime] = useState(Date.now())
  
  // Estado del modo adaptativo
  const [isAdaptiveMode, setIsAdaptiveMode] = useState(false)
  
  // Estados de tracking avanzado
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [firstInteractionTime, setFirstInteractionTime] = useState(null)
  const [interactionCount, setInteractionCount] = useState(0)
  const [confidenceLevel, setConfidenceLevel] = useState(null)
  const [detailedAnswers, setDetailedAnswers] = useState([])
  
  // Estados de sesión - SIMPLIFICADOS
  const [currentTestSession, setCurrentTestSession] = useState(null)
  const [userSession, setUserSession] = useState(null)
  const [saveStatus, setSaveStatus] = useState(null)
  
  // Control explícito de finalización
  const [isExplicitlyCompleted, setIsExplicitlyCompleted] = useState(false)
  
  // Estado para notificación de guardado exitoso
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  
  // Estados para hot articles
  const [hotArticleInfo, setHotArticleInfo] = useState(null)
  const [showHotAlert, setShowHotAlert] = useState(false)

  // 📤 Estado para compartir pregunta
  const [showShareQuestion, setShowShareQuestion] = useState(false)

  // 🧠 Estados para modo adaptativo
  const [adaptiveMode, setAdaptiveMode] = useState(false)
  const [activeQuestions, setActiveQuestions] = useState([])
  const [questionPool, setQuestionPool] = useState([])
  const [adaptiveCatalog, setAdaptiveCatalog] = useState(null)
  const [currentDifficulty, setCurrentDifficulty] = useState('medium')
  const [showCuriosityDetails, setShowCuriosityDetails] = useState(false)
  const [currentQuestionUuid, setCurrentQuestionUuid] = useState(null)
  const [lastAdaptedQuestion, setLastAdaptedQuestion] = useState(-999) // 🔥 Evitar adaptaciones múltiples seguidas

  // Estados anti-duplicados
  const [processingAnswer, setProcessingAnswer] = useState(false)
  const [lastProcessedAnswer, setLastProcessedAnswer] = useState(null)

  // Estado para configuración de scroll automático
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const [showScrollFeedback, setShowScrollFeedback] = useState(false)

  // Refs para tracking y control
  const pageLoadTime = useRef(Date.now())
  const explanationRef = useRef(null)
  const questionHeaderRef = useRef(null)
  const sessionCreationRef = useRef(new Set())
  const registrationProcessingRef = useRef(new Set())

  // Hook para obtener la URL actual
  const pathname = usePathname()
  
  // Detectar si estamos en /test-oposiciones/ para desactivar modal de registro
  const isTestOposicionesSection = pathname?.startsWith('/test-oposiciones/')

  // ✅ MOVER CÁLCULO DE ESTADOS DERIVADOS DESPUÉS DE DECLARACIONES
  // Estados calculados - MOVIDO AQUÍ PARA EVITAR ERRORES DE ORDEN
  const effectiveQuestions = adaptiveMode ? activeQuestions : questions
  const isTestCompleted = isExplicitlyCompleted || (currentQuestion === effectiveQuestions?.length - 1 && showResult)
  const currentQ = effectiveQuestions?.[currentQuestion]

  // Helper para formatear nombre de tema (101 → "Bloque II - Tema 1", 1 → "Tema 1")
  const formatTemaName = (temaNumber) => {
    if (!temaNumber) return 'Tema'
    if (temaNumber >= 101) {
      return `Bloque II - Tema ${temaNumber - 100}`
    }
    return `Tema ${temaNumber}`
  }

  // 🔄 PERSISTENCIA DE TEST PARA USUARIOS ANÓNIMOS
  const PENDING_TEST_KEY = 'vence_pending_test'

  // Guardar estado del test en localStorage (solo para usuarios no logueados)
  const savePendingTestState = (newAnsweredQuestions, newScore, newDetailedAnswers) => {
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
  const clearPendingTest = () => {
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
    if (questions?.adaptiveCatalog && questions?.isAdaptive) {
      console.log('🧠 DETECTADO CATÁLOGO ADAPTATIVO - Configurando sistema inteligente')
      setAdaptiveCatalog(questions.adaptiveCatalog)
      setAdaptiveMode(true)

      console.log('🧠 Catálogo recibido:', {
        neverSeenEasy: questions.adaptiveCatalog.neverSeen.easy.length,
        neverSeenMedium: questions.adaptiveCatalog.neverSeen.medium.length,
        neverSeenHard: questions.adaptiveCatalog.neverSeen.hard.length
      })
    }
  }, [questions])

  // Validación de props al inicio
  useEffect(() => {

    if (!questions || questions.length === 0) {
      console.error('❌ TestLayout: No hay preguntas disponibles')
      return
    }

    // ✅ CORRECCIÓN: Validar tema puede ser 0 (válido para artículos dirigidos)
    if (tema === null || tema === undefined || !testNumber || !config) {
      console.error('❌ TestLayout: Props obligatorias faltantes:', { tema, testNumber, config })
      return
    }

    // 🧠 Inicializar modo adaptativo si detectado
    if (questions.isAdaptive) {
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
      setActiveQuestions(questions)
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
        law: currentQ.law || currentQ.article?.law?.short_name || currentQ.article?.law?.name || currentQ.article?.law_short_name || currentQ.article?.law_name,
        article_number: currentQ.article_number || currentQ.article?.article_number || currentQ.article?.number,
        difficulty: currentQ.difficulty || currentQ.metadata?.difficulty,
        source: currentQ.source || currentQ.metadata?.exam_source
      })
    }

    // Limpiar contexto al desmontar el componente
    return () => {
      clearQuestionContext()
    }
  }, [currentQuestion, effectiveQuestions, setQuestionContext, clearQuestionContext, showResult, verifiedCorrectAnswer])

  // Guardar respuestas previas al registrarse
  const savePreviousAnswersOnRegistration = async (userId, previousAnswers) => {
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
        const questionsToSave = questions.isAdaptive ? questions.activeQuestions : questions
        const session = await createDetailedTestSession(userId, tema, testNumber, questionsToSave, config, startTime, pageLoadTime.current)
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
            answer.questionData, 
            answer, 
            tema, 
            answer.confidence, 
            answer.interactions, 
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

        // Actualizar puntuación (guardar porcentaje, no número absoluto)
        const scorePercentage = Math.round((score / effectiveQuestions.length) * 100)
        await updateTestScore(session.id, scorePercentage)

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
  const checkHotArticle = async (articleId, userId, isOfficialExam = false) => {
    if (!articleId || !userId) return

    try {

      const { data, error } = await supabase.rpc('check_hot_article_for_current_user', {
        article_id_param: articleId,
        user_id_param: userId
      })

      if (error) {
        console.error('Error verificando artículo:', error)
        return
      }

      console.log('🔥 Resultado check hot article:', data)

      if (data && data.length > 0 && data[0].is_hot) {
        const hotData = data[0]
        console.log('🔥 [DEBUG] Datos del hot article:', hotData)
        console.log('🔥 [DEBUG] isOfficialExam:', isOfficialExam)
        console.log('🔥 [DEBUG] Estados ANTES:', { showHotAlert, hotArticleInfo })

        // 🏛️ FILTRO POR OPOSICIÓN: Verificar que el hot article sea de la oposición del usuario
        if (!isHotArticleForUserOposicion(hotData.target_oposicion, userOposicionSlug)) {
          console.log('🔥 [FILTRADO] Hot article ignorado - target_oposicion:', hotData.target_oposicion, 'userOposicion:', userOposicionSlug)
          return
        }

        // Diferentes notificaciones según tipo
        if (isOfficialExam) {
          // Pregunta oficial
          setHotArticleInfo({
            ...hotData,
            type: 'official_question',
            hot_message: `🏛️ PREGUNTA DE EXAMEN OFICIAL\n${hotData.hot_message}`,
            display_title: '¡Esta pregunta apareció en un examen oficial!'
          })
        } else {
          // Artículo hot
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
  const scrollToResult = () => {
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
  const toggleAutoScroll = () => {
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
  const saveAnswersInBackground = async (sessionId, allAnswers, questions, temaId, testStartTime) => {
    console.log('💾 ═══════════════════════════════════════════')
    console.log('💾 GUARDADO EN SEGUNDO PLANO INICIADO')
    console.log('💾 ═══════════════════════════════════════════')

    try {
      // Obtener qué preguntas ya están guardadas
      const { data: savedQuestions } = await supabase
        .from('test_questions')
        .select('question_order')
        .eq('test_id', sessionId)

      const savedOrders = new Set(savedQuestions?.map(q => q.question_order) || [])
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
          correctAnswer: question.correct,
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

      return { success: true, savedCount, errorCount }
    } catch (error) {
      console.error('❌ Error en guardado en segundo plano:', error)
      return { success: false, error }
    }
  }

  // Compartir rápido sin abrir modal
  const handleQuickShare = async (platform) => {
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

  // Manejar respuesta con protección anti-duplicados
  const handleAnswerClick = async (answerIndex) => {
    if (showResult || processingAnswer) return

    // Verificar limite diario para usuarios FREE
    // (el tracking de limit_reached se hace en useDailyQuestionLimit cuando llega a 25)
    if (hasLimit && isLimitReached) {
      setShowUpgradeModal(true)
      return
    }

    console.log('🎯 Respuesta seleccionada:', answerIndex)
    
    if (!effectiveQuestions || !effectiveQuestions[currentQuestion]) {
      console.error('❌ No hay pregunta actual disponible')
      return
    }

    const currentQ = effectiveQuestions[currentQuestion]
    
    // Crear clave única para esta respuesta específica
    const answerKey = `${currentQuestion}-${answerIndex}-${Date.now()}`
    
    // Verificar si ya procesamos esta respuesta
    if (lastProcessedAnswer === answerKey) {
      console.log('🚫 RESPUESTA YA PROCESADA:', answerKey)
      return
    }
    
    // Marcar como en proceso
    setProcessingAnswer(true)
    setLastProcessedAnswer(answerKey)
    
    console.log('🔒 PROCESANDO RESPUESTA ÚNICA:', answerKey)

    if (!firstInteractionTime) {
      setFirstInteractionTime(Date.now())
      testTracker.trackInteraction('first_answer_click', { selected_option: answerIndex }, currentQuestion)
    } else {
      testTracker.trackInteraction('answer_change', {
        from_option: selectedAnswer,
        to_option: answerIndex
      }, currentQuestion)
    }

    // 📊 Tracking de interacción
    trackTestAction('answer_selected', currentQ?.id, {
      answerIndex,
      questionIndex: currentQuestion,
      timeToDecide: Date.now() - questionStartTime,
      isChange: selectedAnswer !== null
    })

    setSelectedAnswer(answerIndex)
    setInteractionCount(prev => prev + 1)
    
    const timeToDecide = Date.now() - questionStartTime
    const newConfidence = calculateConfidence(timeToDecide, interactionCount)
    setConfidenceLevel(newConfidence)
    
    setTimeout(async () => {
      try {
        setShowResult(true)
        scrollToResult()

        const timeSpent = Math.round((Date.now() - questionStartTime) / 1000)
        const responseTimeMs = Date.now() - questionStartTime

        // 🔒 Validar respuesta de forma segura (API con fallback local)
        // Fase 2: La API valida, pero tenemos fallback por si falla
        const validationResult = await validateAnswerSecure(
          currentQ.id,           // questionId (UUID)
          answerIndex,           // userAnswer (0-3)
          currentQ.correct       // localCorrectAnswer (fallback)
        )

        const isCorrect = validationResult.isCorrect
        const apiCorrectAnswer = validationResult.correctAnswer // 🔒 Respuesta verificada por API
        const newScore = isCorrect ? score + 1 : score

        // 🔒 Guardar respuesta correcta verificada para el UI
        setVerifiedCorrectAnswer(apiCorrectAnswer)

        // 🤖 Registrar comportamiento para detección de scrapers
        // (Los scrapers no "responden" - solo copian contenido rápidamente)
        if (user?.id) {
          recordBehavior(responseTimeMs)
        }

        if (isCorrect) {
          setScore(newScore)
          testTracker.trackInteraction('answer_correct', {
            time_spent: timeSpent,
            confidence: newConfidence
          }, currentQuestion)
        } else {
          testTracker.trackInteraction('answer_incorrect', {
            time_spent: timeSpent,
            confidence: newConfidence,
            correct_answer: apiCorrectAnswer
          }, currentQuestion)
        }

        const detailedAnswer = createDetailedAnswer(
          currentQuestion,
          answerIndex,
          apiCorrectAnswer,
          isCorrect,
          timeSpent,
          currentQ,
          newConfidence,
          interactionCount
        )
        
        const newAnsweredQuestions = [...answeredQuestions, {
          question: currentQuestion,
          selectedAnswer: answerIndex,
          correct: isCorrect,
          timestamp: new Date().toISOString()
        }]
        
        const newDetailedAnswers = [...detailedAnswers, detailedAnswer]
        
        setAnsweredQuestions(newAnsweredQuestions)
        setDetailedAnswers(newDetailedAnswers)

        // 💾 Guardar en localStorage para usuarios anónimos
        savePendingTestState(newAnsweredQuestions, newScore, newDetailedAnswers)

        // 📊 TRACKING: Marcar usuario como activo si es su primera pregunta logueado
        if (user && answeredQuestions.length === 0) {
          // Primera pregunta de este test - verificar si es su primera pregunta global
          (async () => {
            try {
              const { data: profile } = await supabase
                .from('user_profiles')
                .select('is_active_student')
                .eq('id', user.id)
                .single()

              if (profile && !profile.is_active_student) {
                await supabase
                  .from('user_profiles')
                  .update({
                    is_active_student: true,
                    first_test_completed_at: new Date().toISOString()
                  })
                  .eq('id', user.id)

                console.log('🎯 [TRACKING] Usuario marcado como ACTIVO (primera pregunta logueado)')
              }
            } catch (e) {
              console.warn('⚠️ Error actualizando is_active_student:', e)
            }
          })()
        }

        // 🧠 Lógica adaptativa: evaluar % de aciertos
        if (adaptiveMode) {
          // Calcular % de aciertos actual
          const totalAnswered = newAnsweredQuestions.length
          const totalCorrect = newAnsweredQuestions.filter(q => q.correct).length
          const currentAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 100

          console.log(`🧠 Accuracy actual: ${currentAccuracy.toFixed(1)}% (${totalCorrect}/${totalAnswered})`)

          // 🔥 NUEVO: Calcular preguntas desde última adaptación
          const questionsSinceLastAdaptation = currentQuestion - lastAdaptedQuestion
          console.log(`🔍 Preguntas desde última adaptación: ${questionsSinceLastAdaptation}`)

          // 🧠 SMART LOGIC: Solo adaptar si el usuario va MAL (< 60%)
          // Si va bien, dejarlo con las preguntas que tiene (no castigar)
          if (currentAccuracy < 60 && totalAnswered >= 3) { // Mínimo 3 respuestas para evaluar

            // 🔥 NUEVO: Solo adaptar si han pasado al menos 3 preguntas desde la última adaptación
            if (questionsSinceLastAdaptation >= 3) {
              console.log('🧠 Accuracy < 60%, adaptando a preguntas más fáciles...')
              console.log(`🔍 Preguntas actuales antes de adaptar: ${effectiveQuestions.map(q => q.id).join(', ')}`)

              setIsAdaptiveMode(true) // 🔥 MOSTRAR: Se está adaptando
              adaptDifficulty('easier')
              setLastAdaptedQuestion(currentQuestion) // 🔥 Guardar que adaptamos ahora

              console.log('✅ MENSAJE VISUAL ACTIVADO: "✨ Adaptándose a tu nivel"')

              // Ocultar mensaje después de 4 segundos
              setTimeout(() => {
                setIsAdaptiveMode(false)
                console.log('🔕 Mensaje visual desactivado')
              }, 4000)
            } else {
              console.log(`⏸️  Adaptación en cooldown (faltan ${3 - questionsSinceLastAdaptation} preguntas)`)
            }
          } else if (currentAccuracy >= 60) {
            console.log(`✅ Accuracy OK (${currentAccuracy.toFixed(1)}%), manteniendo preguntas actuales`)
          }
        }
        
        // Guardado con protección mejorada
        if (user) {
          
          let session = currentTestSession
          
          // Proteger creación de sesión con ref
          if (!session) {
            const sessionKey = `${user.id}-${tema}-${testNumber}`
            
            if (sessionCreationRef.current.has(sessionKey)) {
              console.log('🚫 SESIÓN YA EN CREACIÓN, ESPERANDO...', sessionKey)
              // Esperar a que termine la creación existente
              let attempts = 0
              while (!currentTestSession && attempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 100))
                attempts++
              }
              session = currentTestSession
            } else {
              console.log('🔄 Creando nueva sesión PROTEGIDA...')
              sessionCreationRef.current.add(sessionKey)
              
              try {
                session = await createDetailedTestSession(user.id, tema, testNumber, effectiveQuestions, config, startTime, pageLoadTime.current)
                if (session) {
                  setCurrentTestSession(session)
                  console.log('✅ Nueva sesión PROTEGIDA creada:', session.id)
                }
              } finally {
                sessionCreationRef.current.delete(sessionKey)
              }
            }
          }
          
          if (session) {
            console.log('💾 Guardando respuesta ÚNICA en sesión:', session.id)
            const saveSuccess = await saveDetailedAnswer(
              session.id,
              currentQ,
              detailedAnswer,
              tema,
              newConfidence,
              interactionCount,
              questionStartTime,
              firstInteractionTime,
              testTracker.interactionEvents,
              testTracker.mouseEvents,
              testTracker.scrollEvents
            )
            // 🔴 FIX CRÍTICO: Verificar success === true, no solo question_id
            if (saveSuccess && saveSuccess.success === true && saveSuccess.question_id) {
              setCurrentQuestionUuid(saveSuccess.question_id)
              // Guardar en localStorage para detección de feedback
              try {
                localStorage.setItem('currentQuestionId', saveSuccess.question_id)
              } catch (e) {
                console.warn('⚠️ No se pudo guardar question_id en localStorage:', e)
              }
              // 🐛 FIX: Guardar porcentaje, no número absoluto
              const scorePercentage = Math.round((newScore / effectiveQuestions.length) * 100)
              await updateTestScore(session.id, scorePercentage)
              console.log('✅ Respuesta ÚNICA guardada y puntuación actualizada:', scorePercentage + '%')

              // Registrar respuesta en contador diario (solo usuarios FREE)
              if (hasLimit) {
                await recordAnswer()
              }
            } else {
              // 🔴 NUEVO: Manejo mejorado de errores
              console.error('❌ Error guardando respuesta:', {
                success: saveSuccess?.success,
                action: saveSuccess?.action,
                error: saveSuccess?.error
              })

              // Si fue un duplicado, no es un error grave
              if (saveSuccess?.action === 'prevented_duplicate') {
                console.warn('⚠️ Respuesta duplicada detectada, continuando...')
              } else {
                // TODO: Aquí podríamos mostrar el modal de error
                console.error('❌ Fallo crítico al guardar respuesta')
              }
            }
          } else {
            console.error('❌ No se pudo crear/obtener sesión de test')
          }
          
          if (!userSession) {
            console.log('🔄 Creando sesión de usuario...')
            const newUserSession = await createUserSession(user.id)
            if (newUserSession) {
              setUserSession(newUserSession)
            }
          }
        } else {
          console.log('👤 Usuario no autenticado, guardado omitido')
        }
        
        // Lógica de finalización existente...
        // 🔄 NUEVA LÓGICA: Verificar si todas las preguntas están respondidas
        const allQuestionsAnswered = newDetailedAnswers.length >= effectiveQuestions.length

        if (currentQuestion === effectiveQuestions.length - 1 || allQuestionsAnswered) {
          console.log('🏁 Última pregunta completada')
          console.log(`📊 Preguntas respondidas: ${newDetailedAnswers.length}/${effectiveQuestions.length}`)
          setIsExplicitlyCompleted(true)

          // 📊 Tracking de test completado
          trackTestAction('test_completed', null, {
            totalQuestions: effectiveQuestions.length,
            correctAnswers: newScore,
            accuracy: Math.round((newScore / effectiveQuestions.length) * 100),
            totalTimeMs: Date.now() - startTime,
            testType: tema ? 'tema' : 'general'
          })

          if (user && currentTestSession) {
            setSaveStatus('saving')
            console.log('💾 Completando test final...')

            // 🔄 NUEVO: Verificar preguntas guardadas en BD antes de completar
            const { data: savedQuestions } = await supabase
              .from('test_questions')
              .select('question_order')
              .eq('test_id', currentTestSession.id)

            const savedCount = savedQuestions?.length || 0
            const expectedCount = newDetailedAnswers.length

            console.log(`📊 Preguntas en BD: ${savedCount}/${expectedCount}`)

            // 🔄 NUEVO: Si faltan preguntas, intentar guardarlas en segundo plano
            if (savedCount < expectedCount) {
              console.warn(`⚠️  Faltan ${expectedCount - savedCount} preguntas por guardar`)
              console.log('💾 Guardando preguntas faltantes en segundo plano...')

              // Guardar en segundo plano sin bloquear
              saveAnswersInBackground(
                currentTestSession.id,
                newDetailedAnswers,
                effectiveQuestions,
                tema,
                startTime
              ).then(result => {
                console.log('✅ Guardado en segundo plano completado:', result)
              }).catch(err => {
                console.error('❌ Error en guardado en segundo plano:', err)
              })
            }

            const result = await completeDetailedTest(
              currentTestSession.id,
              newScore,
              newDetailedAnswers,
              effectiveQuestions,
              startTime,
              testTracker.interactionEvents,
              userSession
            )
            setSaveStatus(result.status)
            console.log('✅ Test completado en BD:', result.status)

            // 🔓 NOTIFICAR COMPLETION PARA SISTEMA DE DESBLOQUEO
            if (result.status === 'success' && tema && typeof tema === 'number') {
              const accuracy = Math.round((newScore / effectiveQuestions.length) * 100)
              console.log(`🔄 Notificando completion para desbloqueo: Tema ${tema}, ${accuracy}% accuracy`)

              try {
                await notifyTestCompletion(tema, accuracy, effectiveQuestions.length)
                console.log('✅ Sistema de desbloqueo notificado correctamente')
              } catch (unlockError) {
                console.error('❌ Error notificando sistema de desbloqueo:', unlockError)
              }
            }
          }
        }

        if (currentQuestion >= effectiveQuestions.length - 1) {
          console.log('🚨 FORZANDO FINALIZACIÓN - Detectado índice fuera de rango')
          setIsExplicitlyCompleted(true)
        }

        // Hot article check
        if (user && currentQ.primary_article_id) {
          await checkHotArticle(currentQ.primary_article_id, user.id, currentQ.is_official_exam || currentQ.metadata?.is_official_exam)


        }
        
      } catch (error) {
        console.error('❌ Error en flujo de respuesta:', error)
      } finally {
        // Liberar el lock después de 1 segundo
        setTimeout(() => {
          setProcessingAnswer(false)
          console.log('🔓 RESPUESTA PROCESADA, LIBERANDO LOCK')
        }, 1000)
      }
    }, 200)
  }

  // Navegación a siguiente pregunta con scroll específico
  const handleNextQuestion = () => {
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
  const calculateCompactStats = () => {
    const totalTime = Math.floor((Date.now() - startTime) / 1000)
    const avgTimePerQuestion = Math.round(totalTime / effectiveQuestions.length)
    const percentage = Math.round((score / effectiveQuestions.length) * 100)
    
    // Tiempo por pregunta
    const timeStats = detailedAnswers.map(a => a.timeSpent || 0)
    const fastestTime = timeStats.length > 0 ? Math.min(...timeStats) : 0
    const slowestTime = timeStats.length > 0 ? Math.max(...timeStats) : 0
    
    // Análisis de confianza
    const confidenceStats = detailedAnswers.reduce((acc, answer) => {
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
  const formatTime = (seconds) => {
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
  const adaptDifficulty = (direction = 'easier') => {
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
      let targetDifficulty = direction === 'easier' ? 'easy' : 'medium'

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
  const adaptDifficultyLegacy = (direction) => {
    console.log('🧠 Usando sistema adaptativo legacy')
    // Aquí iría el código original si es necesario
  }

  // Verificación de datos antes de renderizar
  if (!questions || questions.length === 0) {
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
  const HotArticleNotification = () => {

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
              {hotArticleInfo.display_title}
            </div>
            
            {/* Mensaje específico */}
            <div className="mb-2 text-sm opacity-90 whitespace-pre-line">
              {hotArticleInfo.hot_message}
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
                      {hotArticleInfo.curiosity_message}
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
                        window.location.href = config.isLawTest ? '/leyes' : '/auxiliar-administrativo-estado/test'
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
              data-question-id={currentQuestionUuid || questions[currentQuestion]?.id}
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
                  {/* 📤 Compartir pregunta - acceso directo a plataformas */}
                  <div className="flex justify-center items-center gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Compartir:</span>
                    {/* WhatsApp */}
                    <button
                      onClick={() => handleQuickShare('whatsapp')}
                      className="p-2 rounded-full hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                      title="WhatsApp"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#25D366">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </button>
                    {/* Telegram */}
                    <button
                      onClick={() => handleQuickShare('telegram')}
                      className="p-2 rounded-full hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-colors"
                      title="Telegram"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#0088cc">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                    </button>
                    {/* Facebook */}
                    <button
                      onClick={() => handleQuickShare('facebook')}
                      className="p-2 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      title="Facebook"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </button>
                    {/* X/Twitter */}
                    <button
                      onClick={() => handleQuickShare('twitter')}
                      className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="X"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </button>
                  </div>
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
                    {currentQ?.explanation && (
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
                            <span>No lo tengo claro</span>
                          </button>
                        </div>

                        <p className="text-blue-700 dark:text-blue-400 text-sm leading-relaxed whitespace-pre-line">
                          {currentQ.explanation}
                        </p>

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
                          <span>Explícamelo mejor, no lo tengo claro</span>
                        </button>
                      </div>
                    )}

                    {/* Información de procedencia oficial - Solo si es de la oposición del usuario */}
                      {currentQ?.metadata?.is_official_exam && isOfficialForUserOposicion(currentQ?.metadata?.exam_source, userOposicionSlug, currentQ?.metadata?.exam_position) && (
                        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4 mb-4">
                          <div className="flex items-start space-x-3">
                            <div className="text-2xl">🏛️</div>
                            <div className="flex-1">
                              <h4 className="font-bold text-purple-800 dark:text-purple-300 mb-2">
                                Pregunta de Examen Oficial Real
                              </h4>
                              <div className="space-y-1 text-sm text-purple-700 dark:text-purple-400">
                                {currentQ.metadata.exam_source && (
                                  <div className="flex items-center space-x-2">
                                    <span>📋</span>
                                    <span><strong>Examen:</strong> {formatExamSource(currentQ.metadata.exam_source, userOposicionSlug)}</span>
                                  </div>
                                )}
                                {currentQ.metadata.exam_date && (
                                  <div className="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span><strong>Año:</strong> {new Date(currentQ.metadata.exam_date).getFullYear()}</span>
                                  </div>
                                )}
                                {currentQ.metadata.exam_entity && (
                                  <div className="flex items-center space-x-2">
                                    <span>🏢</span>
                                    <span><strong>Oposición:</strong> {currentQ.metadata.exam_entity}</span>
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
                      questionId={currentQuestionUuid || questions[currentQuestion]?.id}
                      user={user}
                      supabase={supabase}
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
                            {/* 📤 Compartir - acceso directo */}
                            <div className="flex justify-center items-center gap-3 pt-2">
                              <span className="text-sm text-gray-500 dark:text-gray-400">Compartir:</span>
                              <button onClick={() => handleQuickShare('whatsapp')} className="p-1.5 rounded-full hover:bg-green-50 dark:hover:bg-green-900/30" title="WhatsApp">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </button>
                              <button onClick={() => handleQuickShare('telegram')} className="p-1.5 rounded-full hover:bg-cyan-50 dark:hover:bg-cyan-900/30" title="Telegram">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0088cc"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                              </button>
                              <button onClick={() => handleQuickShare('facebook')} className="p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Facebook">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                              </button>
                              <button onClick={() => handleQuickShare('twitter')} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700" title="X">
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                              </button>
                            </div>
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

                          {/* Botones simplificados - solo 2 opciones */}
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
                                    href={config.isLawTest ? "/leyes" : "/auxiliar-administrativo-estado/test"}
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
                                  href={`/auxiliar-administrativo-estado/test/tema/${tema}`}
                                  className={`px-4 sm:px-8 py-3 sm:py-4 rounded-lg font-semibold text-white transition-all bg-gradient-to-r ${config.color} hover:opacity-90 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center space-x-2 sm:space-x-3 text-sm sm:text-base w-full sm:w-auto`}
                                >
                                  <span>📚</span>
                                  <span>Volver al {formatTemaName(tema)}</span>
                                </Link>
                                
                                {/* Botón secundario: Ir a Otros Temas */}
                                <Link
                                  href="/auxiliar-administrativo-estado/test"
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
                    {currentQ?.article?.full_text && isLegalArticle(currentQ.article.law_short_name) && (
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
          lawName={config?.title || ''}
          isOpen={showShareQuestion}
          onClose={() => setShowShareQuestion(false)}
        />
      )}

      {/* Banner de limite diario (solo usuarios FREE) */}
      {hasLimit && <DailyLimitBanner />}

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
    </PersistentRegistrationManager>
  )
}

// Componente para mostrar artículo desplegable con resaltado inteligente
function ArticleDropdown({ article, currentQuestion }) {
  const [isOpen, setIsOpen] = useState(false)

  // Función para extraer palabras clave de la pregunta y respuesta correcta
  const extractKeywords = (question, correctAnswer, options) => {
    const keywords = new Set()
    
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
    const correctAnswerText = options?.[correctAnswer]
    if (correctAnswerText) {
      const answerWords = correctAnswerText
        .toLowerCase()
        .replace(/[,.:;]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
      
      answerWords.forEach(word => keywords.add(word))
    }
    
    return Array.from(keywords).filter(word => word.length > 2)
  }

  // Función para formatear texto plano a HTML legible con resaltado inteligente
  const formatTextContent = (content, question, correctAnswer, options) => {
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
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi')
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
                  article.full_text || article.content || 'Contenido no disponible',
                  currentQuestion?.question,
                  currentQuestion?.correct,
                  currentQuestion?.options
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
function generateQuestionId(questionData, tema, questionIndex) {
  // Genera un ID único basado en el contenido de la pregunta
  const content = questionData?.question || questionData?.question_text || ''
  const articleInfo = questionData?.article?.display_number || questionData?.primary_article_id || ''
  return `tema-${tema}-q${questionIndex}-${content.slice(0, 20).replace(/\s+/g, '-')}-${articleInfo}`.toLowerCase()
}

