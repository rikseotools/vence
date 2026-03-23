// app/mis-estadisticas/page.tsx - ACTUALIZADO USANDO useAuth GLOBAL
'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext' // ✅ USAR CONTEXTO GLOBAL
import { useOposicion } from '@/contexts/OposicionContext' // ✅ Para obtener oposición del usuario
import OfficialExamAttempts from '@/components/Statistics/OfficialExamAttempts'

// Importar todos los componentes
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
const aiAnalysisCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutos

// ---- Type definitions ----
interface DbResponse {
  is_correct?: boolean
  time_spent_seconds?: number
  difficulty?: string
  article_number?: string | number | null
  law_name?: string | null
  tema_number?: number | null
  theme_number?: number | null
  theme_title?: string | null
  tema_title?: string | null
  test_id?: string
  created_at?: string
  [key: string]: unknown
}

interface DbTest {
  id: string
  user_id?: string
  created_at?: string
  completed_at?: string
  title?: string
  test_type?: string
  tema_number?: number | null
  score?: number
  total_questions?: number
  total_time_seconds?: number
  duration_seconds?: number
  is_completed?: boolean
  config?: Record<string, unknown>
  focus_weak?: boolean
  [key: string]: unknown
}

interface ThemeRange {
  min: number
  max: number
}

interface DifficultyItem {
  difficulty: string
  total: number
  correct: number
  accuracy: number
  avgTime: number
  avgConfidence?: number
  trend?: string
}

interface ArticleItem {
  article: string
  law: string
  theme?: number | null
  total: number
  correct: number
  accuracy: number
  status?: string
  avgTime?: number
  trend?: string
}

interface ThemeItem {
  theme: number
  title: string
  total: number
  correct: number
  accuracy: number
  avgTime?: number
  articlesCount?: number
  status?: string
  trend?: string
}

interface RecentTest {
  id: string
  title: string
  score: number
  total: number
  totalQuestions?: number
  accuracy?: number
  percentage: number
  date: string
  time: string
  avgTimePerQuestion: number
  difficultyBreakdown?: unknown[]
  engagementScore?: number
  focusScore?: number
  completed_at?: string
  formattedDate?: string
  duration?: number
  formattedDuration?: string
  isPsychometric?: boolean
}

interface Achievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  progress: string
  category: string
}

interface WeeklyProgressItem {
  week?: string
  day?: string
  testsCompleted?: number
  questionsAnswered?: number
  questions?: number
  correctAnswers?: number
  accuracy?: number
  studyTime?: number
  trend?: string
}

interface SessionAnalytics {
  totalSessions: number
  avgSessionDuration: number
  avgEngagement: number
  devicesUsed: number
  recentSessions: Array<Record<string, unknown>>
  consistency: number
}

interface Recommendation {
  priority: string
  title: string
  description: string
  action: string
  type?: string
  icon: string
}

interface StatsObject {
  testsCompleted: number
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  averageTime: number
  totalStudyTime: number
  currentStreak: number
  longestStreak?: number
  bestScore: number
  difficultyBreakdown: DifficultyItem[]
  articlePerformance: ArticleItem[]
  themePerformance?: ThemeItem[]
  learningStyle: Record<string, unknown> | null
  timePatterns: Record<string, unknown> | null
  sessionAnalytics: SessionAnalytics | null
  examReadiness: null
  examPredictionMarch2025: Record<string, unknown> | null
  recommendations: Recommendation[]
  recentTests: RecentTest[]
  achievements: Achievement[]
  weeklyProgress: WeeklyProgressItem[]
  knowledgeRetention: Record<string, unknown> | null
  learningEfficiency: Record<string, unknown> | null
  confidenceAnalysis: Record<string, unknown> | null
  deviceAnalytics: Record<string, unknown> | null
  engagementMetrics: Record<string, unknown> | null
  aiImpactData: Record<string, unknown> | null
  userOposicion?: Record<string, unknown> | null
  _cached?: boolean
  _generatedAt?: string
}
// ---- End type definitions ----

// ✅ FUNCIÓN formatTime DEFINIDA AQUÍ
const formatTime = (seconds: number | null | undefined): string => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : `${seconds}s`
}

