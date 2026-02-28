'use client'
import { useState, useEffect } from 'react'

interface ExamProgress {
  currentPhase: string
  currentMapping: number
  totalMappings: number
  currentLaw: string
  questionsFound: number
  message: string
}

interface ExamLoadingIndicatorProps {
  numQuestions?: number
  numThemes?: number
  themeNames?: string[]
  progress?: ExamProgress | null
}

interface PhaseData {
  title: string
  icon: string
  color: string
}

export default function ExamLoadingIndicator({
  numQuestions = 25,
  numThemes = 1,
  themeNames = [],
  progress = null
}: ExamLoadingIndicatorProps) {
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [currentPhase, setCurrentPhase] = useState<string>('connecting') // connecting, loading, preparing

  // Simulación de carga de preguntas
  useEffect(() => {
    // Fase 1: Conectando (0.5s)
    setTimeout(() => {
      setCurrentPhase('loading')
    }, 500)

    // Fase 2: Cargando preguntas (simular progreso)
    const questionInterval = setInterval(() => {
      setCurrentQuestion(prev => {
        if (prev >= numQuestions) {
          clearInterval(questionInterval)
          setCurrentPhase('preparing')
          return prev
        }
        return prev + Math.floor(Math.random() * 3) + 1 // Incremento aleatorio
      })
    }, 100)

    // Fase 3: Preparando test final
    setTimeout(() => {
      setCurrentPhase('preparing')
    }, 2000)

    return () => clearInterval(questionInterval)
  }, [numQuestions])

  // Usar datos reales si están disponibles
  const actualPhase = progress?.currentPhase || currentPhase
  const actualQuestionsFound = progress?.questionsFound || 0
  const actualCurrentMapping = progress?.currentMapping || 0
  const actualTotalMappings = progress?.totalMappings || 0

  const phases: Record<string, PhaseData> = {
    connecting: {
      title: 'Conectando con la base de datos',
      icon: '🔌',
      color: 'text-gray-600'
    },
    fetching_mappings: {
      title: 'Obteniendo estructura de temas',
      icon: '🗂️',
      color: 'text-blue-600'
    },
    processing_laws: {
      title: `Buscando preguntas disponibles`,
      icon: '📚',
      color: 'text-blue-600'
    },
    loading: {
      title: `Cargando pregunta ${Math.min(currentQuestion, numQuestions)} de ${numQuestions}`,
      icon: '📚',
      color: 'text-blue-600'
    },
    selecting: {
      title: 'Seleccionando preguntas proporcionalmente',
      icon: '🎯',
      color: 'text-purple-600'
    },
    preparing: {
      title: 'Preparando tu examen personalizado',
      icon: '✨',
      color: 'text-green-600'
    }
  }

  const currentPhaseData = phases[actualPhase] || phases.connecting

  // Calcular progreso basado en datos reales
  let progressPercentage = 0
  if (actualPhase === 'processing_laws' && actualTotalMappings > 0) {
    progressPercentage = (actualCurrentMapping / actualTotalMappings) * 100
  } else if (actualPhase === 'selecting') {
    progressPercentage = 100
  } else {
    progressPercentage = (Math.min(currentQuestion, numQuestions) / numQuestions) * 100
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        {/* Icono animado */}
        <div className="text-6xl text-center mb-6 animate-bounce">
          {currentPhaseData.icon}
        </div>

        {/* Título principal */}
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
          Preparando test en modo examen
        </h2>

        {/* Fase actual */}
        <p className={`text-center mb-6 font-medium ${currentPhaseData.color}`}>
          {currentPhaseData.title}
        </p>

        {/* Barra de progreso detallada */}
        <div className="space-y-2 mb-6">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
              style={{ width: `${progressPercentage}%` }}
            >
              {progressPercentage > 10 && (
                <span className="text-xs text-white font-bold">
                  {Math.round(progressPercentage)}%
                </span>
              )}
            </div>
          </div>

          {/* Contador dinámico según la fase */}
          {actualPhase === 'processing_laws' && actualTotalMappings > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Leyes procesadas</span>
              <span className="font-bold">
                {actualCurrentMapping}/{actualTotalMappings}
              </span>
            </div>
          )}
          {actualPhase === 'processing_laws' && actualQuestionsFound > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Preguntas encontradas</span>
              <span className="font-bold text-green-600">
                {actualQuestionsFound}
              </span>
            </div>
          )}
          {actualPhase === 'selecting' && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Distribución proporcional</span>
              <span className="font-bold text-purple-600">
                {numQuestions} de {actualQuestionsFound}
              </span>
            </div>
          )}
          {currentPhase === 'loading' && !progress && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Preguntas cargadas</span>
              <span className="font-bold">
                {Math.min(currentQuestion, numQuestions)}/{numQuestions}
              </span>
            </div>
          )}
        </div>

        {/* Información del test */}
        <div className="bg-blue-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Modo:</span>
            <span className="font-semibold text-blue-700">🎯 Examen</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Temas:</span>
            <span className="font-semibold text-gray-800">
              {numThemes} {numThemes === 1 ? 'tema' : 'temas mezclados'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Preguntas:</span>
            <span className="font-semibold text-gray-800">{numQuestions}</span>
          </div>
        </div>

        {/* Mensaje más estable - no mostrar ley específica que cambia muy rápido */}
        <p className="text-xs text-center text-gray-500 mt-4 italic">
          {actualPhase === 'processing_laws'
            ? `Buscando preguntas en ${actualTotalMappings} combinaciones...`
            : actualPhase === 'selecting'
            ? 'Distribuyendo preguntas proporcionalmente entre los temas seleccionados...'
            : currentPhase === 'loading'
            ? 'Seleccionando las mejores preguntas para ti...'
            : currentPhase === 'preparing'
            ? 'Casi listo, aplicando configuración de examen...'
            : 'Estableciendo conexión segura...'}
        </p>

        {/* Mini animación de actividad */}
        <div className="flex justify-center mt-4 space-x-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    </div>
  )
}
