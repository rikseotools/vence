// components/Statistics/ExamReadiness.js
'use client'
import Link from 'next/link'

export default function ExamReadiness({ examReadiness }) {
  if (!examReadiness) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🎯 Predicción de Preparación para Examen</h3>
      
      {examReadiness.level === 'insufficient_data' ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔍</div>
          <h4 className="text-xl font-bold text-gray-700 mb-2">Datos Insuficientes</h4>
          <p className="text-gray-600 mb-4">{examReadiness.message}</p>
          <Link 
            href="/es/auxiliar-administrativo-estado/test"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            🚀 Hacer Más Tests
          </Link>
        </div>
      ) : (
        <div>
          {/* Puntuación Principal */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-green-700 mb-2">
                {examReadiness.score}%
              </div>
              <div className="text-lg text-green-600 mb-1">Preparación Actual</div>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                examReadiness.level === 'excellent' ? 'bg-green-100 text-green-700' :
                examReadiness.level === 'good' ? 'bg-blue-100 text-blue-700' :
                examReadiness.level === 'developing' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {examReadiness.level === 'excellent' ? '🏆 Excelente' :
                 examReadiness.level === 'good' ? '👍 Bueno' :
                 examReadiness.level === 'developing' ? '📈 En Desarrollo' :
                 '📚 Necesita Mejora'}
              </div>
            </div>

            {/* Barra de Progreso */}
            <div className="w-full bg-green-200 rounded-full h-4 mb-4">
              <div 
                className="bg-green-600 h-4 rounded-full transition-all duration-1000"
                style={{ width: `${examReadiness.score}%` }}
              ></div>
            </div>

            <div className="text-center text-green-700">
              {examReadiness.message}
            </div>
          </div>

          {/* Componentes de la Preparación */}
          {examReadiness.components && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {examReadiness.components.accuracy}%
                </div>
                <div className="text-sm text-blue-600">Precisión</div>
                <div className="text-xs text-blue-500 mt-1">Factor principal</div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {examReadiness.components.consistency}%
                </div>
                <div className="text-sm text-purple-600">Consistencia</div>
                <div className="text-xs text-purple-500 mt-1">Estabilidad</div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-700">
                  {examReadiness.components.coverage}%
                </div>
                <div className="text-sm text-orange-600">Cobertura</div>
                <div className="text-xs text-orange-500 mt-1">Temas estudiados</div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {examReadiness.components.retention}%
                </div>
                <div className="text-sm text-green-600">Retención</div>
                <div className="text-xs text-green-500 mt-1">Conocimiento fijado</div>
              </div>
            </div>
          )}

          {/* Confianza de la IA */}
          {examReadiness.components?.aiConfidence && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800">🧠 Confianza de la Predicción IA</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                  examReadiness.components.aiConfidence === 'high' ? 'bg-green-100 text-green-700' :
                  examReadiness.components.aiConfidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {examReadiness.components.aiConfidence === 'high' ? '🎯 Alta' :
                   examReadiness.components.aiConfidence === 'medium' ? '📊 Media' :
                   '📈 Básica'}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                {examReadiness.components.aiConfidence === 'high' ? 
                  'Predicción basada en algoritmos avanzados de IA con alto nivel de certeza' :
                  examReadiness.components.aiConfidence === 'medium' ?
                  'Predicción basada en análisis de comportamiento con confianza media' :
                  'Predicción básica, necesitas más datos para mayor precisión'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
