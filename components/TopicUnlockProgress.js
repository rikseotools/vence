// components/TopicUnlockProgress.js - COMPONENTE PARA MOSTRAR PROGRESO DE DESBLOQUEO
'use client'
import Link from 'next/link'
import { useTopicUnlock } from '../hooks/useTopicUnlock'

export default function TopicUnlockProgress({ currentTopic, showAll = false }) {
  const {
    isTopicUnlocked,
    getTopicProgress,
    getUnlockRequirements,
    getUnlockMessage,
    loading,
    UNLOCK_THRESHOLD
  } = useTopicUnlock()

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  // Si showAll es true, mostrar progreso de todos los temas
  if (showAll) {
    return <AllTopicsProgress />
  }

  // Mostrar progreso del tema actual y siguiente
  const nextTopic = currentTopic + 1
  const requirements = getUnlockRequirements(currentTopic)
  const unlockMessage = getUnlockMessage(currentTopic)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center">
          <span className="mr-2">🔓</span>
          Progreso de Desbloqueo
        </h3>
        <div className="text-sm text-gray-500">
          Tema {currentTopic} → {nextTopic <= 28 ? `Tema ${nextTopic}` : 'Completado'}
        </div>
      </div>

      {/* Progreso actual */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Tema {currentTopic} - Tu Rendimiento
          </span>
          <span className={`text-lg font-bold ${
            requirements.currentAccuracy >= UNLOCK_THRESHOLD ? 'text-green-600' : 'text-orange-600'
          }`}>
            {requirements.currentAccuracy}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div 
            className={`h-3 rounded-full transition-all ${
              requirements.currentAccuracy >= UNLOCK_THRESHOLD 
                ? 'bg-green-500' 
                : 'bg-orange-500'
            }`}
            style={{ width: `${Math.min(100, requirements.currentAccuracy)}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span className="font-medium text-blue-600">{UNLOCK_THRESHOLD}% requerido</span>
          <span>100%</span>
        </div>
      </div>

      {/* Estado del siguiente tema */}
      {nextTopic <= 28 && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <span className="mr-2 text-lg">{unlockMessage.icon}</span>
              <span className="font-medium text-gray-800">
                Tema {nextTopic}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              requirements.isNextUnlocked 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {requirements.isNextUnlocked ? 'Desbloqueado' : 'Bloqueado'}
            </span>
          </div>

          <p className={`text-sm mb-3 ${
            unlockMessage.type === 'success' ? 'text-green-600' :
            unlockMessage.type === 'locked' ? 'text-gray-600' :
            unlockMessage.type === 'progress' ? 'text-orange-600' :
            'text-blue-600'
          }`}>
            {unlockMessage.message}
          </p>

          {/* Requisitos específicos */}
          {!requirements.isNextUnlocked && requirements.isCurrentUnlocked && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-800">
                <div className="font-medium mb-3">Para desbloquear Tema {nextTopic} necesitas:</div>
                <div className="space-y-3">
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">📊 Precisión mínima del 70%</span>
                      <span className={`font-bold text-lg ${
                        requirements.currentAccuracy >= UNLOCK_THRESHOLD ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {requirements.currentAccuracy >= UNLOCK_THRESHOLD ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Tu precisión actual: <strong>{requirements.currentAccuracy}%</strong>
                      {requirements.currentAccuracy >= UNLOCK_THRESHOLD 
                        ? ' (¡Ya cumples este requisito!)' 
                        : ` (necesitas ${UNLOCK_THRESHOLD - requirements.currentAccuracy}% más)`
                      }
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">🎯 Mínimo 10 preguntas respondidas</span>
                      <span className={`font-bold text-lg ${
                        requirements.questionsAnswered >= 10 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {requirements.questionsAnswered >= 10 ? '✅' : '❌'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Preguntas respondidas: <strong>{requirements.questionsAnswered}</strong>
                      {requirements.questionsAnswered >= 10 
                        ? ' (¡Ya cumples este requisito!)' 
                        : ` (necesitas ${10 - requirements.questionsAnswered} más)`
                      }
                    </div>
                  </div>
                </div>
                
                {requirements.currentAccuracy < UNLOCK_THRESHOLD && (
                  <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
                    <div className="text-xs text-orange-800">
                      💡 <strong>Consejo:</strong> Sigue practicando el Tema {currentTopic} para mejorar tu precisión. 
                      Cada test te ayuda a dominar mejor el contenido.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botón de acción */}
          <div className="mt-4">
            {requirements.isNextUnlocked && (
              <Link
                href={`/es/auxiliar-administrativo-estado/temario/tema-${nextTopic}`}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <span className="mr-2">🎉</span>
                Ver Tema {nextTopic}
              </Link>
            )}
            {!requirements.isNextUnlocked && requirements.isCurrentUnlocked && (
              <Link
                href={`/es/auxiliar-administrativo-estado/test/tema/${currentTopic}`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">🎯</span>
                Seguir Practicando
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de completado */}
      {nextTopic > 28 && requirements.currentAccuracy >= UNLOCK_THRESHOLD && (
        <div className="border-t border-gray-200 pt-4 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <div className="text-lg font-bold text-green-600 mb-2">
            ¡Felicitaciones!
          </div>
          <p className="text-gray-600 text-sm">
            Has completado todos los temas disponibles con excelente rendimiento.
          </p>
        </div>
      )}
    </div>
  )
}

// Componente para mostrar todos los temas y su estado
function AllTopicsProgress() {
  const { isTopicUnlocked, getTopicProgress, loading } = useTopicUnlock()

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Lista de todos los temas (solo mostramos los primeros 10 por ahora)
  const allTopics = [
    { number: 1, title: "La Constitución Española de 1978" },
    { number: 2, title: "Los Derechos Fundamentales" },
    { number: 3, title: "La Corona" },
    { number: 4, title: "El Poder Judicial" },
    { number: 5, title: "La Administración Pública" },
    { number: 6, title: "Los Contratos del Sector Público" },
    { number: 7, title: "La Ley 19/2013 de Transparencia" },
    { number: 8, title: "Personal al Servicio de las AAPP" },
    { number: 9, title: "Régimen Disciplinario" },
    { number: 10, title: "El Procedimiento Administrativo" }
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="font-bold text-gray-800 mb-6 flex items-center">
        <span className="mr-2">📚</span>
        Progreso General de Temas
      </h3>

      <div className="space-y-3">
        {allTopics.map(topic => {
          const isUnlocked = isTopicUnlocked(topic.number)
          const progress = getTopicProgress(topic.number)
          
          return (
            <div key={topic.number} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
                  isUnlocked 
                    ? progress.accuracy >= 70 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {isUnlocked ? (
                    progress.accuracy >= 70 ? '✅' : topic.number
                  ) : '🔒'}
                </div>
                <div>
                  <div className={`font-medium ${isUnlocked ? 'text-gray-800' : 'text-gray-500'}`}>
                    Tema {topic.number}
                  </div>
                  <div className={`text-sm ${isUnlocked ? 'text-gray-600' : 'text-gray-400'}`}>
                    {topic.title}
                  </div>
                </div>
              </div>

              <div className="text-right">
                {isUnlocked ? (
                  <div>
                    <div className={`font-bold ${
                      progress.accuracy >= 70 ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {progress.accuracy}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {progress.questionsAnswered} respuestas
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm">
                    Bloqueado
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
        💡 Completa cada tema con un 70% o más de precisión para desbloquear el siguiente tema
      </div>
    </div>
  )
}