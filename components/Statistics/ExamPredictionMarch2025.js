// components/Statistics/ExamPredictionMarch2025.js
'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ExamPredictionMarch2025({ examPrediction }) {
  const [showProgressInfo, setShowProgressInfo] = useState(false)
  const [showMetricInfo, setShowMetricInfo] = useState(null)

  if (!examPrediction) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">🔮</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">Predicción no disponible</h3>
        <p className="text-gray-600 mb-4">Necesitas más datos para generar una predicción precisa</p>
        <Link 
          href="/auxiliar-administrativo-estado/test"
          className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          🚀 Hacer Más Tests
        </Link>
      </div>
    )
  }

  const getReadinessColor = (score) => {
    if (score >= 85) return 'text-green-600'
    if (score >= 70) return 'text-blue-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getReadinessBg = (score) => {
    if (score >= 85) return 'from-green-50 to-emerald-50 border-green-200'
    if (score >= 70) return 'from-blue-50 to-cyan-50 border-blue-200'
    if (score >= 50) return 'from-yellow-50 to-orange-50 border-yellow-200'
    return 'from-red-50 to-pink-50 border-red-200'
  }

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-blue-500'
    if (percentage >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Convertir días en formato "X meses y Y días"
  const formatDaysRemaining = (days) => {
    if (days <= 0) return '0 días'
    const months = Math.floor(days / 30)
    const remainingDays = days % 30

    if (months === 0) return `${days} días`
    if (remainingDays === 0) return months === 1 ? '1 mes' : `${months} meses`

    const monthsText = months === 1 ? '1 mes' : `${months} meses`
    const daysText = remainingDays === 1 ? '1 día' : `${remainingDays} días`
    return `${monthsText} y ${daysText}`
  }

  // Datos de la oposición (si están disponibles)
  const oposicionInfo = examPrediction.oposicionInfo || {}
  const hasOposicionData = oposicionInfo.nombre && oposicionInfo.nombre !== 'tu oposición'
  const examDateLabel = oposicionInfo.hasRealExamDate
    ? oposicionInfo.examDateFormatted
    : 'Fecha por confirmar'

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 flex items-center">
            🎯 {oposicionInfo.userName ? `${oposicionInfo.userName}, tu ` : ''}Predicción de Examen
          </h3>
          <p className="text-gray-600">
            {hasOposicionData ? oposicionInfo.nombre : 'Análisis predictivo basado en tu progreso actual'}
          </p>
        </div>
        <div className="text-right">
          {oposicionInfo.hasRealExamDate ? (
            <>
              <div className="text-sm text-gray-500">📅 Fecha examen</div>
              <div className="text-lg font-bold text-purple-600">{oposicionInfo.examDateFormatted}</div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-500">Días restantes</div>
              <div className="text-2xl font-bold text-purple-600">{examPrediction.daysRemaining}</div>
            </>
          )}
          {oposicionInfo.boeReference && (
            <a
              href={`https://www.boe.es/diario_boe/txt.php?id=${oposicionInfo.boeReference}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline mt-1"
            >
              📰 {oposicionInfo.boeReference}
              <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Cuenta Regresiva del Examen - PROMINENTE con animación */}
      {oposicionInfo.hasRealExamDate && (
        <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-4 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-4xl animate-pulse">🎯</div>
              <div>
                <div className="text-sm opacity-90">Examen oficial</div>
                <div className="text-xl font-bold">{oposicionInfo.examDateFormatted}</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-black ${examPrediction.daysRemaining < 90 ? 'animate-pulse' : ''}`}>
                {formatDaysRemaining(examPrediction.daysRemaining)}
              </div>
              <div className="text-sm opacity-90">restantes</div>
            </div>
          </div>
          {examPrediction.daysRemaining < 90 && (
            <div className="mt-3 bg-white bg-opacity-20 rounded-lg p-2 text-center text-sm animate-pulse">
              ⚡ ¡Menos de 3 meses! Intensifica tu preparación
            </div>
          )}
        </div>
      )}

      {/* Info de la Oposición */}
      {hasOposicionData && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
          {/* Nombre de la oposición */}
          <div className="text-center mb-3 pb-2 border-b border-indigo-200">
            <div className="font-bold text-indigo-800">{oposicionInfo.nombre}</div>
            {oposicionInfo.tipoAcceso && (
              <div className="text-xs text-indigo-600 capitalize">{oposicionInfo.tipoAcceso === 'libre' ? 'Acceso libre' : oposicionInfo.tipoAcceso}</div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {!oposicionInfo.hasRealExamDate && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">📅 Examen</div>
                <div className="font-bold text-indigo-800">{examDateLabel}</div>
                <div className="text-xs text-indigo-500">(estimación)</div>
              </div>
            )}
            {(oposicionInfo.plazasLibres || oposicionInfo.plazas) && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">🎫 Plazas (acceso libre)</div>
                <div className="font-bold text-indigo-800">
                  {(oposicionInfo.plazasLibres || oposicionInfo.plazas).toLocaleString()}
                </div>
              </div>
            )}
            {oposicionInfo.inscriptionDeadline && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">📝 Inscripción hasta</div>
                <div className="font-bold text-indigo-800">{oposicionInfo.inscriptionDeadline}</div>
              </div>
            )}
            {oposicionInfo.boeReference && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">📰 BOE</div>
                <div className="font-bold text-indigo-800 text-xs">{oposicionInfo.boeReference}</div>
                {oposicionInfo.boePublicationDate && (
                  <div className="text-xs text-indigo-500">{oposicionInfo.boePublicationDate}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Predicción Principal - COMPACTA */}
      <div className={`bg-gradient-to-r ${getReadinessBg(examPrediction.readinessScore)} border rounded-xl p-4 mb-4 relative`}>
        <button
          onClick={() => setShowProgressInfo(true)}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
          title="¿Cómo se calcula?"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`text-4xl font-bold ${getReadinessColor(examPrediction.readinessScore)}`}>
              {examPrediction.readinessScore}%
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700">Preparación estimada</div>
              <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                examPrediction.readinessLevel === 'excellent' ? 'bg-green-100 text-green-700' :
                examPrediction.readinessLevel === 'good' ? 'bg-blue-100 text-blue-700' :
                examPrediction.readinessLevel === 'developing' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {examPrediction.readinessLevel === 'excellent' ? '🏆 Excelente' :
                 examPrediction.readinessLevel === 'good' ? '👍 Buena' :
                 examPrediction.readinessLevel === 'developing' ? '📈 En desarrollo' :
                 '⚠️ Mejora necesaria'}
              </div>
            </div>
          </div>

          {/* Temas dominados integrado */}
          {examPrediction.mastery && (
            <div className="text-right">
              <button
                onClick={() => setShowMetricInfo('mastery')}
                className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer flex items-center justify-end gap-1"
              >
                🎓 Temas dominados
                <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
              <div className="text-lg font-bold text-purple-700">
                {examPrediction.mastery.masteredThemes}/{examPrediction.mastery.totalThemes}
              </div>
            </div>
          )}
        </div>

        {/* Barra de progreso compacta */}
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${getProgressColor(examPrediction.readinessScore)}`}
              style={{ width: `${examPrediction.readinessScore}%` }}
            ></div>
          </div>
        </div>

        {examPrediction.mainMessage && (
          <div className="mt-2 text-xs text-gray-600 text-center">
            {examPrediction.mainMessage}
          </div>
        )}
      </div>

      {/* Proyección de preparación - SIEMPRE visible */}
      {examPrediction.mastery?.projectedMasteryDate === 'completado' ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-green-700 font-bold">✅ ¡Felicidades! Has dominado todo el temario</p>
        </div>
      ) : examPrediction.mastery?.projectedMasteryDate ? (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-purple-700">
            📅 A este ritmo, dominarás todo el temario para el{' '}
            <span className="font-bold">{examPrediction.mastery.projectedMasteryDate}</span>
          </p>
        </div>
      ) : examPrediction.projection?.estimatedStudyCompletion ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-blue-700">
            📚 A tu ritmo actual, dominarás todo el temario para el{' '}
            <span className="font-bold">{examPrediction.projection.estimatedStudyCompletion}</span>
          </p>
          <p className="text-xs text-blue-500 mt-1">
            Basado en {examPrediction.calculations?.temasPoSemana || examPrediction.projection?.temasPoSemana || 0} temas/semana
          </p>
        </div>
      ) : examPrediction.projection?.noMasteredYet ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-amber-700">
            💡 Domina tu primer tema (≥80% precisión) para ver tu proyección
          </p>
        </div>
      ) : examPrediction.projection?.allMastered ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-green-700">
            ✅ ¡Felicidades! Has dominado todo el temario
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-center">
          <p className="text-sm text-gray-600">
            📊 Empieza a estudiar para ver tu proyección de preparación
          </p>
        </div>
      )}

      {/* Info sobre temas estudiados vs dominados */}
      {examPrediction.mastery && examPrediction.mastery.masteredThemes < examPrediction.coverage?.studiedThemes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">
          <div className="text-xs text-center space-y-1">
            <span className="text-amber-700">
              Tienes <strong>{examPrediction.coverage.studiedThemes}</strong> temas estudiados pero solo <strong>{examPrediction.mastery.masteredThemes}</strong> dominados
            </span>
            <div className="flex justify-center gap-4 mt-1">
              <span className="text-blue-600">📚 Estudiado: ≥50% precisión</span>
              <span className="text-purple-600">🎓 Dominado: ≥80% precisión</span>
            </div>
          </div>
        </div>
      )}

      {/* Métricas Clave - COMPACTAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        
        {/* Cobertura Temario */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center relative">
          <button
            onClick={() => setShowMetricInfo('coverage')}
            className="absolute top-2 right-2 p-1 text-blue-400 hover:text-blue-600 transition-colors"
            title="¿Qué significa?"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="text-lg mb-1">📚</div>
          <div className="text-lg font-bold text-blue-700">
            {examPrediction.coverage.studiedThemes} de {examPrediction.coverage.totalThemes}
          </div>
          <div className="text-xs text-blue-600 mb-1">temas estudiados</div>
          <div className="text-xs text-blue-500">
            {examPrediction.coverage.percentage}% completado
          </div>
        </div>

        {/* Precisión Global */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center relative">
          <button
            onClick={() => setShowMetricInfo('accuracy')}
            className="absolute top-2 right-2 p-1 text-green-400 hover:text-green-600 transition-colors"
            title="¿Qué significa?"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="text-lg mb-1">🎯</div>
          <div className="text-lg font-bold text-green-700">
            {examPrediction.accuracy.current}%
          </div>
          <div className="text-xs text-green-600 mb-1">Aciertos</div>
          <div className="text-xs text-green-500">
            Objetivo: {examPrediction.accuracy.target}%
          </div>
        </div>

        {/* Progreso Diario */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center relative">
          <button
            onClick={() => setShowMetricInfo('improvement')}
            className="absolute top-2 right-2 p-1 text-purple-400 hover:text-purple-600 transition-colors"
            title="¿Qué significa?"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="text-lg mb-1">📈</div>
          <div className="text-lg font-bold text-purple-700">
            +{parseFloat(examPrediction.dailyProgress.averageImprovement).toFixed(1)}%
          </div>
          <div className="text-xs text-purple-600 mb-1">Mejora Diaria</div>
          <div className="text-xs text-purple-500">
            Últimos {examPrediction.dailyProgress.daysAnalyzed} días
          </div>
        </div>

        {/* Tiempo Estimado */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center relative">
          <button
            onClick={() => setShowMetricInfo('time')}
            className="absolute top-2 right-2 p-1 text-orange-400 hover:text-orange-600 transition-colors"
            title="¿Qué significa?"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="text-lg mb-1">⏰</div>
          <div className="text-lg font-bold text-orange-700">
            {examPrediction.timeEstimate.dailyHours}h
          </div>
          <div className="text-xs text-orange-600 mb-1">Horas/día recomendadas</div>
          <div className="text-xs text-orange-500">
            Para estar listo
          </div>
        </div>
      </div>

      {/* Modal de información del progreso */}
      {showProgressInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowProgressInfo(false)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">📊 ¿Cómo se calcula el progreso?</h3>
                <button
                  onClick={() => setShowProgressInfo(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">🎯 ¿Qué significa 100% preparado?</h4>
                    <p className="text-gray-600 text-sm mb-3">
                      La preparación completa significa que has alcanzado el máximo nivel en todos los aspectos clave:
                    </p>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Cobertura completa:</strong> Estudiado todos los temas del temario</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Alta precisión:</strong> Más del 85% de aciertos consistentes</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Rendimiento estable:</strong> Resultados consistentes en el tiempo</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Dominio completo:</strong> Conceptos básicos y avanzados</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-800 text-sm">
                      <strong>💡 Consejo:</strong> Con un 85% de preparación generalmente ya estás listo para aprobar el examen. El 100% representa preparación óptima.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowProgressInfo(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de información de métricas */}
      {showMetricInfo && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowMetricInfo(null)}
            ></div>

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {showMetricInfo === 'coverage' && '📚 Cobertura del Temario'}
                  {showMetricInfo === 'accuracy' && '🎯 Precisión de Aciertos'}
                  {showMetricInfo === 'improvement' && '📈 Mejora Diaria'}
                  {showMetricInfo === 'time' && '⏰ Tiempo Recomendado'}
                  {showMetricInfo === 'mastery' && '🎓 Temas Dominados'}
                </h3>
                <button
                  onClick={() => setShowMetricInfo(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {showMetricInfo === 'coverage' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Indica cuántos temas del temario has trabajado con un mínimo de dedicación y acierto.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <h4 className="font-semibold text-gray-900 mb-2">📚 Tema ESTUDIADO vs 🎓 Tema DOMINADO</h4>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-start space-x-2">
                            <span className="text-blue-600 font-bold">📚 Estudiado:</span>
                            <span className="text-gray-600">≥10 preguntas respondidas Y ≥50% de precisión</span>
                          </div>
                          <div className="flex items-start space-x-2">
                            <span className="text-purple-600 font-bold">🎓 Dominado:</span>
                            <span className="text-gray-600">≥10 preguntas respondidas Y ≥80% de precisión</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula el porcentaje?</h4>
                        <p className="text-gray-500 text-xs">
                          (Temas estudiados / Total de temas de tu oposición) × 100
                        </p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-amber-800 text-sm">
                          <strong>💡 Objetivo:</strong> Primero estudia todos los temas (cobertura), luego domínalos (≥80% precisión en cada uno).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showMetricInfo === 'accuracy' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Tu porcentaje actual de respuestas correctas en todos los tests realizados.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Respuestas correctas / Total de respuestas) × 100
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Se considera tu historial completo de respuestas, dando más peso a las respuestas recientes.
                        </p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-green-800 text-sm">
                          <strong>💡 Consejo:</strong> Para aprobar necesitas generalmente &gt;70% de aciertos. El objetivo de 85% te da un margen de seguridad.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showMetricInfo === 'improvement' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Muestra cuánto has mejorado tu precisión promedio comparando tus tests recientes con los más antiguos.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Precisión tests recientes - Precisión tests antiguos) / Días transcurridos
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Compara tus primeros tests con los más recientes para medir tu progreso real.
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          <strong>Positivo:</strong> mejorando • <strong>Negativo:</strong> empeorando • <strong>0:</strong> estable
                        </p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-purple-800 text-sm">
                          <strong>💡 Consejo:</strong> Una mejora constante, aunque pequeña (+0.1% diario), es mejor que grandes subidas y bajadas irregulares.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showMetricInfo === 'time' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Tiempo diario recomendado de estudio para alcanzar tu objetivo según tu ritmo actual.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          Se basa en tu velocidad de mejora actual, temas pendientes, y días restantes hasta el examen.
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Incluye tiempo para tests, repaso, y estudio de teoría nueva.
                        </p>
                      </div>
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-orange-800 text-sm">
                          <strong>💡 Consejo:</strong> Es mejor estudiar consistentemente cada día que hacer sesiones muy largas esporádicas. 1-2 horas diarias son ideales.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {showMetricInfo === 'mastery' && (
                  <div>
                    <p className="text-gray-600 text-sm mb-4">
                      Indica cuántos temas has dominado completamente del total de tu oposición.
                    </p>
                    <div className="space-y-3">
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <h4 className="font-semibold text-purple-900 mb-2">🎓 ¿Cuándo se considera un tema DOMINADO?</h4>
                        <ul className="text-purple-700 text-sm space-y-1">
                          <li>• Has respondido <strong>≥10 preguntas</strong> de ese tema</li>
                          <li>• Tienes <strong>≥80% de precisión</strong> en esas preguntas</li>
                        </ul>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="font-semibold text-blue-900 mb-2">📚 ¿Y un tema ESTUDIADO?</h4>
                        <ul className="text-blue-700 text-sm space-y-1">
                          <li>• Has respondido <strong>≥10 preguntas</strong> de ese tema</li>
                          <li>• Tienes <strong>≥50% de precisión</strong> en esas preguntas</li>
                        </ul>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-green-800 text-sm">
                          <strong>💡 Objetivo:</strong> Primero estudia todos los temas (cobertura 100%), luego trabaja para dominarlos uno a uno (≥80% precisión en cada uno).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowMetricInfo(null)}
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