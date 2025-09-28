// components/Statistics/ConfidenceAnalysis.js - MEJORADO CON INFO DESPLEGABLE
'use client'

import { useState } from 'react'

export default function ConfidenceAnalysis({ confidenceAnalysis }) {
  const [showInfo, setShowInfo] = useState(false)

  if (!confidenceAnalysis) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">🎯 Análisis de Confianza</h3>
          <button 
            onClick={() => setShowInfo(!showInfo)}
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span className="text-lg">ℹ️</span>
          </button>
        </div>

        {showInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
            <p className="font-bold text-blue-800 mb-2">¿Cómo se calcula?</p>
            <p className="text-blue-700 mb-2">El sistema analiza tu comportamiento automáticamente:</p>
            <div className="space-y-1 text-blue-700">
              <p>• <strong>Tiempo de respuesta:</strong> Rapidez vs precisión</p>
              <p>• <strong>Patrones de lectura:</strong> Tiempo antes de responder</p>
              <p>• <strong>Correlaciones:</strong> Velocidad según dificultad</p>
            </div>
          </div>
        )}

        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎯</div>
          <h4 className="text-lg font-semibold text-gray-700 mb-2">
            Recopilando Datos
          </h4>
          <p className="text-gray-500 mb-4">
            Analizando tu comportamiento para calcular confianza automáticamente.
          </p>
          
          {/* Vista previa compacta de cómo funcionará */}
          <div className="max-w-sm mx-auto bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-3">El sistema detectará:</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-white rounded">
                <span>⚡ Rápido + correcto</span>
                <span className="text-green-600 font-bold">Muy seguro</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded">
                <span>🤔 Reflexión larga</span>
                <span className="text-orange-600 font-bold">Dudoso</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded">
                <span>🎲 Rápido + error</span>
                <span className="text-red-600 font-bold">Adivinando</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Si tenemos datos de confianza, mostrarlos aquí
  const { 
    calibrationScore, 
    recommendation, 
    overconfidenceRate, 
    underconfidenceRate,
    byLevel 
  } = confidenceAnalysis

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">🎯 Análisis de Confianza</h3>
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className="text-blue-600 hover:text-blue-800 transition-colors"
        >
          <span className="text-lg">ℹ️</span>
        </button>
      </div>

      {showInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-sm">
          <p className="font-bold text-blue-800 mb-2">¿Cómo se calcula el Análisis de Confianza?</p>
          <p className="text-blue-700 mb-2">Analizamos tu comportamiento en tiempo real:</p>
          <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
            <div>• <strong>Tiempo respuesta:</strong> Velocidad vs acierto</div>
            <div>• <strong>Tiempo lectura:</strong> Reflexión previa</div>
            <div>• <strong>Patrones dificultad:</strong> Comportamiento según nivel</div>
            <div>• <strong>Calibración:</strong> Confianza real vs percibida</div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Calibración de Confianza - Compacta */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-bold text-blue-800 mb-3">📊 Calibración</h4>
          <div className="text-center mb-3">
            <div className="text-2xl font-bold text-blue-700">
              {calibrationScore}%
            </div>
            <div className="text-xs text-blue-600">Precisión Auto-evaluación</div>
          </div>
          <div className="text-sm text-blue-700">
            {recommendation}
          </div>
        </div>

        {/* Patrones de Confianza - Compacta */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-bold text-purple-800 mb-3">🔍 Patrones</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Exceso confianza:</span>
              <span className="font-bold text-red-600">
                {overconfidenceRate}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Falta confianza:</span>
              <span className="font-bold text-yellow-600">
                {underconfidenceRate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desglose por Nivel de Confianza - Compacto */}
      {byLevel && (
        <div className="mt-6">
          <h4 className="font-bold text-gray-800 mb-3">📈 Por Nivel de Confianza</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(byLevel).map(([level, data]) => (
              <div key={level} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-xs font-medium capitalize mb-1">
                  {level === 'very_sure' ? 'Muy Seguro' :
                   level === 'sure' ? 'Seguro' :
                   level === 'unsure' ? 'Inseguro' : 'Adivinando'}
                </div>
                <div className="text-lg font-bold text-gray-800">{data.accuracy}%</div>
                <div className="text-xs text-gray-600">{data.correct}/{data.total}</div>
                <div className="text-xs text-gray-500">{data.avgTime}s</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}