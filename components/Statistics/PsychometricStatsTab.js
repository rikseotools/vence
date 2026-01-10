'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

export default function PsychometricStatsTab() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('all')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const loadPsychometricStats = useCallback(async () => {
    try {
      setLoading(true)

      let dateFilter = {}
      const now = new Date()

      if (selectedPeriod === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        dateFilter = { created_at: { gte: weekAgo.toISOString() } }
      } else if (selectedPeriod === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        dateFilter = { created_at: { gte: monthAgo.toISOString() } }
      }

      let query = supabase
        .from('psychometric_test_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_type', 'psychometric')

      if (dateFilter.created_at) {
        query = query.gte('created_at', dateFilter.created_at.gte)
      }

      if (selectedCategory !== 'all') {
        query = query.eq('psychometric_questions.psychometric_sections.psychometric_categories.category_key', selectedCategory)
      }

      const { data: answers, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading psychometric stats:', error)
        return
      }

      const processedStats = processPsychometricStats(answers)
      setStats(processedStats)

    } catch (error) {
      console.error('Error in loadPsychometricStats:', error)
    } finally {
      setLoading(false)
    }
  }, [user, selectedPeriod, selectedCategory])

  useEffect(() => {
    if (user) {
      loadPsychometricStats()
    }
  }, [user, selectedPeriod, selectedCategory, loadPsychometricStats])

  const processPsychometricStats = (sessions) => {
    if (!sessions || sessions.length === 0) {
      return {
        overview: { totalAnswers: 0, accuracy: 0, averageTime: 0, totalSessions: 0 },
        byCategory: {},
        recentActivity: [],
        weakAreas: [],
        strengths: []
      }
    }

    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.is_completed === true)
    const incompleteWithProgress = sessions.filter(s => s.is_completed === false && (s.questions_answered > 0))
    const totalQuestions = completedSessions.reduce((sum, s) => sum + (s.total_questions || 0), 0)

    const accuracy = completedSessions.length > 0 ?
      Math.round(completedSessions.reduce((sum, s) => sum + (s.accuracy_percentage || 0), 0) / completedSessions.length) : 0

    const averageTime = completedSessions.length > 0 ? Math.round(
      completedSessions.reduce((sum, s) => {
        if (s.total_time_seconds) {
          return sum + s.total_time_seconds
        } else if (s.started_at && s.completed_at) {
          const startTime = new Date(s.started_at)
          const endTime = new Date(s.completed_at)
          return sum + Math.round((endTime - startTime) / 1000)
        }
        return sum
      }, 0) / completedSessions.length
    ) : 0

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
      byCategory[sessionType].total += (session.total_questions || 0)
      if (session.accuracy_percentage !== null && session.accuracy_percentage !== undefined) {
        byCategory[sessionType].accuracies.push(session.accuracy_percentage)
      }
      byCategory[sessionType].correct += (session.correct_answers || 0)

      if (session.total_time_seconds) {
        byCategory[sessionType].sessionTimes.push(session.total_time_seconds)
      } else if (session.started_at && session.completed_at) {
        const startTime = new Date(session.started_at)
        const endTime = new Date(session.completed_at)
        const sessionTime = Math.round((endTime - startTime) / 1000)
        byCategory[sessionType].sessionTimes.push(sessionTime)
      }
    })

    Object.keys(byCategory).forEach(key => {
      const cat = byCategory[key]
      cat.accuracy = cat.accuracies.length > 0
        ? Math.round(cat.accuracies.reduce((a, b) => a + b, 0) / cat.accuracies.length)
        : 0
      cat.averageTime = cat.sessionTimes.length > 0
        ? Math.round(cat.sessionTimes.reduce((a, b) => a + b, 0) / cat.sessionTimes.length)
        : 0
      delete cat.accuracies
      delete cat.sessionTimes
    })

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
          is_correct: session.is_completed,
          score: session.accuracy_percentage,
          correct_answers: session.correct_answers,
          total_questions: session.total_questions,
          answered_at: session.completed_at || session.created_at,
          time_taken: session.total_time_seconds || (session.started_at && session.completed_at ?
            Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 1000) : 0)
        })),
      weakAreas: [],
      strengths: []
    }
  }

  const formatTime = (seconds) => {
    if (!seconds) return '0s'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
    return `${seconds}s`
  }

  if (!user) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Debes iniciar sesión para ver tus estadísticas psicotécnicas
        </p>
        <Link
          href="/login"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Iniciar Sesión
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!stats || stats.overview.totalAnswers === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🧩</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Sin Datos Psicotécnicos
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Aún no has realizado tests psicotécnicos. ¡Empieza ahora para ver tus estadísticas!
        </p>
        <Link
          href="/auxiliar-administrativo-estado/test"
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          Realizar Test Psicotécnico
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-2xl">📝</span>
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
                  {stats.overview.incompleteWithProgressStats.count} incompletos con progreso
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
                    <span className={`w-4 h-4 rounded-full ${activity.is_correct ? 'bg-green-500' : 'bg-orange-500'}`}></span>
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
    </div>
  )
}
