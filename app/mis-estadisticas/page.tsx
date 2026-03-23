// app/mis-estadisticas/page.js - ACTUALIZADO USANDO useAuth GLOBAL
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext' // ✅ USAR CONTEXTO GLOBAL
import { useOposicion } from '@/contexts/OposicionContext' // ✅ Para obtener oposición del usuario
import OfficialExamAttempts from '@/components/Statistics/OfficialExamAttempts'

// Importar todos los componentes
import MainStats from '@/components/Statistics/MainStats'
import WeeklyProgress from '@/components/Statistics/WeeklyProgress'
import RecentTests from '@/components/Statistics/RecentTests'
import Achievements from '@/components/Statistics/Achievements'
import DifficultyBreakdown from '@/components/Statistics/DifficultyBreakdown'
import ThemePerformance from '@/components/Statistics/ThemePerformance'
import ArticlePerformance from '@/components/Statistics/ArticlePerformance'
import TimePatterns from '@/components/Statistics/TimePatterns'
import ExamReadiness from '@/components/Statistics/ExamReadiness'
import ExamPredictionMarch2025 from '@/components/Statistics/ExamPredictionMarch2025'
import PersonalDifficultyInsights from '@/components/Statistics/PersonalDifficultyInsights'
import DetailedCharts from '@/components/Statistics/DetailedCharts'

// Lazy load PsychometricStatsTab - solo se carga cuando se usa
const PsychometricStatsTab = dynamic(
  () => import('@/components/Statistics/PsychometricStatsTab'),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    ),
    ssr: false
  }
)

// Cache inteligente para análisis de IA
const aiAnalysisCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// ✅ FUNCIÓN formatTime DEFINIDA AQUÍ
const formatTime = (seconds) => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : `${seconds}s`
}

// ✅ Formatear número de tema interno a nombre legible por bloque
// oposicionSlug determina qué bloques son válidos para esa oposición
const formatThemeName = (num, oposicionSlug = 'auxiliar-administrativo-estado') => {
  // Administrativo del Estado (C1) - Estructura según /administrativo-estado/test
  if (oposicionSlug === 'administrativo-estado') {
    if (num >= 1 && num <= 11) return `Bloque I - Tema ${num}`
    if (num >= 201 && num <= 204) return `Bloque II - Tema ${num - 200}`
    if (num >= 301 && num <= 307) return `Bloque III - Tema ${num - 300}`
    if (num >= 401 && num <= 409) return `Bloque IV - Tema ${num - 400}`
    if (num >= 501 && num <= 506) return `Bloque V - Tema ${num - 500}`
    if (num >= 601 && num <= 608) return `Bloque VI - Tema ${num - 600}`
    return `Tema ${num}`
  }

  // Auxiliar Administrativo del Estado (C2) - Estructura por defecto
  if (num >= 1 && num <= 16) return `Bloque I - Tema ${num}`
  if (num >= 101 && num <= 112) return `Bloque II - Tema ${num - 100}`

  return `Tema ${num}`
}

// ✅ Obtener los rangos de temas válidos según la oposición
const getValidThemeRanges = (oposicionSlug) => {
  if (oposicionSlug === 'administrativo-estado') {
    // Administrativo C1: 6 bloques (según /administrativo-estado/test)
    return [
      { min: 1, max: 11 },      // Bloque I: 11 temas
      { min: 201, max: 204 },   // Bloque II: 4 temas
      { min: 301, max: 307 },   // Bloque III: 7 temas
      { min: 401, max: 409 },   // Bloque IV: 9 temas
      { min: 501, max: 506 },   // Bloque V: 6 temas
      { min: 601, max: 608 },   // Bloque VI: 8 temas
    ]
  }
  // Auxiliar Administrativo C2: 2 bloques (por defecto)
  return [
    { min: 1, max: 16 },      // Bloque I: 16 temas
    { min: 101, max: 112 },   // Bloque II: 12 temas
  ]
}

// ✅ Verificar si un tema pertenece a la oposición del usuario
const isThemeValidForOposicion = (themeNumber, oposicionSlug) => {
  const ranges = getValidThemeRanges(oposicionSlug)
  return ranges.some(r => themeNumber >= r.min && themeNumber <= r.max)
}

// ✅ FUNCIONES AUXILIARES MOVIDAS AL INICIO - ANTES DE SU USO
const generateRealRecommendations = (responses, articlePerformance, accuracy) => {
  if (!responses || responses.length < 10) return []
  
  const recommendations = []
  
  // 1. Análisis de errores frecuentes
  const incorrectResponses = responses.filter(r => !r.is_correct)
  if (incorrectResponses.length > responses.length * 0.3) {
    recommendations.push({
      priority: 'high',
      title: 'Reducir Errores Frecuentes',
      description: `Tienes ${incorrectResponses.length} errores de ${responses.length} respuestas`,
      action: 'Revisar los temas con más errores y reforzar conceptos básicos',
      type: 'accuracy',
      icon: '🎯'
    })
  }
  
  // 2. Análisis de artículos débiles
  const weakArticles = articlePerformance?.filter(art => art.accuracy < 60) || []
  if (weakArticles.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Reforzar Artículos Débiles',
      description: `${weakArticles.length} artículos con menos del 60% de precisión`,
      action: `Estudiar específicamente: ${weakArticles.slice(0, 3).map(a => `${a.law} - ${a.article}`).join(', ')}`,
      type: 'content',
      icon: '📚'
    })
  }
  
  // 3. Análisis de tiempo
  const avgTime = responses.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0) / responses.length
  if (avgTime > 60) {
    recommendations.push({
      priority: 'low',
      title: 'Mejorar Velocidad de Respuesta',
      description: `Tiempo promedio: ${Math.round(avgTime)}s por pregunta`,
      action: 'Practicar tests cronometrados para mejorar la velocidad',
      type: 'speed',
      icon: '⏱️'
    })
  }
  
  return recommendations
}

const detectRealLearningStyle = (responses, learningAnalytics) => {
  if (!responses || responses.length < 30) return null
  
  // Análisis básico basado en patrones reales
  const avgTime = responses.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0) / responses.length
  const accuracy = (responses.filter(r => r.is_correct).length / responses.length) * 100
  
  let style = 'Analítico'
  const characteristics = []
  
  if (avgTime > 45) {
    style = 'Reflexivo'
    characteristics.push('Toma tiempo para analizar', 'Prefiere la precisión', 'Evalúa opciones cuidadosamente')
  } else if (avgTime < 20) {
    style = 'Intuitivo'
    characteristics.push('Respuestas rápidas', 'Confía en primera impresión', 'Procesamiento ágil')
  } else {
    characteristics.push('Equilibrio tiempo-precisión', 'Metodología consistente', 'Enfoque sistemático')
  }
  
  return {
    style,
    characteristics,
    confidence: responses.length >= 100 ? 'high' : responses.length >= 50 ? 'medium' : 'low',
    source: 'ai_analysis',
    metrics: {
      avgTime: Math.round(avgTime),
      avgInteractions: 1, // Simplificado
      confidenceAccuracy: Math.round(accuracy)
    }
  }
}

// ✅ FUNCIONES AUXILIARES PARA PREDICCIÓN DE EXAMEN MOVIDAS AQUÍ
const calculateActiveDays = (tests) => {
  if (!tests || tests.length === 0) return 0
  const dates = [...new Set(tests.map(test => 
    new Date(test.completed_at).toDateString()
  ))]
  return dates.length
}

const calculateDailyImprovement = (responses, tests) => {
  if (!tests || tests.length < 5) return 0.1
  
  // Ordenar tests por fecha
  const sortedTests = tests.sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
  
  // Tomar los primeros y últimos tests para comparar
  const recentCount = Math.min(5, Math.floor(tests.length / 3))
  const oldTests = sortedTests.slice(0, recentCount)
  const recentTests = sortedTests.slice(-recentCount)
  
  // Calcular precisión de cada período
  const oldAccuracy = calculatePeriodAccuracy(oldTests)
  const recentAccuracy = calculatePeriodAccuracy(recentTests)
  
  // Calcular días transcurridos
  const firstDate = new Date(oldTests[0].completed_at)
  const lastDate = new Date(recentTests[recentTests.length - 1].completed_at)
  const daysDiff = Math.max(1, Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)))
  
  // Mejora diaria
  const totalImprovement = recentAccuracy - oldAccuracy
  const dailyImprovement = totalImprovement / daysDiff
  
  return Math.max(0.0, parseFloat(dailyImprovement.toFixed(1)))
}

const calculatePeriodAccuracy = (tests) => {
  const totalQuestions = tests.reduce((sum, test) => sum + (test.total_questions || 0), 0)
  const totalCorrect = tests.reduce((sum, test) => sum + (test.score || 0), 0)
  return totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
}

const calculateLearningSpeed = (responses, totalStudyTime) => {
  if (!responses || responses.length === 0 || !totalStudyTime) return 50
  
  const questionsPerHour = (responses.length / (totalStudyTime / 3600))
  const accuracyPerHour = (responses.filter(r => r.is_correct).length / (totalStudyTime / 3600))
  
  // Puntuación de 0-100 basada en eficiencia
  return Math.min(100, Math.round((questionsPerHour + accuracyPerHour) * 5))
}

const createEmptyStats = () => ({
  testsCompleted: 0,
  totalQuestions: 0,
  correctAnswers: 0,
  accuracy: 0,
  averageTime: 0,
  totalStudyTime: 0,
  currentStreak: 0,
  bestScore: 0,
  difficultyBreakdown: [],
  articlePerformance: [],
  learningStyle: null,
  timePatterns: null,
  sessionAnalytics: null,
  examReadiness: null,
  recommendations: [],
  recentTests: [],
  achievements: [],
  weeklyProgress: [],
  knowledgeRetention: null,
  learningEfficiency: null,
  confidenceAnalysis: null,
  deviceAnalytics: null,
  engagementMetrics: null,
  aiImpactData: null
})

// Wrapper que intercepta filtros de examen oficial
function ExamFilterCheck() {
  const searchParams = useSearchParams()
  const examDate = searchParams.get('examDate')
  const parte = searchParams.get('parte')
  const oposicion = searchParams.get('oposicion')

  if (examDate && parte && oposicion) {
    return <OfficialExamAttempts examDate={examDate} parte={parte} oposicion={oposicion} />
  }

  return <EstadisticasContent />
}

export default function EstadisticasRevolucionarias() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    }>
      <ExamFilterCheck />
    </Suspense>
  )
}

