// components/Statistics/WeeklyProgress.js
'use client'

import { useState } from 'react'

const formatTime = (seconds) => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : '0m'
}

const getScoreColor = (percentage) => {
  if (percentage >= 85) return '#10b981' // green-500
  if (percentage >= 70) return '#3b82f6' // blue-500
  if (percentage >= 50) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

const getBarColor = (percentage) => {
  if (percentage >= 85) return 'bg-green-500'
  if (percentage >= 70) return 'bg-blue-500'
  if (percentage >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function WeeklyProgress({ weeklyProgress }) {
  const [activeMetric, setActiveMetric] = useState('accuracy')
  const [showInfo, setShowInfo] = useState(false)

  if (!weeklyProgress || weeklyProgress.length === 0) return null

  const last4Weeks = weeklyProgress.slice(-4)
  const maxValue = Math.max(...last4Weeks.map(week => {
    switch(activeMetric) {
      case 'accuracy': return week.accuracy
      case 'tests': return week.testsCompleted
      case 'questions': return week.questionsAnswered
      case 'time': return Math.floor(week.studyTime / 3600) // horas
      default: return week.accuracy
    }
  }))

  const getMetricValue = (week) => {
    switch(activeMetric) {
      case 'accuracy': return week.accuracy
      case 'tests': return week.testsCompleted
      case 'questions': return week.questionsAnswered
      case 'time': return Math.floor(week.studyTime / 3600)
      default: return week.accuracy
    }
  }

  const getMetricLabel = (week) => {
    switch(activeMetric) {
      case 'accuracy': return `${week.accuracy}%`
      case 'tests': return `${week.testsCompleted}`
      case 'questions': return `${week.questionsAnswered}`
      case 'time': return `${Math.floor(week.studyTime / 3600)}h`
      default: return `${week.accuracy}%`
    }
  }

  const getMetricTitle = () => {
    switch(activeMetric) {
      case 'accuracy': return 'Precisión'
      case 'tests': return 'Tests Completados'
      case 'questions': return 'Preguntas Respondidas'
      case 'time': return 'Tiempo de Estudio'
      default: return 'Precisión'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">📈 Progreso Semanal</h3>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span className="text-lg">ℹ️</span>
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm">
          <p><strong>Progreso visual:</strong> Cambia entre métricas para ver tu evolución semanal en diferentes aspectos del estudio.</p>
        </div>
      )}

      {/* Selector de métricas */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'accuracy', label: 'Precisión', icon: '🎯' },
          { id: 'tests', label: 'Tests', icon: '📝' },
          { id: 'questions', label: 'Preguntas', icon: '❓' },
          { id: 'time', label: 'Tiempo', icon: '⏱️' }
        ].map(metric => (
          <button
            key={metric.id}
            onClick={() => setActiveMetric(metric.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeMetric === metric.id
                ? 'bg-purple-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="mr-1">{metric.icon}</span>
            {metric.label}
          </button>
        ))}
      </div>

      {/* Gráfico visual mejorado */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="font-bold text-gray-800 mb-6 text-center">{getMetricTitle()} - Últimas 4 Semanas</h4>
        
        <div className="relative">
          {/* Eje Y con valores de referencia */}
          <div className="absolute left-0 top-0 h-48 w-12 flex flex-col justify-between text-xs text-gray-500">
            <span>{maxValue}</span>
            <span>{Math.round(maxValue * 0.75)}</span>
            <span>{Math.round(maxValue * 0.5)}</span>
            <span>{Math.round(maxValue * 0.25)}</span>
            <span>0</span>
          </div>

          {/* Líneas de referencia horizontales */}
          <div className="ml-16 relative">
            <div className="absolute inset-0 h-48">
              {[0, 25, 50, 75, 100].map((percentage, index) => (
                <div 
                  key={index}
                  className="absolute w-full border-t border-gray-200"
                  style={{ bottom: `${percentage * 1.92}px` }}
                ></div>
              ))}
            </div>

            {/* Gráfico de barras con más espacio */}
            <div className="flex items-end justify-center space-x-8 h-48 mb-8 relative z-10">
              {last4Weeks.map((week, index) => {
                const value = getMetricValue(week)
                const height = maxValue > 0 ? (value / maxValue) * 160 + 12 : 12 // min 12px height, max 160px
                
                return (
                  <div key={index} className="flex flex-col items-center space-y-3">
                    {/* Valor sobre la barra con más separación */}
                    <div className="text-sm font-bold text-gray-700 bg-white px-3 py-2 rounded-lg shadow-md border">
                      {getMetricLabel(week)}
                    </div>
                    
                    {/* Barra más ancha y con sombra */}
                    <div 
                      className={`w-16 rounded-t-lg transition-all duration-500 hover:opacity-80 shadow-lg ${
                        activeMetric === 'accuracy' ? getBarColor(week.accuracy) : 'bg-purple-500'
                      }`}
                      style={{ height: `${height}px` }}
                    ></div>
                    
                    {/* Label de semana con mejor formato */}
                    <div className="text-sm font-medium text-gray-700 text-center w-20 bg-white px-2 py-2 rounded-lg shadow-md border">
                      {week.week.replace('Hace ', '').replace(' semanas', 's').replace(' semana', 's')}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Eje X */}
            <div className="border-t-2 border-gray-400"></div>
          </div>

          {/* Etiquetas de ejes */}
          <div className="mt-4 text-center">
            <div className="text-sm font-medium text-gray-600">
              📅 Semanas
            </div>
          </div>
          <div className="absolute left-0 top-1/2 transform -rotate-90 text-sm font-medium text-gray-600">
            📊 {getMetricTitle()}
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {last4Weeks.map((week, index) => (
            <div key={index} className="bg-white rounded-lg p-3 text-center">
              <div className="text-xs text-gray-600 mb-1">{week.week}</div>
              <div className="space-y-1">
                <div className="text-xs">
                  <span className="text-gray-500">Tests:</span>
                  <span className="font-bold ml-1">{week.testsCompleted}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Precisión:</span>
                  <span className="font-bold ml-1" style={{ color: getScoreColor(week.accuracy) }}>
                    {week.accuracy}%
                  </span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Tiempo:</span>
                  <span className="font-bold ml-1">{formatTime(week.studyTime)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Análisis de tendencias */}
      {last4Weeks.length >= 2 && (
        <div className="mt-4 bg-blue-50 rounded-lg p-4">
          <h5 className="font-bold text-blue-800 mb-2">📊 Análisis de Tendencia</h5>
          <div className="text-sm text-blue-700">
            {(() => {
              const firstWeek = last4Weeks[0]
              const lastWeek = last4Weeks[last4Weeks.length - 1]
              const accuracyChange = lastWeek.accuracy - firstWeek.accuracy
              const testsChange = lastWeek.testsCompleted - firstWeek.testsCompleted
              
              if (accuracyChange > 5) {
                return `📈 ¡Excelente! Tu precisión ha mejorado ${accuracyChange.toFixed(1)}% en las últimas semanas.`
              } else if (accuracyChange < -5) {
                return `📉 Tu precisión ha bajado ${Math.abs(accuracyChange).toFixed(1)}%. Considera revisar los temas más difíciles.`
              } else if (testsChange > 0) {
                return `🔄 Mantenes un ritmo constante. Has aumentado ${testsChange} tests esta semana.`
              } else {
                return `➡️ Tu rendimiento se mantiene estable. ¡Sigue así!`
              }
            })()}
          </div>
        </div>
      )}
    </div>
  )
}