// components/Statistics/RecentTests.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DifficultyItem {
  difficulty: string
  correct: number
  total: number
  accuracy: number
}

interface RecentTestData {
  id: string
  title: string
  score: number
  total: number
  percentage: number
  date: string
  time: string
  avgTimePerQuestion: number
  difficultyBreakdown?: DifficultyItem[]
  engagementScore?: number
  focusScore?: number
  isPsychometric?: boolean
}

interface RecentTestsProps {
  recentTests: RecentTestData[]
  onInfoClick?: () => void
}

const INITIAL_SHOW_COUNT = 5

const getScoreColor = (percentage: number): string => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage: number): string => {
  if (percentage >= 85) return 'bg-green-50 border-green-200'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export default function RecentTests({ recentTests, onInfoClick }: RecentTestsProps) {
  const [showAll, setShowAll] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const router = useRouter()

  if (!recentTests || recentTests.length === 0) return null

  const visibleTests = showAll ? recentTests : recentTests.slice(0, INITIAL_SHOW_COUNT)
  const hasMore = recentTests.length > INITIAL_SHOW_COUNT

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">Tests Recientes</h3>
        {onInfoClick && (
          <button
            onClick={onInfoClick}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="Que significan estos porcentajes?"
          >
            i
          </button>
        )}
      </div>
      <div className="space-y-4">
        {visibleTests.map((test) => (
          <div
            key={test.id}
            onClick={() => {
              setLoadingId(test.id)
              const typeParam = test.isPsychometric ? '?type=psychometric' : ''
              router.push(`/revisar/${test.id}${typeParam}`)
            }}
            className={`p-4 rounded-lg border ${getScoreBg(test.percentage)} hover:shadow-md cursor-pointer transition-shadow ${loadingId === test.id ? 'opacity-70' : ''}`}
          >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-3xl">
                    {loadingId === test.id ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
                    ) : test.isPsychometric ? '\u{1F9E9}' : '\u{2696}\u{FE0F}'}
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{test.title}</div>
                    <div className="text-sm text-gray-600">
                      {test.date} &bull; {test.time} &bull; {test.avgTimePerQuestion}s/pregunta
                    </div>
                    <div className="text-xs text-blue-500 font-medium mt-0.5">Pulsa para revisar →</div>
                    {(test.engagementScore ?? 0) > 0 && (
                      <div className="text-xs text-purple-600 mt-1">
                        Engagement: {test.engagementScore}% &bull; Focus: {test.focusScore}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${getScoreColor(test.percentage)}`}>
                      {test.score}/{test.total}
                    </div>
                    <div className={`text-lg font-bold ${getScoreColor(test.percentage)}`}>
                      {test.percentage}%
                    </div>
                  </div>
                  <div className="text-gray-400 text-xl">›</div>
                </div>
              </div>

              {/* Desglose por Dificultad */}
              {test.difficultyBreakdown && test.difficultyBreakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 mb-2">Analisis por Dificultad:</div>
                  <div className="flex space-x-4">
                    {test.difficultyBreakdown.map((diff, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-xs font-medium capitalize">{diff.difficulty}</div>
                        <div className="text-sm font-bold">{diff.correct}/{diff.total}</div>
                        <div className={`text-xs ${getScoreColor(diff.accuracy)}`}>
                          {diff.accuracy}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 w-full py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
        >
          {showAll
            ? 'Mostrar menos'
            : `Ver historial completo (${recentTests.length} tests)`}
        </button>
      )}
    </div>
  )
}
