// components/Statistics/AIImpactAnalysis.js
'use client'
import { useState, useEffect } from 'react'

export default function AIImpactAnalysis({ aiImpactData, motivationalNotifications }) {
  const [activeMetric, setActiveMetric] = useState('overview')

  // Si no hay datos de impacto IA, mostrar estado inicial
  if (!aiImpactData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Impacto de tu Asistente Personal IA ✨</h3>
            <p className="text-gray-600">El sistema está recopilando datos para generar insights personalizados</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-6">
          <div className="text-center">
            <div className="text-4xl mb-3">🌱</div>
            <h4 className="font-bold text-purple-800 mb-2">Tu IA Personal ✨ está Aprendiendo</h4>
            <p className="text-purple-600 mb-4">
              A medida que estudies más, el sistema de inteligencia artificial comenzará a:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <span className="text-2xl">🎯</span>
                <div className="font-medium text-purple-800">Detectar Problemas</div>
                <div className="text-sm text-purple-600">Identificar artículos y temas que necesitan refuerzo</div>
              </div>
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <span className="text-2xl">📈</span>
                <div className="font-medium text-purple-800">Reconocer Mejoras</div>
                <div className="text-sm text-purple-600">Celebrar tu progreso con datos concretos</div>
              </div>
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <span className="text-2xl">⚡</span>
                <div className="font-medium text-purple-800">Optimizar Estudio</div>
                <div className="text-sm text-purple-600">Encontrar tu horario y ritmo óptimo</div>
              </div>
              <div className="bg-white bg-opacity-50 rounded-lg p-4">
                <span className="text-2xl">🏆</span>
                <div className="font-medium text-purple-800">Motivar Progreso</div>
                <div className="text-sm text-purple-600">Insights motivacionales cuando más los necesites</div>
              </div>
            </div>
            <div className="mt-4 text-sm text-purple-500">
              💡 Completa más tests para activar el análisis completo de IA
            </div>
          </div>
        </div>
      </div>
    )
  }

  const {
    totalInsights = 0,
    problemsDetected = 0,
    improvementsRecognized = 0,
    timeOptimized = 0,
    articlesImproved = 0,
    motivationalReceived = 0,
    optimalTimeDetected = null,
    accuracyImprovement = 0,
    speedImprovement = 0,
    studyStreakHelped = 0
  } = aiImpactData

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Impacto de tu Asistente Personal IA ✨</h3>
            <p className="text-gray-600">Métricas de cómo la inteligencia artificial mejora tu aprendizaje</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-lg text-center">
          <div className="font-bold text-2xl">{totalInsights}</div>
          <div className="text-xs opacity-90">Insights Total</div>
        </div>
      </div>

      {/* Métricas Principales - Compactas y Lineales */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center min-w-[120px]">
          <div className="text-lg mb-1">🚨</div>
          <div className="font-bold text-lg text-red-600">{problemsDetected}</div>
          <div className="text-xs text-red-600 font-medium">Problemas</div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-center min-w-[120px]">
          <div className="text-lg mb-1">📈</div>
          <div className="font-bold text-lg text-green-600">{improvementsRecognized}</div>
          <div className="text-xs text-green-600 font-medium">Mejoras</div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center min-w-[120px]">
          <div className="text-lg mb-1">⚡</div>
          <div className="font-bold text-lg text-blue-600">{articlesImproved}</div>
          <div className="text-xs text-blue-600 font-medium">Artículos</div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-center min-w-[120px]">
          <div className="text-lg mb-1">💡</div>
          <div className="font-bold text-lg text-purple-600">{motivationalReceived}</div>
          <div className="text-xs text-purple-600 font-medium">Motivación</div>
        </div>
      </div>

      {/* Navegación de métricas detalladas - STICKY */}
      <div className="sticky top-20 md:top-24 z-40 bg-white border-b border-gray-200 shadow-sm mb-4 pb-3 pt-2">
        <div className="flex justify-center">
          <div className="flex flex-wrap gap-2 max-w-lg">
            {[
              { id: 'overview', name: 'Resumen', icon: '📊' },
              { id: 'detection', name: 'Detección', icon: '🎯' },
              { id: 'optimization', name: 'Optimización', icon: '⚡' },
              { id: 'motivation', name: 'Motivación', icon: '🚀' }
            ].map((metric) => (
              <button
                key={metric.id}
                onClick={() => setActiveMetric(metric.id)}
                className={`px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-all ${
                  activeMetric === metric.id
                    ? 'bg-purple-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {metric.icon} {metric.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido según métrica activa */}
      <div className="bg-gray-50 rounded-lg p-4">
        {activeMetric === 'overview' && (
          <div>
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Resumen del Impacto IA
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">🎯 Detección Automática</h5>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span>Problemas identificados:</span>
                    <span className="font-bold text-red-600">{problemsDetected}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Tiempo ahorrado:</span>
                    <span className="font-bold text-blue-600">{timeOptimized}h</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Artículos mejorados:</span>
                    <span className="font-bold text-green-600">{articlesImproved}</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">📈 Mejoras Conseguidas</h5>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between">
                    <span>Mejora en accuracy:</span>
                    <span className="font-bold text-green-600">+{accuracyImprovement}%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Mejora en velocidad:</span>
                    <span className="font-bold text-blue-600">-{speedImprovement}s</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Rachas mantenidas:</span>
                    <span className="font-bold text-orange-600">{studyStreakHelped}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeMetric === 'detection' && (
          <div>
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Capacidades de Detección IA
            </h4>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border-l-4 border-red-400">
                <h5 className="font-bold text-red-700 mb-2">🚨 Alertas Críticas</h5>
                <p className="text-sm text-gray-700 mb-2">
                  El sistema detecta automáticamente regresiones en tu rendimiento y artículos problemáticos.
                </p>
                <div className="bg-red-50 rounded p-3">
                  <div className="text-sm">
                    <strong>Ejemplo:</strong> "Tu rendimiento en Art. 103 bajó 15% → Test de Refuerzo (5 min)"
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-yellow-400">
                <h5 className="font-bold text-yellow-700 mb-2">⚠️ Detección Temprana</h5>
                <p className="text-sm text-gray-700 mb-2">
                  Identifica patrones antes de que se conviertan en problemas serios.
                </p>
                <div className="bg-yellow-50 rounded p-3">
                  <div className="text-sm">
                    <strong>Ejemplo:</strong> "LPAC Arts. 1,2,3 con &lt;70% accuracy → Test Intensivo"
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMetric === 'optimization' && (
          <div>
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Optimización Personalizada IA
            </h4>
            <div className="space-y-4">
              {optimalTimeDetected && (
                <div className="bg-white rounded-lg p-4 border-l-4 border-blue-400">
                  <h5 className="font-bold text-blue-700 mb-2">🕐 Horario Óptimo Detectado</h5>
                  <p className="text-sm text-gray-700 mb-2">
                    La IA analizó tus patrones y encontró tu mejor momento de estudio:
                  </p>
                  <div className="bg-blue-50 rounded p-3">
                    <div className="text-lg font-bold text-blue-700">{optimalTimeDetected}</div>
                    <div className="text-sm text-blue-600">Mejor rendimiento detectado en este horario</div>
                  </div>
                </div>
              )}
              <div className="bg-white rounded-lg p-4 border-l-4 border-green-400">
                <h5 className="font-bold text-green-700 mb-2">📈 Mejoras de Rendimiento</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">+{accuracyImprovement}%</div>
                    <div className="text-sm text-green-600">Mejora en Precisión</div>
                  </div>
                  <div className="bg-green-50 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">-{speedImprovement}s</div>
                    <div className="text-sm text-green-600">Mejora en Velocidad</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeMetric === 'motivation' && (
          <div>
            <h4 className="font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">✨</span>
              Sistema de Motivación Adaptativa IA
            </h4>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border-l-4 border-purple-400">
                <h5 className="font-bold text-purple-700 mb-2">💡 Insights Motivacionales</h5>
                <p className="text-sm text-gray-700 mb-3">
                  La IA solo envía motivación cuando realmente aporta valor (no spam):
                </p>
                <div className="space-y-2">
                  <div className="bg-purple-50 rounded p-3">
                    <div className="text-sm">
                      <strong>Progreso Real:</strong> "Llevas 4 días seguidos estudiando (2h 30m total)"
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded p-3">
                    <div className="text-sm">
                      <strong>Mejoras Detectadas:</strong> "Tu precisión en Tema 5 mejoró del 65% al 82%"
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded p-3">
                    <div className="text-sm">
                      <strong>Maestría Alcanzada:</strong> "Has dominado 2 artículos nuevos: CE Art. 104 (89%), LPAC Art. 15 (92%)"
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">📊 Estadísticas de Motivación</h5>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{motivationalReceived}</div>
                    <div className="text-xs text-gray-600">Insights Recibidos</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{studyStreakHelped}</div>
                    <div className="text-xs text-gray-600">Rachas Ayudadas</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{timeOptimized}h</div>
                    <div className="text-xs text-gray-600">Tiempo Optimizado</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer con CTA */}
      <div className="mt-6 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h5 className="font-bold text-purple-800">✨ Tu IA Personal Sigue Aprendiendo</h5>
            <p className="text-sm text-purple-600">
              Cuanto más estudies, más preciso será el análisis y mejores insights recibirás.
            </p>
          </div>
          <div className="text-purple-500">
            <div className="text-2xl">🔄</div>
          </div>
        </div>
      </div>
    </div>
  )
}