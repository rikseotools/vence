'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabase'

const supabase = getSupabaseClient()

const formatTime = (seconds) => {
  if (!seconds) return '0s'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
  return `${seconds}s`
}

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage) => {
  if (percentage >= 85) return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
}

const getBarColor = (accuracy) => {
  if (accuracy >= 80) return 'bg-green-500'
  if (accuracy >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function PsychometricStatsTab() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categoryStats, setCategoryStats] = useState([])
  const [recentTests, setRecentTests] = useState([])
  const [loadingId, setLoadingId] = useState(null)

  const loadStats = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)

      // 1. Get accuracy by category from answers + questions join
      const { data: answers, error: answersError } = await supabase
        .from('psychometric_test_answers')
        .select('is_correct, psychometric_questions!inner(category_id)')
        .not('user_answer', 'is', null)

      if (answersError) {
        console.error('Error loading psychometric answers:', answersError)
      }

      // Get categories for display names
      const { data: categories } = await supabase
        .from('psychometric_categories')
        .select('id, display_name, category_key')
        .eq('is_active', true)
        .order('display_order')

      // Aggregate by category
      if (answers && categories) {
        const catMap = {}
        categories.forEach(c => {
          catMap[c.id] = { ...c, correct: 0, total: 0 }
        })

        answers.forEach(a => {
          const catId = a.psychometric_questions?.category_id
          if (catId && catMap[catId]) {
            catMap[catId].total++
            if (a.is_correct) catMap[catId].correct++
          }
        })

        const stats = Object.values(catMap)
          .filter(c => c.total > 0)
          .map(c => ({
            display_name: c.display_name,
            category_key: c.category_key,
            accuracy: Math.round((c.correct / c.total) * 100),
            correct: c.correct,
            total: c.total
          }))
          .sort((a, b) => b.total - a.total)

        setCategoryStats(stats)
      }

      // 2. Get recent completed sessions
      const { data: sessions } = await supabase
        .from('psychometric_test_sessions')
        .select('id, total_questions, correct_answers, accuracy_percentage, total_time_seconds, started_at, completed_at, created_at')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: false })
        .limit(10)

      if (sessions) {
        setRecentTests(sessions.map(s => {
          const timeSeconds = s.total_time_seconds ||
            (s.started_at && s.completed_at ? Math.round((new Date(s.completed_at) - new Date(s.started_at)) / 1000) : 0)
          const avgTime = s.total_questions > 0 ? Math.round(timeSeconds / s.total_questions) : 0
          return {
            id: s.id,
            score: s.correct_answers,
            total: s.total_questions,
            percentage: Math.round(s.accuracy_percentage || 0),
            date: new Date(s.completed_at || s.created_at).toLocaleDateString('es-ES'),
            time: formatTime(timeSeconds),
            avgTimePerQuestion: avgTime
          }
        }))
      }

    } catch (error) {
      console.error('Error in loadStats:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (categoryStats.length === 0 && recentTests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🧩</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Sin datos psicotecnicos
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Realiza tests psicotecnicos para ver tus estadisticas aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* % Aciertos por tipo de test psicotecnico */}
      {categoryStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Aciertos por tipo
          </h3>
          <div className="space-y-4">
            {categoryStats.map((cat) => (
              <div key={cat.category_key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {cat.display_name}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {cat.correct}/{cat.total}
                    </span>
                    <span className={`text-sm font-bold ${getScoreColor(cat.accuracy)}`}>
                      {cat.accuracy}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${getBarColor(cat.accuracy)}`}
                    style={{ width: `${cat.accuracy}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tests recientes psicotecnicos */}
      {recentTests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Tests recientes
          </h3>
          <div className="space-y-3">
            {recentTests.map((test) => (
              <div
                key={test.id}
                onClick={() => {
                  setLoadingId(test.id)
                  router.push(`/revisar/${test.id}?type=psychometric`)
                }}
                className={`p-4 rounded-lg border ${getScoreBg(test.percentage)} hover:shadow-md cursor-pointer transition-shadow ${loadingId === test.id ? 'opacity-70' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">
                      {loadingId === test.id ? (
                        <div className="animate-spin rounded-full h-7 w-7 border-2 border-green-500 border-t-transparent" />
                      ) : '\u{1F9E9}'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                        Test psicotecnico
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {test.date} &bull; {test.time} &bull; {test.avgTimePerQuestion}s/pregunta
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${getScoreColor(test.percentage)}`}>
                      {test.score}/{test.total}
                    </div>
                    <div className={`text-sm font-bold ${getScoreColor(test.percentage)}`}>
                      {test.percentage}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
