// components/test/TemaTestPage.tsx - Componente compartido para página de tema de test
// Reemplaza las 17 copias hardcodeadas de app/[oposicion]/test/tema/[numero]/page.tsx
'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase'
import TestConfigurator from '@/components/TestConfigurator'
import { buildTestUrl } from '@/lib/test-url/buildTestUrl'
import type { TestStartConfig } from '@/components/TestConfigurator.types'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import ArticleModal from '@/components/ArticleModal'
import ArticulosEstudioPrioritario from '@/components/test/ArticulosEstudioPrioritario'
import { generateLawSlug } from '@/lib/lawMappingUtils'
import { getOposicion, getBlockForTopic, type Block } from '@/lib/config/oposiciones'

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

interface TemaTestPageProps {
  oposicionSlug: string
}

export default function TemaTestPage({ oposicionSlug }: TemaTestPageProps) {
  const params = useParams<{ numero: string }>()
  const config = getOposicion(oposicionSlug)

  const [temaNumber, setTemaNumber] = useState<number | null>(null)
  const [topicData, setTopicData] = useState<TopicData | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [temaNotFound, setTemaNotFound] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [difficultyStats, setDifficultyStats] = useState<Record<string, number>>({})
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [userStatsLoading, setUserStatsLoading] = useState(false)
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0)
  const [articlesCountByLaw, setArticlesCountByLaw] = useState<any[]>([])

  const [testLoading, setTestLoading] = useState(false)
  const [userRecentStats, setUserRecentStats] = useState<any>(null)
  const [userAnswers, setUserAnswers] = useState<any[]>([])
  const [testMode, setTestMode] = useState<'practica' | 'examen'>('practica')

  // ArticleModal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<{ number: string | null; lawSlug: string | null }>({ number: null, lawSlug: null })

  const basePath = `/${oposicionSlug}`
  const positionType = config?.positionType || 'auxiliar_administrativo'
  const color = config?.color || 'blue'

  // Tailwind color mapping
  const colorClasses = {
    emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-500', bgLight: 'bg-emerald-50', btn: 'bg-emerald-600 hover:bg-emerald-700', spinner: 'border-emerald-600', accent: 'text-emerald-600' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-500', bgLight: 'bg-amber-50', btn: 'bg-amber-600 hover:bg-amber-700', spinner: 'border-amber-600', accent: 'text-amber-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500', bgLight: 'bg-blue-50', btn: 'bg-blue-600 hover:bg-blue-700', spinner: 'border-blue-600', accent: 'text-blue-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-500', bgLight: 'bg-purple-50', btn: 'bg-purple-600 hover:bg-purple-700', spinner: 'border-purple-600', accent: 'text-purple-600' },
    rose: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-500', bgLight: 'bg-rose-50', btn: 'bg-rose-600 hover:bg-rose-700', spinner: 'border-rose-600', accent: 'text-rose-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500', bgLight: 'bg-orange-50', btn: 'bg-orange-600 hover:bg-orange-700', spinner: 'border-orange-600', accent: 'text-orange-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-500', bgLight: 'bg-teal-50', btn: 'bg-teal-600 hover:bg-teal-700', spinner: 'border-teal-600', accent: 'text-teal-600' },
    sky: { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-500', bgLight: 'bg-sky-50', btn: 'bg-sky-600 hover:bg-sky-700', spinner: 'border-sky-600', accent: 'text-sky-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-500', bgLight: 'bg-indigo-50', btn: 'bg-indigo-600 hover:bg-indigo-700', spinner: 'border-indigo-600', accent: 'text-indigo-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', bgLight: 'bg-yellow-50', btn: 'bg-yellow-600 hover:bg-yellow-700', spinner: 'border-yellow-600', accent: 'text-yellow-600' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', bgLight: 'bg-red-50', btn: 'bg-red-600 hover:bg-red-700', spinner: 'border-red-600', accent: 'text-red-600' },
    cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-500', bgLight: 'bg-cyan-50', btn: 'bg-cyan-600 hover:bg-cyan-700', spinner: 'border-cyan-600', accent: 'text-cyan-600' },
  } as Record<string, { bg: string; text: string; border: string; bgLight: string; btn: string; spinner: string; accent: string }>
  const c = colorClasses[color] || colorClasses.blue

  // Validate tema number against config
  const isValidTema = (tema: number): boolean => {
    if (!config) return false
    for (const block of config.blocks) {
      for (const theme of block.themes) {
        if (theme.id === tema) return true
      }
    }
    return false
  }

  const getBloque = (num: number): string => {
    if (!config) return ''
    const block = getBlockForTopic(oposicionSlug, num)
    return block?.blockTitle || ''
  }

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('preferredTestMode')
      if (savedMode === 'practica' || savedMode === 'examen') {
        setTestMode(savedMode)
      }
    } catch { /* localStorage blocked */ }
  }, [])

  const handleTestModeChange = (newMode: 'practica' | 'examen') => {
    setTestMode(newMode)
    try { localStorage.setItem('preferredTestMode', newMode) } catch { /* */ }
  }

  const loadTopicData = useCallback(async (tema: number, userId: string | null) => {
    try {
      const queryParams = new URLSearchParams({
        oposicion: oposicionSlug,
        ...(userId && { userId })
      })
      const response = await fetch(`/api/topics/${tema}?${queryParams}`)
      const data = await response.json()
      if (!data.success) return null
      return data
    } catch (error) {
      console.error('Error en loadTopicData:', error)
      return null
    }
  }, [oposicionSlug])

  // Refresh on visibility/focus
  useEffect(() => {
    if (!currentUser || !temaNumber || loading) return
    const handleVisibilityOrFocus = async () => {
      if (document.hidden) return
      const data = await loadTopicData(temaNumber, currentUser.id)
      if (data?.success) {
        setDifficultyStats(data.difficultyStats || {})
        setOfficialQuestionsCount(data.officialQuestionsCount || 0)
        setArticlesCountByLaw(data.articlesByLaw?.map((a: any) => ({
          law_short_name: a.lawShortName, law_name: a.lawName, articles_with_questions: a.articlesWithQuestions
        })) || [])
        if (data.userProgress) {
          setUserStats({
            totalAnswers: data.userProgress.totalAnswers, overallAccuracy: data.userProgress.overallAccuracy,
            performanceByDifficulty: data.userProgress.performanceByDifficulty, isRealData: true,
            uniqueQuestionsAnswered: data.userProgress.uniqueQuestionsAnswered,
            totalQuestionsAvailable: data.userProgress.totalQuestionsAvailable, neverSeen: data.userProgress.neverSeen
          })
          if (data.userProgress.recentStats) {
            setUserRecentStats({
              last7Days: data.userProgress.recentStats.last7Days, last15Days: data.userProgress.recentStats.last15Days,
              last30Days: data.userProgress.recentStats.last30Days, recentlyAnswered: data.userProgress.recentStats.last15Days,
              getExcludedCount: (days: number) => {
                if (days <= 7) return data.userProgress.recentStats.last7Days
                if (days <= 15) return data.userProgress.recentStats.last15Days
                return data.userProgress.recentStats.last30Days
              }
            })
          }
          setUserAnswers(data.userProgress.detailedAnswers || [])
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

  // Click outside dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // Close any dropdown if needed
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Resolve params and load data
  useEffect(() => {
    if (!params?.numero) return
    const tema = parseInt(params.numero)
    setTemaNumber(tema)

    if (isNaN(tema) || !isValidTema(tema)) {
      setTemaNotFound(true)
      setLoading(false)
      return
    }
  }, [params?.numero])

  useEffect(() => {
    if (!temaNumber || temaNotFound) return
    async function fetchAllData() {
      try {
        const basicData = await loadTopicData(temaNumber!, null)
        if (!basicData?.success) { setTemaNotFound(true); setLoading(false); return }

        setTopicData({
          id: basicData.topic.id, topic_number: basicData.topic.topicNumber,
          title: basicData.topic.title, description: basicData.topic.description,
          difficulty: basicData.topic.difficulty, estimated_hours: basicData.topic.estimatedHours
        })
        setDifficultyStats(basicData.difficultyStats || {})
        setOfficialQuestionsCount(basicData.officialQuestionsCount || 0)
        setArticlesCountByLaw(basicData.articlesByLaw?.map((a: any) => ({
          law_short_name: a.lawShortName, law_name: a.lawName, articles_with_questions: a.articlesWithQuestions
        })) || [])
        setLoading(false)

        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        if (user) {
          setUserStatsLoading(true)
          const userData = await loadTopicData(temaNumber!, user.id)
          if (userData?.success && userData.userProgress) {
            setUserStats({
              totalAnswers: userData.userProgress.totalAnswers, overallAccuracy: userData.userProgress.overallAccuracy,
              performanceByDifficulty: userData.userProgress.performanceByDifficulty, isRealData: true,
              uniqueQuestionsAnswered: userData.userProgress.uniqueQuestionsAnswered,
              totalQuestionsAvailable: userData.userProgress.totalQuestionsAvailable, neverSeen: userData.userProgress.neverSeen
            })
            if (userData.userProgress.recentStats) {
              setUserRecentStats({
                last7Days: userData.userProgress.recentStats.last7Days, last15Days: userData.userProgress.recentStats.last15Days,
                last30Days: userData.userProgress.recentStats.last30Days, recentlyAnswered: userData.userProgress.recentStats.last15Days,
                getExcludedCount: (days: number) => {
                  if (days <= 7) return userData.userProgress.recentStats.last7Days
                  if (days <= 15) return userData.userProgress.recentStats.last15Days
                  return userData.userProgress.recentStats.last30Days
                }
              })
            }
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

  async function handleStartCustomTest(testConfig: TestStartConfig) {
    setTestLoading(true)
    try {
      window.location.href = buildTestUrl({ basePath, temaNumber: temaNumber!, testMode, config: testConfig })
    } catch (error) {
      console.error('Error iniciando test:', error)
      setTestLoading(false)
    }
  }

  function openArticleModal(articleNumber: string, lawName: string) {
    const lawSlug = lawName ? generateLawSlug(lawName) : 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setModalOpen(true)
  }

  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
  }

  const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

  // LOADING
  if (loading && !temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-8 w-8 border-b-2 ${c.spinner} mx-auto mb-3`}></div>
          <p className="text-gray-600 text-sm">Cargando tema...</p>
        </div>
      </div>
    )
  }

  // NOT FOUND
  if (temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tema No Encontrado</h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber || ''} no existe para {config?.shortName || 'esta oposicion'}.
          </p>
          <Link href={`${basePath}/test`} className={`inline-flex items-center px-4 py-2 ${c.btn} text-white rounded-lg transition-colors`}>
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
            <div className={`inline-flex items-center px-3 py-1 ${c.bg} ${c.text} rounded-full text-xs font-medium mb-3`}>
              <span className="mr-1">{config?.emoji || '🏛️'}</span>
              <Link href={`${basePath}/test`} className="hover:opacity-80 transition-opacity">
                {config?.shortName || 'Oposicion'} ({config?.badge || 'C2'})
              </Link>
              <span className="mx-2 opacity-60">{'›'}</span>
              <span className="font-semibold">{getBloque(temaNumber || 0)}</span>
            </div>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Tema {temaNumber}: {topicData?.title}
          </h1>

          {topicData?.description && (
            <p className="text-gray-600 text-sm md:text-base mb-4">{topicData.description}</p>
          )}

          <div className="space-y-2">
            <p className="text-gray-600 text-sm md:text-base">
              {totalQuestions > 0 ? `${totalQuestions} preguntas disponibles para este tema` : 'Cargando preguntas...'}
            </p>
            {officialQuestionsCount > 0 && (
              <p className={`${c.accent} font-medium text-sm md:text-base`}>
                {'🏛️'} {officialQuestionsCount} preguntas de examenes oficiales disponibles
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
                <p className="text-green-600 font-medium text-sm">{userStats.uniqueQuestionsAnswered} vistas</p>
                <p className="text-blue-600 font-medium text-sm">{userStats.neverSeen} nunca vistas</p>
              </div>
            )}
            {articlesCountByLaw.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-700 font-medium text-sm mb-2">Articulos con preguntas disponibles:</p>
                <div className="text-center space-y-1">
                  {articlesCountByLaw.map((lawData: any, index: number) => (
                    <div key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{lawData.law_short_name}:</span> {lawData.articles_with_questions} articulo{lawData.articles_with_questions > 1 ? 's' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Toggle Modo */}
        <section className="mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 text-center">Selecciona el modo de estudio</h2>
            <div className="flex gap-3 mb-4">
              <button onClick={() => handleTestModeChange('practica')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${testMode === 'practica' ? `${c.border} ${c.bgLight}` : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <div className="text-3xl mb-2">{'📚'}</div>
                <div className="font-bold text-gray-800 mb-1">Practica</div>
                <div className="text-sm text-gray-600">Preguntas una a una con feedback inmediato</div>
              </button>
              <button onClick={() => handleTestModeChange('examen')}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${testMode === 'examen' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-300'}`}>
                <div className="text-3xl mb-2">{'📝'}</div>
                <div className="font-bold text-gray-800 mb-1">Examen</div>
                <div className="text-sm text-gray-600">Todas las preguntas de una vez, correccion al final</div>
              </button>
            </div>
            <div className={`p-4 rounded-lg ${testMode === 'practica' ? `${c.bgLight} border ${c.border}` : 'bg-orange-50 border border-orange-200'}`}>
              <div className="text-sm">
                {testMode === 'practica' ? (
                  <><span className={`font-semibold ${c.text}`}>Modo Practica:</span><span className="text-gray-700"> Veras una pregunta a la vez con explicacion inmediata.</span></>
                ) : (
                  <><span className="font-semibold text-orange-800">Modo Examen:</span><span className="text-orange-700"> Veras todas las preguntas en scroll. Correccion al final.</span></>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Configurador */}
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
              positionType={positionType}
            />
          </section>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-3">{'🚧'}</div>
              <h2 className="text-lg font-bold text-yellow-800 mb-2">Tema en preparacion</h2>
              <p className="text-yellow-700 text-sm">Este tema aun no tiene preguntas configuradas.</p>
            </div>
          </div>
        )}

        {/* Progreso del usuario con métricas detalladas */}
        {!userStatsLoading && currentUser && userStats && userStats.totalAnswers > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
              Tu Progreso en el Tema {temaNumber}
            </h2>
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">Rendimiento Personal</h3>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${c.accent}`}>{userStats.overallAccuracy.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">{userStats.totalAnswers} respuestas</div>
                </div>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-bold text-blue-800 mb-2 text-sm">Ultimos 7 dias</div>
                  <div className="text-xl font-bold text-blue-600 mb-1">
                    {(() => {
                      const recent = userAnswers?.filter((a: any) => new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) || []
                      return recent.length > 0 ? (recent.filter((a: any) => a.isCorrect).length / recent.length * 100).toFixed(0) + '%' : 'N/A'
                    })()}
                  </div>
                  <div className="text-xs text-blue-600">
                    {(userAnswers?.filter((a: any) => new Date(a.createdAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) || []).length} respuestas
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-bold text-green-800 mb-2 text-sm">Velocidad</div>
                  <div className="text-xl font-bold text-green-600 mb-1">
                    {(() => {
                      const avgTime = userAnswers?.reduce((sum: number, a: any) => sum + (a.timeSpentSeconds || 0), 0) / (userAnswers?.length || 1)
                      return avgTime > 0 ? Math.round(avgTime) + 's' : 'N/A'
                    })()}
                  </div>
                  <div className="text-xs text-green-600">por pregunta</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-bold text-purple-800 mb-2 text-sm">Racha</div>
                  <div className="text-xl font-bold text-purple-600 mb-1">
                    {(() => {
                      const dates = [...new Set(userAnswers?.map((a: any) => new Date(a.createdAt).toDateString()) || [])].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
                      let streak = 0
                      let currentDate = new Date()
                      for (const date of dates) {
                        const diffDays = Math.floor((currentDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
                        if (diffDays === streak) { streak++; currentDate = new Date(date) } else break
                      }
                      return streak
                    })()}
                  </div>
                  <div className="text-xs text-purple-600">dias seguidos</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-bold text-orange-800 mb-2 text-sm">Cobertura</div>
                  <div className="text-xl font-bold text-orange-600 mb-1">
                    {new Set(userAnswers?.map((a: any) => a.articleNumber).filter(Boolean) || []).size}
                  </div>
                  <div className="text-xs text-orange-600">articulos distintos</div>
                </div>
              </div>

              {/* Análisis Inteligente */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">{'🎯'}</span>
                  Analisis Inteligente de Estudio
                </h4>
                <ArticulosEstudioPrioritario
                  userAnswers={userAnswers}
                  tema={temaNumber || 0}
                  totalRespuestas={userStats.totalAnswers}
                  openArticleModal={openArticleModal}
                />
              </div>
            </div>
          </section>
        )}

        {/* Mensaje cuando no hay estadísticas */}
        {!userStatsLoading && currentUser && (!userStats || userStats.totalAnswers === 0) && (
          <section className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">{'📊'}</div>
              <h3 className="font-bold text-blue-800 mb-2">Empieza a practicar</h3>
              <p className="text-blue-700 text-sm">Completa algunos tests para ver tus estadisticas personales.</p>
            </div>
          </section>
        )}

        {/* Dificultad */}
        {Object.keys(difficultyStats).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Preguntas por Dificultad</h2>
            <div className="space-y-2">
              {Object.entries(difficultyStats).sort(([,a], [,b]) => b - a).map(([difficulty, count]) => (
                <div key={difficulty} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-3" style={{
                      backgroundColor: { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444', extreme: '#8b5cf6', auto: '#6b7280' }[difficulty] || '#6b7280'
                    }}></span>
                    <span className="font-medium text-gray-700 capitalize">
                      {{ auto: 'Automatica', easy: 'Facil', medium: 'Media', hard: 'Dificil', extreme: 'Extrema' }[difficulty] || difficulty}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-gray-900 mr-2">{count}</span>
                    <span className="text-sm text-gray-500">({((count / totalQuestions) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">Total:</span>
                <span className={`font-bold ${c.accent} text-lg`}>{totalQuestions} preguntas</span>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <div className="mt-8 text-center">
          <Link href={`${basePath}/test`} className={`inline-flex items-center px-4 py-2 ${c.btn} text-white rounded-lg transition-colors`}>
            Volver a todos los temas
          </Link>
        </div>
      </div>

      {/* ArticleModal */}
      <ArticleModal
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
      />
    </div>
  )
}
