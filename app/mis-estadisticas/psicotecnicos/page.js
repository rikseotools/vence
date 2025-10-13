'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'
import PsychometricWeakAreasAnalysis from '@/components/Statistics/PsychometricWeakAreasAnalysis'

const supabase = getSupabaseClient()

export default function PsychometricStatistics() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('all') // all, week, month
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    if (user) {
      loadPsychometricStats()
    }
  }, [user, selectedPeriod, selectedCategory])

  const loadPsychometricStats = async () => {
    try {
      setLoading(true)
      
      // Calcular fechas según el período seleccionado
      let dateFilter = {}
      const now = new Date()
      
      if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFilter = { created_at: { gte: weekAgo.toISOString() } }
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        dateFilter = { created_at: { gte: monthAgo.toISOString() } }
      }

      // Usar tabla psychometric_test_sessions que sí existe
      // IMPORTANTE: Filtrar solo sesiones psicotécnicas, no mezclar con preguntas de ley
      console.log('🔍 DEBUG: User ID:', user.id, 'Email:', user.email)
      
      let query = supabase
        .from('psychometric_test_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'psychometric')

      // Aplicar filtro de fecha si es necesario
      if (dateFilter.created_at) {
        query = query.gte('created_at', dateFilter.created_at.gte)
      }

      // Aplicar filtro de categoría si es necesario
      if (selectedCategory !== 'all') {
        query = query.eq('psychometric_questions.psychometric_sections.psychometric_categories.category_key', selectedCategory)
      }

      const { data: answers, error } = await query.order('created_at', { ascending: false })

      console.log('🔍 DEBUG: Query result for user', user.email, ':', { 
        answers: answers?.length || 0, 
        error: error?.message,
        firstAnswer: answers?.[0] 
      })

      if (error) {
        console.error('Error loading psychometric stats:', error)
        return
      }

      // Procesar estadísticas
      const processedStats = processPsychometricStats(answers)
      console.log('🔍 DEBUG: Processed stats:', { 
        totalAnswers: processedStats.overview.totalAnswers,
        accuracy: processedStats.overview.accuracy,
        categories: Object.keys(processedStats.byCategory)
      })
      setStats(processedStats)

    } catch (error) {
      console.error('Error in loadPsychometricStats:', error)
    } finally {
      setLoading(false)
    }
  }

  const processPsychometricStats = (sessions) => {
    console.log('🔍 DEBUG: Processing sessions:', sessions?.length || 0)
    console.log('🔍 DEBUG: First session fields:', Object.keys(sessions?.[0] || {}))
    console.log('🔍 DEBUG: First session scores:', {
      score: sessions?.[0]?.score,
      score_percentage: sessions?.[0]?.score_percentage,
      total_questions: sessions?.[0]?.total_questions
    })
    if (!sessions || sessions.length === 0) {
      return {
        overview: { totalAnswers: 0, accuracy: 0, averageTime: 0, totalSessions: 0 },
        byCategory: {},
        bySection: {},
        byDifficulty: {},
        timePatterns: {},
        recentActivity: [],
        weakAreas: [],
        strengths: []
      }
    }

    // Estadísticas generales basadas en sesiones
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.is_completed === true)
    const incompleteWithProgress = sessions.filter(s => s.is_completed === false && (s.questions_answered > 0))
    const totalQuestions = completedSessions.reduce((sum, s) => sum + (s.total_questions || 0), 0)
    
    // Calcular accuracy correctamente: promedio de accuracy_percentage de sesiones completadas
    const accuracy = completedSessions.length > 0 ? 
      Math.round(completedSessions.reduce((sum, s) => sum + (s.accuracy_percentage || 0), 0) / completedSessions.length) : 0
    // Calcular tiempo promedio usando started_at y completed_at si total_time_seconds es null
    const averageTime = completedSessions.length > 0 ? Math.round(
      completedSessions.reduce((sum, s) => {
        if (s.total_time_seconds) {
          return sum + s.total_time_seconds
        } else if (s.started_at && s.completed_at) {
          // Calcular diferencia en segundos
          const startTime = new Date(s.started_at)
          const endTime = new Date(s.completed_at)
          return sum + Math.round((endTime - startTime) / 1000)
        }
        return sum
      }, 0) / completedSessions.length
    ) : 0

    // Estadísticas por tipo de sesión (simplificado por ahora)
    const byCategory = {}
    completedSessions.forEach(session => {
      const sessionType = session.session_type || 'psychometric'
      if (!byCategory[sessionType]) {
        byCategory[sessionType] = {
          display_name: sessionType,
          total: 0,
          correct: 0,
          accuracy: 0,
          averageTime: 0,
          accuracies: [],
          sessionTimes: []
        }
      }
      // Sumar total de preguntas (no número de sesiones)
      byCategory[sessionType].total += (session.total_questions || 0)
      if (session.accuracy_percentage !== null && session.accuracy_percentage !== undefined) {
        byCategory[sessionType].accuracies.push(session.accuracy_percentage)
      }
      // Sumar respuestas correctas totales
      byCategory[sessionType].correct += (session.correct_answers || 0)
      
      // Calcular tiempo de la sesión para promedio
      if (session.total_time_seconds) {
        byCategory[sessionType].sessionTimes.push(session.total_time_seconds)
      } else if (session.started_at && session.completed_at) {
        const startTime = new Date(session.started_at)
        const endTime = new Date(session.completed_at)
        const sessionTime = Math.round((endTime - startTime) / 1000)
        byCategory[sessionType].sessionTimes.push(sessionTime)
      }
    })

    // Calcular promedios por tipo de sesión
    Object.keys(byCategory).forEach(key => {
      const cat = byCategory[key]
      cat.accuracy = cat.accuracies.length > 0 
        ? Math.round(cat.accuracies.reduce((a, b) => a + b, 0) / cat.accuracies.length)
        : 0
      cat.averageTime = cat.sessionTimes.length > 0
        ? Math.round(cat.sessionTimes.reduce((a, b) => a + b, 0) / cat.sessionTimes.length)
        : 0
      // cat.correct ya tiene el total de respuestas correctas sumadas arriba
      delete cat.accuracies // Limpiar arrays temporales
      delete cat.sessionTimes
    })

    // Por ahora simplificamos y solo mostramos estadísticas básicas

    // Calcular estadísticas de tests incompletos con progreso
    const incompleteStats = incompleteWithProgress.length > 0 ? {
      count: incompleteWithProgress.length,
      averageAccuracy: Math.round(
        incompleteWithProgress.reduce((sum, s) => sum + (s.accuracy_percentage || 0), 0) / incompleteWithProgress.length
      ),
      totalQuestionsAnswered: incompleteWithProgress.reduce((sum, s) => sum + (s.questions_answered || 0), 0),
      totalCorrectAnswers: incompleteWithProgress.reduce((sum, s) => sum + (s.correct_answers || 0), 0)
    } : null

    return {
      overview: {
        totalAnswers: totalQuestions,
        accuracy,
        averageTime,
        totalSessions: completedSessions.length,
        incompleteWithProgressStats: incompleteStats
      },
      byCategory,
      bySection: {}, // Vacío por ahora
      byDifficulty: {}, // Vacío por ahora
      timePatterns: {}, // Vacío por ahora
      recentActivity: [...completedSessions, ...incompleteWithProgress]
        .sort((a, b) => new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at))
        .slice(0, 10)
        .map(session => ({
        session_id: session.id,
        question_text: session.is_completed 
          ? `Test completado: ${session.correct_answers}/${session.total_questions} aciertos (${Math.round(session.accuracy_percentage)}%)`
          : `Test incompleto: ${session.questions_answered}/${session.total_questions} preguntas (${session.correct_answers} aciertos, ${Math.round(session.accuracy_percentage)}%)`,
        category: 'Test Psicotécnico',
        section: `${session.total_questions} preguntas`,
        is_correct: session.is_completed, // Verde si completado, rojo si incompleto
        score: session.accuracy_percentage,
        correct_answers: session.correct_answers,
        total_questions: session.total_questions,
        answered_at: session.completed_at || session.created_at,
        time_taken: session.total_time_seconds || (session.started_at && session.completed_at ? 
          Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 1000) : 0)
      })),
      weakAreas: [], // Vacío por ahora
      strengths: [] // Vacío por ahora
    }
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0s'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
    return `${seconds}s`
  }

  const getDifficultyLabel = (level) => {
    const labels = {
      1: 'Muy Fácil',
      2: 'Fácil', 
      3: 'Medio',
      4: 'Difícil',
      5: 'Muy Difícil'
    }
    return labels[level] || 'Medio'
  }

  const getDifficultyColor = (level) => {
    const colors = {
      1: 'text-green-600 bg-green-100',
      2: 'text-blue-600 bg-blue-100',
      3: 'text-yellow-600 bg-yellow-100',
      4: 'text-orange-600 bg-orange-100',
      5: 'text-red-600 bg-red-100'
    }
    return colors[level] || 'text-gray-600 bg-gray-100'
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Acceso Requerido
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Debes iniciar sesión para ver tus estadísticas psicotécnicas
          </p>
          <Link 
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                <Link href="/mis-estadisticas" className="hover:text-gray-700 dark:hover:text-gray-300">
                  Mis Estadísticas
                </Link>
                <span>→</span>
                <span className="text-gray-900 dark:text-gray-100">Psicotécnicos</span>
              </nav>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                📊 Estadísticas Psicotécnicas
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Análisis detallado de tu rendimiento en tests psicotécnicos
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período:</label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Todo el tiempo</option>
                <option value="month">Último mes</option>
                <option value="week">Última semana</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoría:</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="all">Todas las categorías</option>
                <option value="capacidad-administrativa">Capacidad Administrativa</option>
                <option value="razonamiento-numerico">Razonamiento Numérico</option>
                <option value="razonamiento-verbal">Razonamiento Verbal</option>
                <option value="series-alfanumericas">Series Alfanuméricas</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : !stats || stats.overview.totalAnswers === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🧠</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Sin Datos Psicotécnicos
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Aún no has realizado tests psicotécnicos. ¡Empieza ahora para ver tus estadísticas!
            </p>
            <Link 
              href="/auxiliar-administrativo-estado/test"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Realizar Test Psicotécnico
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Respuestas</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.overview.totalAnswers}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <span className="text-2xl">✅</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Precisión</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.overview.accuracy}%</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                    <span className="text-2xl">⏱️</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tiempo Promedio</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatTime(stats.overview.averageTime)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <span className="text-2xl">📚</span>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tests Completados</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.overview.totalSessions}</p>
                    {stats.overview.incompleteWithProgressStats && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        📊 {stats.overview.incompleteWithProgressStats.count} tests incompletos con progreso 
                        ({stats.overview.incompleteWithProgressStats.averageAccuracy}% accuracy promedio)
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance by Category */}
            {Object.keys(stats.byCategory).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    📋 Rendimiento por Categoría
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(stats.byCategory).map(([key, category]) => (
                      <div key={key} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{category.display_name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            category.accuracy >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            category.accuracy >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {category.accuracy}%
                          </span>
                        </div>
                        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex justify-between">
                            <span>Respuestas:</span>
                            <span>{category.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Aciertos:</span>
                            <span>{category.correct}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tiempo promedio:</span>
                            <span>{formatTime(category.averageTime)}</span>
                          </div>
                        </div>
                        {/* Barra de progreso */}
                        <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              category.accuracy >= 80 ? 'bg-green-600' :
                              category.accuracy >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${category.accuracy}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Performance by Difficulty */}
            {Object.keys(stats.byDifficulty).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    🎯 Rendimiento por Dificultad
                  </h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {Object.entries(stats.byDifficulty)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([level, difficulty]) => (
                      <div key={level} className="text-center">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold ${getDifficultyColor(parseInt(level))}`}>
                          {difficulty.accuracy}%
                        </div>
                        <div className="mt-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {getDifficultyLabel(parseInt(level))}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {difficulty.total} preguntas
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Weak Areas and Strengths */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weak Areas */}
              {stats.weakAreas.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      ⚠️ Áreas de Mejora
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {stats.weakAreas.map((area, index) => (
                        <div key={area.key} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{area.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{area.category}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-red-600 dark:text-red-400">{area.accuracy}%</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{area.total} intentos</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Strengths */}
              {stats.strengths.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      ⭐ Fortalezas
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {stats.strengths.map((strength, index) => (
                        <div key={strength.key} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100">{strength.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{strength.category}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-green-600 dark:text-green-400">{strength.accuracy}%</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{strength.total} intentos</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Activity */}
            {stats.recentActivity.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    🕒 Actividad Reciente
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    {stats.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className={`w-4 h-4 rounded-full ${activity.is_correct ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {activity.question_text}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {activity.category} • {activity.section}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                          <div>{formatTime(activity.time_taken)}</div>
                          <div>{new Date(activity.answered_at).toLocaleDateString('es-ES')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Weak Areas Analysis - Temporarily disabled due to missing table columns */}
            {/* <PsychometricWeakAreasAnalysis userId={user.id} /> */}
          </div>
        )}
      </div>
    </div>
  )
}