// ✅ Formatear número de tema interno a nombre legible por bloque
// oposicionSlug determina qué bloques son válidos para esa oposición
const formatThemeName = (num: number, oposicionSlug: string = 'auxiliar-administrativo-estado'): string => {
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
const getValidThemeRanges = (oposicionSlug?: string): ThemeRange[] => {
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
const isThemeValidForOposicion = (themeNumber: number, oposicionSlug: string): boolean => {
  const ranges = getValidThemeRanges(oposicionSlug)
  return ranges.some(r => themeNumber >= r.min && themeNumber <= r.max)
}

// ✅ FUNCIONES AUXILIARES MOVIDAS AL INICIO - ANTES DE SU USO
const generateRealRecommendations = (responses: DbResponse[], articlePerformance: ArticleItem[], accuracy: number): Recommendation[] => {
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

const detectRealLearningStyle = (responses: DbResponse[], learningAnalytics: unknown): Record<string, unknown> | null => {
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
const calculateActiveDays = (tests: DbTest[]): number => {
  if (!tests || tests.length === 0) return 0
  const dates = [...new Set(tests.map(test =>
    new Date(test.completed_at as string).toDateString()
  ))]
  return dates.length
}

const calculateDailyImprovement = (responses: DbResponse[], tests: DbTest[]): number => {
  if (!tests || tests.length < 5) return 0.1
  
  // Ordenar tests por fecha
  const sortedTests = tests.sort((a, b) => new Date(a.completed_at as string).getTime() - new Date(b.completed_at as string).getTime())
  
  // Tomar los primeros y últimos tests para comparar
  const recentCount = Math.min(5, Math.floor(tests.length / 3))
  const oldTests = sortedTests.slice(0, recentCount)
  const recentTests = sortedTests.slice(-recentCount)
  
  // Calcular precisión de cada período
  const oldAccuracy = calculatePeriodAccuracy(oldTests)
  const recentAccuracy = calculatePeriodAccuracy(recentTests)
  
  // Calcular días transcurridos
  const firstDate = new Date(oldTests[0].completed_at as string)
  const lastDate = new Date(recentTests[recentTests.length - 1].completed_at as string)
  const daysDiff = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
  
  // Mejora diaria
  const totalImprovement = recentAccuracy - oldAccuracy
  const dailyImprovement = totalImprovement / daysDiff
  
  return Math.max(0.0, parseFloat(dailyImprovement.toFixed(1)))
}

const calculatePeriodAccuracy = (tests: DbTest[]): number => {
  const totalQuestions = tests.reduce((sum, test) => sum + (test.total_questions || 0), 0)
  const totalCorrect = tests.reduce((sum, test) => sum + (test.score || 0), 0)
  return totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0
}

const calculateLearningSpeed = (responses: DbResponse[], totalStudyTime: number): number => {
  if (!responses || responses.length === 0 || !totalStudyTime) return 50
  
  const questionsPerHour = (responses.length / (totalStudyTime / 3600))
  const accuracyPerHour = (responses.filter(r => r.is_correct).length / (totalStudyTime / 3600))
  
  // Puntuación de 0-100 basada en eficiencia
  return Math.min(100, Math.round((questionsPerHour + accuracyPerHour) * 5))
}

const createEmptyStats = (): StatsObject => ({
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
  examPredictionMarch2025: null,
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

  const [loading, setLoading] = useState<boolean>(true)
  const [stats, setStats] = useState<StatsObject>(createEmptyStats())
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('overview')
  const [showRecentTestsInfo, setShowRecentTestsInfo] = useState<boolean>(false)

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
  const handleTabChange = (tabId: string): void => {
    setActiveTab(tabId)
  }

  // loadCompleteAnalytics eliminado — toda la data se obtiene via /api/stats (Drizzle + Zod)

  // processCompleteAnalytics eliminado — era código muerto, toda la data se obtiene via /api/stats
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

        // Sesiones de usuario desde la API (ya incluidas en apiData.stats)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userSessions = (apiData.stats?.userSessions || []).map((s: any) => ({
          total_duration_minutes: s.totalDurationMinutes,
          engagement_score: s.engagementScore,
          session_start: s.sessionStart,
          tests_completed: s.testsCompleted,
          questions_answered: s.questionsAnswered,
        }))

        // Filtrar sesiones con duración válida para promedios
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validSessions = userSessions?.filter((s: any) => (s.total_duration_minutes || 0) > 0) || []

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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const legislativeTests = apiStats.recentTests.map((t: any) => {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const psychoTests = completedPsychometricSessions.map((ps: any) => ({
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filtered = apiStats.themePerformance
              .filter((t: any) => isThemeValidForOposicion(t.temaNumber, oposicionSlug))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return filtered.map((t: any) => {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          difficultyBreakdown: apiStats.difficultyBreakdown.map((d: any) => ({
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          articlePerformance: [...apiStats.weakArticles, ...apiStats.strongArticles].map((a: any) => ({
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              apiStats.difficultyBreakdown.filter((d: any) => d.accuracy < 70).length +
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const filteredThemePerformance = apiStats.themePerformance
              .filter((t: any) => isThemeValidForOposicion(t.temaNumber, oposicionSlug))

            // Tema "estudiado" = ≥10 preguntas Y ≥50% precisión (criterio similar a desbloqueo)
            const studiedThemes = filteredThemePerformance
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t: any) => t.totalQuestions >= 10 && t.accuracy >= 50).length
            const coveragePercentage = Math.min(100, Math.round((studiedThemes / totalThemes) * 100))

            // Temas dominados (accuracy >= 80% Y ≥10 preguntas) - también filtrados
            const masteredThemes = filteredThemePerformance
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((t: any) => t.totalQuestions >= 10 && t.accuracy >= 80).length
            const masteredPercentage = Math.round((masteredThemes / totalThemes) * 100)
            const accuracy = apiStats.main.accuracy

            // Fecha del examen REAL desde la BD o estimación
            const examDateStr = oposicion?.examDate
            const examDate = examDateStr ? new Date(examDateStr) : new Date('2026-07-01')
            const hasRealExamDate = !!examDateStr
            const today = new Date()
            const daysRemaining = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const weeklyQuestions = apiStats.weeklyProgress.reduce((sum: number, day: any) => sum + day.questions, 0)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const activeDaysInWeek = apiStats.weeklyProgress.filter((d: any) => d.questions > 0).length
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              action: `Estudiar específicamente: ${apiStats.weakArticles.slice(0, 3).map((a: any) => `${a.lawName} Art.${a.articleNumber}`).join(', ')}`,
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? Math.round(validSessions.reduce((sum: number, s: any) => sum + (s.total_duration_minutes || 0), 0) / validSessions.length)
              : 0,
            avgEngagement: validSessions.length > 0
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? Math.round(validSessions.reduce((sum: number, s: any) => sum + (s.engagement_score || 0), 0) / validSessions.length)
              : 0,
            devicesUsed: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            recentSessions: userSessions.slice(0, 5).map((s: any) => ({
              date: new Date(s.session_start).toLocaleDateString('es-ES'),
              duration: s.total_duration_minutes || 0,
              engagement: s.engagement_score || 0,
              device: 'Web',
              testsCompleted: s.tests_completed || 0,
              questionsAnswered: s.questions_answered || 0
            })),
            consistency: (() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const last30Days = userSessions.filter((s: any) => {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            weeklyActivity: apiStats.weeklyProgress.map((w: any) => ({ day: w.day, questions: w.questions })),
            streakData: {
              current: apiStats.main.currentStreak,
              longest: apiStats.main.longestStreak,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              thisWeek: apiStats.weeklyProgress.filter((w: any) => w.questions > 0).length
            },
            completionRate: apiStats.main.totalTests > 0 ? 100 : 0,
            averageSessionLength: Math.round(apiStats.main.totalStudyTimeSeconds / Math.max(1, apiStats.main.totalTests) / 60)
          } : null,

          // Retención de conocimiento - basado en artículos fuertes/débiles
          knowledgeRetention: apiStats.main.totalQuestions >= 50 ? {
            overallRetention: Math.round(
              (apiStats.strongArticles.length / Math.max(1, apiStats.strongArticles.length + apiStats.weakArticles.length)) * 100
            ),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            byTheme: apiStats.themePerformance.slice(0, 5).map((t: any) => ({
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            byDifficulty: apiStats.difficultyBreakdown.map((d: any) => ({
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

        setStats(mappedStats as unknown as StatsObject)
        console.log('✅ Estadísticas cargadas desde API:', apiData.cached ? '(cached)' : '(fresh)', mappedStats)

      } catch (error) {
        console.error('❌ Error cargando estadísticas:', error)
        setError((error as Error).message)
      } finally {
        setLoading(false)
      }
    }

    loadUserStats()
  }, [user, authLoading, supabase])

  // Componente de loading
  const LoadingSection = ({ title }: { title?: string }) => (
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
                  subtitle: (stats?.examPredictionMarch2025 as any)?.oposicionInfo?.hasRealExamDate
                    ? (stats.examPredictionMarch2025 as any).oposicionInfo.examDateFormatted?.split(' de ')[0] + ' ' + (stats.examPredictionMarch2025 as any).oposicionInfo.examDateFormatted?.split(' de ')[1]?.substring(0, 3)
                    : 'Examen',
                  color: 'pink',
                  // Datos especiales para predicciones
                  hasExamDate: (stats?.examPredictionMarch2025 as any)?.oposicionInfo?.hasRealExamDate,
                  daysRemaining: (stats?.examPredictionMarch2025 as any)?.daysRemaining
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
              <DetailedCharts
                weeklyProgress={stats.weeklyProgress}
                difficultyBreakdown={stats.difficultyBreakdown}
                themePerformance={stats.themePerformance || []}
              />
              <RecentTests
                recentTests={stats.recentTests as any}
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
                themePerformance={stats.themePerformance as any}
                articlePerformance={stats.articlePerformance as any}
                userOposicion={stats.userOposicion as any}
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