// components/Statistics/PersonalDifficultyInsights.js
'use client'

import { useState, useEffect } from 'react'
import { adaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'
import { useAuth } from '@/contexts/AuthContext'

export default function PersonalDifficultyInsights() {
  const { user, supabase } = useAuth()
  const [localUser, setLocalUser] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [trends, setTrends] = useState(null)
  const [strugglingQuestions, setStrugglingQuestions] = useState([])
  const [masteredQuestions, setMasteredQuestions] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const initializeData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        await loadAllData(user.id)
      }
      setIsLoading(false)
    }
    
    initializeData()
  }, [])

  const loadAllData = async (userId) => {
    try {
      const [metricsData, trendsData, strugglingData, masteredData, recommendationsData] = await Promise.all([
        adaptiveDifficultyService.getUserDifficultyMetrics(userId),
        adaptiveDifficultyService.getUserProgressTrends(userId),
        adaptiveDifficultyService.getStrugglingQuestions(userId, 5),
        adaptiveDifficultyService.getMasteredQuestions(userId, 5),
        adaptiveDifficultyService.getPersonalizedRecommendations(userId)
      ])

      setMetrics(metricsData)
      setTrends(trendsData)
      setStrugglingQuestions(strugglingData)
      setMasteredQuestions(masteredData)
      setRecommendations(recommendationsData)
    } catch (error) {
      console.error('Error loading personal difficulty data:', error)
    }
  }

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
        <p className="text-gray-600">🔐 Inicia sesión para ver tu análisis personal</p>
      </div>
    )
  }

  if (metrics.total_questions_attempted === 0) {
    return (
      <div className="bg-blue-50 rounded-xl p-6 text-center border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800 mb-2">✨ Dificultad Personal IA</h3>
        <p className="text-blue-700 mb-3">Responde preguntas para activar tu análisis personalizado</p>
        
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center mx-auto space-x-1"
        >
          <span>ℹ️</span>
          <span>¿Cómo funciona?</span>
          <span className="text-xs">{showInfo ? '▼' : '▶'}</span>
        </button>
        
        {showInfo && (
          <div className="mt-3 text-sm text-blue-600 space-y-1">
            <p>• Cada pregunta se adapta a tu nivel individual</p>
            <p>• Seguimos tu progreso y detectamos mejoras</p>
            <p>• Identificamos fortalezas y áreas de mejora</p>
          </div>
        )}
      </div>
    )
  }

  const getProgressColor = (trend) => {
    switch (trend) {
      case 'improving': return 'text-green-600'
      case 'declining': return 'text-red-600'
      default: return 'text-blue-600'
    }
  }

  const getProgressIcon = (trend) => {
    switch (trend) {
      case 'improving': return '📈'
      case 'declining': return '📉'
      default: return '➡️'
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 border-red-300 text-red-800'
      case 'medium': return 'bg-yellow-100 border-yellow-300 text-yellow-800'
      default: return 'bg-blue-100 border-blue-300 text-blue-800'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">✨ Dificultad Personal IA</h3>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span className="text-lg">ℹ️</span>
        </button>
      </div>
      
      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
          <p><strong>Sistema adaptativo IA ✨:</strong> Analiza tu rendimiento individual en cada pregunta para ofrecerte insights personalizados y recomendaciones específicas.</p>
        </div>
      )}
      
      {/* Tabs compactos */}
      <div className="flex space-x-1 mb-4">
        {[
          { id: 'overview', label: 'Resumen', icon: '📊' },
          { id: 'struggling', label: 'Mejorar', icon: '💪' },
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

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Métricas compactas */}
          <div className="flex justify-center space-x-3 mb-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{metrics.total_questions_attempted}</div>
              <div className="text-xs text-blue-600">Intentadas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{metrics.questions_mastered}</div>
              <div className="text-xs text-green-600">Dominadas</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">{metrics.questions_struggling}</div>
              <div className="text-xs text-red-600">Difíciles</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{metrics.avg_personal_difficulty?.toFixed(1)}</div>
              <div className="text-xs text-purple-600">Dificultad</div>
            </div>
          </div>

          {/* Tendencias compactas */}
          {trends && trends.total > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="font-bold text-gray-800 mb-2 text-sm">📈 Tendencias</h4>
              <div className="flex justify-center space-x-4 text-center">
                <div className={`${getProgressColor('improving')}`}>
                  <span className="text-lg">{getProgressIcon('improving')}</span>
                  <div className="font-bold">{trends.improving}</div>
                  <div className="text-xs">Mejorando</div>
                </div>
                <div className={`${getProgressColor('stable')}`}>
                  <span className="text-lg">{getProgressIcon('stable')}</span>
                  <div className="font-bold">{trends.stable}</div>
                  <div className="text-xs">Estable</div>
                </div>
                <div className={`${getProgressColor('declining')}`}>
                  <span className="text-lg">{getProgressIcon('declining')}</span>
                  <div className="font-bold">{trends.declining}</div>
                  <div className="text-xs">Declive</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Struggling Questions Tab */}
      {activeTab === 'struggling' && (
        <div className="space-y-3">
          {strugglingQuestions.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                💪 Enfócate en estas para mejorar:
              </p>
              {strugglingQuestions.map((item, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-red-800 truncate flex-1">
                      {item.questions.question_text.substring(0, 80)}...
                    </div>
                    <div className="text-xs text-red-600 ml-2 shrink-0">
                      {Math.round(item.success_rate * 100)}% éxito
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Intentos: {item.total_attempts}</span>
                    <span className={`${getProgressColor(item.trend)}`}>
                      {getProgressIcon(item.trend)} {item.trend}
                    </span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>🎉 ¡Genial! No tienes preguntas con dificultades significativas.</p>
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
                ✅ Preguntas que dominas:
              </p>
              {masteredQuestions.map((item, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium text-green-800 truncate flex-1">
                      {item.questions.question_text.substring(0, 80)}...
                    </div>
                    <div className="text-xs text-green-600 ml-2 shrink-0">
                      {Math.round(item.success_rate * 100)}% éxito
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Intentos: {item.total_attempts}</span>
                    <span>Dificultad: {item.personal_difficulty}</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>📚 Continúa practicando para dominar más preguntas.</p>
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
              <p>🎯 ¡Perfecto! No hay recomendaciones urgentes ahora.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}