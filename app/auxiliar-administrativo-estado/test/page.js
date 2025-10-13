// app/auxiliar-administrativo-estado/test/page.js - ACTUALIZADA CON TODOS LOS TEMAS
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function TestsAuxiliarAdministrativoEstado() {
  const { user, loading, supabase } = useAuth()
  const router = useRouter()
  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('tema') // 'tema', 'accuracy_asc', 'accuracy_desc', 'last_study_new', 'last_study_old'
  const [showStatsInfo, setShowStatsInfo] = useState(false)
  const [activeTab, setActiveTab] = useState('materias')










  // Cargar estadísticas del usuario cada vez que se carga la página
  useEffect(() => {
    if (user && !loading) {
      loadUserThemeStats(user.id)
    }
  }, [user, loading])

  // 🔄 ACTUALIZACIÓN AUTOMÁTICA: Recargar estadísticas cada vez que se visita la página
  useEffect(() => {
    if (user) {
      loadUserThemeStats(user.id)
    }
  }, []) // Array vacío = se ejecuta cada vez que se monta el componente (incluye recargas de página)

  // Función para cargar estadísticas por tema - OPTIMIZADA 🚀
  const loadUserThemeStats = async (userId) => {
    setStatsLoading(true)
    console.log('👤 Cargando estadísticas para usuario ID:', userId)
    try {
      const { getSupabaseClient } = await import('../../../lib/supabase')
      const supabase = getSupabaseClient()

      // 🔧 NUEVA QUERY OPTIMIZADA: Usa función SQL agregada
      const { data: themeStatsData, error } = await supabase
        .rpc('get_user_theme_stats', { p_user_id: userId })

      if (!error && themeStatsData) {
        console.log('📊 Estadísticas cargadas:', themeStatsData.length, 'temas')
        
        // Procesar datos ya agregados de la función SQL
        const themeStats = {}
        
        themeStatsData.forEach(row => {
          const theme = row.tema_number
          if (!theme) return

          themeStats[theme] = {
            total: parseInt(row.total),
            correct: parseInt(row.correct),
            accuracy: parseInt(row.accuracy),
            lastStudy: new Date(row.last_study),
            lastStudyFormatted: new Date(row.last_study).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short'
            })
          }
        })

        console.log('🎯 Estadísticas procesadas:', Object.keys(themeStats).length, 'temas')
        setUserStats(themeStats)
      } else {
        console.error('❌ Error cargando estadísticas:', error)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas por tema:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // ✅ FUNCIÓN: Obtener color según % de aciertos
  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 90) return 'green'    // 90-100%: Verde brillante
    if (accuracy >= 75) return 'emerald'  // 75-89%: Verde esmeralda
    if (accuracy >= 60) return 'yellow'   // 60-74%: Amarillo
    if (accuracy >= 40) return 'orange'   // 40-59%: Naranja
    return 'red'                         // 0-39%: Rojo
  }

  // ✅ FUNCIÓN: Obtener clases CSS según color dinámico
  const getColorClasses = (color) => {
    const colorClasses = {
      green: 'bg-green-600 hover:bg-green-700 focus:ring-green-300',
      emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
      yellow: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300',
      orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-300',
      red: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
      gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-300'
    }
    
    return colorClasses[color] || colorClasses.gray
  }

  // ✅ FUNCIÓN: getSortedThemes con colores dinámicos basados en accuracy - CORREGIDO CON 16 TEMAS OFICIALES
  const getSortedThemes = () => {
    const themes = [
      { id: 1, title: 'La Constitución Española de 1978', href: '/auxiliar-administrativo-estado/test/tema/1' },
      { id: 2, title: 'El Tribunal Constitucional. La Corona', href: '/auxiliar-administrativo-estado/test/tema/2' },
      { id: 3, title: 'Las Cortes Generales', href: '/auxiliar-administrativo-estado/test/tema/3' },
      { id: 4, title: 'El Poder Judicial', href: '/auxiliar-administrativo-estado/test/tema/4' },
      { id: 5, title: 'El Gobierno y la Administración', href: '/auxiliar-administrativo-estado/test/tema/5' },
      { id: 6, title: 'El Gobierno Abierto. Agenda 2030', href: '/auxiliar-administrativo-estado/test/tema/6' },
      { id: 7, title: 'Ley 19/2013 de Transparencia', href: '/auxiliar-administrativo-estado/test/tema/7' },
      { id: 8, title: 'La Administración General del Estado', href: '/auxiliar-administrativo-estado/test/tema/8' },
      { id: 9, title: 'La Organización Territorial del Estado', href: '/auxiliar-administrativo-estado/test/tema/9' },
      { id: 10, title: 'La Organización de la Unión Europea', href: '/auxiliar-administrativo-estado/test/tema/10' },
      { id: 11, title: 'Las Leyes del Procedimiento Administrativo Común', href: '/auxiliar-administrativo-estado/test/tema/11' },
      { id: 12, title: 'La Protección de Datos Personales', href: '/auxiliar-administrativo-estado/test/tema/12' },
      { id: 13, title: 'El Personal Funcionario de las Administraciones Públicas', href: '/auxiliar-administrativo-estado/test/tema/13' },
      { id: 14, title: 'Derechos y Deberes de los Funcionarios', href: '/auxiliar-administrativo-estado/test/tema/14' },
      { id: 15, title: 'El Presupuesto del Estado en España', href: '/auxiliar-administrativo-estado/test/tema/15' },
      { id: 16, title: 'Políticas de Igualdad y contra la Violencia de Género', href: '/auxiliar-administrativo-estado/test/tema/16' }
    ].map(theme => {
      // ✅ ASIGNAR COLOR DINÁMICO SEGÚN ESTADÍSTICAS DE USUARIO
      const stats = userStats[theme.id]
      const accuracy = stats ? stats.accuracy : 0
      const color = stats ? getAccuracyColor(accuracy) : 'gray'
      
      return { ...theme, color, accuracy }
    })

    return themes.sort((a, b) => {
      const statsA = userStats[a.id]
      const statsB = userStats[b.id]

      switch (sortBy) {
        case 'tema':
          return a.id - b.id

        case 'accuracy_asc':
          if (!statsA && !statsB) return 0
          if (!statsA) return 1
          if (!statsB) return -1
          return statsA.accuracy - statsB.accuracy

        case 'accuracy_desc':
          if (!statsA && !statsB) return 0
          if (!statsA) return 1
          if (!statsB) return -1
          return statsB.accuracy - statsA.accuracy

        case 'last_study_new':
          if (!statsA && !statsB) return 0
          if (!statsA) return 1
          if (!statsB) return -1
          if (!statsA.lastStudy && !statsB.lastStudy) return 0
          if (!statsA.lastStudy) return 1
          if (!statsB.lastStudy) return -1
          return statsB.lastStudy - statsA.lastStudy

        case 'last_study_old':
          if (!statsA && !statsB) return 0
          if (!statsA) return 1
          if (!statsB) return -1
          if (!statsA.lastStudy && !statsB.lastStudy) return 0
          if (!statsA.lastStudy) return 1
          if (!statsB.lastStudy) return -1
          return statsA.lastStudy - statsB.lastStudy

        default:
          return a.id - b.id
      }
    })
  }

  // Mostrar loading solo durante la verificación inicial de auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* INTERFAZ DE TESTS - DISPONIBLE PARA TODOS LOS USUARIOS */}
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-4xl w-full">
              {/* Header mejorado */}
              <div className="mb-8">
                <div className="inline-flex items-center bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-2 rounded-full text-sm font-medium mb-6">
                  <span className="mr-2">🏛️</span>
                  Auxiliar Administrativo del Estado
                </div>

              </div>
              
              {/* Contenido de tests */}
                <>

                  {/* ✅ LEYENDA DE COLORES */}
                  <div className="mb-6">
                    <div className="bg-white rounded-lg shadow-md p-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">Leyenda de colores por % de aciertos:</div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <div className="flex items-center px-3 py-1 bg-green-100 rounded-lg">
                          <span className="w-3 h-3 bg-green-600 rounded-full mr-2"></span>
                          <span className="text-xs font-medium text-green-800">90-100%: Excelente</span>
                        </div>
                        <div className="flex items-center px-3 py-1 bg-emerald-100 rounded-lg">
                          <span className="w-3 h-3 bg-emerald-600 rounded-full mr-2"></span>
                          <span className="text-xs font-medium text-emerald-800">75-89%: Muy bueno</span>
                        </div>
                        <div className="flex items-center px-3 py-1 bg-yellow-100 rounded-lg">
                          <span className="w-3 h-3 bg-yellow-600 rounded-full mr-2"></span>
                          <span className="text-xs font-medium text-yellow-800">60-74%: Bueno</span>
                        </div>
                        <div className="flex items-center px-3 py-1 bg-orange-100 rounded-lg">
                          <span className="w-3 h-3 bg-orange-600 rounded-full mr-2"></span>
                          <span className="text-xs font-medium text-orange-800">40-59%: Mejorable</span>
                        </div>
                        <div className="flex items-center px-3 py-1 bg-red-100 rounded-lg">
                          <span className="w-3 h-3 bg-red-600 rounded-full mr-2"></span>
                          <span className="text-xs font-medium text-red-800">0-39%: Necesita práctica</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Opciones de ordenación */}
                  <div className="mb-6">
                    <div className="bg-white rounded-lg shadow-md p-4">
                      <div className="text-sm font-medium text-gray-700 mb-3">Ordenar por:</div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {[
                          { id: 'tema', label: 'Por Tema', icon: '🔢' },
                          { id: 'accuracy_asc', label: '% Más Bajo', icon: '📉' },
                          { id: 'accuracy_desc', label: '% Más Alto', icon: '📈' },
                          { id: 'last_study_new', label: 'Más Reciente', icon: '🕐' },
                          { id: 'last_study_old', label: 'Más Antiguo', icon: '🕰️' }
                        ].map((option) => (
                          <button
                            key={option.id}
                            onClick={() => setSortBy(option.id)}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              sortBy === option.id
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span className="mr-1">{option.icon}</span>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* ✅ BOTONES DINÁMICOS CON COLORES POR ACCURACY */}
                  <div className="space-y-4">
                    {/* Test Aleatorio */}
                    <Link
                      href="/auxiliar-administrativo-estado/test/aleatorio"
                      className="block bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-300 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-3 text-2xl group-hover:animate-bounce">🎲</span>
                          <span>Test Aleatorio: Mezcla preguntas de varios temas</span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                            Personalizable
                          </span>
                        </div>
                      </div>
                    </Link>

                    {getSortedThemes().map((theme) => (
                      <Link
                        key={theme.id}
                        href={theme.href}
                        className={`block ${getColorClasses(theme.color)} text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 group`}
                      >
                        <div className="flex items-center justify-between">
                          <span>Tests Tema {theme.id}: {theme.title}</span>
                          <div className="flex items-center space-x-3">
                            {userStats[theme.id] && (
                              <>
                                <div className="flex items-center space-x-1">
                                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                    {userStats[theme.id].accuracy}% ({userStats[theme.id].correct}/{userStats[theme.id].total})
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setShowStatsInfo(true)
                                    }}
                                    className="text-white/70 hover:text-white transition-colors p-1"
                                    title="¿Qué significa este porcentaje?"
                                  >
                                    ℹ️
                                  </button>
                                </div>
                                <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                                  Último estudio: {userStats[theme.id].lastStudyFormatted}
                                </span>
                              </>
                            )}
                            {!userStats[theme.id] && (
                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                                Sin datos
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>

              {/* Modal de información de estadísticas */}
              {showStatsInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Estadísticas de Rendimiento</h3>
                    <div className="space-y-3 text-sm text-gray-700">
                      <p>
                        <strong>Porcentaje de aciertos:</strong> Calculado como (respuestas correctas / total respuestas) × 100
                      </p>
                      <p>
                        <strong>Respuestas:</strong> Formato (correctas/total)
                      </p>
                      <p>
                        <strong>Último estudio:</strong> Fecha de tu última sesión de test en ese tema
                      </p>
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <p className="text-blue-800 font-medium">💡 Consejo</p>
                        <p className="text-blue-700">Practica los temas con menor porcentaje para mejorar tu preparación general.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowStatsInfo(false)}
                      className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Entendido
                    </button>
                  </div>
                </div>
              )}
            </div>
        </div>

      </div>
    </div>
  )
}
