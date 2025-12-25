// app/administrativo-estado/test/page.js - Hub de tests Administrativo del Estado (C1)
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export default function TestsAdministrativoEstado() {
  const { user, loading, supabase } = useAuth()
  const router = useRouter()
  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('tema')
  const [showStatsInfo, setShowStatsInfo] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState(() => {
    // Intentar recuperar estado guardado del localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('administrativo-estado-expanded-blocks')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          // Si hay error, usar estado por defecto
        }
      }
    }
    return {
      bloque1: false,
      bloque2: false,
      bloque3: false,
      bloque4: false,
      bloque5: false,
      bloque6: false
    }
  })

  // TODO: Cargar estadísticas del usuario cuando haya preguntas de administrativo-estado
  // Por ahora desactivado para no mezclar stats de otras oposiciones
  // useEffect(() => {
  //   if (user && !loading) {
  //     loadUserThemeStats(user.id)
  //   }
  // }, [user, loading])

  const loadUserThemeStats = async (userId) => {
    setStatsLoading(true)
    try {
      const { getSupabaseClient } = await import('../../../lib/supabase')
      const supabase = getSupabaseClient()

      // TODO: Crear función RPC específica para administrativo-estado
      // Por ahora usar estructura vacía
      const { data: themeStatsData, error } = await supabase
        .rpc('get_user_theme_stats', { p_user_id: userId })

      if (!error && themeStatsData) {
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
        setUserStats(themeStats)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 90) return 'green'
    if (accuracy >= 75) return 'emerald'
    if (accuracy >= 60) return 'yellow'
    if (accuracy >= 40) return 'orange'
    return 'red'
  }

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

  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => {
      const newState = {
        ...prev,
        [blockId]: !prev[blockId]
      }
      // Guardar en localStorage para recordar el estado
      localStorage.setItem('administrativo-estado-expanded-blocks', JSON.stringify(newState))
      return newState
    })
  }

  // Definición de los 6 bloques con 45 temas según BOE 22/12/2025
  const getThemesByBlock = () => {
    const basePath = '/administrativo-estado/test/tema'

    // Bloque I: Organización del Estado y de la Administración pública (11 temas)
    const bloque1Themes = [
      { id: 1, title: 'La Constitución Española de 1978', href: `${basePath}/1` },
      { id: 2, title: 'La Jefatura del Estado. La Corona', href: `${basePath}/2` },
      { id: 3, title: 'Las Cortes Generales', href: `${basePath}/3` },
      { id: 4, title: 'El Poder Judicial', href: `${basePath}/4` },
      { id: 5, title: 'El Gobierno y la Administración', href: `${basePath}/5` },
      { id: 6, title: 'El Gobierno Abierto. Agenda 2030', href: `${basePath}/6` },
      { id: 7, title: 'La Ley 19/2013 de Transparencia', href: `${basePath}/7` },
      { id: 8, title: 'La Administración General del Estado', href: `${basePath}/8` },
      { id: 9, title: 'La Organización Territorial del Estado', href: `${basePath}/9` },
      { id: 10, title: 'La Administración Local', href: `${basePath}/10` },
      { id: 11, title: 'La Organización de la Unión Europea', href: `${basePath}/11` }
    ]

    // Bloque II: Organización de oficinas públicas (4 temas)
    const bloque2Themes = [
      { id: 12, title: 'Atención al Público', href: `${basePath}/12`, displayNumber: 1 },
      { id: 13, title: 'Documento, Registro y Archivo', href: `${basePath}/13`, displayNumber: 2 },
      { id: 14, title: 'Administración Electrónica', href: `${basePath}/14`, displayNumber: 3 },
      { id: 15, title: 'Protección de Datos Personales', href: `${basePath}/15`, displayNumber: 4 }
    ]

    // Bloque III: Derecho administrativo general (7 temas)
    const bloque3Themes = [
      { id: 16, title: 'Las Fuentes del Derecho Administrativo', href: `${basePath}/16`, displayNumber: 1 },
      { id: 17, title: 'El Acto Administrativo', href: `${basePath}/17`, displayNumber: 2 },
      { id: 18, title: 'Las Leyes del Procedimiento Administrativo', href: `${basePath}/18`, displayNumber: 3 },
      { id: 19, title: 'Los Contratos del Sector Público', href: `${basePath}/19`, displayNumber: 4 },
      { id: 20, title: 'Procedimientos y Formas de la Actividad Administrativa', href: `${basePath}/20`, displayNumber: 5 },
      { id: 21, title: 'La Responsabilidad Patrimonial', href: `${basePath}/21`, displayNumber: 6 },
      { id: 22, title: 'Políticas de Igualdad', href: `${basePath}/22`, displayNumber: 7 }
    ]

    // Bloque IV: Gestión de personal (9 temas)
    const bloque4Themes = [
      { id: 23, title: 'El Personal al Servicio de las Administraciones Públicas', href: `${basePath}/23`, displayNumber: 1 },
      { id: 24, title: 'Selección de Personal', href: `${basePath}/24`, displayNumber: 2 },
      { id: 25, title: 'El Personal Funcionario', href: `${basePath}/25`, displayNumber: 3 },
      { id: 26, title: 'Adquisición y Pérdida de la Condición de Funcionario', href: `${basePath}/26`, displayNumber: 4 },
      { id: 27, title: 'Provisión de Puestos de Trabajo', href: `${basePath}/27`, displayNumber: 5 },
      { id: 28, title: 'Las Incompatibilidades y Régimen Disciplinario', href: `${basePath}/28`, displayNumber: 6 },
      { id: 29, title: 'El Régimen de la Seguridad Social de los Funcionarios', href: `${basePath}/29`, displayNumber: 7 },
      { id: 30, title: 'El Personal Laboral', href: `${basePath}/30`, displayNumber: 8 },
      { id: 31, title: 'El Régimen de la Seguridad Social del Personal Laboral', href: `${basePath}/31`, displayNumber: 9 }
    ]

    // Bloque V: Gestión financiera (6 temas)
    const bloque5Themes = [
      { id: 32, title: 'El Presupuesto', href: `${basePath}/32`, displayNumber: 1 },
      { id: 33, title: 'El Presupuesto del Estado en España', href: `${basePath}/33`, displayNumber: 2 },
      { id: 34, title: 'El Procedimiento de Ejecución del Presupuesto de Gasto', href: `${basePath}/34`, displayNumber: 3 },
      { id: 35, title: 'Las Retribuciones e Indemnizaciones', href: `${basePath}/35`, displayNumber: 4 },
      { id: 36, title: 'Gastos para la Compra de Bienes y Servicios', href: `${basePath}/36`, displayNumber: 5 },
      { id: 37, title: 'Gestión Económica y Financiera', href: `${basePath}/37`, displayNumber: 6 }
    ]

    // Bloque VI: Informática básica y ofimática (8 temas)
    const bloque6Themes = [
      { id: 38, title: 'Informática Básica', href: `${basePath}/38`, displayNumber: 1 },
      { id: 39, title: 'Sistema Operativo Windows', href: `${basePath}/39`, displayNumber: 2 },
      { id: 40, title: 'El Explorador de Windows', href: `${basePath}/40`, displayNumber: 3 },
      { id: 41, title: 'Procesadores de Texto: Word 365', href: `${basePath}/41`, displayNumber: 4 },
      { id: 42, title: 'Hojas de Cálculo: Excel 365', href: `${basePath}/42`, displayNumber: 5 },
      { id: 43, title: 'Bases de Datos: Access 365', href: `${basePath}/43`, displayNumber: 6 },
      { id: 44, title: 'Correo Electrónico: Outlook 365', href: `${basePath}/44`, displayNumber: 7 },
      { id: 45, title: 'La Red Internet', href: `${basePath}/45`, displayNumber: 8 }
    ]

    const processThemes = (themes) => {
      return themes.map(theme => {
        const stats = userStats[theme.id]
        const accuracy = stats ? stats.accuracy : 0
        const color = stats ? getAccuracyColor(accuracy) : 'gray'
        return { ...theme, color, accuracy }
      })
    }

    return {
      bloque1: processThemes(bloque1Themes),
      bloque2: processThemes(bloque2Themes),
      bloque3: processThemes(bloque3Themes),
      bloque4: processThemes(bloque4Themes),
      bloque5: processThemes(bloque5Themes),
      bloque6: processThemes(bloque6Themes)
    }
  }

  // Componente reutilizable para renderizar un bloque
  const renderBlock = (blockId, icon, title, themes, temasCount, color = 'blue') => {
    const gradientColors = {
      blue: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-300',
      green: 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:ring-green-300',
      purple: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:ring-purple-300',
      orange: 'from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 focus:ring-orange-300',
      red: 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:ring-red-300',
      indigo: 'from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:ring-indigo-300'
    }

    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={() => toggleBlock(blockId)}
          className={`w-full bg-gradient-to-r ${gradientColors[color]} text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 focus:outline-none focus:ring-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="mr-3 text-xl">{icon}</span>
              <span>{title}</span>
              <span className="ml-3 bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                {temasCount} temas
              </span>
            </div>
            <span className={`text-2xl transition-transform duration-300 ${expandedBlocks[blockId] ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>

        {expandedBlocks[blockId] && (
          <div className="p-4 space-y-3 bg-gray-50">
            {themes.map((theme) => {
              const hasStats = !!userStats[theme.id]
              return (
                <Link
                  key={theme.id}
                  href={theme.href}
                  className={`block py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 group ${
                    hasStats
                      ? `${getColorClasses(theme.color)} text-white`
                      : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 focus:ring-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>Tema {theme.displayNumber || theme.id}: {theme.title}</span>
                    <div className="flex items-center space-x-3">
                      {hasStats && (
                        <>
                          <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                            {userStats[theme.id].accuracy}% ({userStats[theme.id].correct}/{userStats[theme.id].total})
                          </span>
                          <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                            {userStats[theme.id].lastStudyFormatted}
                          </span>
                        </>
                      )}
                      {!hasStats && (
                        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
                          Empezar
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

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

  const blocks = getThemesByBlock()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {user && <InteractiveBreadcrumbs />}

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-4xl w-full">
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-2 rounded-full text-sm font-medium mb-6">
                <span className="mr-2">🏢</span>
                Administrativo del Estado (C1)
              </div>
            </div>

            {/* Leyenda de colores */}
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

            {/* Bloques de temas */}
            <div className="space-y-6">
              {/* Test Aleatorio */}
              <Link
                href="/administrativo-estado/test/aleatorio"
                className="block bg-gradient-to-r from-gray-800 to-gray-900 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-gray-400 group"
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

              {/* Bloque I: Organización del Estado */}
              {renderBlock('bloque1', '🏛️', 'Bloque I: Organización del Estado', blocks.bloque1, 11, 'blue')}

              {/* Bloque II: Organización de Oficinas Públicas */}
              {renderBlock('bloque2', '📋', 'Bloque II: Organización de Oficinas Públicas', blocks.bloque2, 4, 'blue')}

              {/* Bloque III: Derecho Administrativo General */}
              {renderBlock('bloque3', '⚖️', 'Bloque III: Derecho Administrativo General', blocks.bloque3, 7, 'blue')}

              {/* Bloque IV: Gestión de Personal */}
              {renderBlock('bloque4', '👥', 'Bloque IV: Gestión de Personal', blocks.bloque4, 9, 'blue')}

              {/* Bloque V: Gestión Financiera */}
              {renderBlock('bloque5', '💰', 'Bloque V: Gestión Financiera', blocks.bloque5, 6, 'blue')}

              {/* Bloque VI: Informática Básica y Ofimática */}
              {renderBlock('bloque6', '💻', 'Bloque VI: Informática Básica y Ofimática', blocks.bloque6, 8, 'blue')}
            </div>

            {/* Modal de información */}
            {showStatsInfo && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Estadísticas de Rendimiento</h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p><strong>Porcentaje de aciertos:</strong> (correctas / total) × 100</p>
                    <p><strong>Respuestas:</strong> Formato (correctas/total)</p>
                    <p><strong>Último estudio:</strong> Fecha de tu última sesión</p>
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-blue-800 font-medium">💡 Consejo</p>
                      <p className="text-blue-700">Practica los temas con menor porcentaje.</p>
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
