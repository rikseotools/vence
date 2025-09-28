// components/Statistics/LearningEfficiency.js
'use client'

export default function LearningEfficiency({ learningEfficiency }) {
  if (!learningEfficiency) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">⚡ Eficiencia de Aprendizaje</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Puntuación Principal */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <h4 className="font-bold text-orange-800 mb-2">🎯 Eficiencia IA</h4>
          <div className="text-3xl font-bold text-orange-700">{learningEfficiency.score}%</div>
          <div className="text-sm text-orange-600">
            Nivel: {learningEfficiency.level === 'excellent' ? 'Excelente' :
                    learningEfficiency.level === 'good' ? 'Bueno' :
                    learningEfficiency.level === 'fair' ? 'Regular' : 'Mejorable'}
          </div>
        </div>

        {/* Métricas de Tiempo */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-bold text-blue-800 mb-3">⏰ Métricas Temporales</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Preguntas/hora:</span>
              <span className="font-bold">{learningEfficiency.questionsPerHour}</span>
            </div>
            <div className="flex justify-between">
              <span>Aciertos/hora:</span>
              <span className="font-bold">{learningEfficiency.accuracyPerHour}</span>
            </div>
            <div className="flex justify-between">
              <span>Horas totales:</span>
              <span className="font-bold">{learningEfficiency.totalStudyHours}h</span>
            </div>
          </div>
        </div>

        {/* Recomendación */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-bold text-purple-800 mb-2">💡 Recomendación IA</h4>
          <div className="text-sm text-purple-700">
            {learningEfficiency.recommendation}
          </div>
        </div>
      </div>
    </div>
  )
}
