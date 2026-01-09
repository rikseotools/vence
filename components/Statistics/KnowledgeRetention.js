// components/Statistics/KnowledgeRetention.js
'use client'

export default function KnowledgeRetention({ knowledgeRetention }) {
  if (!knowledgeRetention) return null

  // Asegurar que distribution existe y es un objeto válido
  const distribution = knowledgeRetention.distribution || { excellent: 0, good: 0, fair: 0, poor: 0 }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🧠 Retención de Conocimiento (IA)</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Puntuación General */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <h4 className="font-bold text-green-800 mb-3">📊 Puntuación IA</h4>
          <div className="text-4xl font-bold text-green-700 mb-2">
            {knowledgeRetention.averageScore}
          </div>
          <div className="text-sm text-green-600 mb-3">
            de 150 puntos • Nivel: {knowledgeRetention.level === 'excellent' ? 'Excelente' :
                                    knowledgeRetention.level === 'good' ? 'Bueno' :
                                    knowledgeRetention.level === 'fair' ? 'Regular' : 'Mejorable'}
          </div>
          <div className="text-xs text-green-700">
            {knowledgeRetention.recommendation}
          </div>
        </div>

        {/* Distribución */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="font-bold text-blue-800 mb-3">📈 Distribución</h4>
          <div className="space-y-3">
            {Object.entries(distribution).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <span className="text-sm capitalize">
                  {level === 'excellent' ? '🏆 Excelente' :
                   level === 'good' ? '👍 Bueno' :
                   level === 'fair' ? '⚠️ Regular' : '📚 Mejorable'}
                </span>
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-bold">{count}</div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        level === 'excellent' ? 'bg-green-500' :
                        level === 'good' ? 'bg-blue-500' :
                        level === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{
                        width: `${(count / Math.max(1, ...Object.values(distribution))) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Tendencia */}
      <div className="mt-6 text-center">
        <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
          knowledgeRetention.trend === 'improving' ? 'bg-green-100 text-green-700' :
          knowledgeRetention.trend === 'declining' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {knowledgeRetention.trend === 'improving' ? '📈 Mejorando' :
           knowledgeRetention.trend === 'declining' ? '📉 Declinando' :
           '➡️ Estable'}
        </div>
      </div>
    </div>
  )
}
