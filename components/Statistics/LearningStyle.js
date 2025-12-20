// components/Statistics/LearningStyle.js
'use client'

export default function LearningStyle({ learningStyle }) {
  if (!learningStyle) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🧠 Tu Estilo de Aprendizaje (IA)</h3>
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-bold text-purple-700 mb-2">
              📊 "{learningStyle.style}"
            </div>
            <div className="text-purple-600 mb-4">
              {learningStyle.source === 'ai_analysis' ? 'Detectado por IA avanzada' : 'Análisis de comportamiento'}
            </div>
          </div>
          <div className={`px-4 py-2 rounded-full text-sm font-bold ${
            learningStyle.confidence === 'high' ? 'bg-green-100 text-green-700' :
            learningStyle.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            Confianza: {learningStyle.confidence === 'high' ? 'Alta' : 
                       learningStyle.confidence === 'medium' ? 'Media' : 'Baja'}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {learningStyle.characteristics.map((char, index) => (
            <div key={index} className="bg-white bg-opacity-70 rounded-lg p-3 text-center">
              <div className="text-sm font-medium text-purple-700">{char}</div>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-purple-700">{learningStyle.metrics.avgTime}s</div>
            <div className="text-purple-600">Tiempo Promedio</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-purple-700">{learningStyle.metrics.avgInteractions}</div>
            <div className="text-purple-600">Interacciones</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-purple-700">{learningStyle.metrics.confidenceAccuracy}%</div>
            <div className="text-purple-600">Calibración</div>
          </div>
        </div>
      </div>
    </div>
  )
}