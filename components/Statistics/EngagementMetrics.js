// components/Statistics/EngagementMetrics.js
'use client'

export default function EngagementMetrics({ engagementMetrics }) {
  if (!engagementMetrics) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 Métricas de Engagement</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{engagementMetrics.avgEngagement}%</div>
          <div className="text-sm text-purple-600">Engagement Promedio</div>
          <div className="text-xs text-purple-500 mt-1">
            {engagementMetrics.level === 'excellent' ? '🏆 Excelente' :
             engagementMetrics.level === 'good' ? '👍 Bueno' :
             engagementMetrics.level === 'fair' ? '⚠️ Regular' : '📚 Mejorable'}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{engagementMetrics.avgInteractionRate}</div>
          <div className="text-sm text-green-600">Interacciones/min</div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{engagementMetrics.bounceRate}%</div>
          <div className="text-sm text-red-600">Tasa de Rebote</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{engagementMetrics.highEngagementAccuracy}%</div>
          <div className="text-sm text-blue-600">Precisión en Sesiones de Alto Engagement</div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-bold text-yellow-800 mb-2">💡 Recomendación de Engagement</h4>
        <div className="text-sm text-yellow-700">
          {engagementMetrics.recommendation}
        </div>
      </div>
    </div>
  )
}
