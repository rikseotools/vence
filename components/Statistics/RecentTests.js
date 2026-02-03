// components/Statistics/RecentTests.js
'use client'

import Link from 'next/link'

const formatTime = (seconds) => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : `${seconds}s`
}

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

const getScoreBg = (percentage) => {
  if (percentage >= 85) return 'bg-green-50 border-green-200'
  if (percentage >= 70) return 'bg-blue-50 border-blue-200'
  if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

export default function RecentTests({ recentTests, onInfoClick }) {
  if (!recentTests || recentTests.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">📋 Tests Recientes</h3>
        {onInfoClick && (
          <button
            onClick={onInfoClick}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="¿Qué significan estos porcentajes?"
          >
            ℹ️
          </button>
        )}
      </div>
      <div className="space-y-4">
        {recentTests.slice(0, 5).map((test, index) => (
          <div key={test.id} className={`p-4 rounded-lg border ${getScoreBg(test.percentage)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl">
                  {test.percentage >= 85 ? '🏆' : 
                   test.percentage >= 70 ? '🎯' : 
                   test.percentage >= 50 ? '📚' : '💪'}
                </div>
                <div>
                  <div className="font-bold text-gray-800">{test.title}</div>
                  <div className="text-sm text-gray-600">
                    {test.date} • {test.time} • {test.avgTimePerQuestion}s/pregunta
                  </div>
                  {test.engagementScore > 0 && (
                    <div className="text-xs text-purple-600 mt-1">
                      🧠 Engagement: {test.engagementScore}% • Focus: {test.focusScore}%
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className={`text-2xl font-bold ${getScoreColor(test.percentage)}`}>
                  {test.score}/{test.total}
                </div>
                <div className={`text-lg font-bold ${getScoreColor(test.percentage)}`}>
                  {test.percentage}%
                </div>
                <Link
                  href={`/test/${test.id}/revisar`}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  Ver detalle
                </Link>
              </div>
            </div>
            
            {/* Desglose por Dificultad */}
            {test.difficultyBreakdown && test.difficultyBreakdown.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2">📊 Análisis por Dificultad:</div>
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
    </div>
  )
}