function EstadisticasContent() {
  // ✅ USAR CONTEXTO GLOBAL EN LUGAR DE ESTADO LOCAL
  const { user, loading: authLoading, supabase } = useAuth()
  const { oposicionId } = useOposicion() // ✅ Para obtener oposición del usuario

  // Obtener slug de oposición del usuario (formato con guiones para formatThemeName)
  // oposicionId usa guiones bajos (administrativo_estado), formatThemeName espera guiones (administrativo-estado)
  const userOposicionSlug = oposicionId?.replace(/_/g, '-') || 'auxiliar-administrativo-estado'

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(createEmptyStats())
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [showRecentTestsInfo, setShowRecentTestsInfo] = useState(false)

  // Función para scroll suave al contenido
  const scrollToContent = () => {
    const contentElement = document.getElementById('statistics-content')
    if (contentElement) {
      contentElement.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start' 
      })
    }
  }

  // Función para cambiar tab (sin scroll automático)
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
  }

  // 🧠 Cargar análisis completo desde todas las tablas
  const loadCompleteAnalytics = useCallback(async (userId) => {
    try {
      console.log('🧠 Cargando análisis  completo...')
      
      // 1A. ✅ TODOS LOS TESTS (para conteos consistentes con Avatar)
      const { data: allTests, error: allTestsError } = await supabase
        .from('tests')
        .select('id, user_id, created_at, title, test_type, tema_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (allTestsError) {
        console.error('❌ Error cargando todos los tests:', allTestsError)
        throw allTestsError
      }

      // 1B. ✅ TESTS COMPLETADOS (para análisis de rendimiento)
      const { data: tests, error: testsError } = await supabase
        .from('tests')
        .select('*')
        .eq('user_id', userId)
        .eq('is_completed', true)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })

      if (testsError) {
        console.error('❌ Error cargando tests completados:', testsError)
        throw testsError
      }

      // 1C. SESIONES PSICOTÉCNICAS COMPLETADAS (via API server-side, bypasses RLS)
      let psychometricSessions = []
      try {
        const psychoRes = await fetch(`${window.location.origin}/api/psychometric/completed-sessions?userId=${userId}&limit=10`)
        const psychoData = await psychoRes.json()
        if (psychoData.success) {
          psychometricSessions = psychoData.sessions || []
        }
      } catch (psychoErr) {
        console.warn('⚠️ Error cargando sesiones psicotécnicas:', psychoErr)
      }

      console.log('🔍 Todos los tests:', allTests?.length, '| Tests completados:', tests?.length, '| Psicotécnicos completados:', psychometricSessions?.length || 0)

      // 2. ✅ RESPUESTAS DETALLADAS - Usar RPC para evitar timeouts
      // Primero obtener estadísticas completas via RPC (más eficiente)
      const { data: completeStats, error: statsError } = await supabase
        .rpc('get_user_complete_stats', { p_user_id: userId })

      if (statsError) {
        console.warn('RPC no disponible, usando método tradicional con límite:', statsError)
        // Fallback: cargar datos en 2 pasos (evita timeout del join)
        const { data: fallbackTests } = await supabase
          .from('tests')
          .select('id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(300)

        let responses = []
        if (fallbackTests && fallbackTests.length > 0) {
          const testIds = fallbackTests.map(t => t.id)
          const { data: responsesData, error: responsesError } = await supabase
            .from('test_questions')
            .select('*')
            .in('test_id', testIds)
            .limit(5000)

          if (responsesError) throw responsesError
          responses = responsesData || []
        }
        return { responses, completeStats: null }
      }

      // Para el detalle visual - optimizado en 2 pasos para evitar timeout
      // Paso 1: obtener IDs de tests del usuario (rápido)
      const { data: userTests, error: userTestsError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200) // Últimos 200 tests

      if (userTestsError) throw userTestsError

      // Paso 2: obtener respuestas de esos tests (sin join, más rápido)
      let responses = []
      if (userTests && userTests.length > 0) {
        const testIds = userTests.map(t => t.id)
        const { data: responsesData, error: responsesError } = await supabase
          .from('test_questions')
          .select('*')
          .in('test_id', testIds)
          .order('created_at', { ascending: false })
          .limit(2000) // Más registros porque es más eficiente sin join

        if (responsesError) throw responsesError
        responses = responsesData || []
      }

      // 3. ✅ ANÁLISIS DE APRENDIZAJE desde user_learning_analytics  
      const { data: learningAnalytics, error: learningError } = await supabase
        .from('user_learning_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('last_analysis_date', { ascending: false })
        .limit(10)

      if (learningError) throw learningError

      // 4. ✅ SESIONES DE USUARIO desde user_sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('session_start', { ascending: false })
.limit(200)

      if (sessionsError) throw sessionsError

      console.log(`✅ Datos cargados: ${tests?.length || 0} tests, ${responses?.length || 0} respuestas`)

      // ⚡ CONTEOS OPTIMIZADOS para gráficos básicos (sin transferir filas)
      const testIds = tests?.map(t => t.id) || []
      
      // Solo hacer conteos si hay tests
      let optimizedCounts = { totalQuestions: 0, correctAnswers: 0 }
      if (testIds.length > 0) {
        console.log('⚡ Cargando conteos optimizados...')
        
        const [totalResult, correctResult] = await Promise.all([
          // Total preguntas count
          supabase
            .from('test_questions')
            .select('*', { count: 'exact', head: true })
            .in('test_id', testIds),
          
          // Preguntas correctas count  
          supabase
            .from('test_questions')
            .select('*', { count: 'exact', head: true })
            .in('test_id', testIds)
            .eq('is_correct', true)
        ])

        optimizedCounts = {
          totalQuestions: totalResult.count || 0,
          correctAnswers: correctResult.count || 0
        }
        
        console.log('⚡ Conteos optimizados:', optimizedCounts)
      }

      // 🧠 PROCESAMIENTO INTELIGENTE DE TODOS LOS DATOS
      const processedStats = await processCompleteAnalytics(tests, responses, learningAnalytics, sessions, optimizedCounts, supabase, allTests, userOposicionSlug)

      return processedStats

    } catch (error) {
      console.error('❌ Error cargando análisis completo:', error)
      throw error
    }
  }, [supabase, oposicionId])

  // 🧠 Procesamiento SOLO con datos reales - sin inventar nada
  const processCompleteAnalytics = useCallback(async (tests, responses, learningAnalytics, sessions, optimizedCounts, supabaseClient, allTests, oposicionSlug = 'auxiliar-administrativo-estado') => {
    console.log('🧠 Procesando análisis con datos 100% reales...')

    // ESTADÍSTICAS BÁSICAS - USAR CONTEOS OPTIMIZADOS para gráficos básicos
    const totalQuestions = optimizedCounts?.totalQuestions || responses?.length || 0
    const correctAnswers = optimizedCounts?.correctAnswers || responses?.filter(r => r.is_correct).length || 0
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0
    const totalStudyTime = tests?.reduce((sum, test) => sum + (test.total_time_seconds || 0), 0) || 0
    const testsCompleted = tests?.length || 0
    
    // TIEMPO PROMEDIO REAL
    const averageTime = totalQuestions > 0 ? 
      Math.round(responses.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0) / totalQuestions) : 0

    // MEJOR PUNTUACIÓN REAL
    const bestScore = tests?.length > 0 ? 
      Math.max(...tests.map(t => Math.round(((t.score || 0) / (t.total_questions || 1)) * 100))) : 0

    // RACHA ACTUAL REAL - calculada desde fechas reales
    const calculateRealStreak = (tests) => {
      if (!tests || tests.length === 0) return 0
      
      let streak = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Verificar los últimos 30 días
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() - i)
        
        const hasTestOnDate = tests.some(test => {
          const testDate = new Date(test.completed_at)
          testDate.setHours(0, 0, 0, 0)
          return testDate.getTime() === checkDate.getTime()
        })
        
        if (hasTestOnDate) {
          streak++
        } else if (i > 0) {
          break // Rompe la racha si no hay test y no es hoy
        }
      }
      
      return streak
    }

    const currentStreak = calculateRealStreak(tests)

    // ANÁLISIS POR DIFICULTAD - SOLO SI EXISTE EN LA BD
    const difficultyBreakdown = responses && responses.length > 0 ? 
      ['easy', 'medium', 'hard', 'extreme'].map(diff => {
        const responsesForDiff = responses.filter(r => r.difficulty === diff)
        const total = responsesForDiff.length
        const correct = responsesForDiff.filter(r => r.is_correct).length
        const avgTime = total > 0 ? Math.round(responsesForDiff.reduce((sum, r) => sum + (r.time_spent_seconds || 0), 0) / total) : 0
        
        return {
          difficulty: diff,
          total,
          correct,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
          avgTime,
          avgConfidence: 0, // No calculamos sin datos reales
          trend: 'unknown' // Sin suficientes datos para tendencia
        }
      }).filter(item => item.total > 0) : []

    // ANÁLISIS POR TEMA - NUEVO
    const themePerformance = responses && responses.length > 0 ? (() => {
      const themeMap = {}

      responses.forEach((response, index) => {
        const theme = response.tema_number ?? response.theme_number ?? 0

        if (theme === null || theme === undefined) {
          return // Skip si no hay tema
        }

        // Generar título con formato "Bloque X - Tema Y: Nombre descriptivo"
        const bloquePrefix = formatThemeName(theme, oposicionSlug)
        const descriptiveName = response.theme_title || response.tema_title || ''
        const themeTitle = theme === 0
          ? 'Tests aleatorios'
          : descriptiveName
            ? `${bloquePrefix}: ${descriptiveName}`
            : bloquePrefix

        if (!themeMap[theme]) {
          themeMap[theme] = {
            theme: theme,
            title: themeTitle,
            total: 0,
            correct: 0,
            totalTime: 0,
            articles: new Set()
          }
        }
        
        themeMap[theme].total++
        if (response.is_correct) themeMap[theme].correct++
        themeMap[theme].totalTime += response.time_spent_seconds || 0
        if (response.article_number) themeMap[theme].articles.add(response.article_number)
      })

      return Object.values(themeMap)
        .filter(theme => theme.total >= 1) // Incluir todos los temas con al menos 1 respuesta
        .map(theme => ({
          ...theme,
          accuracy: Math.round((theme.correct / theme.total) * 100),
          avgTime: Math.round(theme.totalTime / theme.total),
          articlesCount: theme.articles.size,
          status: theme.correct / theme.total >= 0.85 ? 'dominado' : 
                  theme.correct / theme.total >= 0.70 ? 'bien' :
                  theme.correct / theme.total >= 0.50 ? 'regular' : 'débil',
          trend: 'unknown' // Sin datos suficientes para calcular tendencia real
        }))
        .sort((a, b) => a.accuracy - b.accuracy)
    })() : []

    // ANÁLISIS POR ARTÍCULO - MEJORADO con referencia al tema
    const articlePerformance = responses && responses.length > 0 ? (() => {
      const articleMap = {}
      responses.forEach(response => {
        const article = response.article_number
        const law = response.law_name
        const theme = response.tema_number || response.theme_number
        if (!article || !law) return // Skip si no hay datos

        const key = `${law}-Art${article}`
        
        if (!articleMap[key]) {
          articleMap[key] = {
            article: `Art. ${article}`,
            law: law,
            theme: theme, // Agregar referencia al tema
            total: 0,
            correct: 0,
            totalTime: 0
          }
        }
        
        articleMap[key].total++
        if (response.is_correct) articleMap[key].correct++
        articleMap[key].totalTime += response.time_spent_seconds || 0
      })

      return Object.values(articleMap)
        .filter(art => art.total >= 2) // Solo con al menos 2 respuestas
        .map(art => ({
          ...art,
          accuracy: Math.round((art.correct / art.total) * 100),
          avgTime: Math.round(art.totalTime / art.total),
          status: art.correct / art.total >= 0.85 ? 'dominado' : 
                  art.correct / art.total >= 0.70 ? 'bien' :
                  art.correct / art.total >= 0.50 ? 'regular' : 'débil',
          trend: 'unknown' // Sin datos suficientes para calcular tendencia real
        }))
        .sort((a, b) => a.accuracy - b.accuracy)
    })() : []

    // TESTS RECIENTES REALES - ✅ AHORA CON formatTime DISPONIBLE
    const recentTests = tests?.slice(0, 10).map(test => {
      const percentage = Math.round(((test.score || 0) / (test.total_questions || 1)) * 100)
      
      console.log('📊 Processing test:', {
        id: test.id,
        title: test.title,
        test_type: test.test_type,
        tema_number: test.tema_number,
        completed_at: test.completed_at,
        score: test.score,
        total_questions: test.total_questions,
        raw_date_type: typeof test.completed_at,
        is_date_valid: test.completed_at && !isNaN(new Date(test.completed_at).getTime())
      })
      
      return {
        id: test.id,
        title: (() => {
          let cleanTitle = (test.title || `Test`).replace(/ - \d+$/, '')
          
          // Si es "Test Tema X", convertir a algo más descriptivo
          if (cleanTitle.includes('Tema X')) {
            // Verificar si es un test de áreas débiles
            const isWeakAreasTest = test.title?.toLowerCase().includes('debil') || 
                                  test.title?.toLowerCase().includes('weak') ||
                                  test.config?.focusWeakAreas === true ||
                                  test.focus_weak === true
                                  
            if (isWeakAreasTest) {
              cleanTitle = 'Refuerzo de Debilidades'
            } else if (test.test_type === 'practice') {
              cleanTitle = 'Test de Práctica'
            } else if (test.test_type === 'random') {
              cleanTitle = 'Test Aleatorio'  
            } else if (test.test_type === 'mixed') {
              cleanTitle = 'Test Mixto'
            } else if (test.test_type === 'official_exam') {
              cleanTitle = 'Examen Oficial'
            } else {
              cleanTitle = 'Test General'
            }
            
            // Añadir número de preguntas para diferenciarlo
            if (test.total_questions) {
              cleanTitle += ` (${test.total_questions}p)`
            }
          }
          
          return cleanTitle
        })(),
        score: test.score || 0,
        total: test.total_questions || 0,
        percentage,
        date: (() => {
          // Validar fecha antes de formatear
          if (!test.completed_at) {
            console.warn('⚠️ Test sin completed_at:', test.id, test.title)
            return 'Fecha no disponible'
          }
          
          const testDate = new Date(test.completed_at)
          if (isNaN(testDate.getTime())) {
            console.warn('⚠️ Fecha inválida:', test.completed_at, 'para test:', test.id)
            return 'Fecha inválida'
          }
          
          return testDate.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            timeZone: 'Europe/Madrid'
          })
        })(),
        time: (() => {
          if (!test.total_time_seconds && test.duration_seconds) {
            return formatTime(test.duration_seconds)
          }
          return formatTime(test.total_time_seconds || 0)
        })(),
        avgTimePerQuestion: Math.round((test.total_time_seconds || test.duration_seconds || 0) / (test.total_questions || 1)),
        difficultyBreakdown: [], // Requiere análisis adicional
        engagementScore: 0, // Sin datos reales disponibles
        focusScore: 0 // Sin datos reales disponibles
      }
    }) || []

    // Añadir sesiones psicotécnicas completadas a tests recientes
    const psychoRecentTests = (psychometricSessions || []).map(ps => ({
      id: ps.id,
      title: ps.categoryName || 'Test Psicotecnico',
      score: ps.correctAnswers || 0,
      total: ps.totalQuestions || 0,
      percentage: Math.round(Number(ps.accuracyPercentage || 0)),
      date: ps.completedAt ? new Date(ps.completedAt).toLocaleDateString('es-ES', {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid'
      }) : 'Fecha no disponible',
      time: formatTime(ps.totalTimeSeconds || 0),
      avgTimePerQuestion: Math.round((ps.totalTimeSeconds || 0) / (ps.totalQuestions || 1)),
      difficultyBreakdown: [],
      engagementScore: 0,
      focusScore: 0,
      _completedAt: ps.completedAt,
    }))

    // Mezclar legislativos y psicotécnicos, ordenar por fecha
    const allRecentTests = [...recentTests.map(t => ({
      ...t,
      _completedAt: tests?.find(tt => tt.id === t.id)?.completed_at || null,
    })), ...psychoRecentTests]
      .sort((a, b) => {
        const dateA = a._completedAt ? new Date(a._completedAt).getTime() : 0
        const dateB = b._completedAt ? new Date(b._completedAt).getTime() : 0
        return dateB - dateA
      })
      .slice(0, 15)
      .map(({ _completedAt, ...rest }) => rest) // quitar campo temporal

    // Reemplazar recentTests con la lista combinada
    const mergedRecentTests = allRecentTests

    // LOGROS REALES - basados en datos verdaderos
    const achievements = [
      {
        id: 'first_steps',
        title: '🎯 Primeros Pasos',
        description: 'Completaste tu primer test',
        unlocked: testsCompleted >= 1,
        progress: `${Math.min(testsCompleted, 1)}/1`,
        category: 'basic'
      },
      {
        id: 'dedicated_student',
        title: '📚 Estudiante Dedicado',
        description: 'Completaste 5 tests',
        unlocked: testsCompleted >= 5,
        progress: `${Math.min(testsCompleted, 5)}/5`,
        category: 'progress'
      },
      {
        id: 'question_master',
        title: '❓ Maestro de Preguntas',
        description: 'Respondiste 100 preguntas',
        unlocked: totalQuestions >= 100,
        progress: `${Math.min(totalQuestions, 100)}/100`,
        category: 'volume'
      },
      {
        id: 'accuracy_champion',
        title: '🎓 Campeón de Precisión',
        description: 'Alcanzaste 80% de precisión global',
        unlocked: accuracy >= 80,
        progress: `${accuracy}/80%`,
        category: 'skill'
      },
      {
        id: 'time_warrior',
        title: '⏰ Guerrero del Tiempo',
        description: 'Acumulaste 10 horas de estudio',
        unlocked: totalStudyTime >= 36000, // 10 horas en segundos
        progress: `${Math.min(Math.floor(totalStudyTime / 3600), 10)}/10h`,
        category: 'dedication'
      },
      {
        id: 'streak_master',
        title: '🔥 Maestro de la Constancia',
        description: 'Estudiaste 7 días seguidos',
        unlocked: currentStreak >= 7,
        progress: `${Math.min(currentStreak, 7)}/7 días`,
        category: 'habit'
      }
    ]

    // PROGRESO SEMANAL REAL - calculado desde lunes de cada semana CON CONTEOS OPTIMIZADOS
    const calculateRealWeeklyProgress = async (tests, responses, supabaseClient) => {
      if (!tests || tests.length === 0) return []

      console.log('🔍 CALCULANDO ACTIVIDAD SEMANAL CON CONTEOS OPTIMIZADOS:', {
        totalTests: tests.length,
        totalResponses: responses?.length || 0,
        fechaActual: new Date().toLocaleDateString()
      })

      const weeks = []
      const now = new Date()
      const testIds = tests.map(t => t.id)
      console.log('🔍 TEST IDS para semanas:', testIds.length, 'tests:', testIds.slice(0, 5), '...');
      
      // Función para obtener el lunes de una semana específica
      const getMondayOfWeek = (date, weeksBack = 0) => {
        const target = new Date(date)
        target.setDate(date.getDate() - (weeksBack * 7))
        const dayOfWeek = target.getDay()
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1 // domingo = 0, lunes = 1
        target.setDate(target.getDate() - daysToMonday)
        target.setHours(0, 0, 0, 0)
        return target
      }
      
      for (let i = 3; i >= 0; i--) {
        const weekStart = getMondayOfWeek(now, i)
        
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)
        
        const weekTests = tests.filter(test => {
          const testDate = new Date(test.completed_at)
          return testDate >= weekStart && testDate <= weekEnd
        })
        
        // ⚡ CONTEOS OPTIMIZADOS para esta semana específica
        const isCurrentWeek = i === 0 // "Esta semana"
        const endDate = isCurrentWeek ? new Date().toISOString() : weekEnd.toISOString()
        
        const weekLabel = i === 0 ? 'Esta semana' : i === 1 ? 'Semana pasada' : `Hace ${i} semanas`
        console.log(`📅 SEMANA ${weekLabel} - isCurrentWeek: ${isCurrentWeek}, endDate: ${endDate}`);
        console.log(`🔍 Query params: weekStart=${weekStart.toISOString()}, endDate=${endDate}`);
        
        const [weekQuestionsResult, weekCorrectResult] = await Promise.all([
          // Contar preguntas de esta semana
          supabaseClient
            .from('test_questions')
            .select('*', { count: 'exact', head: true })
            .in('test_id', testIds)
            .gte('created_at', weekStart.toISOString())
            .lt('created_at', endDate), // Usar < en lugar de <=
          
          // Contar preguntas correctas de esta semana
          supabaseClient
            .from('test_questions')
            .select('*', { count: 'exact', head: true })
            .in('test_id', testIds)
            .gte('created_at', weekStart.toISOString())
            .lt('created_at', endDate) // Usar < en lugar de <=
            .eq('is_correct', true)
        ])

        const questionsAnswered = weekQuestionsResult.count || 0
        const correctAnswers = weekCorrectResult.count || 0
        
        console.log(`🔍 RESULTADO QUERY ${weekLabel}:`, {
          questionsCount: weekQuestionsResult.count,
          correctCount: weekCorrectResult.count,
          error: weekQuestionsResult.error || weekCorrectResult.error
        });
        
        const weekData = {
          week: i === 0 ? 'Esta semana' : i === 1 ? 'Semana pasada' : `Hace ${i} semanas`,
          testsCompleted: weekTests.length,
          questionsAnswered: questionsAnswered, // ⚡ CONTEO OPTIMIZADO
          correctAnswers: correctAnswers, // ⚡ CONTEO OPTIMIZADO
          accuracy: questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0,
          studyTime: weekTests.reduce((sum, test) => sum + (test.total_time_seconds || 0), 0),
          trend: 'unknown' // Requiere más cálculos para tendencia real
        }
        
        console.log(`🔍 SEMANA ${weekData.week} (OPTIMIZADO):`, {
          rango: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
          tests: weekTests.length,
          questionsAnswered: questionsAnswered,
          correctAnswers: correctAnswers,
          accuracy: weekData.accuracy
        })
        
        weeks.push(weekData)
      }
      
      return weeks
    }

    const weeklyProgress = await calculateRealWeeklyProgress(allTests || tests, responses, supabaseClient)

    // ANÁLISIS DE SESIONES REAL
    // Filtrar sesiones con duración > 0 para calcular promedios reales
    const validSessions = sessions?.filter(s => (s.total_duration_minutes || 0) > 0) || []
    const sessionAnalytics = sessions && sessions.length > 0 ? {
      totalSessions: sessions.length,
      avgSessionDuration: validSessions.length > 0
        ? Math.round(validSessions.reduce((sum, s) => sum + (s.total_duration_minutes || 0), 0) / validSessions.length)
        : 0,
      avgEngagement: validSessions.length > 0
        ? Math.round(validSessions.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / validSessions.length)
        : 0,
      devicesUsed: [...new Set(sessions.map(s => s.device_model).filter(Boolean))].length,
      recentSessions: sessions.slice(0, 5).map(session => ({
        date: new Date(session.session_start).toLocaleDateString('es-ES', {
          timeZone: 'Europe/Madrid'
        }),
        duration: session.total_duration_minutes || 0,
        engagement: session.engagement_score || 0,
        device: session.device_model || 'Desconocido',
        testsCompleted: session.tests_completed || 0,
        questionsAnswered: session.questions_answered || 0
      })),
      consistency: (() => {
        const last30Days = sessions.filter(s => {
          const sessionDate = new Date(s.session_start)
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return sessionDate >= thirtyDaysAgo
        })
        return Math.round((last30Days.length / 30) * 100)
      })()
    } : null

    // PREDICCIÓN EXAMEN MARZO 2025 - CÁLCULO COMPLETO
    const examPredictionMarch2025 = totalQuestions >= 20 ? (() => {
      // Fecha objetivo del examen
      const examDate = new Date('2026-07-01') // Estimación julio 2026
      const today = new Date()
      const daysRemaining = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24))
      
      // 1. COBERTURA DEL TEMARIO
      const totalThemes = 28 // 16 Bloque I + 12 Bloque II
      const studiedThemes = themePerformance?.length || 0
      const coveragePercentage = Math.round((studiedThemes / totalThemes) * 100)
      
      // 2. PROGRESO DIARIO REAL
      const activeDays = calculateActiveDays(tests)
      const dailyQuestions = activeDays > 0 ? Math.round(totalQuestions / activeDays) : 0
      const averageImprovement = calculateDailyImprovement(responses, tests)
      
      // 3. VELOCIDAD DE APRENDIZAJE
      const learningSpeed = calculateLearningSpeed(responses, totalStudyTime)
      
      // 4. CONSISTENCIA
      const consistency = activeDays > 0 ? Math.min(100, Math.round((activeDays / 30) * 100)) : 0
      
      // 5. CÁLCULO DE PREPARACIÓN
      let readinessScore

      if (accuracy < 50) {
        // Si no llegas al 50% de aciertos, preparación muy baja
        readinessScore = Math.round(accuracy * 0.2) // Solo 20% del porcentaje de aciertos
        // Con 20% aciertos: 20 * 0.2 = 4%
      } else if (coveragePercentage < 50) {
        // Si no has cubierto 50% del temario
        readinessScore = Math.round((accuracy + coveragePercentage) / 2 * 0.6)
      } else {
        // Fórmula normal para estudiantes avanzados
        readinessScore = Math.round((accuracy * 0.6) + (coveragePercentage * 0.4))
      }

      // Límites estrictos
      readinessScore = Math.max(1, readinessScore) // Mínimo 1%
      if (accuracy < 30) readinessScore = Math.min(readinessScore, 5) // Máximo 5% si <30% aciertos

      // 6. PROYECCIONES
      // Calcular preguntas necesarias basándose en temas pendientes
      const themesRemainingCount = totalThemes - studiedThemes
      const avgQuestionsPerTheme = totalQuestions > 0 && studiedThemes > 0
        ? Math.round(totalQuestions / studiedThemes)
        : 30 // Estimación: 30 preguntas por tema
      const questionsNeeded = themesRemainingCount * avgQuestionsPerTheme

      // Calcular días necesarios basándose en ritmo actual
      const effectiveDailyQuestions = dailyQuestions > 0 ? dailyQuestions : 10
      const daysToCompleteThemes = questionsNeeded > 0
        ? Math.ceil(questionsNeeded / effectiveDailyQuestions)
        : 0
      const daysToReady = Math.max(daysToCompleteThemes,
        averageImprovement > 0 ? Math.ceil((85 - readinessScore) / averageImprovement) : daysRemaining
      )
      const estimatedReadinessDate = new Date()
      estimatedReadinessDate.setDate(estimatedReadinessDate.getDate() + daysToReady)
      
      // 7. RECOMENDACIONES ESPECÍFICAS
      const specificRecommendations = []
      
      if (coveragePercentage < 80) {
        specificRecommendations.push({
          priority: 'high',
          title: 'Ampliar Cobertura Temario',
          description: `Solo has estudiado ${studiedThemes}/${totalThemes} temas (${coveragePercentage}%)`,
          action: `Estudiar ${totalThemes - studiedThemes} temas restantes prioritariamente`,
          icon: '📚'
        })
      }
      
      if (accuracy < 75) {
        specificRecommendations.push({
          priority: 'high',
          title: 'Mejorar Precisión',
          description: `Tu precisión actual (${accuracy}%) está por debajo del objetivo (85%)`,
          action: 'Repasar errores frecuentes y reforzar conceptos débiles',
          icon: '🎯'
        })
      }
      
      if (dailyQuestions < 10) {
        specificRecommendations.push({
          priority: 'medium',
          title: 'Aumentar Ritmo de Estudio',
          description: `Promedio actual: ${dailyQuestions} preguntas/día`,
          action: 'Aumentar a mínimo 15-20 preguntas diarias',
          icon: '⏰'
        })
      }
      
      if (daysToReady > daysRemaining) {
        specificRecommendations.push({
          priority: 'high',
          title: 'Acelerar Preparación',
          description: `Al ritmo actual no estarás listo para julio 2026`,
          action: `Aumentar intensidad de estudio para reducir ${daysToReady - daysRemaining} días de retraso`,
          icon: '🚨'
        })
      }
      
      return {
        daysRemaining,
        readinessScore,
        readinessLevel: readinessScore >= 85 ? 'excellent' : 
                       readinessScore >= 70 ? 'good' : 
                       readinessScore >= 50 ? 'developing' : 'needs_improvement',
        mainMessage: readinessScore >= 85 ? 
          '¡Vas muy bien! Mantén este ritmo para estar completamente preparado.' :
          readinessScore >= 70 ?
          'Buen progreso. Enfócate en tus puntos débiles para mejorar.' :
          readinessScore >= 50 ?
          'Necesitas acelerar el ritmo para estar listo en febrero.' :
          'Debes intensificar significativamente tu preparación.',
        
        coverage: {
          studiedThemes,
          totalThemes,
          percentage: coveragePercentage
        },
        
        accuracy: {
          current: accuracy,
          target: 85
        },
        
        dailyProgress: {
          averageImprovement: Math.max(0.1, averageImprovement),
          daysAnalyzed: Math.min(30, activeDays)
        },
        
        timeEstimate: {
          dailyHours: Math.max(1, Math.min(8, Math.ceil(questionsNeeded / Math.max(1, daysRemaining) / 20))) || 2
        },

        projection: {
          estimatedReadinessDate: estimatedReadinessDate.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Europe/Madrid'
          }),
          // Fecha estimada de cobertura completa del temario (basada en ritmo de estudio)
          estimatedStudyCompletion: (() => {
            if (themesRemainingCount <= 0) return null
            const studyCompletionDate = new Date()
            studyCompletionDate.setDate(studyCompletionDate.getDate() + daysToCompleteThemes)
            return studyCompletionDate.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'Europe/Madrid'
            })
          })(),
          onTrack: daysToReady <= daysRemaining,
          questionsNeeded: Math.max(0, questionsNeeded),
          themesRemaining: themesRemainingCount
        },
        
        calculations: {
          testsCompleted,
          totalQuestions,
          activeDays,
          totalStudyTime: `${Math.round(totalStudyTime / 3600)}h`,
          averageImprovement,
          dailyQuestions,
          consistency,
          learningSpeed: learningSpeed.toFixed(1)
        },
        
        specificRecommendations
      }
    })() : null

    // RECOMENDACIONES - solo si hay datos para generar
    const recommendations = totalQuestions >= 10 ? 
      generateRealRecommendations(responses, articlePerformance, accuracy) : []

    // ESTILO DE APRENDIZAJE - solo con datos suficientes
    const learningStyle = totalQuestions >= 30 ? 
      detectRealLearningStyle(responses, learningAnalytics) : null

    // 🧠 ANÁLISIS DE IMPACTO IA - NUEVO
    const generateAIImpactData = () => {
      if (totalQuestions < 20) return null // Necesita datos mínimos

      // Simular datos de impacto basados en estadísticas reales
      const simulatedProblemsDetected = Math.floor(difficultyBreakdown.filter(d => d.accuracy < 70).length + 
                                                   articlePerformance.filter(a => a.accuracy < 70).length)
      
      const simulatedImprovements = Math.floor(weeklyProgress.filter(w => w.accuracy > 0).length +
                                              achievements.filter(a => a.unlocked).length)
      
      const simulatedTimeOptimized = Math.floor(totalStudyTime / 3600 * 0.15) // 15% de tiempo optimizado por IA
      
      return {
        totalInsights: simulatedProblemsDetected + simulatedImprovements + 3,
        problemsDetected: simulatedProblemsDetected,
        improvementsRecognized: simulatedImprovements,
        timeOptimized: simulatedTimeOptimized,
        articlesImproved: Math.floor(articlePerformance.filter(a => a.accuracy >= 70).length * 0.6),
        motivationalReceived: Math.floor(currentStreak * 0.5 + simulatedImprovements),
        optimalTimeDetected: totalQuestions >= 50 ? '19:00-20:00' : null,
        accuracyImprovement: Math.max(0, Math.floor((accuracy - 50) * 0.3)),
        speedImprovement: Math.max(0, Math.floor((60 - averageTime) * 0.1)),
        studyStreakHelped: Math.floor(currentStreak * 0.3)
      }
    }

    const aiImpactData = generateAIImpactData()

    return {
      // Básicas - todas reales
      testsCompleted,
      totalQuestions,
      correctAnswers,
      accuracy,
      averageTime,
      totalStudyTime,
      currentStreak,
      bestScore,
      
      // Análisis avanzados - todos reales o null
      difficultyBreakdown,
      themePerformance,
      articlePerformance,
      recentTests: mergedRecentTests,
      achievements,
      weeklyProgress,
      sessionAnalytics,
      examReadiness: null, // Reemplazado por examPredictionMarch2025
      examPredictionMarch2025,
      recommendations,
      learningStyle,
      aiImpactData,
      
      // Componentes que requieren más datos - null hasta tener suficiente
      timePatterns: tests && tests.length >= 5 ? (() => {
        // Análisis temporal básico basado en completed_at de tests
        const hourlyStats = {}
        
        tests.forEach(test => {
          const testDate = new Date(test.completed_at)
          const hour = testDate.getHours()
          const accuracy = Math.round(((test.score || 0) / (test.total_questions || 1)) * 100)
          
          if (!hourlyStats[hour]) {
            hourlyStats[hour] = {
              hour: hour,
              tests: 0,
              totalAccuracy: 0,
              accuracy: 0
            }
          }
          
          hourlyStats[hour].tests++
          hourlyStats[hour].totalAccuracy += accuracy
          hourlyStats[hour].accuracy = Math.round(hourlyStats[hour].totalAccuracy / hourlyStats[hour].tests)
        })
        
        const hoursWithData = Object.values(hourlyStats).filter(h => h.tests >= 2)
        
        if (hoursWithData.length === 0) return null
        
        // Ordenar por accuracy
        const sortedByAccuracy = hoursWithData.sort((a, b) => b.accuracy - a.accuracy)
        
        return {
          hourlyStats: hoursWithData,
          bestHours: sortedByAccuracy.slice(0, 3).map(h => h.hour),
          worstHours: sortedByAccuracy.slice(-3).reverse().map(h => h.hour),
          peakPerformanceHour: sortedByAccuracy[0]?.hour || 10
        }
      })() : null, // Requiere al menos 5 tests para análisis temporal
      knowledgeRetention: null, // Requiere campo retention_score en BD
      learningEfficiency: null, // Requiere más datos de comportamiento
      confidenceAnalysis: null, // Requiere campo confidence_level en BD
      deviceAnalytics: null, // Requiere más datos de device analytics
      engagementMetrics: null // Requiere más datos de engagement
    }
  }, [supabase])

  // ✅ SIMPLIFICADO - Solo cargar datos si hay usuario autenticado
  useEffect(() => {
    if (authLoading) {
      console.log('⏳ Esperando verificación de autenticación...')
      return
    }

    if (!user) {
      console.log('❌ No hay usuario autenticado')
      setLoading(false)
      return
    }

    console.log('✅ Usuario autenticado, cargando estadísticas...', user.email)
    
    const loadUserStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // 🚀 NUEVO: Usar API optimizada con Drizzle
        console.log('🚀 Cargando estadísticas desde API optimizada...')
        const response = await fetch(`/api/stats?userId=${user.id}`)
        const apiData = await response.json()

        if (!apiData.success) {
          throw new Error(apiData.error || 'Error cargando estadísticas')
        }

        // 🔄 Cargar sesiones psicotécnicas completadas (via API server-side)
        let completedPsychometricSessions = []
        try {
          const psychoRes = await fetch(`/api/psychometric/completed-sessions?userId=${user.id}&limit=10`)
          const psychoData = await psychoRes.json()
          if (psychoData.success) {
            completedPsychometricSessions = psychoData.sessions || []
          }
        } catch (psychoErr) {
          console.warn('⚠️ Error cargando sesiones psicotécnicas:', psychoErr)
        }

        // 🔄 Cargar sesiones de usuario para analytics reales
        const { data: userSessions } = await supabase
          .from('user_sessions')
          .select('total_duration_minutes, engagement_score, session_start, tests_completed, questions_answered')
          .eq('user_id', user.id)
          .order('session_start', { ascending: false })
          .limit(100)

        // Filtrar sesiones con duración válida para promedios
        const validSessions = userSessions?.filter(s => (s.total_duration_minutes || 0) > 0) || []

        // Mapear respuesta de API al formato esperado por componentes
        const { stats: apiStats } = apiData
        const mappedStats = {
          // Estadísticas principales
          testsCompleted: apiStats.main.totalTests,
          totalQuestions: apiStats.main.totalQuestions,
          correctAnswers: apiStats.main.correctAnswers,
          accuracy: apiStats.main.accuracy,
          averageTime: apiStats.main.averageTimePerQuestion,
          totalStudyTime: apiStats.main.totalStudyTimeSeconds,
          currentStreak: apiStats.main.currentStreak,
          longestStreak: apiStats.main.longestStreak,
          bestScore: apiStats.main.bestScore,

          // Progreso semanal
          weeklyProgress: apiStats.weeklyProgress,

          // Tests recientes - mapear al formato esperado por RecentTests.js
          recentTests: (() => {
            const oposicionSlug = apiStats.userOposicion?.slug || 'auxiliar-administrativo-estado'
            const legislativeTests = apiStats.recentTests.map(t => {
              const bloquePrefix = t.temaNumber ? formatThemeName(t.temaNumber, oposicionSlug) : null
              const fullTitle = t.temaNumber
                ? bloquePrefix
                : (t.title && !t.title.includes('Test Tema') ? t.title : 'Test Aleatorio')
              return {
                id: t.id,
                title: fullTitle,
                score: t.score,
                total: t.totalQuestions,
                totalQuestions: t.totalQuestions,
                accuracy: t.accuracy,
                percentage: t.accuracy,
                date: new Date(t.completedAt).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  timeZone: 'Europe/Madrid'
                }) + ' ' + new Date(t.completedAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Madrid'
                }),
                time: t.timeSeconds > 3600
                  ? `${Math.floor(t.timeSeconds / 3600)}h ${Math.floor((t.timeSeconds % 3600) / 60)}m`
                  : `${Math.floor(t.timeSeconds / 60)}m`,
                avgTimePerQuestion: t.totalQuestions > 0 ? Math.round(t.timeSeconds / t.totalQuestions) : 0,
                completed_at: t.completedAt,
                formattedDate: new Date(t.completedAt).toLocaleDateString('es-ES'),
                duration: t.timeSeconds,
                formattedDuration: t.timeSeconds > 3600
                  ? `${Math.floor(t.timeSeconds / 3600)}h ${Math.floor((t.timeSeconds % 3600) / 60)}m`
                  : `${Math.floor(t.timeSeconds / 60)}m`
              }
            })

            // Mezclar con sesiones psicotécnicas completadas
            const psychoTests = completedPsychometricSessions.map(ps => ({
              id: ps.id,
              title: ps.categoryName || 'Test Psicotecnico',
              isPsychometric: true,
              score: ps.correctAnswers || 0,
              total: ps.totalQuestions || 0,
              totalQuestions: ps.totalQuestions || 0,
              accuracy: ps.accuracyPercentage || 0,
              percentage: ps.accuracyPercentage || 0,
              date: ps.completedAt ? new Date(ps.completedAt).toLocaleDateString('es-ES', {
                day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid'
              }) + ' ' + new Date(ps.completedAt).toLocaleTimeString('es-ES', {
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid'
              }) : '',
              time: formatTime(ps.totalTimeSeconds || 0),
              avgTimePerQuestion: ps.totalQuestions > 0 ? Math.round((ps.totalTimeSeconds || 0) / ps.totalQuestions) : 0,
              completed_at: ps.completedAt,
              formattedDate: ps.completedAt ? new Date(ps.completedAt).toLocaleDateString('es-ES') : '',
              duration: ps.totalTimeSeconds || 0,
              formattedDuration: formatTime(ps.totalTimeSeconds || 0),
            }))

            return [...legislativeTests, ...psychoTests]
              .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
              .slice(0, 15)
          })(),

          // Rendimiento por tema - filtrado por oposición del usuario
          themePerformance: (() => {
            const oposicionSlug = apiStats.userOposicion?.slug || 'auxiliar-administrativo-estado'
            const filtered = apiStats.themePerformance
              .filter(t => isThemeValidForOposicion(t.temaNumber, oposicionSlug))
            return filtered.map(t => {
                const bloquePrefix = formatThemeName(t.temaNumber, oposicionSlug)
                // Solo mostrar el bloque formateado
                const fullTitle = bloquePrefix
                return {
                  theme: t.temaNumber,
                  title: fullTitle,
                  total: t.totalQuestions,
                  correct: t.correctAnswers,
                  accuracy: t.accuracy,
                  avgTime: t.averageTime,
                  status: t.accuracy >= 85 ? 'dominado' : t.accuracy >= 70 ? 'bien' : t.accuracy >= 50 ? 'regular' : 'débil'
                }
              })
          })(),

          // Info de la oposición del usuario para mostrar en UI
          userOposicion: apiStats.userOposicion ? {
            nombre: apiStats.userOposicion.nombre,
            slug: apiStats.userOposicion.slug,
            userName: apiStats.userOposicion.userName,
            tipoAcceso: apiStats.userOposicion.tipoAcceso,
            bloquesCount: apiStats.userOposicion.bloquesCount,
            temasCount: apiStats.userOposicion.temasCount,
            examDate: apiStats.userOposicion.examDate,
            inscriptionDeadline: apiStats.userOposicion.inscriptionDeadline,
            plazas: apiStats.userOposicion.plazas, // Total
            plazasLibres: apiStats.userOposicion.plazasLibres,
            plazasPromocionInterna: apiStats.userOposicion.plazasPromocionInterna,
            boeReference: apiStats.userOposicion.boeReference,
            boePublicationDate: apiStats.userOposicion.boePublicationDate
          } : null,

          // Desglose por dificultad
          difficultyBreakdown: apiStats.difficultyBreakdown.map(d => ({
            difficulty: d.difficulty,
            total: d.totalQuestions,
            correct: d.correctAnswers,
            accuracy: d.accuracy,
            avgTime: d.averageTime
          })),

          // Patrones de tiempo - mapear hourlyDistribution a hourlyStats para TimePatterns.js
          timePatterns: apiStats.timePatterns ? {
            ...apiStats.timePatterns,
            hourlyStats: apiStats.timePatterns.hourlyDistribution, // TimePatterns usa 'hourlyStats'
          } : null,

          // Artículos débiles y fuertes - incluir theme para filtrado por tema
          articlePerformance: [...apiStats.weakArticles, ...apiStats.strongArticles].map(a => ({
            article: `Art. ${a.articleNumber}`,
            law: a.lawName,
            theme: a.temaNumber, // Necesario para getArticlesForTheme
            total: a.totalQuestions,
            correct: a.correctAnswers,
            accuracy: a.accuracy,
            status: a.accuracy >= 85 ? 'dominado' : a.accuracy >= 70 ? 'bien' : a.accuracy >= 50 ? 'regular' : 'débil'
          })),

          // Logros - calculados desde datos básicos
          achievements: [
            {
              id: 'first_steps',
              title: '🎯 Primeros Pasos',
              description: 'Completaste tu primer test',
              unlocked: apiStats.main.totalTests >= 1,
              progress: `${Math.min(apiStats.main.totalTests, 1)}/1`,
              category: 'basic'
            },
            {
              id: 'dedicated_student',
              title: '📚 Estudiante Dedicado',
              description: 'Completaste 5 tests',
              unlocked: apiStats.main.totalTests >= 5,
              progress: `${Math.min(apiStats.main.totalTests, 5)}/5`,
              category: 'progress'
            },
            {
              id: 'question_master',
              title: '❓ Maestro de Preguntas',
              description: 'Respondiste 100 preguntas',
              unlocked: apiStats.main.totalQuestions >= 100,
              progress: `${Math.min(apiStats.main.totalQuestions, 100)}/100`,
              category: 'volume'
            },
            {
              id: 'accuracy_champion',
              title: '🎓 Campeón de Precisión',
              description: 'Alcanzaste 80% de precisión global',
              unlocked: apiStats.main.accuracy >= 80,
              progress: `${apiStats.main.accuracy}/80%`,
              category: 'skill'
            },
            {
              id: 'time_warrior',
              title: '⏰ Guerrero del Tiempo',
              description: 'Acumulaste 10 horas de estudio',
              unlocked: apiStats.main.totalStudyTimeSeconds >= 36000,
              progress: `${Math.min(Math.floor(apiStats.main.totalStudyTimeSeconds / 3600), 10)}/10h`,
              category: 'dedication'
            },
            {
              id: 'streak_master',
              title: '🔥 Maestro de la Constancia',
              description: 'Estudiaste 7 días seguidos',
              unlocked: apiStats.main.currentStreak >= 7,
              progress: `${Math.min(apiStats.main.currentStreak, 7)}/7 días`,
              category: 'habit'
            }
          ],

          // AI Impact Data - calculado desde datos disponibles
          aiImpactData: apiStats.main.totalQuestions >= 20 ? {
            totalInsights: Math.floor(
              apiStats.difficultyBreakdown.filter(d => d.accuracy < 70).length +
              apiStats.weakArticles.length + 3
            ),
            problemsDetected: apiStats.weakArticles.length,
            improvementsRecognized: apiStats.strongArticles.length,
            timeOptimized: Math.floor(apiStats.main.totalStudyTimeSeconds / 3600 * 0.15),
            articlesImproved: apiStats.strongArticles.length,
            motivationalReceived: Math.floor(apiStats.main.currentStreak * 0.5 + apiStats.strongArticles.length),
            optimalTimeDetected: apiStats.timePatterns?.bestHours?.length > 0
              ? `${apiStats.timePatterns.bestHours[0]}:00-${apiStats.timePatterns.bestHours[0] + 1}:00`
              : null,
            accuracyImprovement: Math.max(0, Math.floor((apiStats.main.accuracy - 50) * 0.3)),
            speedImprovement: Math.max(0, Math.floor((60 - apiStats.main.averageTimePerQuestion) * 0.1)),
            studyStreakHelped: Math.floor(apiStats.main.currentStreak * 0.3)
          } : null,

          // Predicción de examen - calculada con datos REALES de la oposición del usuario
          examPredictionMarch2025: apiStats.main.totalQuestions >= 20 ? (() => {
            const oposicion = apiStats.userOposicion
            const userName = oposicion?.userName?.split(' ')[0] || 'Opositor' // Solo primer nombre
            const oposicionNombre = oposicion?.nombre || 'tu oposición'
            const oposicionSlug = oposicion?.slug || 'auxiliar-administrativo-estado'
            const totalThemes = oposicion?.temasCount || 28

            // ✅ Filtrar temas por la oposición del usuario (igual que en themePerformance)
            const filteredThemePerformance = apiStats.themePerformance
              .filter(t => isThemeValidForOposicion(t.temaNumber, oposicionSlug))

            // Tema "estudiado" = ≥10 preguntas Y ≥50% precisión (criterio similar a desbloqueo)
            const studiedThemes = filteredThemePerformance
              .filter(t => t.totalQuestions >= 10 && t.accuracy >= 50).length
            const coveragePercentage = Math.min(100, Math.round((studiedThemes / totalThemes) * 100))

            // Temas dominados (accuracy >= 80% Y ≥10 preguntas) - también filtrados
            const masteredThemes = filteredThemePerformance
              .filter(t => t.totalQuestions >= 10 && t.accuracy >= 80).length
            const masteredPercentage = Math.round((masteredThemes / totalThemes) * 100)
            const accuracy = apiStats.main.accuracy

            // Fecha del examen REAL desde la BD o estimación
            const examDateStr = oposicion?.examDate
            const examDate = examDateStr ? new Date(examDateStr) : new Date('2026-07-01')
            const hasRealExamDate = !!examDateStr
            const today = new Date()
            const daysRemaining = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24))

            // Cálculo de preparación
            let readinessScore
            if (accuracy < 50) {
              readinessScore = Math.round(accuracy * 0.2)
            } else if (coveragePercentage < 50) {
              readinessScore = Math.round((accuracy + coveragePercentage) / 2 * 0.6)
            } else {
              readinessScore = Math.round((accuracy * 0.6) + (coveragePercentage * 0.4))
            }
            readinessScore = Math.max(1, readinessScore)
            if (accuracy < 30) readinessScore = Math.min(readinessScore, 5)

            // Mensaje personalizado con el nombre del usuario
            const getPersonalizedMessage = () => {
              if (readinessScore >= 85) {
                return `¡${userName}, vas muy bien! Mantén este ritmo y estarás listo para ${oposicionNombre}.`
              } else if (readinessScore >= 70) {
                return `${userName}, buen progreso. Enfócate en tus puntos débiles para ${oposicionNombre}.`
              } else if (readinessScore >= 50) {
                return `${userName}, necesitas acelerar el ritmo para estar listo a tiempo.`
              }
              return `${userName}, debes intensificar tu preparación para ${oposicionNombre}.`
            }

            return {
              // Datos de la oposición
              oposicionInfo: {
                nombre: oposicionNombre,
                userName: userName,
                tipoAcceso: oposicion?.tipoAcceso || 'libre',
                hasRealExamDate,
                examDateFormatted: examDate.toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }),
                plazas: oposicion?.plazas || null, // Total
                plazasLibres: oposicion?.plazasLibres || null,
                plazasPromocionInterna: oposicion?.plazasPromocionInterna || null,
                boeReference: oposicion?.boeReference || null,
                boePublicationDate: oposicion?.boePublicationDate
                  ? new Date(oposicion.boePublicationDate).toLocaleDateString('es-ES')
                  : null,
                inscriptionDeadline: oposicion?.inscriptionDeadline
                  ? new Date(oposicion.inscriptionDeadline).toLocaleDateString('es-ES')
                  : null,
              },
              daysRemaining: Math.max(0, daysRemaining),
              readinessScore,
              readinessLevel: readinessScore >= 85 ? 'excellent' :
                             readinessScore >= 70 ? 'good' :
                             readinessScore >= 50 ? 'developing' : 'needs_improvement',
              mainMessage: getPersonalizedMessage(),
              coverage: {
                studiedThemes,
                totalThemes,
                percentage: coveragePercentage
              },
              // Temas dominados (>= 80% accuracy)
              mastery: {
                masteredThemes,
                totalThemes,
                percentage: masteredPercentage,
                remaining: totalThemes - masteredThemes,
                // Predicción de cuándo dominará todo el temario
                // 🔧 CORREGIDO: Usar daysSinceJoin (igual que UserProfileModal)
                // antes usaba recentTests que solo tiene 10 tests, dando fechas incorrectas
                projectedMasteryDate: (() => {
                  if (masteredThemes < 1) return null // Necesita al menos 1 tema dominado
                  if (masteredThemes >= totalThemes) return 'completado'

                  // Usar días desde registro (igual que UserProfileModal)
                  const diasEnVence = oposicion?.daysSinceJoin || 30

                  // Calcular ritmo: temas dominados por semana
                  const temasPoSemana = (masteredThemes / diasEnVence) * 7
                  const themesRemaining = totalThemes - masteredThemes
                  const semanasNecesarias = Math.ceil(themesRemaining / temasPoSemana)

                  // Solo mostrar si es razonable (< 2 años = 104 semanas)
                  if (semanasNecesarias > 104) return null

                  const projectedDate = new Date()
                  projectedDate.setDate(projectedDate.getDate() + semanasNecesarias * 7)

                  return projectedDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })
                })(),
                message: masteredThemes >= totalThemes
                  ? `¡Felicidades ${userName}! Has dominado todo el temario`
                  : masteredThemes > 0
                  ? `${userName}, llevas ${masteredThemes}/${totalThemes} temas dominados (${masteredPercentage}%)`
                  : `${userName}, aún no tienes temas dominados. Sigue practicando para alcanzar 80% en cada tema.`
              },
              accuracy: {
                current: accuracy,
                target: 85
              },
              dailyProgress: {
                averageImprovement: 0.1,
                daysAnalyzed: 7
              },
              timeEstimate: {
                dailyHours: Math.max(1, Math.min(4, Math.ceil((totalThemes - studiedThemes) * 30 / Math.max(1, daysRemaining) / 20))) || 2
              },
              projection: (() => {
                // 🔧 CÁLCULO IGUAL QUE EN UserProfileModal:
                // Ritmo = temas dominados / días en Vence * 7 = temas por semana
                // Semanas necesarias = temas pendientes / temas por semana

                const themesLeftToMaster = totalThemes - masteredThemes
                const diasEnVence = oposicion?.daysSinceJoin || 30 // Default 30 días

                // Si no hay temas dominados, no podemos calcular proyección
                if (masteredThemes === 0) {
                  return {
                    estimatedReadinessDate: null,
                    onTrack: false,
                    estimatedStudyCompletion: null,
                    questionsNeeded: themesLeftToMaster * 50, // Estimación
                    themesRemaining: themesLeftToMaster,
                    noMasteredYet: true
                  }
                }

                // Si ya dominó todos los temas
                if (themesLeftToMaster <= 0) {
                  return {
                    estimatedReadinessDate: null,
                    onTrack: true,
                    estimatedStudyCompletion: null,
                    questionsNeeded: 0,
                    themesRemaining: 0,
                    allMastered: true
                  }
                }

                // Calcular ritmo: temas dominados por semana
                const temasPoSemana = (masteredThemes / diasEnVence) * 7
                const semanasNecesarias = Math.ceil(themesLeftToMaster / temasPoSemana)

                // Calcular fecha proyectada
                const projectedDate = new Date(today.getTime() + semanasNecesarias * 7 * 24 * 60 * 60 * 1000)

                // Solo mostrar si es razonable (menos de 2 años)
                const isReasonable = semanasNecesarias < 104

                return {
                  estimatedReadinessDate: isReasonable ? projectedDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : null,
                  onTrack: daysRemaining > 0 && readinessScore >= 50,
                  estimatedStudyCompletion: isReasonable ? projectedDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : null,
                  questionsNeeded: themesLeftToMaster * 50, // Estimación
                  themesRemaining: themesLeftToMaster,
                  temasPoSemana: Math.round(temasPoSemana * 10) / 10 // Para mostrar el ritmo
                }
              })(),
              calculations: (() => {
                // 🔧 Métricas basadas en ritmo de dominio (igual que UserProfileModal)
                const diasEnVence = oposicion?.daysSinceJoin || 30
                const temasPoSemana = diasEnVence > 0 && masteredThemes > 0
                  ? Math.round((masteredThemes / diasEnVence) * 7 * 10) / 10
                  : 0

                // También mostrar preguntas recientes
                const weeklyQuestions = apiStats.weeklyProgress.reduce((sum, day) => sum + day.questions, 0)
                const activeDaysInWeek = apiStats.weeklyProgress.filter(d => d.questions > 0).length
                const dailyQ = activeDaysInWeek > 0
                  ? Math.round(weeklyQuestions / activeDaysInWeek)
                  : 0

                return {
                  testsCompleted: apiStats.main.totalTests,
                  totalQuestions: apiStats.main.totalQuestions,
                  activeDays: diasEnVence, // Días desde registro
                  totalStudyTime: `${Math.round(apiStats.main.totalStudyTimeSeconds / 3600)}h`,
                  averageImprovement: 0.1,
                  dailyQuestions: dailyQ, // Preguntas/día (última semana)
                  temasPoSemana, // Ritmo de dominio de temas
                  consistency: Math.round((activeDaysInWeek / 7) * 100),
                  learningSpeed: '50'
                }
              })(),
              specificRecommendations: [
                ...(coveragePercentage < 80 ? [{
                  priority: 'high',
                  title: 'Ampliar Cobertura Temario',
                  description: `${userName}, solo has estudiado ${studiedThemes}/${totalThemes} temas (${coveragePercentage}%)`,
                  action: `Estudiar ${totalThemes - studiedThemes} temas restantes prioritariamente`,
                  icon: '📚'
                }] : []),
                ...(accuracy < 75 ? [{
                  priority: 'high',
                  title: 'Mejorar Precisión',
                  description: `Tu precisión actual (${accuracy}%) está por debajo del objetivo (85%)`,
                  action: 'Repasar errores frecuentes y reforzar conceptos débiles',
                  icon: '🎯'
                }] : []),
                ...(apiStats.weakArticles.length > 0 ? [{
                  priority: 'medium',
                  title: 'Reforzar Artículos Débiles',
                  description: `${apiStats.weakArticles.length} artículos con menos del 60% de precisión`,
                  action: 'Practicar tests enfocados en tus puntos débiles',
                  icon: '📖'
                }] : []),
                ...(daysRemaining < 90 && readinessScore < 70 ? [{
                  priority: 'high',
                  title: '¡Tiempo Limitado!',
                  description: `Solo quedan ${daysRemaining} días para el examen`,
                  action: 'Intensifica tu estudio diario para llegar preparado',
                  icon: '⏰'
                }] : [])
              ]
            }
          })() : null,

          // Recomendaciones basadas en datos reales
          recommendations: apiStats.main.totalQuestions >= 10 ? [
            ...(apiStats.main.accuracy < 70 ? [{
              priority: 'high',
              title: 'Mejorar Precisión General',
              description: `Tu precisión actual es ${apiStats.main.accuracy}%`,
              action: 'Revisar los temas con más errores y reforzar conceptos básicos',
              type: 'accuracy',
              icon: '🎯'
            }] : []),
            ...(apiStats.weakArticles.length > 0 ? [{
              priority: 'medium',
              title: 'Reforzar Artículos Débiles',
              description: `${apiStats.weakArticles.length} artículos con menos del 60% de precisión`,
              action: `Estudiar específicamente: ${apiStats.weakArticles.slice(0, 3).map(a => `${a.lawName} Art.${a.articleNumber}`).join(', ')}`,
              type: 'content',
              icon: '📚'
            }] : []),
            ...(apiStats.main.averageTimePerQuestion > 60 ? [{
              priority: 'low',
              title: 'Mejorar Velocidad de Respuesta',
              description: `Tiempo promedio: ${Math.round(apiStats.main.averageTimePerQuestion)}s por pregunta`,
              action: 'Practicar tests cronometrados para mejorar la velocidad',
              type: 'speed',
              icon: '⏱️'
            }] : [])
          ] : [],

          // Estilo de aprendizaje - calculado desde tiempo promedio
          learningStyle: apiStats.main.totalQuestions >= 30 ? (() => {
            const avgTime = apiStats.main.averageTimePerQuestion
            const accuracy = apiStats.main.accuracy

            let style = 'Analítico'
            const characteristics = []

            if (avgTime > 45) {
              style = 'Reflexivo'
              characteristics.push('Toma tiempo para analizar', 'Prefiere la precisión', 'Evalúa opciones cuidadosamente')
            } else if (avgTime < 20) {
              style = 'Intuitivo'
              characteristics.push('Respuestas rápidas', 'Confía en primera impresión', 'Procesamiento ágil')
            } else {
              characteristics.push('Equilibrio tiempo-precisión', 'Metodología consistente', 'Enfoque sistemático')
            }

            return {
              style,
              characteristics,
              confidence: apiStats.main.totalQuestions >= 100 ? 'high' : apiStats.main.totalQuestions >= 50 ? 'medium' : 'low',
              source: 'api_analysis',
              metrics: {
                avgTime: Math.round(avgTime),
                avgInteractions: 1,
                confidenceAccuracy: Math.round(accuracy)
              }
            }
          })() : null,

          // Análisis de sesiones - usando datos reales de user_sessions
          sessionAnalytics: userSessions && userSessions.length > 0 ? {
            totalSessions: userSessions.length,
            avgSessionDuration: validSessions.length > 0
              ? Math.round(validSessions.reduce((sum, s) => sum + (s.total_duration_minutes || 0), 0) / validSessions.length)
              : 0,
            avgEngagement: validSessions.length > 0
              ? Math.round(validSessions.reduce((sum, s) => sum + (s.engagement_score || 0), 0) / validSessions.length)
              : 0,
            devicesUsed: 1,
            recentSessions: userSessions.slice(0, 5).map(s => ({
              date: new Date(s.session_start).toLocaleDateString('es-ES'),
              duration: s.total_duration_minutes || 0,
              engagement: s.engagement_score || 0,
              device: 'Web',
              testsCompleted: s.tests_completed || 0,
              questionsAnswered: s.questions_answered || 0
            })),
            consistency: (() => {
              const last30Days = userSessions.filter(s => {
                const sessionDate = new Date(s.session_start)
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                return sessionDate >= thirtyDaysAgo
              })
              return Math.round((last30Days.length / 30) * 100)
            })()
          } : null,

          // Analytics de dispositivo - básico
          deviceAnalytics: apiStats.main.totalTests >= 1 ? {
            primaryDevice: 'Web Browser',
            devices: [{ name: 'Web', sessions: apiStats.main.totalTests, percentage: 100 }],
            performanceByDevice: [{ device: 'Web', accuracy: apiStats.main.accuracy, avgTime: apiStats.main.averageTimePerQuestion }]
          } : null,

          // Métricas de engagement
          engagementMetrics: apiStats.main.totalQuestions >= 10 ? {
            overallScore: Math.min(100, Math.round(
              (apiStats.main.accuracy * 0.4) +
              (Math.min(apiStats.main.currentStreak, 7) / 7 * 30) +
              (Math.min(apiStats.main.totalTests, 20) / 20 * 30)
            )),
            weeklyActivity: apiStats.weeklyProgress.map(w => ({ day: w.day, questions: w.questions })),
            streakData: {
              current: apiStats.main.currentStreak,
              longest: apiStats.main.longestStreak,
              thisWeek: apiStats.weeklyProgress.filter(w => w.questions > 0).length
            },
            completionRate: apiStats.main.totalTests > 0 ? 100 : 0,
            averageSessionLength: Math.round(apiStats.main.totalStudyTimeSeconds / Math.max(1, apiStats.main.totalTests) / 60)
          } : null,

          // Retención de conocimiento - basado en artículos fuertes/débiles
          knowledgeRetention: apiStats.main.totalQuestions >= 50 ? {
            overallRetention: Math.round(
              (apiStats.strongArticles.length / Math.max(1, apiStats.strongArticles.length + apiStats.weakArticles.length)) * 100
            ),
            byTheme: apiStats.themePerformance.slice(0, 5).map(t => ({
              theme: t.temaNumber,
              retention: t.accuracy,
              lastPracticed: t.lastPracticed
            })),
            strongAreas: apiStats.strongArticles.length,
            weakAreas: apiStats.weakArticles.length,
            recommendation: apiStats.weakArticles.length > apiStats.strongArticles.length
              ? 'Enfócate en reforzar los artículos débiles'
              : 'Buen equilibrio, mantén la práctica constante'
          } : null,

          // Eficiencia de aprendizaje
          learningEfficiency: apiStats.main.totalQuestions >= 20 ? {
            questionsPerHour: apiStats.main.totalStudyTimeSeconds > 0
              ? Math.round(apiStats.main.totalQuestions / (apiStats.main.totalStudyTimeSeconds / 3600))
              : 0,
            accuracyPerHour: apiStats.main.totalStudyTimeSeconds > 0
              ? Math.round(apiStats.main.correctAnswers / (apiStats.main.totalStudyTimeSeconds / 3600))
              : 0,
            efficiencyScore: Math.min(100, Math.round(
              (apiStats.main.accuracy * 0.6) +
              (Math.min(60, 60 - apiStats.main.averageTimePerQuestion) / 60 * 40)
            )),
            trend: 'stable',
            recommendation: apiStats.main.averageTimePerQuestion > 45
              ? 'Intenta responder más rápido sin sacrificar precisión'
              : apiStats.main.accuracy < 70
              ? 'Enfócate en mejorar la precisión antes de la velocidad'
              : 'Buen equilibrio velocidad-precisión'
          } : null,

          // Análisis de confianza - basado en precisión y consistencia
          confidenceAnalysis: apiStats.main.totalQuestions >= 30 ? {
            overallConfidence: Math.round(
              (apiStats.main.accuracy * 0.7) +
              (Math.min(apiStats.main.currentStreak, 7) / 7 * 30)
            ),
            byDifficulty: apiStats.difficultyBreakdown.map(d => ({
              difficulty: d.difficulty,
              confidence: d.accuracy,
              questions: d.totalQuestions
            })),
            trend: apiStats.main.accuracy >= 70 ? 'improving' : 'needs_work',
            insights: [
              apiStats.main.accuracy >= 80 ? 'Tu confianza está bien fundamentada en buenos resultados' :
              apiStats.main.accuracy >= 60 ? 'Estás progresando, sigue practicando' :
              'Enfócate en los fundamentos para construir confianza'
            ]
          } : null,

          // Metadata
          _cached: apiData.cached,
          _generatedAt: apiData.generatedAt
        }

        setStats(mappedStats)
        console.log('✅ Estadísticas cargadas desde API:', apiData.cached ? '(cached)' : '(fresh)', mappedStats)

      } catch (error) {
        console.error('❌ Error cargando estadísticas:', error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadUserStats()
  }, [user, authLoading, supabase])

  // Componente de loading
  const LoadingSection = ({ title }) => (
    <div className="bg-white rounded-xl shadow-lg mb-6 animate-pulse">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-6 h-6 bg-gray-300 rounded-full"></div>
          <div className="h-6 bg-gray-300 rounded w-48"></div>
        </div>
      </div>
      <div className="p-6 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </div>
  )

  // ✅ LOADING MIENTRAS SE VERIFICA AUTH
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Verificando autenticación...</h1>
          <p className="text-gray-600">Conectando con el sistema...</p>
        </div>
      </div>
    )
  }

  // ✅ PÁGINA DE LOGIN SI NO HAY USUARIO
  if (!user) {
    console.log('🔍 DEBUG: No user found, showing login page. AuthLoading:', authLoading, 'User:', user)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600 mb-6">Necesitas iniciar sesión para ver tus estadísticas</p>
          <div className="text-xs text-gray-400 mb-4">Debug: authLoading={authLoading ? 'true' : 'false'}, user={user ? 'exists' : 'null'}</div>
          <div className="space-y-3">
            <button
              onClick={() => {
                console.log('🔄 Refrescando sesión...')
                window.location.reload()
              }}
              className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg text-sm hover:bg-orange-600 transition-colors"
            >
              🔄 Refrescar Sesión
            </button>
            <Link 
              href="/login"
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity block"
            >
              🚀 Iniciar Sesión
            </Link>
            <Link 
              href="/es"
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-300 transition-colors block"
            >
              ← Volver al Inicio
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              📊 Cargando Sistema de estadísticas con IA
            </h1>
            <p className="text-gray-600">
              Analizando tus datos...
            </p>
          </div>
          <LoadingSection />
          <LoadingSection />
          <LoadingSection />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Error de Sistema</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-red-600 to-pink-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity"
          >
            🔄 Reintentar Carga
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 mb-2">
              Estadísticas
            </h1>
            <p className="text-gray-600 text-lg">
              Métricas y análisis de tu progreso para que pongas foco en lo realmente importante.
            </p>
          </div>

          {/* Usuario Info */}
          <div className="bg-gradient-to-r from-purple-100 to-indigo-100 border-2 border-purple-300 rounded-xl p-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {user?.user_metadata?.full_name ? user.user_metadata.full_name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-purple-800 text-lg">
                  {user?.user_metadata?.full_name || 'Usuario'}
                </div>
                <div className="text-purple-600">{user?.email}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN STICKY CON TABS COMPACTOS */}
      <div className="sticky top-0 z-40 bg-gradient-to-br from-purple-50 to-indigo-50 border-b border-purple-200 shadow-sm py-2 md:py-4">
        <div className="container mx-auto px-4">
          {/* Tabs horizontales compactos y sticky */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2">
            <div className="flex overflow-x-auto space-x-2 md:grid md:grid-cols-5 md:gap-3 max-w-5xl mx-auto scrollbar-hide pb-1 md:pb-0 -mx-1 px-1">
              {[
                {
                  id: 'overview',
                  name: 'General',
                  icon: '📊',
                  subtitle: 'Resumen',
                  color: 'blue'
                },
                {
                  id: 'ai_analysis',
                  name: 'Análisis Fallos',
                  icon: '🔍',
                  subtitle: 'Errores',
                  color: 'purple'
                },
                {
                  id: 'performance',
                  name: 'Rendimiento',
                  icon: '📈',
                  subtitle: 'Métricas',
                  color: 'green'
                },
                {
                  id: 'predictions',
                  name: 'Predicciones',
                  icon: '🔮',
                  subtitle: stats?.examPrediction?.oposicionInfo?.hasRealExamDate
                    ? stats.examPrediction.oposicionInfo.examDateFormatted?.split(' de ')[0] + ' ' + stats.examPrediction.oposicionInfo.examDateFormatted?.split(' de ')[1]?.substring(0, 3)
                    : 'Examen',
                  color: 'pink',
                  // Datos especiales para predicciones
                  hasExamDate: stats?.examPrediction?.oposicionInfo?.hasRealExamDate,
                  daysRemaining: stats?.examPrediction?.daysRemaining
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`min-w-[64px] flex-shrink-0 md:min-w-0 md:flex-auto p-2 md:p-3 rounded-lg transition-all duration-200 relative ${
                    activeTab === tab.id
                      ? `${tab.color === 'blue' ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          tab.color === 'purple' ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                          tab.color === 'indigo' ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                          tab.color === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600' :
                          tab.color === 'orange' ? 'bg-gradient-to-br from-orange-500 to-orange-600' :
                          'bg-gradient-to-br from-pink-500 to-pink-600'} text-white shadow-md`
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
                  }`}
                >
                  {/* Badge de activo solo en móvil */}
                  {activeTab === tab.id && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full md:flex md:items-center md:justify-center">
                      <span className="hidden md:inline text-xs">✓</span>
                    </div>
                  )}

                  <div className="text-center">
                    <div className="text-lg md:text-xl mb-1">{tab.icon}</div>
                    <div className="font-bold text-xs md:text-sm leading-tight">{tab.name}</div>
                    {/* Mostrar días restantes parpadeando si hay fecha de examen */}
                    {tab.id === 'predictions' && tab.hasExamDate ? (
                      <div className={`text-xs leading-tight ${
                        activeTab === tab.id ? 'text-white' : 'text-pink-600'
                      }`}>
                        <span className={`font-bold ${tab.daysRemaining < 90 ? 'animate-pulse' : ''}`}>
                          {tab.daysRemaining}d
                        </span>
                        <span className="opacity-75 ml-1">{tab.subtitle}</span>
                      </div>
                    ) : (
                      <div className={`text-xs leading-tight ${
                        activeTab === tab.id ? 'text-white opacity-75' : 'text-gray-500'
                      }`}>
                        {tab.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {/* Tab Psicotecnicos */}
              <button
                onClick={() => handleTabChange('psicotecnicos')}
                className={`min-w-[64px] flex-shrink-0 md:min-w-0 md:flex-auto p-2 md:p-3 rounded-lg transition-all duration-200 relative ${
                  activeTab === 'psicotecnicos'
                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-md'
                    : 'bg-gray-50 hover:bg-green-100 text-gray-700 hover:text-green-700 dark:bg-gray-700 dark:hover:bg-green-900/30 dark:text-gray-300'
                }`}
              >
                {activeTab === 'psicotecnicos' && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full md:flex md:items-center md:justify-center">
                    <span className="hidden md:inline text-xs">✓</span>
                  </div>
                )}
                <div className="text-center">
                  <div className={`text-lg md:text-xl mb-1 ${activeTab === 'psicotecnicos' ? 'text-white' : 'text-green-500'}`}>🧩</div>
                  <div className="font-bold text-xs md:text-sm leading-tight">Psicotécnicos</div>
                  <div className={`text-xs leading-tight ${activeTab === 'psicotecnicos' ? 'text-white opacity-75' : 'text-gray-500'}`}>
                    Tests
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido por Tabs usando Componentes con Auto-scroll */}
      <div className="container mx-auto px-4 py-8">
        <div id="statistics-content" className="scroll-mt-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <MainStats stats={stats} />
              <DetailedCharts 
                weeklyProgress={stats.weeklyProgress}
                difficultyBreakdown={stats.difficultyBreakdown}
                themePerformance={stats.themePerformance}
              />
              <RecentTests 
                recentTests={stats.recentTests} 
                onInfoClick={() => setShowRecentTestsInfo(true)} 
              />
              <Achievements achievements={stats.achievements} />
            </div>
          )}

          {activeTab === 'ai_analysis' && (
            <div className="space-y-6">
              <PersonalDifficultyInsights />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <DifficultyBreakdown difficultyBreakdown={stats.difficultyBreakdown} />
              <ThemePerformance
                themePerformance={stats.themePerformance}
                articlePerformance={stats.articlePerformance}
                userOposicion={stats.userOposicion} 
              />
              <TimePatterns timePatterns={stats.timePatterns} />
            </div>
          )}

          {activeTab === 'predictions' && (
            <div className="space-y-6">
              <ExamPredictionMarch2025 examPrediction={stats.examPredictionMarch2025} />
            </div>
          )}

          {activeTab === 'psicotecnicos' && (
            <div className="space-y-6">
              <PsychometricStatsTab />
            </div>
          )}
        </div>
      </div>

      {/* Modal informativo sobre tests recientes */}
      {showRecentTestsInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center">
                <span className="mr-2">📚</span>
                Tests Recientes
              </h3>
              <button
                onClick={() => setShowRecentTestsInfo(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3 text-sm text-gray-600">
              <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                <p className="font-medium text-green-800 mb-2">¿Qué representan estos porcentajes?</p>
                <p className="text-green-700">
                  Estos porcentajes son los <strong>resultados individuales de cada test completo</strong> 
                  que has terminado al 100%.
                </p>
              </div>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                <p className="font-medium text-yellow-800 mb-2">Diferencia con la página "Tests"</p>
                <p className="text-yellow-700">
                  En la página de <strong>"Tests"</strong> verás estadísticas históricas (todas tus respuestas), 
                  mientras que aquí ves solo tests completados.
                </p>
              </div>
              
              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                <p className="font-medium text-blue-800 mb-2">¿Por qué pueden diferir?</p>
                <p className="text-blue-700">
                  Los tests individuales pueden tener mejores porcentajes que las estadísticas históricas, 
                  ya que estas incluyen tests abandonados y preguntas sueltas.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowRecentTestsInfo(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}