// app/administrativo-estado/test/tema/[numero]/page.js - PÁGINA DINÁMICA PARA ADMINISTRATIVO C1
'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../../lib/supabase'
import TestConfigurator from '@/components/TestConfigurator'

const supabase = getSupabaseClient()

export default function TemaAdministrativoPage({ params }) {
  // Estados principales
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)
  const [topicData, setTopicData] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [temaNotFound, setTemaNotFound] = useState(false)
  const [showOposicionDropdown, setShowOposicionDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Estados para estadísticas
  const [difficultyStats, setDifficultyStats] = useState({})
  const [userStats, setUserStats] = useState(null)
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0)
  const [articlesCountByLaw, setArticlesCountByLaw] = useState([])

  // Estados para configurador
  const [testLoading, setTestLoading] = useState(false)
  const [userRecentStats, setUserRecentStats] = useState(null)
  const [userAnswers, setUserAnswers] = useState([])

  // Estado para modo práctica/examen
  const [testMode, setTestMode] = useState('practica')

  // Cargar preferencia de modo desde localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('preferredTestMode')
    if (savedMode === 'practica' || savedMode === 'examen') {
      setTestMode(savedMode)
    }
  }, [])

  const handleTestModeChange = (newMode) => {
    setTestMode(newMode)
    localStorage.setItem('preferredTestMode', newMode)
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowOposicionDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Resolver params async
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)

      setResolvedParams(resolved)
      setTemaNumber(tema)

      // Administrativo tiene 45 temas
      if (isNaN(tema) || tema < 1 || tema > 45) {
        setTemaNotFound(true)
        setLoading(false)
        return
      }
    }
    resolveParams()
  }, [params])

  // Cargar datos del tema y usuario
  useEffect(() => {
    if (!temaNumber || temaNotFound) return

    async function checkUserAndStats() {
      try {
        // Obtener datos del tema
        const topicDataResult = await getTopicData(temaNumber)
        if (!topicDataResult) {
          setTemaNotFound(true)
          setLoading(false)
          return
        }
        setTopicData(topicDataResult)

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        // Cargar estadísticas
        await loadDifficultyStats(temaNumber)
        await loadOfficialQuestionsCount(temaNumber)
        await loadArticlesCountByLaw(temaNumber)

        if (user) {
          await getUserPersonalStats(user.id, temaNumber)
          await loadUserRecentStats(user.id, temaNumber)
        }

      } catch (error) {
        console.warn('Error obteniendo datos tema:', error)
        setTemaNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    checkUserAndStats()
  }, [temaNumber, temaNotFound])

  // Obtener datos del tema desde BD
  async function getTopicData(temaNumber) {
    try {
      const { data: topicData, error } = await supabase
        .from('topics')
        .select('id, topic_number, title, description, difficulty, estimated_hours')
        .eq('position_type', 'administrativo')
        .eq('topic_number', temaNumber)
        .eq('is_active', true)
        .single()

      if (error || !topicData) {
        console.error('Error obteniendo datos del tema:', error)
        return null
      }
      return topicData
    } catch (error) {
      console.error('Error en getTopicData:', error)
      return null
    }
  }

  // Cargar estadísticas por dificultad (MULTI-LEY)
  async function loadDifficultyStats(temaNumber) {
    try {
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'administrativo')

      if (mappingError || !mappings?.length) {
        setDifficultyStats({})
        return
      }

      let allQuestions = []

      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) continue

        const { data: questions, error } = await supabase
          .from('questions')
          .select(`
            global_difficulty,
            difficulty,
            articles!inner(laws!inner(short_name))
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)

        if (!error && questions) {
          allQuestions = [...allQuestions, ...questions]
        }
      }

      const diffCount = allQuestions.reduce((acc, q) => {
        let difficultyLevel
        if (q.global_difficulty !== null && q.global_difficulty !== undefined) {
          if (q.global_difficulty < 25) difficultyLevel = 'easy'
          else if (q.global_difficulty < 50) difficultyLevel = 'medium'
          else if (q.global_difficulty < 75) difficultyLevel = 'hard'
          else difficultyLevel = 'extreme'
        } else {
          difficultyLevel = q.difficulty || 'auto'
        }
        acc[difficultyLevel] = (acc[difficultyLevel] || 0) + 1
        return acc
      }, {})

      setDifficultyStats(diffCount)
    } catch (error) {
      console.warn('Error cargando estadísticas:', error)
      setDifficultyStats({})
    }
  }

  // Contar preguntas oficiales
  async function loadOfficialQuestionsCount(temaNumber) {
    try {
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'administrativo')

      if (mappingError || !mappings?.length) {
        setOfficialQuestionsCount(0)
        return
      }

      let totalOfficials = 0

      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) continue

        const { count, error } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_official_exam', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)

        if (!error && count) totalOfficials += count
      }

      setOfficialQuestionsCount(totalOfficials)
    } catch (error) {
      console.error('Error cargando conteo oficial:', error)
      setOfficialQuestionsCount(0)
    }
  }

  // Cargar conteo de artículos por ley
  async function loadArticlesCountByLaw(temaNumber) {
    try {
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'administrativo')

      if (mappingError || !mappings?.length) {
        setArticlesCountByLaw([])
        return
      }

      const lawArticlesCounts = []

      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) continue

        const { data: articlesData, error } = await supabase
          .from('questions')
          .select(`articles!inner(article_number, laws!inner(short_name))`)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)

        if (!error && articlesData) {
          const uniqueArticlesWithQuestions = new Set(
            articlesData.map(q => q.articles.article_number)
          ).size

          if (uniqueArticlesWithQuestions > 0) {
            lawArticlesCounts.push({
              law_short_name: mapping.laws.short_name,
              law_name: mapping.laws.name,
              articles_with_questions: uniqueArticlesWithQuestions
            })
          }
        }
      }

      const sortedCounts = lawArticlesCounts.sort((a, b) =>
        b.articles_with_questions - a.articles_with_questions
      )

      setArticlesCountByLaw(sortedCounts)
    } catch (error) {
      console.error('Error cargando conteo artículos:', error)
      setArticlesCountByLaw([])
    }
  }

  // Cargar estadísticas de preguntas recientes del usuario
  async function loadUserRecentStats(userId, temaNumber) {
    if (!userId) return null

    try {
      const { data: allUserAnswers, error } = await supabase
        .from('test_questions')
        .select('question_id, created_at, tests!inner(user_id)')
        .eq('tests.user_id', userId)
        .eq('tema_number', temaNumber)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error

      const finalRecentAnswers = allUserAnswers || []

      const getExcludedCount = (days) => {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        const uniqueQuestions = new Set()

        finalRecentAnswers?.forEach(answer => {
          const answerDate = new Date(answer.created_at)
          if (answerDate >= cutoffDate && answer.question_id) {
            uniqueQuestions.add(answer.question_id)
          }
        })

        return uniqueQuestions.size
      }

      const stats = {
        getExcludedCount,
        recentlyAnswered: getExcludedCount(15),
        last7Days: getExcludedCount(7),
        last15Days: getExcludedCount(15),
        last30Days: getExcludedCount(30)
      }

      setUserRecentStats(stats)
    } catch (error) {
      setUserRecentStats({ getExcludedCount: () => 0, recentlyAnswered: 0 })
    }
  }

  // Obtener estadísticas del usuario
  async function getUserPersonalStats(userId, temaNumber) {
    try {
      const { data: userAnswersData, error } = await supabase
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
        .eq('tema_number', temaNumber)
        .eq('questions.is_active', true)

      setUserAnswers(userAnswersData || [])
      processUserStats(userAnswersData || [])
    } catch (error) {
      setUserStats(null)
      setUserAnswers([])
    }
  }

  // Procesar estadísticas del usuario
  function processUserStats(userAnswersData) {
    const performanceByDifficulty = userAnswersData.reduce((acc, answer) => {
      const difficulty = answer.difficulty || 'auto'
      if (!acc[difficulty]) acc[difficulty] = { total: 0, correct: 0 }
      acc[difficulty].total++
      if (answer.is_correct) acc[difficulty].correct++
      return acc
    }, {})

    Object.keys(performanceByDifficulty).forEach(difficulty => {
      const stats = performanceByDifficulty[difficulty]
      stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
    })

    const totalCorrect = userAnswersData.filter(a => a.is_correct).length
    const overallAccuracy = userAnswersData.length > 0 ? (totalCorrect / userAnswersData.length) * 100 : 0
    const uniqueQuestionsAnswered = new Set(userAnswersData.map(a => a.question_id)).size
    const totalQuestionsAvailable = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)
    const neverSeen = Math.max(0, totalQuestionsAvailable - uniqueQuestionsAnswered)

    setUserStats({
      totalAnswers: userAnswersData.length,
      overallAccuracy,
      performanceByDifficulty,
      isRealData: true,
      uniqueQuestionsAnswered,
      totalQuestionsAvailable,
      neverSeen
    })
  }

  // Manejar inicio de test personalizado
  async function handleStartCustomTest(config) {
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

      const testPath = testMode === 'examen' ? 'test-examen' : 'test-personalizado'
      const testUrl = `/administrativo-estado/test/tema/${temaNumber}/${testPath}?${params.toString()}`

      window.location.href = testUrl
    } catch (error) {
      console.error('Error iniciando test:', error)
      setTestLoading(false)
    }
  }

  // Calcular totales
  const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

  // Loading state
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

  // Tema no encontrado
  if (temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Tema No Encontrado</h1>
          <p className="text-gray-600 mb-6">
            El Tema {temaNumber || ''} no existe o no está disponible para Administrativo del Estado.
          </p>
          <Link
            href="/administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </Link>
        </div>
      </div>
    )
  }

  // Obtener bloque según tema
  const getBloque = (num) => {
    if (num <= 11) return 'Bloque I'
    if (num <= 15) return 'Bloque II'
    if (num <= 22) return 'Bloque III'
    if (num <= 31) return 'Bloque IV'
    if (num <= 37) return 'Bloque V'
    return 'Bloque VI'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block" ref={dropdownRef}>
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-3">
              <span className="mr-1">🏢</span>
              <Link href="/administrativo-estado/test" className="hover:text-blue-900 transition-colors">
                Administrativo del Estado (C1)
              </Link>
              <button
                onClick={() => setShowOposicionDropdown(!showOposicionDropdown)}
                className="ml-1 hover:text-blue-900 transition-colors"
              >
                <span className="text-xs">▼</span>
              </button>
              <span className="mx-2 text-blue-600">›</span>
              <span className="font-semibold">{getBloque(temaNumber)}</span>
            </div>

            {/* Dropdown de Oposiciones */}
            {showOposicionDropdown && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-2">
                  <Link
                    href="/administrativo-estado/test"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">🏢</span>
                      <div>
                        <div className="font-medium">Administrativo del Estado (C1)</div>
                        <div className="text-xs text-gray-500">Todos los temas</div>
                      </div>
                    </div>
                  </Link>

                  <div className="border-t border-gray-100 my-1"></div>

                  <Link
                    href="/auxiliar-administrativo-estado/test"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-800 transition-colors"
                    onClick={() => setShowOposicionDropdown(false)}
                  >
                    <div className="flex items-center">
                      <span className="mr-2">🏛️</span>
                      <div>
                        <div className="font-medium">Auxiliar Administrativo (C2)</div>
                        <div className="text-xs text-gray-500">Cambiar oposición</div>
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
              <p className="text-purple-600 font-medium text-sm md:text-base">
                🏛️ {officialQuestionsCount} preguntas de exámenes oficiales disponibles
              </p>
            )}

            {/* Mostrar progreso del usuario */}
            {currentUser && userStats && userStats.totalQuestionsAvailable > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-green-600 font-medium text-sm">
                  ✅ {userStats.uniqueQuestionsAnswered} vistas
                </p>
                <p className="text-blue-600 font-medium text-sm">
                  👁️ {userStats.neverSeen} nunca vistas
                </p>
              </div>
            )}

            {/* Mostrar artículos con preguntas */}
            {articlesCountByLaw.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-700 font-medium text-sm mb-2">📖 Artículos con preguntas disponibles:</p>
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

        {/* Toggle Modo Práctica/Examen */}
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
                    <span className="text-blue-700"> Verás una pregunta a la vez con explicación inmediata.</span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-purple-800">Modo Examen:</span>
                    <span className="text-purple-700"> Verás todas las preguntas en scroll. Corrección al final.</span>
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
              tema={temaNumber}
              totalQuestions={difficultyStats}
              onStartTest={handleStartCustomTest}
              userStats={userRecentStats}
              loading={testLoading}
              currentUser={currentUser}
              lawsData={articlesCountByLaw}
              officialQuestionsCount={officialQuestionsCount}
              testMode={testMode}
              positionType="administrativo"
            />
          </section>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="text-center">
              <div className="text-4xl mb-3">🚧</div>
              <h2 className="text-lg font-bold text-yellow-800 mb-2">
                Tema en preparación
              </h2>
              <p className="text-yellow-700 text-sm">
                Este tema aún no tiene preguntas configuradas. Estamos trabajando en añadir contenido.
              </p>
            </div>
          </div>
        )}

        {/* Tu Progreso */}
        {currentUser && userStats && userStats.totalAnswers > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
              📊 Tu Progreso en el Tema {temaNumber}
            </h2>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">👤 Rendimiento Personal</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{userStats.overallAccuracy.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">{userStats.totalAnswers} respuestas</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-bold text-blue-800 mb-2 text-sm">📈 Últimos 7 días</div>
                  <div className="text-xl font-bold text-blue-600 mb-1">
                    {(() => {
                      const recent7Days = userAnswers?.filter(a =>
                        new Date(a.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ) || []
                      return recent7Days.length > 0
                        ? `${(recent7Days.filter(a => a.is_correct).length / recent7Days.length * 100).toFixed(0)}%`
                        : 'N/A'
                    })()}
                  </div>
                </div>

                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-bold text-green-800 mb-2 text-sm">⚡ Velocidad</div>
                  <div className="text-xl font-bold text-green-600 mb-1">
                    {(() => {
                      const avgTime = userAnswers?.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0) / (userAnswers?.length || 1)
                      return avgTime > 0 ? `${Math.round(avgTime)}s` : 'N/A'
                    })()}
                  </div>
                  <div className="text-xs text-green-600">por pregunta</div>
                </div>

                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-bold text-purple-800 mb-2 text-sm">✅ Vistas</div>
                  <div className="text-xl font-bold text-purple-600 mb-1">
                    {userStats.uniqueQuestionsAnswered}
                  </div>
                  <div className="text-xs text-purple-600">preguntas únicas</div>
                </div>

                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-bold text-orange-800 mb-2 text-sm">👁️ Sin ver</div>
                  <div className="text-xl font-bold text-orange-600 mb-1">
                    {userStats.neverSeen}
                  </div>
                  <div className="text-xs text-orange-600">preguntas nuevas</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Preguntas por Dificultad */}
        {Object.keys(difficultyStats).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📊 Preguntas por Dificultad
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

        {/* Navegación */}
        <div className="mt-8 text-center">
          <Link
            href="/administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </Link>
        </div>

      </div>
    </div>
  )
}
