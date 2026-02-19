// app/auxiliar-administrativo-estado/test/tema/[numero]/page.tsx - REFACTORIZADO CON API LAYER + LAZY LOADING
'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { getSupabaseClient } from '../../../../../lib/supabase'
import TestConfigurator from '@/components/TestConfigurator'
import ArticleModal from '@/components/ArticleModal'
import { generateLawSlug } from '@/lib/lawMappingUtils'
import { safeParseGetTopicDataResponse, type GetTopicDataResponse } from '@/lib/api/topic-data/schemas'

const supabase = getSupabaseClient()

// Tipos para el componente principal
interface PageProps {
  params: Promise<{ numero: string }>
}

interface TopicData {
  id: string
  topic_number: number
  title: string
  description: string | null
  difficulty: string | null
  estimated_hours: number | null
}

interface UserStats {
  totalAnswers: number
  overallAccuracy: number
  performanceByDifficulty: Record<string, any>
  isRealData: boolean
  dataSource?: string
  periodAnalyzed?: string
  lastUpdated?: string
  uniqueQuestionsAnswered: number
  totalQuestionsAvailable: number
  neverSeen: number
}

interface SelectedArticle {
  number: string | null
  lawSlug: string | null
}

interface ArticlesCountByLawItem {
  law_short_name: string
  law_name: string
  articles_with_questions: number
}

interface UserRecentStats {
  last7Days: number
  last15Days: number
  last30Days: number
  recentlyAnswered: number
  getExcludedCount: (days: number) => number
}

// Tipos para ArticulosEstudioPrioritario
interface ArticulosEstudioPrioritarioProps {
  userAnswers: any[]
  tema: number
  totalRespuestas: number
  openArticleModal: (articleNumber: string, lawName: string) => void
}

interface ArticuloAgrupado {
  article_number: string | null
  law_name: string | null
  total_respuestas: number
  correctas: number
  incorrectas: number
  tiempo_promedio: number
  confianza_baja: number
  ultima_respuesta: string
  fallos_consecutivos: number
  ultima_correcta: string | null
}

interface ArticuloProblematico extends ArticuloAgrupado {
  precision: string
  porcentaje_confianza_baja: string
  tasa_fallos: string
  score_problema: number
}

interface Recomendacion {
  tipo: string
  prioridad: string
  titulo: string
  descripcion: string
  articulos: ArticuloProblematico[]
  accion: string
  iconoGrande?: string
  colorScheme: string
}

// Tipos para RecomendacionCard
interface RecomendacionCardProps {
  recomendacion: Recomendacion
  openArticleModal: (articleNumber: string, lawName: string) => void
}

