// app/auxilio-judicial/test/tema/[numero]/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase'
import TestConfigurator from '@/components/TestConfigurator'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

const supabase = getSupabaseClient()

interface TopicData {
  id: string
  topic_number: number
  title: string
  description: string
  difficulty: string
  estimated_hours: number
}

interface UserStats {
  totalAnswers: number
  overallAccuracy: number
  performanceByDifficulty: Record<string, number>
  isRealData: boolean
  uniqueQuestionsAnswered: number
  totalQuestionsAvailable: number
  neverSeen: number
}

interface PageProps {
  params: Promise<{ numero: string }>
}

export default function TemaAuxilioJudicialPage({ params }: PageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ numero: string } | null>(null)
  const [temaNumber, setTemaNumber] = useState<number | null>(null)
  const [topicData, setTopicData] = useState<TopicData | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [temaNotFound, setTemaNotFound] = useState(false)
  const [showOposicionDropdown, setShowOposicionDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [difficultyStats, setDifficultyStats] = useState<Record<string, number>>({})
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userStatsLoading, setUserStatsLoading] = useState(false)
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0)
  const [articlesCountByLaw, setArticlesCountByLaw] = useState<any[]>([])

  const [testLoading, setTestLoading] = useState(false)
  const [userRecentStats, setUserRecentStats] = useState<any>(null)
  const [userAnswers, setUserAnswers] = useState<any[]>([])
  const [testMode, setTestMode] = useState('practica')

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('preferredTestMode')
      if (savedMode === 'practica' || savedMode === 'examen') {
        setTestMode(savedMode)
      }
    } catch {
      // localStorage bloqueado
    }
  }, [])

  const handleTestModeChange = (newMode: string) => {
    setTestMode(newMode)
    try {
      localStorage.setItem('preferredTestMode', newMode)
    } catch {
      // localStorage bloqueado
    }
  }

  const loadTopicData = useCallback(async (tema: number, userId: string | null) => {
    try {
      const queryParams = new URLSearchParams({
        oposicion: 'auxilio-judicial',
        ...(userId && { userId })
      })

      const response = await fetch(`/api/topics/${tema}?${queryParams}`)
      const data = await response.json()

      if (!data.success) {
        console.error('Error cargando datos del tema:', data.error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error en loadTopicData:', error)
      return null
    }
  }, [])

  useEffect(() => {
    if (!currentUser || !temaNumber || loading) return

    const handleVisibilityOrFocus = async () => {
      if (document.hidden) return

      const data = await loadTopicData(temaNumber, currentUser.id)

      if (data?.success) {
        setDifficultyStats(data.difficultyStats || {})
        setOfficialQuestionsCount(data.officialQuestionsCount || 0)
        setArticlesCountByLaw(data.articlesByLaw?.map((a: any) => ({
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
            uniqueQuestionsAnswered: data.userProgress.uniqueQuestionsAnswered,
            totalQuestionsAvailable: data.userProgress.totalQuestionsAvailable,
            neverSeen: data.userProgress.neverSeen
          })

          if (data.userProgress.recentStats) {
            setUserRecentStats({
              last7Days: data.userProgress.recentStats.last7Days,
              last15Days: data.userProgress.recentStats.last15Days,
              last30Days: data.userProgress.recentStats.last30Days,
              recentlyAnswered: data.userProgress.recentStats.last15Days,
              getExcludedCount: (days: number) => {
                if (days <= 7) return data.userProgress.recentStats.last7Days
                if (days <= 15) return data.userProgress.recentStats.last15Days
                return data.userProgress.recentStats.last30Days
              }
            })
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [currentUser, temaNumber, loading, loadTopicData])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOposicionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      // Auxilio Judicial: 26 temas (1-26)
      if (isNaN(tema) || tema < 1 || tema > 26) {
        setTemaNotFound(true)
        setLoading(false)
        return
      }
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (!temaNumber || temaNotFound) return

    async function fetchAllData() {
      try {
        const basicData = await loadTopicData(temaNumber, null)

        if (!basicData?.success) {
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
        setArticlesCountByLaw(basicData.articlesByLaw?.map((a: any) => ({
          law_short_name: a.lawShortName,
          law_name: a.lawName,
          articles_with_questions: a.articlesWithQuestions
        })) || [])

        setLoading(false)

        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          setUserStatsLoading(true)

          const userData = await loadTopicData(temaNumber, user.id)

          if (userData?.success && userData.userProgress) {
            setUserStats({
              totalAnswers: userData.userProgress.totalAnswers,
              overallAccuracy: userData.userProgress.overallAccuracy,
              performanceByDifficulty: userData.userProgress.performanceByDifficulty,
              isRealData: true,
              uniqueQuestionsAnswered: userData.userProgress.uniqueQuestionsAnswered,
              totalQuestionsAvailable: userData.userProgress.totalQuestionsAvailable,
              neverSeen: userData.userProgress.neverSeen
            })

            if (userData.userProgress.recentStats) {
              setUserRecentStats({
                last7Days: userData.userProgress.recentStats.last7Days,
                last15Days: userData.userProgress.recentStats.last15Days,
                last30Days: userData.userProgress.recentStats.last30Days,
                recentlyAnswered: userData.userProgress.recentStats.last15Days,
                getExcludedCount: (days: number) => {
                  if (days <= 7) return userData.userProgress.recentStats.last7Days
                  if (days <= 15) return userData.userProgress.recentStats.last15Days
                  return userData.userProgress.recentStats.last30Days
                }
              })
            }

            await loadUserAnswersForMetrics(user.id, temaNumber)
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

  async function loadUserAnswersForMetrics(userId: string, tema: number) {
    try {
      const { data: answers, error } = await supabase
        .from('test_questions')
        .select(`
          question_id,
          is_correct,
          difficulty,
          created_at,
          time_spent_seconds,
          article_number,
          tests!inner(user_id),
          questions!inner(is_active)
        `)
        .eq('tests.user_id', userId)
        .eq('tema_number', tema)
        .eq('questions.is_active', true)

      if (!error) {
        setUserAnswers(answers || [])
      }
    } catch (error) {
      console.error('Error cargando respuestas del usuario:', error)
    }
  }

  async function handleStartCustomTest(config: any) {
    setTestLoading(true)

    try {
      const testParams = new URLSearchParams({
        n: config.numQuestions.toString(),
        exclude_recent: config.excludeRecent.toString(),
        recent_days: config.recentDays.toString(),
        difficulty_mode: config.difficultyMode,
        ...(config.onlyOfficialQuestions && { only_official: 'true' }),
        ...(config.focusEssentialArticles && { focus_essential: 'true' }),
        ...(config.focusWeakAreas && { focus_weak: 'true' }),
        ...(config.adaptiveMode && { adaptive: 'true' }),
        ...(config.onlyFailedQuestions && { only_failed: 'true' }),
        ...(config.timeLimit && { time_limit: config.timeLimit.toString() })
      })

      if (config.selectedLaws && config.selectedLaws.length > 0) {
        testParams.set('selected_laws', JSON.stringify(config.selectedLaws))
      }

      const testPath = testMode === 'examen' ? 'test-examen' : 'test-personalizado'
      const testUrl = `/auxilio-judicial/test/tema/${temaNumber}/${testPath}?${testParams.toString()}`

      window.location.href = testUrl
    } catch (error) {
      console.error('Error iniciando test:', error)
      setTestLoading(false)
    }
  }

  const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

  const getBloque = (num: number) => {
    if (num >= 1 && num <= 5) return 'Bloque I'
    if (num >= 6 && num <= 15) return 'Bloque II'
    if (num >= 16 && num <= 26) return 'Bloque III'
    return ''
  }

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

  if (temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tema No Encontrado</h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber || ''} no existe o no esta disponible para Auxilio Judicial.
          </p>
          <Link
            href="/auxilio-judicial/test"
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
      <InteractiveBreadcrumbs />
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block" ref={dropdownRef}>
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-3">
              <span className="mr-1">⚖️</span>
              <Link href="/auxilio-judicial/test" className="hover:text-blue-900 transition-colors">
                Auxilio Judicial (C2)
              </Link>
              <button
                onClick={() => setShowOposicionDropdown(!showOposicionDropdown)}
                className="ml-1 hover:text-blue-900 transition-colors"
              >
                <span className="text-xs">▼</span>
              </button>
              <span className="mx-2 text-blue-600">›</span>
              <span className="font-semibold">{getBloque(temaNumber || 0)}</span>
            </div>

            {showOposicionDropdown && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-2">
                  <Link
                    href="/auxilio-judicial/test"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">⚖️</span>
                      <div>
                        <div className="font-medium">Auxilio Judicial (C2)</div>
                        <div className="text-xs text-gray-500">Todos los temas</div>
                      </div>
                    </div>
                  </Link>

                  <div className="border-t border-gray-100 my-1"></div>

                  <Link
                    href="/tramitacion-procesal/test"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">⚖️</span>
                      <div>
                        <div className="font-medium">Tramitacion Procesal (C1)</div>
                        <div className="text-xs text-gray-500">Cambiar oposicion</div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Tema {temaNumber}: {topicData?.title}
          </h1>

          {topicData?.description && (
            <p className="text-gray-600 text-sm md:text-base mb-4">
              {topicData.description}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-gray-600 text-sm md:text-base">
              {totalQuestions > 0 ? `${totalQuestions} preguntas disponibles para este tema` : 'Cargando preguntas...'}
            </p>

            {officialQuestionsCount > 0 && (
              <p className="text-blue-600 font-medium text-sm md:text-base">
                🏛️ {officialQuestionsCount} preguntas de examenes oficiales disponibles
              </p>
            )}

            {userStatsLoading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-gray-500 text-sm">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Cargando tu progreso...</span>
              </div>
            )}

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

            {articlesCountByLaw.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-700 font-medium text-sm mb-2">Articulos con preguntas disponibles:</p>
                <div className="text-center space-y-1">
                  {articlesCountByLaw.map((lawData, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{lawData.law_short_name}:</span> {lawData.articles_with_questions} articulo{lawData.articles_with_questions > 1 ? 's' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Modo Practica/Examen */}
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
                <div className="font-bold text-gray-800 mb-1">Practica</div>
                <div className="text-sm text-gray-600">
                  Preguntas una a una con feedback inmediato
                </div>
              </button>

              <button
                onClick={() => handleTestModeChange('examen')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  testMode === 'examen'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 bg-white hover:border-indigo-300'
                }`}
              >
                <div className="text-3xl mb-2">📝</div>
                <div className="font-bold text-gray-800 mb-1">Examen</div>
                <div className="text-sm text-gray-600">
                  Todas las preguntas de una vez, correccion al final
                </div>
              </button>
            </div>

            <div className={`p-4 rounded-lg ${testMode === 'practica' ? 'bg-blue-50 border border-blue-200' : 'bg-indigo-50 border border-indigo-200'}`}>
              <div className="text-sm">
                {testMode === 'practica' ? (
                  <>
                    <span className="font-semibold text-blue-800">Modo Practica:</span>
                    <span className="text-blue-700"> Veras una pregunta a la vez con explicacion inmediata.</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-indigo-800">Modo Examen:</span>
                    <span className="text-indigo-700"> Veras todas las preguntas en scroll. Correccion al final.</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Configurador de Test */}
        {totalQuestions > 0 ? (
          <section className="mb-8">
            <TestConfigurator
              tema={temaNumber || 0}
              totalQuestions={difficultyStats as unknown as number}
              onStartTest={handleStartCustomTest}
              userStats={userRecentStats}
              loading={testLoading}
              currentUser={currentUser}
              lawsData={articlesCountByLaw}
              officialQuestionsCount={officialQuestionsCount}
              testMode={testMode}
              positionType="auxilio_judicial"
            />
          </section>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-3">🚧</div>
              <h2 className="text-lg font-bold text-yellow-800 mb-2">
                Tema en preparacion
              </h2>
              <p className="text-yellow-700 text-sm">
                Este tema aun no tiene preguntas configuradas. Estamos trabajando en anadir contenido.
              </p>
            </div>
          </div>
        )}

        {/* Preguntas por Dificultad */}
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
                      {difficulty === 'auto' ? 'Automatica' :
                       difficulty === 'easy' ? 'Facil' :
                       difficulty === 'medium' ? 'Media' :
                       difficulty === 'hard' ? 'Dificil' :
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

        {/* Navegacion */}
        <div className="mt-8 text-center">
          <Link
            href="/auxilio-judicial/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Volver a todos los temas
          </Link>
        </div>

      </div>
    </div>
  )
}
