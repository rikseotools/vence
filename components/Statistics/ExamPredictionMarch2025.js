// components/Statistics/ExamPredictionMarch2025.js
'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ExamPredictionMarch2025({ examPrediction }) {
  const [showCalculationDetails, setShowCalculationDetails] = useState(false)
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
          <div className="text-sm text-gray-500">Días restantes</div>
          <div className="text-2xl font-bold text-purple-600">{examPrediction.daysRemaining}</div>
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
              <div className={`text-4xl font-black ${examPrediction.daysRemaining < 90 ? 'animate-pulse' : ''}`}>
                {examPrediction.daysRemaining}
              </div>
              <div className="text-sm opacity-90">días restantes</div>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {!oposicionInfo.hasRealExamDate && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">📅 Examen</div>
                <div className="font-bold text-indigo-800">{examDateLabel}</div>
                <div className="text-xs text-indigo-500">(estimación)</div>
              </div>
            )}
            {oposicionInfo.plazas && (
              <div>
                <div className="text-xs text-indigo-600 font-medium">🎫 Plazas</div>
                <div className="font-bold text-indigo-800">{oposicionInfo.plazas.toLocaleString()}</div>
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

      {/* Predicción Principal */}
      <div className={`bg-gradient-to-r ${getReadinessBg(examPrediction.readinessScore)} border rounded-2xl p-6 mb-6 relative`}>
        {/* Botón de información en esquina superior derecha */}
        <button
          onClick={() => setShowProgressInfo(true)}
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full transition-colors"
          title="¿Cómo se calcula el progreso?"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <div className={`text-6xl font-bold mb-2 ${getReadinessColor(examPrediction.readinessScore)}`}>
            {examPrediction.readinessScore}%
          </div>
          <div className="text-lg font-semibold text-gray-700 mb-2">
            Preparación Estimada para {oposicionInfo.hasRealExamDate ? oposicionInfo.examDateFormatted : 'el examen'}
          </div>
          <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
            examPrediction.readinessLevel === 'excellent' ? 'bg-green-100 text-green-700' :
            examPrediction.readinessLevel === 'good' ? 'bg-blue-100 text-blue-700' :
            examPrediction.readinessLevel === 'developing' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {examPrediction.readinessLevel === 'excellent' ? '🏆 Excelente preparación' :
             examPrediction.readinessLevel === 'good' ? '👍 Buena preparación' :
             examPrediction.readinessLevel === 'developing' ? '📈 En desarrollo' :
             '⚠️ Necesita mejora'}
          </div>
        </div>

        {/* Barra de progreso global */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progreso de preparación</span>
            <span>{examPrediction.readinessScore}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-1000 ${getProgressColor(examPrediction.readinessScore)}`}
              style={{ width: `${examPrediction.readinessScore}%` }}
            ></div>
          </div>

        </div>

        <div className="text-center text-gray-700">
          {examPrediction.mainMessage}
        </div>
      </div>

      {/* Temas Dominados - Sección destacada */}
      {examPrediction.mastery && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🎓</div>
              <div>
                <div className="text-sm text-purple-600 font-medium">Temas dominados</div>
                <div className="text-2xl font-bold text-purple-800">
                  {examPrediction.mastery.masteredThemes}
                  <span className="text-base text-purple-500 ml-1">/{examPrediction.mastery.totalThemes}</span>
                  <span className="text-sm text-purple-400 ml-2">({examPrediction.mastery.percentage}%)</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              {/* Barra de progreso circular simplificada */}
              <div className="relative w-16 h-16">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e9d5ff" strokeWidth="6" fill="none" />
                  <circle
                    cx="32" cy="32" r="28"
                    stroke="#9333ea"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${examPrediction.mastery.percentage * 1.76} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-purple-700">{examPrediction.mastery.percentage}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Predicción de dominio del temario */}
          {examPrediction.mastery.projectedMasteryDate && examPrediction.mastery.projectedMasteryDate !== 'completado' && (
            <div className="mt-3 bg-white bg-opacity-60 rounded-lg p-3 text-center">
              <p className="text-sm text-purple-700">
                📅 A este ritmo, <span className="font-bold">{oposicionInfo.userName || 'dominarás'}</span>
                {oposicionInfo.userName ? ' dominará' : ''} todo el temario para el{' '}
                <span className="font-bold text-purple-900">{examPrediction.mastery.projectedMasteryDate}</span>
              </p>
            </div>
          )}

          {examPrediction.mastery.projectedMasteryDate === 'completado' && (
            <div className="mt-3 bg-green-100 rounded-lg p-3 text-center">
              <p className="text-sm text-green-700 font-bold">
                ✅ ¡Felicidades! Has dominado todo el temario
              </p>
            </div>
          )}

          {examPrediction.mastery.masteredThemes === 0 && (
            <div className="mt-3 bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-sm text-yellow-700">
                💡 Un tema se considera dominado cuando alcanzas &ge;80% de precisión en él
              </p>
            </div>
          )}
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

      {/* Proyección Temporal */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h4 className="font-bold text-gray-800 mb-4">📊 Proyección Temporal</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="text-center">
            <div className="font-bold text-gray-700 text-lg">
              {examPrediction.projection.estimatedReadinessDate}
            </div>
            <div className="text-sm text-gray-600">Fecha estimada 85% preparación</div>
            <div className={`text-xs mt-1 ${
              examPrediction.projection.onTrack ? 'text-green-600' : 'text-red-600'
            }`}>
              {examPrediction.projection.onTrack ? '✅ A tiempo' : '⚠️ Retraso estimado'}
            </div>
          </div>

          <div className="text-center">
            <div className="font-bold text-gray-700 text-lg">
              {examPrediction.projection.questionsNeeded}
            </div>
            <div className="text-sm text-gray-600">Preguntas restantes estimadas</div>
            <div className="text-xs text-gray-500 mt-1">
              Basado en tu ritmo actual
            </div>
          </div>

          <div className="text-center">
            <div className="font-bold text-gray-700 text-lg">
              {examPrediction.projection.themesRemaining}
            </div>
            <div className="text-sm text-gray-600">Temas pendientes</div>
            <div className="text-xs text-gray-500 mt-1">
              Para cobertura completa
            </div>
          </div>
        </div>
      </div>

      {/* Cálculos y Metodología */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => setShowCalculationDetails(!showCalculationDetails)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
        >
          <div className="flex items-center space-x-3">
            <span className="text-xl">🔬</span>
            <div>
              <div className="font-bold text-gray-800">Metodología de Cálculo</div>
              <div className="text-sm text-gray-600">Ver cómo se calculó esta predicción</div>
            </div>
          </div>
          <div className="text-gray-400">
            {showCalculationDetails ? '▼' : '▶'}
          </div>
        </button>

        {showCalculationDetails && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <h5 className="font-bold text-gray-800 mb-3">📋 Datos Empleados en el Cálculo:</h5>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded p-3">
                <h6 className="font-semibold text-gray-700 mb-2">📊 Datos Base</h6>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Tests completados: <strong>{examPrediction.calculations.testsCompleted}</strong></li>
                  <li>• Preguntas respondidas: <strong>{examPrediction.calculations.totalQuestions}</strong></li>
                  <li>• Días de actividad: <strong>{examPrediction.calculations.activeDays}</strong></li>
                  <li>• Tiempo total estudio: <strong>{examPrediction.calculations.totalStudyTime}</strong></li>
                </ul>
              </div>

              <div className="bg-white rounded p-3">
                <h6 className="font-semibold text-gray-700 mb-2">🎯 Tendencias</h6>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Mejora promedio: <strong>+{examPrediction.calculations.averageImprovement}%/día</strong></li>
                  <li>• Ritmo de estudio: <strong>{examPrediction.calculations.dailyQuestions} preguntas/día</strong></li>
                  <li>• Consistencia: <strong>{examPrediction.calculations.consistency}%</strong></li>
                  <li>• Velocidad aprendizaje: <strong>{examPrediction.calculations.learningSpeed}</strong></li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
              <h6 className="font-semibold text-blue-800 mb-2">🧮 Fórmula de Predicción</h6>
              <div className="text-sm text-blue-700">
                <strong>Preparación Estimada = </strong>
                <span className="block mt-1 ml-4">
                  (Precisión Actual × 0.4) + <br/>
                  (Cobertura Temario × 0.3) + <br/>
                  (Consistencia × 0.2) + <br/>
                  (Velocidad Aprendizaje × 0.1)
                </span>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <h6 className="font-semibold text-yellow-800 mb-2">⚠️ Consideraciones</h6>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• Esta predicción se basa en tu progreso histórico</li>
                <li>• Los resultados pueden variar según tu dedicación futura</li>
                <li>• Se recomienda mantener un ritmo constante de estudio</li>
                <li>• La fecha del examen es una estimación (julio 2026)</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Recomendaciones Específicas */}
      {examPrediction.specificRecommendations && examPrediction.specificRecommendations.length > 0 && (
        <div className="mt-6">
          <h4 className="font-bold text-gray-800 mb-4">💡 Recomendaciones Específicas</h4>
          <div className="space-y-3">
            {examPrediction.specificRecommendations.map((rec, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                rec.priority === 'high' ? 'bg-red-50 border-red-200' :
                rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-start space-x-3">
                  <span className="text-xl">{rec.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{rec.title}</div>
                    <div className="text-sm text-gray-600">{rec.description}</div>
                    <div className="text-sm font-medium text-gray-700 mt-1">
                      👉 {rec.action}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                      Muestra qué porcentaje del temario oficial has estudiado y cuántos temas has completado.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">¿Cómo se calcula?</h4>
                        <p className="text-gray-500 text-xs">
                          (Temas estudiados / Total de temas) × 100
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          Un tema se considera "estudiado" cuando has respondido al menos 10 preguntas de ese tema.
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 text-sm">
                          <strong>💡 Consejo:</strong> Intenta estudiar todos los temas del temario para tener una preparación completa. Un 80% de cobertura es un buen objetivo inicial.
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