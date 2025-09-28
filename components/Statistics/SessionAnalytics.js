// components/Statistics/SessionAnalytics.js - MEJORADO SIN DETALLES TÉCNICOS
'use client'
import { useState } from 'react'

export default function SessionAnalytics({ sessionAnalytics }) {
  const [showInfoModal, setShowInfoModal] = useState(null)
  if (!sessionAnalytics) {
    return (
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Análisis de Sesiones</h3>
              <p className="text-gray-600 text-sm">Cómo estudias y tu constancia</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <div className="text-4xl mb-4">📈</div>
            <h4 className="text-lg font-semibold text-gray-700 mb-2">
              Análisis en Desarrollo
            </h4>
            <p className="text-gray-500">
              Completa más sesiones de estudio para ver análisis detallados de tu constancia y patrones de estudio.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { 
    totalSessions, 
    avgSessionDuration, 
    avgEngagement, 
    recentSessions, 
    consistency 
  } = sessionAnalytics

  // Función para interpretar engagement
  const getEngagementLevel = (score) => {
    if (score >= 80) return { level: 'Excelente', color: 'green', icon: '🔥' }
    if (score >= 60) return { level: 'Bueno', color: 'blue', icon: '✅' }
    if (score >= 40) return { level: 'Regular', color: 'yellow', icon: '⚠️' }
    return { level: 'Bajo', color: 'red', icon: '📉' }
  }

  // Función para interpretar consistencia
  const getConsistencyLevel = (score) => {
    if (score >= 80) return { level: 'Muy constante', color: 'green', icon: '🎯' }
    if (score >= 60) return { level: 'Constante', color: 'blue', icon: '📈' }
    if (score >= 40) return { level: 'Irregular', color: 'yellow', icon: '📊' }
    return { level: 'Muy irregular', color: 'red', icon: '📉' }
  }

  const engagementInfo = getEngagementLevel(avgEngagement)
  const consistencyInfo = getConsistencyLevel(consistency)

  return (
    <div className="bg-white rounded-xl shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📊</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Análisis de Sesiones</h3>
              <p className="text-gray-600 text-sm">Tu constancia y calidad de estudio</p>
            </div>
          </div>
          <button
            onClick={() => setShowInfoModal({ type: 'general' })}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="¿Qué significan estas métricas?"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Métricas principales - MÁS COMPACTAS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {/* Total de sesiones - COMPACTO */}
          <div className="bg-purple-50 p-3 rounded-lg text-center">
            <div className="text-purple-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
              📚 Sesiones
              <button
                onClick={() => setShowInfoModal({ type: 'sesiones' })}
                className="text-purple-400 hover:text-purple-600 transition-colors"
                title="¿Qué son las sesiones?"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="text-xl font-bold text-purple-700">{totalSessions}</div>
          </div>

          {/* Duración promedio - COMPACTO */}
          <div className="bg-blue-50 p-3 rounded-lg text-center">
            <div className="text-blue-600 text-xs font-medium mb-1 flex items-center justify-center gap-1">
              ⏱️ Duración
              <button
                onClick={() => setShowInfoModal({ type: 'duracion' })}
                className="text-blue-400 hover:text-blue-600 transition-colors"
                title="¿Qué es la duración promedio?"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="text-xl font-bold text-blue-700">{avgSessionDuration}m</div>
          </div>

          {/* Engagement - COMPACTO */}
          <div className={`bg-${engagementInfo.color}-50 p-3 rounded-lg text-center`}>
            <div className={`text-${engagementInfo.color}-600 text-xs font-medium mb-1 flex items-center justify-center gap-1`}>
              {engagementInfo.icon} Engagement
              <button
                onClick={() => setShowInfoModal({ type: 'engagement' })}
                className={`text-${engagementInfo.color}-400 hover:text-${engagementInfo.color}-600 transition-colors`}
                title="¿Qué es el engagement?"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className={`text-xl font-bold text-${engagementInfo.color}-700`}>{avgEngagement}%</div>
          </div>

          {/* Consistencia - COMPACTO */}
          <div className={`bg-${consistencyInfo.color}-50 p-3 rounded-lg text-center`}>
            <div className={`text-${consistencyInfo.color}-600 text-xs font-medium mb-1 flex items-center justify-center gap-1`}>
              {consistencyInfo.icon} Consistencia
              <button
                onClick={() => setShowInfoModal({ type: 'consistencia' })}
                className={`text-${consistencyInfo.color}-400 hover:text-${consistencyInfo.color}-600 transition-colors`}
                title="¿Qué es la consistencia?"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className={`text-xl font-bold text-${consistencyInfo.color}-700`}>{consistency}%</div>
          </div>
        </div>

      </div>
      
      {/* Modal de información */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowInfoModal(null)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {showInfoModal.type === 'sesiones' && '📚 Sesiones de Estudio'}
                  {showInfoModal.type === 'duracion' && '⏱️ Duración Promedio'}
                  {showInfoModal.type === 'engagement' && '🔥 Engagement'}
                  {showInfoModal.type === 'consistencia' && '🎯 Consistencia'}
                  {showInfoModal.type === 'general' && '📊 ¿Qué significan estas métricas?'}
                </h3>
                <button
                  onClick={() => setShowInfoModal(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {showInfoModal.type === 'sesiones' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Cada sesión de estudio representa una vez que abres la app para estudiar y realizas actividad educativa.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          Se cuenta una nueva sesión cada vez que entras a la app después de más de 30 minutos de inactividad.
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-800 text-sm">
                          <strong>💡 Consejo:</strong> Más sesiones cortas y frecuentes son mejores que pocas sesiones muy largas. El cerebro aprende mejor con repetición espaciada.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showInfoModal.type === 'duracion' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      El tiempo promedio que dedicas a cada sesión de estudio activo.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Tiempo total de todas las sesiones / Número total de sesiones)
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Solo cuenta el tiempo activo estudiando, no los descansos o tiempo inactivo.
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 text-sm">
                          <strong>💡 Consejo:</strong> Sesiones de 25-45 minutos son ideales. Muy cortas no permiten concentración profunda, muy largas causan fatiga mental.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showInfoModal.type === 'engagement' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Mide qué tan activo y concentrado estás durante tus sesiones de estudio.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Tiempo de actividad real / Tiempo total en la app) × 100
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Incluye tiempo leyendo teoría, respondiendo preguntas, y navegando con propósito educativo.
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-green-800 text-sm">
                          <strong>💡 Consejo:</strong> Un engagement alto (&gt;70%) indica estudio efectivo. Si es bajo, elimina distracciones y enfócate en una tarea a la vez.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showInfoModal.type === 'consistencia' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Mide qué tan regular eres estudiando a lo largo del tiempo.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Días con actividad / Días totales desde registro) × 100
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Por ejemplo: Si llevas 10 días registrado y has estudiado 7 días, tu consistencia es 70%.
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 text-sm">
                          <strong>💡 Consejo:</strong> La consistencia es clave para retener información. Mejor 20 minutos diarios que 3 horas una vez por semana.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showInfoModal.type === 'general' && (
                  <div className="space-y-4">
                    {/* Sesiones */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-purple-600 text-sm">📚</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Sesiones de Estudio</h4>
                        <p className="text-gray-600 text-sm mb-2">
                          Cada sesión representa una vez que abres la app para estudiar y realizas actividad educativa.
                        </p>
                        <p className="text-gray-500 text-xs">
                          <strong>Cálculo:</strong> Nueva sesión después de 30+ minutos de inactividad.
                        </p>
                      </div>
                    </div>

                    {/* Duración */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 text-sm">⏱️</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Duración Promedio</h4>
                        <p className="text-gray-600 text-sm mb-2">
                          Tiempo promedio que dedicas a cada sesión de estudio activo.
                        </p>
                        <p className="text-gray-500 text-xs">
                          <strong>Cálculo:</strong> (Tiempo total de sesiones / Número de sesiones)
                        </p>
                      </div>
                    </div>

                    {/* Engagement */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 text-sm">🔥</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Engagement</h4>
                        <p className="text-gray-600 text-sm mb-2">
                          Mide qué tan activo y concentrado estás durante tus sesiones de estudio.
                        </p>
                        <p className="text-gray-500 text-xs">
                          <strong>Cálculo:</strong> (Tiempo de actividad real / Tiempo total en la app) × 100
                        </p>
                      </div>
                    </div>

                    {/* Consistencia */}
                    <div className="flex items-start space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 text-sm">🎯</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Consistencia</h4>
                        <p className="text-gray-600 text-sm mb-2">
                          Mide qué tan regular eres estudiando a lo largo del tiempo.
                        </p>
                        <p className="text-gray-500 text-xs">
                          <strong>Cálculo:</strong> (Días con actividad / Días totales desde registro) × 100
                        </p>
                      </div>
                    </div>

                    {/* Consejos generales */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-2">💡 Consejos para mejorar:</h4>
                      <ul className="text-blue-800 text-sm space-y-1">
                        <li>• <strong>Sesiones:</strong> Mejor sesiones cortas y frecuentes que pocas muy largas</li>
                        <li>• <strong>Duración:</strong> 25-45 minutos son ideales para concentración</li>
                        <li>• <strong>Engagement:</strong> Elimina distracciones, enfócate en una tarea</li>
                        <li>• <strong>Consistencia:</strong> 20 minutos diarios &gt; 3 horas semanales</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowInfoModal(null)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}