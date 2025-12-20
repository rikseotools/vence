'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTopicUnlock } from '@/hooks/useTopicUnlock'
import TopicUnlockProgress from '@/components/TopicUnlockProgress'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export default function TemarioPage() {
  const { user } = useAuth()
  const { isTopicUnlocked, getTopicProgress, loading } = useTopicUnlock()
  const [showModal, setShowModal] = useState(false)
  const [modalTema, setModalTema] = useState(null)

  const openModal = (tema) => {
    setModalTema(tema)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setModalTema(null)
  }

  const temas = [
    { numero: 1, titulo: "La Constitución Española de 1978", color: "blue", icon: "📜", descripcion: "Estructura del Estado, derechos fundamentales" },
    { numero: 2, titulo: "El Tribunal Constitucional", color: "red", icon: "⚖️", descripcion: "Composición, competencias y procedimientos" },
    { numero: 3, titulo: "Las Cortes Generales", color: "indigo", icon: "🏛️", descripcion: "Congreso, Senado y Defensor del Pueblo" },
    { numero: 4, titulo: "El Poder Judicial", color: "amber", icon: "⚖️", descripcion: "Organización judicial, CGPJ y LO 1/2025" },
    { numero: 5, titulo: "El Gobierno y la Administración", color: "purple", icon: "⚖️", descripcion: "Composición, funciones e investidura" },
    { numero: 6, titulo: "El Gobierno Abierto y la Agenda 2030", color: "teal", icon: "🌍", descripcion: "Transparencia, participación y desarrollo sostenible" },
    { numero: 7, titulo: "Ley 19/2013 de Transparencia", color: "green", icon: "📋", descripcion: "Transparencia, acceso y buen gobierno" },
    { numero: 8, titulo: "La Administración General del Estado", color: "cyan", icon: "🏛️", descripcion: "Órganos centrales, territoriales y exterior" }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando temario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <InteractiveBreadcrumbs />
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            📚 Temario Auxiliar Administrativo Estado
          </h1>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 max-w-4xl mx-auto rounded-lg mb-8">
            <div className="flex items-start">
              <span className="text-2xl mr-3">🎯</span>
              <div className="text-left">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  ¡Los tests están siempre disponibles!
                </h3>
                <p className="text-blue-800">
                  Solo se bloquea la teoría por el sistema progresivo. 
                  Puedes hacer tests de cualquier tema cuando quieras.
                </p>
              </div>
            </div>
          </div>
        </div>

        {user && (
          <div className="mb-12">
            <TopicUnlockProgress currentTopic={1} showAll={false} />
          </div>
        )}

        <div className="grid gap-4 max-w-5xl mx-auto">
          {temas.map(tema => {
            const isUnlocked = user ? isTopicUnlocked(tema.numero) : tema.numero === 1
            const progress = user ? getTopicProgress(tema.numero) : { accuracy: 0, questionsAnswered: 0 }
            
            const getStateColorClasses = () => {
              if (!isUnlocked) {
                // Bloqueados - Gris
                return { bg: 'bg-gray-50', border: 'border-gray-300', accent: 'bg-gray-500' }
              } else if (progress.accuracy >= 70) {
                // Dominados - Verde
                return { bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-500' }
              } else if (progress.accuracy > 0) {
                // En progreso - Naranja
                return { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500' }
              } else {
                // Disponibles - Azul
                return { bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-500' }
              }
            }

            const colorClasses = getStateColorClasses()
            
            return (
              <div key={tema.numero} className={`${colorClasses.bg} border-2 ${colorClasses.border} rounded-xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden`}>
                {/* Header compacto */}
                <div className="relative">
                  <div className={`${colorClasses.accent} px-4 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tema.icon}</span>
                      <div>
                        <h3 className="text-white font-bold text-sm sm:text-base">
                          Tema {tema.numero}
                        </h3>
                        <div className="text-xs text-white/90 font-medium flex items-center gap-1">
                          {!isUnlocked ? (
                            <span className="flex items-center gap-1">
                              🔒 BLOQUEADO
                              <button
                                onClick={() => openModal(tema)}
                                className="bg-blue-500 hover:bg-blue-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold border border-white/30 transition-colors cursor-pointer"
                                title="Ver información para desbloquear"
                              >
                                i
                              </button>
                            </span>
                          ) :
                           progress.accuracy >= 70 ? '✅ DOMINADO' :
                           progress.accuracy > 0 ? '🎯 EN PROGRESO' : '🆕 DISPONIBLE'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Mostrar progreso */}
                    {user && isUnlocked && progress.questionsAnswered > 0 ? (
                      <div className="text-right">
                        <div className="text-white font-bold text-lg">{progress.accuracy}%</div>
                        <div className="text-xs text-white/90">{progress.questionsAnswered} preguntas</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Contenido compacto */}
                <div className="p-4">
                  <h4 className="font-bold text-gray-800 text-base sm:text-lg mb-2 leading-tight">
                    {tema.titulo}
                  </h4>
                  <p className="text-gray-600 text-sm mb-4">
                    {tema.descripcion}
                  </p>
                  
                  {/* Barra de progreso compacta */}
                  {user && isUnlocked && progress.questionsAnswered > 0 && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div 
                          className={`h-1.5 rounded-full ${colorClasses.accent}`}
                          style={{ width: `${Math.min(100, progress.accuracy)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Botones compactos */}
                  <div className="flex gap-2">
                    {isUnlocked ? (
                      <>
                        <Link 
                          href={`/auxiliar-administrativo-estado/temario/tema-${tema.numero}`}
                          className="flex-1 text-center bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          📖 Teoría
                        </Link>
                        <Link 
                          href={`/auxiliar-administrativo-estado/test/tema/${tema.numero}`}
                          className={`flex-1 text-center text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors ${colorClasses.accent} hover:opacity-90`}
                        >
                          🎯 Tests
                        </Link>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-center bg-gray-200 text-gray-500 px-3 py-2 rounded-lg text-sm font-medium cursor-not-allowed">
                          🔒 Teoría
                        </div>
                        <Link 
                          href={`/auxiliar-administrativo-estado/test/tema/${tema.numero}`}
                          className={`flex-1 text-center text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors ${colorClasses.accent} hover:opacity-90`}
                        >
                          🎯 Tests
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
          <div className="text-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">
              💡 Sistema de Desbloqueo Progresivo
            </h3>
            <p className="text-gray-600 text-sm">Practica con tests para desbloquear la teoría avanzada</p>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">🎯</div>
              <h4 className="font-bold text-gray-800 mb-1 text-sm">Tests Siempre Libres</h4>
              <p className="text-gray-600 text-xs">
                Puedes hacer tests de cualquier tema cuando quieras
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">🔓</div>
              <h4 className="font-bold text-gray-800 mb-1 text-sm">Desbloqueo Fácil</h4>
              <p className="text-gray-600 text-xs">
                70% de precisión con 10+ preguntas para acceder a teoría
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de información */}
      {showModal && modalTema && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 shadow-2xl">
            {/* Header del modal */}
            <div className="bg-blue-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{modalTema.icon}</span>
                <div>
                  <h3 className="font-bold text-lg">Tema {modalTema.numero}</h3>
                  <p className="text-blue-100 text-sm">{modalTema.titulo}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Contenido del modal */}
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔒</span>
                </div>
                <h4 className="text-xl font-bold text-gray-800 mb-2">
                  Tema Bloqueado
                </h4>
                <p className="text-gray-600 text-sm">
                  Para acceder a la teoría de este tema, necesitas desbloquear el anterior
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-bold text-blue-800 mb-2 flex items-center gap-2">
                    <span>🎯</span> ¿Cómo desbloquear?
                  </h5>
                  <ul className="text-blue-700 text-sm space-y-2">
                    <li>• Consigue <strong>70% de precisión</strong> en el tema anterior</li>
                    <li>• Responde al menos <strong>10 preguntas</strong></li>
                    <li>• El desbloqueo es <strong>automático</strong></li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-bold text-green-800 mb-2 flex items-center gap-2">
                    <span>✅</span> Mientras tanto...
                  </h5>
                  <p className="text-green-700 text-sm">
                    Puedes practicar con <strong>tests de este tema</strong> cuando quieras. ¡Los tests están siempre disponibles!
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex gap-3 mt-6">
                <Link
                  href={`/auxiliar-administrativo-estado/test/tema/${modalTema.numero - 1}`}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
                  onClick={closeModal}
                >
                  🎯 Practicar Tema {modalTema.numero - 1}
                </Link>
                <Link
                  href={`/auxiliar-administrativo-estado/test/tema/${modalTema.numero}`}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white text-center py-3 px-4 rounded-lg font-medium transition-colors"
                  onClick={closeModal}
                >
                  📝 Test Tema {modalTema.numero}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}