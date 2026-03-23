// components/Statistics/PersonalDifficultyInsights.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import type {
  GetDifficultyInsightsResponse,
  DifficultyMetrics,
  QuestionResult,
  ProgressTrends,
  Recommendation,
} from '@/lib/api/difficulty-insights/schemas'

type TrendType = 'improving' | 'declining' | 'stable'

export default function PersonalDifficultyInsights() {
  const { user } = useAuth()
  const router = useRouter()
  const [metrics, setMetrics] = useState<DifficultyMetrics | null>(null)
  const [trends, setTrends] = useState<ProgressTrends | null>(null)
  const [strugglingQuestions, setStrugglingQuestions] = useState<QuestionResult[]>([])
  const [masteredQuestions, setMasteredQuestions] = useState<QuestionResult[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('struggling')
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false)
      return
    }

    const loadData = async () => {
      try {
        const res = await fetch(`/api/v2/difficulty-insights?userId=${user.id}`)
        const data: GetDifficultyInsightsResponse = await res.json()

        if (data.success && data.data) {
          setMetrics(data.data.metrics)
          setTrends(data.data.progressTrends)
          setStrugglingQuestions(data.data.strugglingQuestions)
          setMasteredQuestions(data.data.masteredQuestions)
          setRecommendations(data.data.recommendations)
        } else {
          setMetrics({ totalQuestionsAttempted: 0, questionsMastered: 0, questionsStruggling: 0, avgPersonalDifficulty: 0, accuracyTrend: 'stable' })
        }
      } catch (error) {
        console.error('Error loading difficulty insights:', error)
        setMetrics({ totalQuestionsAttempted: 0, questionsMastered: 0, questionsStruggling: 0, avgPersonalDifficulty: 0, accuracyTrend: 'stable' })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [user?.id])

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!user || !metrics) {
    return (
      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-600">Inicia sesión para ver tu análisis personal</p>
      </div>
    )
  }

  if (metrics.totalQuestionsAttempted === 0) {
    return (
      <div className="bg-blue-50 rounded-xl p-6 text-center border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800 mb-2">Análisis de tu Rendimiento</h3>
        <p className="text-blue-700 mb-3">Responde preguntas para activar tu análisis personalizado</p>

        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center mx-auto space-x-1"
        >
          <span>¿Cómo funciona?</span>
          <span className="text-xs">{showInfo ? '▼' : '▶'}</span>
        </button>

        {showInfo && (
          <div className="mt-3 text-sm text-blue-600 space-y-1">
            <p>Cada pregunta se adapta a tu nivel individual</p>
            <p>Seguimos tu progreso y detectamos mejoras</p>
            <p>Identificamos fortalezas y áreas de mejora</p>
          </div>
        )}
      </div>
    )
  }

  const getProgressColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-600'
      case 'declining': return 'text-red-600'
      default: return 'text-blue-600'
    }
  }

  const getProgressIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 border-red-300 text-red-800'
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      default: return 'bg-blue-100 border-blue-300 text-blue-800'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-800">Análisis de tu Rendimiento</h3>
      </div>

      {/* Tabs compactos */}
      <div className="flex space-x-1 mb-4">
        {[
          { id: 'struggling', label: 'Áreas a mejorar', icon: '💪' },
          { id: 'mastered', label: 'Dominadas', icon: '✅' },
          { id: 'recommendations', label: 'Consejos', icon: '💡' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Struggling Questions Tab */}
      {activeTab === 'struggling' && (
        <div className="space-y-3">
          {strugglingQuestions.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Enfócate en estas para mejorar:
              </p>
              {strugglingQuestions.map((item, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-red-800 flex-1">
                      {item.questionText.substring(0, 100)}...
                    </div>
                    <div className="text-xs text-red-600 ml-2 shrink-0">
                      {Math.round(item.successRate * 100)}% éxito
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-red-600">
                    <span>Intentos: {item.totalAttempts}</span>
                    <span className={getProgressColor(item.trend || 'stable')}>
                      {getProgressIcon(item.trend || 'stable')} {item.trend || 'stable'}
                    </span>
                  </div>
                  {item.lawSlug && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-red-200">
                      <button
                        onClick={() => router.push(`/leyes/${item.lawSlug}`)}
                        className="text-xs bg-white text-red-700 border border-red-300 px-2 py-1 rounded hover:bg-red-100 transition-colors"
                      >
                        Estudiar {item.lawName} Art. {item.articleNumber}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No tienes preguntas con dificultades significativas.</p>
            </div>
          )}
        </div>
      )}

      {/* Mastered Questions Tab */}
      {activeTab === 'mastered' && (
        <div className="space-y-3">
          {masteredQuestions.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Preguntas que dominas:
              </p>
              {masteredQuestions.map((item, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-green-800 flex-1">
                      {item.questionText.substring(0, 100)}...
                    </div>
                    <div className="text-xs text-green-600 ml-2 shrink-0">
                      {Math.round(item.successRate * 100)}% éxito
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Intentos: {item.totalAttempts}</span>
                  </div>
                  {item.lawSlug && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-green-200">
                      <button
                        onClick={() => router.push(`/leyes/${item.lawSlug}`)}
                        className="text-xs bg-white text-green-700 border border-green-300 px-2 py-1 rounded hover:bg-green-100 transition-colors"
                      >
                        {item.lawName} Art. {item.articleNumber}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Continúa practicando para dominar más preguntas.</p>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="space-y-3">
          {recommendations.length > 0 ? (
            recommendations.map((rec, index) => (
              <div key={index} className={`border rounded-lg p-3 ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start space-x-2">
                  <span className="text-lg">💡</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm mb-1">{rec.title}</h4>
                    <p className="text-sm mb-1">{rec.description}</p>
                    <div className="text-xs opacity-75">
                      Prioridad: {rec.priority === 'high' ? 'Alta' : rec.priority === 'medium' ? 'Media' : 'Baja'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No hay recomendaciones urgentes ahora.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
