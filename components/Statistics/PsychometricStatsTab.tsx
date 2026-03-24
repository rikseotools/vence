// components/Statistics/PsychometricStatsTab.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type {
  GetPsychometricStatsResponse,
  CategoryStat,
  RecentPsychometricTest,
} from '@/lib/api/psychometric-stats/schemas'

const formatTime = (seconds: number): string => {
  if (!seconds) return '0s'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`
  return `${seconds}s`
}

const getScoreColor = (percentage: number): string => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage: number): string => {
  if (percentage >= 85) return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
}

const getBarColor = (accuracy: number): string => {
  if (accuracy >= 80) return 'bg-green-500'
  if (accuracy >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function PsychometricStatsTab() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([])
  const [recentTests, setRecentTests] = useState<RecentPsychometricTest[]>([])
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    const loadStats = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/v2/psychometric-stats?userId=${user.id}`)
        const data: GetPsychometricStatsResponse = await res.json()

        if (data.success && data.data) {
          setCategoryStats(data.data.categoryStats)
          setRecentTests(data.data.recentTests)
        }
      } catch (error) {
        console.error('Error loading psychometric stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [user?.id])

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
          Sin datos psicotécnicos
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Realiza tests psicotécnicos para ver tus estadísticas aquí.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Aciertos por tipo */}
      {categoryStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
            Aciertos por tipo
          </h3>
          <div className="space-y-4">
            {categoryStats.map((cat) => (
              <div key={cat.categoryKey} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {cat.displayName}
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

      {/* Tests recientes */}
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
                      ) : '🧩'}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                        Test psicotécnico
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {test.date} &bull; {formatTime(test.timeSeconds)} &bull; {test.avgTimePerQuestion}s/pregunta
                      </div>
                      <div className="text-xs text-blue-500 font-medium mt-0.5">Pulsa para revisar →</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getScoreColor(test.percentage)}`}>
                        {test.score}/{test.total}
                      </div>
                      <div className={`text-sm font-bold ${getScoreColor(test.percentage)}`}>
                        {test.percentage}%
                      </div>
                    </div>
                    <div className="text-gray-400 text-xl">›</div>
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