export default function TemaPage({ params }: PageProps) {
  // Estados principales
  const [resolvedParams, setResolvedParams] = useState<{ numero: string } | null>(null)
  const [temaNumber, setTemaNumber] = useState<number | null>(null)
  const [topicData, setTopicData] = useState<TopicData | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [temaNotFound, setTemaNotFound] = useState(false)
  const [showOposicionDropdown, setShowOposicionDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Estados para estadísticas (del API)
  const [difficultyStats, setDifficultyStats] = useState<Record<string, number>>({})
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userStatsLoading, setUserStatsLoading] = useState(false) // Lazy loading del progreso
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0)
  const [articlesCountByLaw, setArticlesCountByLaw] = useState<ArticlesCountByLawItem[]>([])

  // Estados para configurador avanzado
  const [testLoading, setTestLoading] = useState(false)
  const [userRecentStats, setUserRecentStats] = useState<UserRecentStats | null>(null)
  const [userAnswers, setUserAnswers] = useState<any[]>([])

  // Estados para modal de artículo
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<SelectedArticle>({ number: null, lawSlug: null })

  // Estado para modo práctica/examen
  const [testMode, setTestMode] = useState<'practica' | 'examen'>('practica')

  // Cargar preferencia de modo desde localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('preferredTestMode')
    if (savedMode === 'practica' || savedMode === 'examen') {
      setTestMode(savedMode)
    }
  }, [])

  // Función helper para cambiar modo y guardar preferencia
  const handleTestModeChange = (newMode: 'practica' | 'examen') => {
    setTestMode(newMode)
    localStorage.setItem('preferredTestMode', newMode)
  }

  // FUNCIÓN CONSOLIDADA: Cargar todos los datos del tema desde API
  const loadTopicData = useCallback(async (tema: number, userId: string | null): Promise<GetTopicDataResponse | null> => {
    try {
      const queryParams = new URLSearchParams({
        oposicion: 'auxiliar-administrativo-estado',
        ...(userId && { userId })
      })

      const response = await fetch(`/api/topics/${tema}?${queryParams}`)
      const raw = await response.json()

      const parsed = safeParseGetTopicDataResponse(raw)
      if (!parsed.success) {
        console.error('❌ [Zod] Respuesta API inválida:', parsed.error.issues)
        return null
      }

      if (!parsed.data.success) {
        console.error('Error cargando datos del tema:', parsed.data.error)
        return null
      }

      return parsed.data
    } catch (error) {
      console.error('Error en loadTopicData:', error)
      return null
    }
  }, [])

  // REFRESH: Cuando la página vuelve a ser visible
  useEffect(() => {
    if (!currentUser || !temaNumber || loading) return

    const handleVisibilityOrFocus = async () => {
      if (document.hidden) return

      console.log('🔄 Refrescando datos del tema...')
      const data = await loadTopicData(temaNumber, currentUser.id)

      if (data?.success) {
        setDifficultyStats(data.difficultyStats || {})
        setOfficialQuestionsCount(data.officialQuestionsCount || 0)
        setArticlesCountByLaw(data.articlesByLaw?.map((a) => ({
          law_short_name: a.lawShortName,
          law_name: a.lawName,
          articles_with_questions: a.articlesWithQuestions
        })) || [])

        if (data.userProgress) {
          setUserStats({
            totalAnswers: data.userProgress.totalAnswers,
            overallAccuracy: data.userProgress.overallAccuracy,
            performanceByDifficulty: data.userProgress.performanceByDifficulty,
            isRealData: true,
            dataSource: 'api_layer',
            uniqueQuestionsAnswered: data.userProgress.uniqueQuestionsAnswered,
            totalQuestionsAvailable: data.userProgress.totalQuestionsAvailable,
            neverSeen: data.userProgress.neverSeen
          })

          // Cargar userRecentStats desde userProgress
          const recentStats = data.userProgress.recentStats
          if (recentStats) {
            setUserRecentStats({
              last7Days: recentStats.last7Days,
              last15Days: recentStats.last15Days,
              last30Days: recentStats.last30Days,
              recentlyAnswered: recentStats.last15Days,
              getExcludedCount: (days: number) => {
                if (days <= 7) return recentStats.last7Days
                if (days <= 15) return recentStats.last15Days
                return recentStats.last30Days
              }
            })
          }

          // Actualizar detailedAnswers para métricas
          setUserAnswers(data.userProgress.detailedAnswers || [])
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)
    window.addEventListener('pageshow', handleVisibilityOrFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      window.removeEventListener('pageshow', handleVisibilityOrFocus)
    }
  }, [currentUser, temaNumber, loading, loadTopicData])

  // Efecto para cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOposicionDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Resolver params async
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      // Validar número de tema (1-16 Bloque I, 101-112 Bloque II)
      if (isNaN(tema) || tema < 1 || (tema > 16 && tema < 101) || tema > 200) {
        setTemaNotFound(true)
        setLoading(false)
        return
      }
    }

    resolveParams()
  }, [params])

  // CARGAR DATOS: Dos fases para carga rápida
  // Fase 1: Datos del tema (sin userId) - rápido, cacheado
  // Fase 2: Progreso del usuario (con userId) - lazy loading
  useEffect(() => {
    if (!temaNumber || temaNotFound) return

    async function fetchAllData() {
      try {
        // FASE 1: Cargar datos básicos del tema SIN userId (muy rápido, cacheado)
        const basicData = await loadTopicData(temaNumber!, null)

        if (!basicData?.success) {
          setTemaNotFound(true)
          setLoading(false)
          return
        }

        // Actualizar datos del tema inmediatamente
        if (!basicData.topic) {
          setTemaNotFound(true)
          setLoading(false)
          return
        }
        setTopicData({
          id: basicData.topic.id,
          topic_number: basicData.topic.topicNumber,
          title: basicData.topic.title,
          description: basicData.topic.description,
          difficulty: basicData.topic.difficulty,
          estimated_hours: basicData.topic.estimatedHours
        })

        setDifficultyStats(basicData.difficultyStats || {})
        setOfficialQuestionsCount(basicData.officialQuestionsCount || 0)

        // Transformar articlesByLaw al formato esperado por el componente
        setArticlesCountByLaw(basicData.articlesByLaw?.map((a) => ({
          law_short_name: a.lawShortName,
          law_name: a.lawName,
          articles_with_questions: a.articlesWithQuestions
        })) || [])

        // Página lista para mostrar
        setLoading(false)

        // FASE 2: Cargar progreso del usuario en segundo plano (lazy loading)
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          setUserStatsLoading(true)

          const userData = await loadTopicData(temaNumber!, user.id)

          if (userData?.success && userData.userProgress) {
            setUserStats({
              totalAnswers: userData.userProgress.totalAnswers,
              overallAccuracy: userData.userProgress.overallAccuracy,
              performanceByDifficulty: userData.userProgress.performanceByDifficulty,
              isRealData: true,
              dataSource: 'api_layer',
              periodAnalyzed: 'historial completo',
              lastUpdated: userData.generatedAt,
              uniqueQuestionsAnswered: userData.userProgress.uniqueQuestionsAnswered,
              totalQuestionsAvailable: userData.userProgress.totalQuestionsAvailable,
              neverSeen: userData.userProgress.neverSeen
            })

            // Configurar userRecentStats
            const recentStats = userData.userProgress.recentStats
            if (recentStats) {
              setUserRecentStats({
                last7Days: recentStats.last7Days,
                last15Days: recentStats.last15Days,
                last30Days: recentStats.last30Days,
                recentlyAnswered: recentStats.last15Days,
                getExcludedCount: (days: number) => {
                  if (days <= 7) return recentStats.last7Days
                  if (days <= 15) return recentStats.last15Days
                  return recentStats.last30Days
                }
              })
            }

            // Usar detailedAnswers del API para métricas
            setUserAnswers(userData.userProgress.detailedAnswers || [])
          }

          setUserStatsLoading(false)
        }

      } catch (error) {
        console.error('Error cargando datos del tema:', error)
        setTemaNotFound(true)
        setLoading(false)
      }
    }

    fetchAllData()
  }, [temaNumber, temaNotFound, loadTopicData])

  // Función: Abrir modal de artículo
  function openArticleModal(articleNumber: string, lawName: string) {
    const lawSlug = lawName ? generateLawSlug(lawName) : 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setModalOpen(true)
  }

  // Función: Cerrar modal de artículo
  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
  }

  // Función: Manejar configuración del test personalizado
  async function handleStartCustomTest(config: any) {
    setTestLoading(true)

    try {
      const params = new URLSearchParams({
        n: config.numQuestions.toString(),
        exclude_recent: config.excludeRecent.toString(),
        recent_days: config.recentDays.toString(),
        difficulty_mode: config.difficultyMode,
        ...(config.onlyOfficialQuestions && { only_official: 'true' }),
        ...(config.focusEssentialArticles && { focus_essential: 'true' }),
        ...(config.focusWeakAreas && { focus_weak: 'true' }),
        ...(config.adaptiveMode && { adaptive: 'true' }),
        ...(config.onlyFailedQuestions && { only_failed: 'true' }),
        ...(config.failedQuestionIds && { failed_question_ids: JSON.stringify(config.failedQuestionIds) }),
        ...(config.failedQuestionsOrder && { failed_questions_order: config.failedQuestionsOrder }),
        ...(config.timeLimit && { time_limit: config.timeLimit.toString() })
      })

      if (config.selectedLaws && config.selectedLaws.length > 0) {
        params.set('selected_laws', JSON.stringify(config.selectedLaws))
      }

      if (config.selectedArticlesByLaw && Object.keys(config.selectedArticlesByLaw).length > 0) {
        params.set('selected_articles_by_law', JSON.stringify(config.selectedArticlesByLaw))
      }

      // 📚 FILTRO DE SECCIONES/TÍTULOS
      console.log('📚 DEBUG selectedSectionFilters en handleStartCustomTest:', {
        exists: !!config.selectedSectionFilters,
        length: config.selectedSectionFilters?.length,
        value: config.selectedSectionFilters
      })
      if (config.selectedSectionFilters && config.selectedSectionFilters.length > 0) {
        params.set('selected_section_filters', JSON.stringify(config.selectedSectionFilters))
        console.log('📚 ✅ selected_section_filters añadido a URL')
      }

      const testPath = testMode === 'examen' ? 'test-examen' : 'test-personalizado'
      const testUrl = `/auxiliar-administrativo-estado/test/tema/${temaNumber!}/${testPath}?${params.toString()}`

      window.location.href = testUrl

    } catch (error) {
      console.error('Error iniciando test:', error)
      setTestLoading(false)
    }
  }

  // Calcular totales
  const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

  // LOADING STATE
  if (loading && !temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando tema...</p>
        </div>
      </div>
    )
  }

  // Past this point, temaNumber is guaranteed non-null
  const tema = temaNumber!

  // TEMA NO ENCONTRADO
  if (temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Encontrado
          </h1>
          <p className="text-gray-600 mb-6">
            {temaNumber ?
              `El Tema ${temaNumber} no existe o no está disponible para Auxiliar Administrativo del Estado.` :
              'Número de tema inválido.'
            }
          </p>
          <Link
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a todos los temas
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* HEADER CON DROPDOWN */}
        <div className="text-center mb-8">
          <div className="relative inline-block" ref={dropdownRef}>
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-3">
              <span className="mr-1">🏛️</span>
              <Link
                href="/auxiliar-administrativo-estado/test"
                className="hover:text-blue-900 transition-colors"
              >
                Auxiliar Administrativo del Estado
              </Link>
              <button
                onClick={() => setShowOposicionDropdown(!showOposicionDropdown)}
                className="ml-1 hover:text-blue-900 transition-colors"
              >
                <span className="text-xs">▼</span>
              </button>
              <span className="mx-2 text-blue-600">›</span>
              <span className="font-semibold">
                {tema >= 101 ? 'Bloque II' : 'Bloque I'}
              </span>
            </div>

            {/* Dropdown de Oposiciones */}
            {showOposicionDropdown && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-2">
                  <Link
                    href="/auxiliar-administrativo-estado/test"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">🏛️</span>
                      <div>
                        <div className="font-medium">Auxiliar Administrativo del Estado</div>
                        <div className="text-xs text-gray-500">Todos los temas</div>
                      </div>
                    </div>
                  </Link>

                  <div className="border-t border-gray-100 my-1"></div>

                  <Link
                    href="/administrativo-estado"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">🏛️</span>
                      <div>
                        <div className="font-medium">Administrativo del Estado</div>
                        <div className="text-xs text-gray-500">Cambiar oposición</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            {topicData?.title?.startsWith('Tema ') ?
              topicData.title :
              `Tema ${tema >= 101 ? tema - 100 : tema}: ${topicData?.title}`
            }
          </h1>

          <p className="text-gray-600 text-sm md:text-base mb-4">
            {topicData?.description}
          </p>

          <div className="space-y-2">
            <p className="text-gray-600 text-sm md:text-base">
              {totalQuestions > 0 ? `${totalQuestions} preguntas disponibles para este tema` : 'Cargando preguntas...'}
            </p>

            {officialQuestionsCount > 0 && (
              <p className="text-purple-600 font-medium text-sm md:text-base">
                🏛️ {officialQuestionsCount} preguntas de exámenes oficiales disponibles
              </p>
            )}

            {/* Mostrar progreso del usuario - Cargando */}
            {userStatsLoading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-gray-500 text-sm">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando tu progreso...</span>
              </div>
            )}

            {/* Mostrar progreso del usuario - Datos */}
            {!userStatsLoading && currentUser && userStats && userStats.totalQuestionsAvailable > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-green-600 font-medium text-sm">
                  {userStats.uniqueQuestionsAnswered} vistas
                </p>
                <p className="text-blue-600 font-medium text-sm">
                  {userStats.neverSeen} nunca vistas
                </p>
              </div>
            )}

            {/* MOSTRAR ARTÍCULOS CON PREGUNTAS */}
            {articlesCountByLaw.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-700 font-medium text-sm mb-2">Artículos con preguntas disponibles:</p>
                <div className="text-center space-y-1">
                  {articlesCountByLaw.map((lawData, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{lawData.law_short_name}:</span> {lawData.articles_with_questions} artículo{lawData.articles_with_questions > 1 ? 's' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TOGGLE MODO PRÁCTICA/EXAMEN */}
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">
              Selecciona el modo de estudio
            </h2>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => handleTestModeChange('practica')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  testMode === 'practica'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="text-3xl mb-2">📚</div>
                <div className="font-bold text-gray-800 mb-1">Práctica</div>
                <div className="text-sm text-gray-600">
                  Preguntas una a una con feedback inmediato
                </div>
              </button>

              <button
                onClick={() => handleTestModeChange('examen')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  testMode === 'examen'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="text-3xl mb-2">📝</div>
                <div className="font-bold text-gray-800 mb-1">Examen</div>
                <div className="text-sm text-gray-600">
                  Todas las preguntas de una vez, corrección al final
                </div>
              </button>
            </div>

            <div className={`p-4 rounded-lg ${testMode === 'practica' ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'}`}>
              <div className="text-sm">
                {testMode === 'practica' ? (
                  <>
                    <span className="font-semibold text-blue-800">Modo Práctica:</span>
                    <span className="text-blue-700"> Verás una pregunta a la vez con explicación inmediata. Ideal para aprender, repasar y consolidar conocimientos con el sistema adaptativo.</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-purple-800">Modo Examen:</span>
                    <span className="text-purple-700"> Verás todas las preguntas en un scroll continuo. Responde todas y al final haz clic en "Corregir" para ver tu resultado. Ideal para simular exámenes reales.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CONFIGURADOR AVANZADO */}
        <section className="mb-8">
          <TestConfigurator
            tema={tema}
            temaDisplayName={topicData ? `${tema >= 101 ? `Bloque II - Tema ${tema - 100}` : `Tema ${tema}`}: ${topicData.title}` : null}
            totalQuestions={difficultyStats as any}
            onStartTest={handleStartCustomTest}
            userStats={userRecentStats as any}
            loading={testLoading}
            currentUser={currentUser}
            lawsData={articlesCountByLaw as any}
            officialQuestionsCount={officialQuestionsCount}
            testMode={testMode}
          />
        </section>

        {/* Tu Progreso - Lazy Loading */}
        {userStatsLoading && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
              Tu Progreso en el {tema >= 101 ? `Bloque II. Tema ${tema - 100}` : `Tema ${tema}`}
            </h2>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-center gap-3 py-8 text-gray-500">
                <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando estadísticas personales...</span>
              </div>
            </div>
          </section>
        )}

        {/* Tu Progreso - Datos cargados */}
        {!userStatsLoading && currentUser && userStats && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
              Tu Progreso en el {tema >= 101 ? `Bloque II. Tema ${tema - 100}` : `Tema ${tema}`}
            </h2>

            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              {userStats.totalAnswers === 0 ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="font-bold text-gray-800 text-xl mb-2">¡Empieza tu primer test del {tema >= 101 ? `Bloque II. Tema ${tema - 100}` : `Tema ${tema}`}!</h3>
                  <p className="text-gray-600">
                    Completa preguntas para ver tus estadísticas personales y análisis de rendimiento.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">Rendimiento Personal</h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{userStats.overallAccuracy.toFixed(1)}%</div>
                      <div className="text-sm text-gray-500">{userStats.totalAnswers} respuestas en {tema >= 101 ? `Bloque II. Tema ${tema - 100}` : `Tema ${tema}`}</div>
                      {userStats.isRealData && (
                        <div className="text-xs text-green-600 font-medium">Datos reales</div>
                      )}
                    </div>
                  </div>

                  {/* MÉTRICAS ÚTILES */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

                    {/* Métrica 1: Tendencia Reciente */}
                    <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="font-bold text-blue-800 mb-2 text-sm">Últimos 7 días</div>
                      <div className="text-xl font-bold text-blue-600 mb-1">
                        {(() => {
                          const recent7Days = userAnswers?.filter(a =>
                            new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          ) || []
                          const recentAccuracy = recent7Days.length > 0
                            ? (recent7Days.filter(a => a.isCorrect).length / recent7Days.length * 100).toFixed(0)
                            : 'N/A'
                          return `${recentAccuracy}%`
                        })()}
                      </div>
                      <div className="text-xs text-blue-600">
                        {(() => {
                          const recent7Days = userAnswers?.filter(a =>
                            new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          ) || []
                          return `${recent7Days.length} respuestas`
                        })()}
                      </div>
                    </div>

                    {/* Métrica 2: Velocidad Promedio */}
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="font-bold text-green-800 mb-2 text-sm">Velocidad</div>
                      <div className="text-xl font-bold text-green-600 mb-1">
                        {(() => {
                          const avgTime = userAnswers?.reduce((sum, a) => sum + (a.timeSpentSeconds || 0), 0) / (userAnswers?.length || 1)
                          return avgTime > 0 ? `${Math.round(avgTime)}s` : 'N/A'
                        })()}
                      </div>
                      <div className="text-xs text-green-600">por pregunta</div>
                    </div>

                    {/* Métrica 3: Racha Actual */}
                    <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="font-bold text-purple-800 mb-2 text-sm">Racha</div>
                      <div className="text-xl font-bold text-purple-600 mb-1">
                        {(() => {
                          const dates = [...new Set(userAnswers?.map(a =>
                            new Date(a.createdAt).toDateString()
                          ) || [])].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())

                          let streak = 0
                          let currentDate = new Date()

                          for (const date of dates) {
                            const diffDays = Math.floor((currentDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
                            if (diffDays === streak) {
                              streak++
                              currentDate = new Date(date)
                            } else {
                              break
                            }
                          }

                          return streak
                        })()}
                      </div>
                      <div className="text-xs text-purple-600">días seguidos</div>
                    </div>

                    {/* Métrica 4: Artículos Únicos */}
                    <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="font-bold text-orange-800 mb-2 text-sm">Cobertura</div>
                      <div className="text-xl font-bold text-orange-600 mb-1">
                        {(() => {
                          const uniqueArticles = new Set(userAnswers?.map(a => a.articleNumber).filter(Boolean) || [])
                          return uniqueArticles.size
                        })()}
                      </div>
                      <div className="text-xs text-orange-600">artículos distintos</div>
                    </div>
                  </div>

                  {/* ANÁLISIS INTELIGENTE */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                      <span className="mr-2">🎯</span>
                      Análisis Inteligente de Estudio - Tema {tema}
                    </h4>

                    <ArticulosEstudioPrioritario
                      userAnswers={userAnswers}
                      tema={tema}
                      totalRespuestas={userStats.totalAnswers}
                      openArticleModal={openArticleModal}
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* MENSAJE CUANDO NO HAY ESTADÍSTICAS */}
        {!userStatsLoading && currentUser && !userStats && (
          <section className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-bold text-blue-800 mb-2">¡Empieza a practicar!</h3>
              <p className="text-blue-700 text-sm">
                Completa algunos tests para ver tus estadísticas personales del Tema {tema}.
              </p>
            </div>
          </section>
        )}

        {/* PREGUNTAS POR DIFICULTAD */}
        {Object.keys(difficultyStats).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Preguntas por Dificultad
            </h2>

            <div className="space-y-2">
              {Object.entries(difficultyStats)
                .sort(([,a], [,b]) => b - a)
                .map(([difficulty, count]) => (
                <div key={difficulty} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-3" style={{
                      backgroundColor: {
                        'easy': '#10b981',
                        'medium': '#f59e0b',
                        'hard': '#ef4444',
                        'extreme': '#8b5cf6',
                        'auto': '#6b7280'
                      }[difficulty] || '#6b7280'
                    }}></span>
                    <span className="font-medium text-gray-700 capitalize">
                      {difficulty === 'auto' ? 'Automática' :
                       difficulty === 'easy' ? 'Fácil' :
                       difficulty === 'medium' ? 'Media' :
                       difficulty === 'hard' ? 'Difícil' :
                       difficulty === 'extreme' ? 'Extrema' : difficulty}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-gray-900 mr-2">{count}</span>
                    <span className="text-sm text-gray-500">
                      ({((count / totalQuestions) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">Total:</span>
                <span className="font-bold text-blue-600 text-lg">{totalQuestions} preguntas</span>
              </div>
            </div>
          </div>
        )}

        {/* NAVEGACIÓN DE VUELTA */}
        <div className="mt-8 text-center">
          <Link
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a todos los temas
          </Link>
        </div>

      </div>

      {/* MODAL DE ARTÍCULO */}
      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
      />
    </div>
  )
}

// COMPONENTE: Artículos de Estudio Prioritario
function ArticulosEstudioPrioritario({ userAnswers, tema, totalRespuestas, openArticleModal }: ArticulosEstudioPrioritarioProps) {
  const { articulosFallados, recomendaciones } = useMemo(() => {
    const totalRespuestasReales = userAnswers.length

    if (totalRespuestasReales === 0) {
      return {
        articulosFallados: [] as ArticuloProblematico[],
        recomendaciones: generarRecomendacionesInteligentes([], 0, tema),
      }
    }

    // Agrupar por artículo
    const articulosAgrupados = userAnswers.reduce((acc: Record<string, ArticuloAgrupado>, respuesta: any) => {
      const key = respuesta.articleNumber || 'sin-articulo'

      if (!acc[key]) {
        acc[key] = {
          article_number: respuesta.articleNumber,
          law_name: respuesta.lawName,
          total_respuestas: 0,
          correctas: 0,
          incorrectas: 0,
          tiempo_promedio: 0,
          confianza_baja: 0,
          ultima_respuesta: respuesta.createdAt,
          fallos_consecutivos: 0,
          ultima_correcta: null
        }
      }

      acc[key].total_respuestas++
      if (respuesta.isCorrect) {
        acc[key].correctas++
        acc[key].ultima_correcta = respuesta.createdAt
        acc[key].fallos_consecutivos = 0
      } else {
        acc[key].incorrectas++
        acc[key].fallos_consecutivos++
      }

      acc[key].tiempo_promedio += respuesta.timeSpentSeconds || 0
      if (respuesta.confidenceLevel === 'unsure' || respuesta.confidenceLevel === 'guessing') {
        acc[key].confianza_baja++
      }

      return acc
    }, {})

    const articulosProblematicos = (Object.values(articulosAgrupados) as ArticuloAgrupado[])
      .map(articulo => {
        const precision = (articulo.correctas / articulo.total_respuestas) * 100
        const tiempo_promedio = articulo.tiempo_promedio / articulo.total_respuestas
        const porcentaje_confianza_baja = (articulo.confianza_baja / articulo.total_respuestas) * 100
        const tasa_fallos = (articulo.incorrectas / articulo.total_respuestas) * 100

        return {
          ...articulo,
          precision: precision.toFixed(1),
          tiempo_promedio: Math.round(tiempo_promedio),
          porcentaje_confianza_baja: porcentaje_confianza_baja.toFixed(1),
          tasa_fallos: tasa_fallos.toFixed(1),
          score_problema: (100 - precision) + porcentaje_confianza_baja + (articulo.fallos_consecutivos * 10)
        }
      })
      .filter(articulo => {
        if (totalRespuestasReales < 10) {
          return articulo.incorrectas >= 1
        } else {
          return (
            articulo.total_respuestas >= 2 &&
            (
              parseFloat(articulo.precision) < 75 ||
              parseFloat(articulo.porcentaje_confianza_baja) > 25 ||
              articulo.incorrectas >= 2
            )
          )
        }
      })
      .sort((a, b) => b.score_problema - a.score_problema)
      .slice(0, 12)

    return {
      articulosFallados: articulosProblematicos,
      recomendaciones: generarRecomendacionesInteligentes(articulosProblematicos, totalRespuestasReales, tema),
    }
  }, [userAnswers, tema])

  function generarRecomendacionesInteligentes(articulosFalladosParam: ArticuloProblematico[], totalRespuestasReales: number, temaNumero: number): Recomendacion[] {
    const recomendacionesGeneradas: Recomendacion[] = []

    if (totalRespuestasReales === 0) {
      recomendacionesGeneradas.push({
        tipo: 'sin_datos',
        prioridad: 'info',
        titulo: `EMPIEZA TU ESTUDIO DEL TEMA ${temaNumero}`,
        descripcion: `No tienes respuestas registradas en el Tema ${temaNumero} aún.`,
        articulos: [],
        accion: 'Completa tu primer test para comenzar el análisis personalizado',
        iconoGrande: '🎯',
        colorScheme: 'blue'
      })
      return recomendacionesGeneradas
    }

    if (totalRespuestasReales < 10) {
      recomendacionesGeneradas.push({
        tipo: 'datos_insuficientes',
        prioridad: 'info',
        titulo: 'DATOS INSUFICIENTES PARA ANÁLISIS COMPLETO',
        descripcion: `Solo tienes ${totalRespuestasReales} respuesta${totalRespuestasReales > 1 ? 's' : ''} en el Tema ${temaNumero}. Necesitas al menos 10-15 para un análisis confiable.`,
        articulos: [],
        accion: 'Completa más tests para obtener recomendaciones personalizadas detalladas',
        iconoGrande: '📈',
        colorScheme: 'yellow'
      })

      if (articulosFalladosParam.length > 0) {
        recomendacionesGeneradas.push({
          tipo: 'observacion_preliminar',
          prioridad: 'info',
          titulo: 'PRIMERAS OBSERVACIONES',
          descripcion: `Hemos detectado ${articulosFalladosParam.length} artículo${articulosFalladosParam.length > 1 ? 's' : ''} con fallos iniciales en el Tema ${temaNumero}.`,
          articulos: articulosFalladosParam.slice(0, 3),
          accion: 'Estos artículos podrían necesitar atención, pero necesitamos más datos para confirmarlo',
          colorScheme: 'blue'
        })
      }

      return recomendacionesGeneradas
    }

    if (totalRespuestasReales < 25) {
      recomendacionesGeneradas.push({
        tipo: 'analisis_limitado',
        prioridad: 'info',
        titulo: 'ANÁLISIS PRELIMINAR',
        descripcion: `Con ${totalRespuestasReales} respuestas en el Tema ${temaNumero} podemos dar recomendaciones básicas. Para análisis completo necesitas 25+ respuestas.`,
        articulos: articulosFalladosParam.slice(0, 3),
        accion: 'Continúa practicando para obtener análisis más detallado y confiable',
        iconoGrande: '📊',
        colorScheme: 'yellow'
      })

      if (articulosFalladosParam.length > 0) {
        const articulosMasFallados = articulosFalladosParam.slice(0, 3)
        recomendacionesGeneradas.push({
          tipo: 'fallos_detectados',
          prioridad: 'media',
          titulo: 'ÁREAS DE MEJORA DETECTADAS',
          descripcion: `${articulosMasFallados.length} artículo${articulosMasFallados.length > 1 ? 's' : ''} del Tema ${temaNumero} que ya muestra${articulosMasFallados.length > 1 ? 'n' : ''} dificultades`,
          articulos: articulosMasFallados,
          accion: 'Revisar estos conceptos específicos del temario',
          colorScheme: 'orange'
        })
      } else {
        recomendacionesGeneradas.push({
          tipo: 'buen_inicio',
          prioridad: 'positiva',
          titulo: `BUEN INICIO EN EL TEMA ${temaNumero}`,
          descripcion: 'No se detectan problemas graves en tus primeras respuestas.',
          articulos: [],
          accion: 'Sigue practicando para consolidar tu conocimiento',
          colorScheme: 'green'
        })
      }

      return recomendacionesGeneradas
    }

    if (articulosFalladosParam.length > 0) {
      recomendacionesGeneradas.push({
        tipo: 'fallos_importantes',
        prioridad: 'alta',
        titulo: `REVISAR CONCEPTOS DEL TEMA ${temaNumero}`,
        descripcion: `${articulosFalladosParam.length} artículo${articulosFalladosParam.length > 1 ? 's' : ''} que necesita${articulosFalladosParam.length > 1 ? 'n' : ''} más práctica`,
        articulos: articulosFalladosParam.slice(0, 6),
        accion: `Repasar los conceptos fundamentales del Tema ${temaNumero}`,
        colorScheme: 'red'
      })
    } else {
      recomendacionesGeneradas.push({
        tipo: 'excelente_dominio',
        prioridad: 'positiva',
        titulo: `EXCELENTE DOMINIO DEL TEMA ${temaNumero}`,
        descripcion: `Con ${totalRespuestasReales} respuestas analizadas, no se detectan áreas problemáticas.`,
        articulos: [],
        accion: 'Mantén este excelente nivel y considera avanzar a otros temas',
        iconoGrande: '🏆',
        colorScheme: 'green'
      })
    }

    return recomendacionesGeneradas
  }

  return (
    <div className="space-y-6">

      {recomendaciones.length > 0 && (
        <div>
          <div className="space-y-3">
            {recomendaciones.map((rec, index) => (
              <RecomendacionCard key={index} recomendacion={rec} openArticleModal={openArticleModal} />
            ))}
          </div>
        </div>
      )}

      {articulosFallados.length > 0 && totalRespuestas >= 10 && (
        <div>
          <h5 className="font-bold text-gray-800 mb-3">Artículos que Necesitan Atención</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articulosFallados.slice(0, 6).map((articulo, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-800">
                      Artículo {articulo.article_number}
                    </div>
                    <div className="text-xs text-gray-600">{articulo.law_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      parseFloat(articulo.precision) >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {articulo.precision}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {articulo.correctas}/{articulo.total_respuestas}
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      {articulo.incorrectas} fallos
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>Tiempo: {articulo.tiempo_promedio}s promedio</div>
                  <div>Dudas: {articulo.porcentaje_confianza_baja}%</div>
                  {articulo.fallos_consecutivos > 0 && (
                    <div className="text-red-600 font-medium">
                      {articulo.fallos_consecutivos} fallos consecutivos
                    </div>
                  )}
                  {articulo.ultima_correcta && (
                    <div className="text-green-600">
                      Última correcta: {new Date(articulo.ultima_correcta).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => openArticleModal(articulo.article_number || '', articulo.law_name || '')}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-md font-medium transition-colors flex items-center"
                  >
                    Ver artículo {articulo.article_number} de {articulo.law_name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {articulosFallados.length > 6 && (
            <div className="text-center mt-3">
              <span className="text-sm text-gray-500">
                Y {articulosFallados.length - 6} artículo{articulosFallados.length - 6 > 1 ? 's' : ''} más que necesita{articulosFallados.length - 6 > 1 ? 'n' : ''} atención
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// COMPONENTE: Card de Recomendación
function RecomendacionCard({ recomendacion, openArticleModal }: RecomendacionCardProps) {
  const estilosColor = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      texto: 'text-blue-800',
      titulo: 'text-blue-900'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      texto: 'text-yellow-800',
      titulo: 'text-yellow-900'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      texto: 'text-red-800',
      titulo: 'text-red-900'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      texto: 'text-green-800',
      titulo: 'text-green-900'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      texto: 'text-orange-800',
      titulo: 'text-orange-900'
    }
  }

  const colores = estilosColor[recomendacion.colorScheme as keyof typeof estilosColor] || estilosColor.blue

  return (
    <div className={`p-4 rounded-lg border ${colores.bg} ${colores.border}`}>
      {recomendacion.iconoGrande && (
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{recomendacion.iconoGrande}</div>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h6 className={`font-bold ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center w-full text-lg' : ''}`}>
          {recomendacion.titulo}
        </h6>
        {recomendacion.articulos.length > 0 && !recomendacion.iconoGrande && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold bg-white bg-opacity-50 ${colores.texto}`}>
            {recomendacion.articulos.length} artículo{recomendacion.articulos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className={`text-sm mb-3 ${colores.texto} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        {recomendacion.descripcion}
      </p>

      <div className={`text-sm font-medium ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        {recomendacion.accion}
      </div>

      {recomendacion.articulos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium mb-2 text-gray-700">
            Artículos detectados:
          </div>
          <div className="flex flex-wrap gap-2">
            {recomendacion.articulos.slice(0, 6).map((articulo, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded text-xs font-medium bg-white bg-opacity-50"
              >
                Art. {articulo.article_number}
                {articulo.precision && ` (${articulo.precision}%)`}
                {articulo.incorrectas && ` ${articulo.incorrectas} fallos`}
              </span>
            ))}
            {recomendacion.articulos.length > 6 && (
              <span className="text-xs text-gray-500 self-center">
                +{recomendacion.articulos.length - 6} más
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
