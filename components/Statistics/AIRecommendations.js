// components/Statistics/AIRecommendations.js
'use client'
import Link from 'next/link'

export default function AIRecommendations({ recommendations }) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-8 text-center">
        <div className="text-6xl mb-4">🧠</div>
        <h3 className="text-2xl font-bold text-purple-800 mb-4">
          ¡Desbloquea el Poder Completo de la IA!
        </h3>
        <p className="text-purple-700 mb-6 max-w-2xl mx-auto">
          Nuestro sistema con IA necesita más datos para generar predicciones precisas y 
          recomendaciones personalizadas. Completa más tests para acceder a:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <div className="text-2xl mb-2">🎯</div>
            <div className="font-bold text-purple-800">Predicciones Precisas</div>
            <div className="text-sm text-purple-600">De preparación para examen</div>
          </div>
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-bold text-purple-800">Recomendaciones IA</div>
            <div className="text-sm text-purple-600">Personalizadas y específicas</div>
          </div>
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-bold text-purple-800">Análisis Profundo</div>
            <div className="text-sm text-purple-600">Patrones de comportamiento</div>
          </div>
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <div className="text-2xl mb-2">🔮</div>
            <div className="font-bold text-purple-800">Predicciones Futuras</div>
            <div className="text-sm text-purple-600">Cuándo estarás listo</div>
          </div>
        </div>
        <Link 
          href="/es/auxiliar-administrativo-estado/test"
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:opacity-90 transition-opacity inline-block"
        >
          🚀 Alimentar la IA con Más Datos
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🤖 Recomendaciones Personalizadas de IA</h3>
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className={`p-4 rounded-lg border ${
            rec.priority === 'high' ? 'bg-red-50 border-red-200' :
            rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start space-x-3">
              <div className="text-2xl">{rec.icon}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`font-bold ${
                    rec.priority === 'high' ? 'text-red-800' :
                    rec.priority === 'medium' ? 'text-yellow-800' :
                    'text-blue-800'
                  }`}>
                    {rec.title}
                  </h4>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {rec.priority === 'high' ? 'URGENTE' :
                     rec.priority === 'medium' ? 'IMPORTANTE' :
                     'SUGERENCIA'}
                  </span>
                </div>
                <p className={`text-sm mb-2 ${
                  rec.priority === 'high' ? 'text-red-700' :
                  rec.priority === 'medium' ? 'text-yellow-700' :
                  'text-blue-700'
                }`}>
                  {rec.description}
                </p>
                <div className={`text-sm font-medium ${
                  rec.priority === 'high' ? 'text-red-800' :
                  rec.priority === 'medium' ? 'text-yellow-800' :
                  'text-blue-800'
                }`}>
                  👉 {rec.action}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Tipo: {rec.type} • Generado por IA
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
