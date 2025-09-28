// app/es/auxiliar-administrativo-estado/test/page.js - ACTUALIZADA CON TODOS LOS TEMAS
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '../../../../contexts/AuthContext'

export default function TestsAuxiliarAdministrativoEstado() {
  const { user, loading } = useAuth()
  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('tema') // 'tema', 'accuracy_asc', 'accuracy_desc', 'last_study_new', 'last_study_old'
  const [showStatsInfo, setShowStatsInfo] = useState(false)

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
      const { getSupabaseClient } = await import('../../../../lib/supabase')
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
      { id: 1, title: 'La Constitución Española de 1978', href: '/es/auxiliar-administrativo-estado/test/tema/1' },
      { id: 2, title: 'El Tribunal Constitucional. La Corona', href: '/es/auxiliar-administrativo-estado/test/tema/2' },
      { id: 3, title: 'Las Cortes Generales', href: '/es/auxiliar-administrativo-estado/test/tema/3' },
      { id: 4, title: 'El Poder Judicial', href: '/es/auxiliar-administrativo-estado/test/tema/4' },
      { id: 5, title: 'El Gobierno y la Administración', href: '/es/auxiliar-administrativo-estado/test/tema/5' },
      { id: 6, title: 'El Gobierno Abierto. Agenda 2030', href: '/es/auxiliar-administrativo-estado/test/tema/6' },
      { id: 7, title: 'Ley 19/2013 de Transparencia', href: '/es/auxiliar-administrativo-estado/test/tema/7' },
      { id: 8, title: 'La Administración General del Estado', href: '/es/auxiliar-administrativo-estado/test/tema/8' },
      { id: 9, title: 'La Organización Territorial del Estado', href: '/es/auxiliar-administrativo-estado/test/tema/9' },
      { id: 10, title: 'La Organización de la Unión Europea', href: '/es/auxiliar-administrativo-estado/test/tema/10' },
      { id: 11, title: 'Las Leyes del Procedimiento Administrativo Común', href: '/es/auxiliar-administrativo-estado/test/tema/11' },
      { id: 12, title: 'La Protección de Datos Personales', href: '/es/auxiliar-administrativo-estado/test/tema/12' },
      { id: 13, title: 'El Personal Funcionario de las Administraciones Públicas', href: '/es/auxiliar-administrativo-estado/test/tema/13' },
      { id: 14, title: 'Derechos y Deberes de los Funcionarios', href: '/es/auxiliar-administrativo-estado/test/tema/14' },
      { id: 15, title: 'El Presupuesto del Estado en España', href: '/es/auxiliar-administrativo-estado/test/tema/15' },
      { id: 16, title: 'Políticas de Igualdad y contra la Violencia de Género', href: '/es/auxiliar-administrativo-estado/test/tema/16' }
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

  // Mostrar loading mientras verifica auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tests...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* USUARIOS LOGUEADOS - BOTONES CON COLORES DINÁMICOS SEGÚN ACCURACY */}
        {user && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-4xl w-full">
              {/* Header mejorado */}
              <div className="mb-8">
                <div className="inline-flex items-center bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-full text-lg font-bold mb-4">
                  <span className="mr-2">📝</span>
                  Tests
                </div>
                <div className="inline-flex items-center bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-2 rounded-full text-sm font-medium">
                  <span className="mr-2">🏛️</span>
                  Auxiliar Administrativo del Estado
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Los colores indican tu rendimiento: 🟢 Excelente → 🔴 Necesita práctica
              </p>


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
                  href="/es/auxiliar-administrativo-estado/test/aleatorio"
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
            </div>
          </div>
        )}

        {/* USUARIOS NO LOGUEADOS - TODOS LOS TEMAS CON COLORES FIJOS */}
        {!user && (
          <>
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Tests Auxiliar Administrativo Estado
              </h1>
              <p className="text-gray-600 mb-6">
                Practica con tests mejorados con análisis y métricas con IA
              </p>

              {/* Estadísticas ACTUALIZADAS CON TODOS LOS TEMAS */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-xl mx-auto">
                <div className="bg-white rounded-lg shadow-md p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">16</div>
                  <div className="text-sm text-gray-600">Temas disponibles</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">Tests</div>
                  <div className="text-sm text-gray-600">Personalizables</div>
                </div>
              </div>
            </div>

            {/* Tests por Tema - TODOS LOS LINKS DINÁMICOS ACTUALIZADOS */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                📚 Tests Disponibles
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                
                {/* TEMA 1 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🏛️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 1</h3>
                        <p className="text-sm opacity-90">La Constitución Española de 1978</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/1"
                        className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-indigo-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-1"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 2 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-red-600 to-orange-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">⚖️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 2</h3>
                        <p className="text-sm opacity-90">El Tribunal Constitucional. La Corona</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/2"
                        className="block w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-red-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-2"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 3 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🏛️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 3</h3>
                        <p className="text-sm opacity-90">Las Cortes Generales</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/3"
                        className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-emerald-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-3"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 5 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-teal-600 to-cyan-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🏛️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 5</h3>
                        <p className="text-sm opacity-90">El Gobierno y la Administración</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/5"
                        className="block w-full bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-teal-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-5"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 6 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🌍</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 6</h3>
                        <p className="text-sm opacity-90">El Gobierno Abierto. Agenda 2030</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/6"
                        className="block w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-purple-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-6"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 7 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">📜</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 7</h3>
                        <p className="text-sm opacity-90">Ley 19/2013 de Transparencia</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/7"
                        className="block w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-blue-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-7"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 8 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🏛️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 8</h3>
                        <p className="text-sm opacity-90">La Administración General del Estado</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/8"
                        className="block w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-green-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-8"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 9 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-yellow-600 to-orange-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🗺️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 9</h3>
                        <p className="text-sm opacity-90">La Organización Territorial del Estado</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/9"
                        className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-yellow-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-9"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 10 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-pink-600 to-purple-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🇪🇺</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 10</h3>
                        <p className="text-sm opacity-90">La Organización de la Unión Europea</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/10"
                        className="block w-full bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-pink-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-10"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 11 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-rose-600 to-red-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">⚖️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 11</h3>
                        <p className="text-sm opacity-90">Las Leyes del Procedimiento Administrativo Común</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/11"
                        className="block w-full bg-rose-600 hover:bg-rose-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-rose-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-11"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 12 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-lime-600 to-green-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">🔒</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 12</h3>
                        <p className="text-sm opacity-90">La Protección de Datos Personales</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/12"
                        className="block w-full bg-lime-600 hover:bg-lime-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-lime-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-12"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 13 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-amber-600 to-yellow-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">👥</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 13</h3>
                        <p className="text-sm opacity-90">El Personal Funcionario de las Administraciones Públicas</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/13"
                        className="block w-full bg-amber-600 hover:bg-amber-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-amber-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-13"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 14 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">⚖️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 14</h3>
                        <p className="text-sm opacity-90">Derechos y Deberes de los Funcionarios</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/14"
                        className="block w-full bg-violet-600 hover:bg-violet-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-violet-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-14"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 15 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">💰</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 15</h3>
                        <p className="text-sm opacity-90">El Presupuesto del Estado en España</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/15"
                        className="block w-full bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-cyan-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-15"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* TEMA 16 */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                  <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 p-4">
                    <div className="flex items-center text-white">
                      <span className="text-2xl mr-3">⚖️</span>
                      <div>
                        <h3 className="font-bold text-lg">Tema 16</h3>
                        <p className="text-sm opacity-90">Políticas de Igualdad y contra la Violencia de Género</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-semibold">
                        ✅ Disponible
                      </span>
                      <span className="text-sm text-gray-600">Tests personalizables</span>
                    </div>
                    
                    <div className="space-y-2">
                      <Link
                        href="/es/auxiliar-administrativo-estado/test/tema/16"
                        className="block w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-3 focus:ring-fuchsia-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">🔥</span>
                          Empezar Tests
                        </span>
                      </Link>
                      <Link
                        href="/es/auxiliar-administrativo-estado/temario/tema-16"
                        className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-center font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md active:scale-95 focus:outline-none focus:ring-3 focus:ring-gray-300 group"
                      >
                        <span className="inline-flex items-center justify-center">
                          <span className="mr-2 group-hover:animate-pulse">📖</span>
                          Ver Temario
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Call to Action para usuarios no logueados */}
            <section className="mb-12">
              <div className="max-w-2xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white text-center">
                <h2 className="text-2xl font-bold mb-4">🔓 Desbloquea tu Progreso</h2>
                <p className="mb-6 opacity-90">
                  Regístrate gratis para guardar tu progreso, ver estadísticas detalladas y acceder a funciones exclusivas
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/es/login"
                    className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-white/50 group"
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="mr-2 group-hover:animate-bounce">📝</span>
                      Registrarse Gratis
                    </span>
                  </Link>
                  <Link
                    href="/es/login"
                    className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-400/50 group"
                  >
                    <span className="inline-flex items-center justify-center">
                      <span className="mr-2 group-hover:animate-pulse">🔑</span>
                      Iniciar Sesión
                    </span>
                  </Link>
                </div>
              </div>
            </section>
          </>
        )}

        {/* Modal informativo sobre estadísticas históricas */}
        {showStatsInfo && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <span className="mr-2">📊</span>
                  Estadísticas Históricas
                </h3>
                <button
                  onClick={() => setShowStatsInfo(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                  <p className="font-medium text-blue-800 mb-2">¿Qué representan estos porcentajes?</p>
                  <p className="text-blue-700">
                    Los porcentajes mostrados aquí son tus <strong>estadísticas históricas totales</strong> 
                    para cada tema, incluyendo todas las respuestas que has dado a lo largo del tiempo.
                  </p>
                </div>
                
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
                  <p className="font-medium text-yellow-800 mb-2">Diferencia con "Mis Estadísticas"</p>
                  <p className="text-yellow-700">
                    En la página <strong>"Mis Estadísticas"</strong> verás los resultados de tests 
                    individuales completados, que pueden ser diferentes a estos porcentajes históricos.
                  </p>
                </div>
                
                <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded">
                  <p className="font-medium text-green-800 mb-2">¿Por qué pueden diferir?</p>
                  <p className="text-green-700">
                    Las estadísticas históricas incluyen tests abandonados y respuestas sueltas, 
                    mientras que "Mis Estadísticas" muestra solo tests completados al 100%.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowStatsInfo(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
