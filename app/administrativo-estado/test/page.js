// app/administrativo-estado/test/page.js - Hub de tests Administrativo del Estado (C1) - Optimizado con API Layer
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

// Definición de los 6 bloques con 45 temas según BOE 22/12/2025
const BASE_PATH = '/administrativo-estado/test/tema'

const BLOQUE1_THEMES = [
  { id: 1, title: 'La Constitución Española de 1978', href: `${BASE_PATH}/1` },
  { id: 2, title: 'La Jefatura del Estado. La Corona', href: `${BASE_PATH}/2` },
  { id: 3, title: 'Las Cortes Generales', href: `${BASE_PATH}/3` },
  { id: 4, title: 'El Poder Judicial', href: `${BASE_PATH}/4` },
  { id: 5, title: 'El Gobierno y la Administración', href: `${BASE_PATH}/5` },
  { id: 6, title: 'El Gobierno Abierto. Agenda 2030', href: `${BASE_PATH}/6` },
  { id: 7, title: 'La Ley 19/2013 de Transparencia', href: `${BASE_PATH}/7` },
  { id: 8, title: 'La Administración General del Estado', href: `${BASE_PATH}/8` },
  { id: 9, title: 'La Organización Territorial del Estado', href: `${BASE_PATH}/9` },
  { id: 10, title: 'La Administración Local', href: `${BASE_PATH}/10` },
  { id: 11, title: 'La Organización de la Unión Europea', href: `${BASE_PATH}/11` }
]

const BLOQUE2_THEMES = [
  { id: 201, title: 'Atención al Público', href: `${BASE_PATH}/201`, displayNumber: 1 },
  { id: 202, title: 'Documento, Registro y Archivo', href: `${BASE_PATH}/202`, displayNumber: 2 },
  { id: 203, title: 'Administración Electrónica', href: `${BASE_PATH}/203`, displayNumber: 3 },
  { id: 204, title: 'Protección de Datos Personales', href: `${BASE_PATH}/204`, displayNumber: 4 }
]

const BLOQUE3_THEMES = [
  { id: 301, title: 'Las Fuentes del Derecho Administrativo', href: `${BASE_PATH}/301`, displayNumber: 1 },
  { id: 302, title: 'El Acto Administrativo', href: `${BASE_PATH}/302`, displayNumber: 2 },
  { id: 303, title: 'Las Leyes del Procedimiento Administrativo', href: `${BASE_PATH}/303`, displayNumber: 3 },
  { id: 304, title: 'Los Contratos del Sector Público', href: `${BASE_PATH}/304`, displayNumber: 4 },
  { id: 305, title: 'Procedimientos y Formas de la Actividad Administrativa', href: `${BASE_PATH}/305`, displayNumber: 5 },
  { id: 306, title: 'La Responsabilidad Patrimonial', href: `${BASE_PATH}/306`, displayNumber: 6 },
  { id: 307, title: 'Políticas de Igualdad', href: `${BASE_PATH}/307`, displayNumber: 7 }
]

const BLOQUE4_THEMES = [
  { id: 401, title: 'El Personal al Servicio de las Administraciones Públicas', href: `${BASE_PATH}/401`, displayNumber: 1 },
  { id: 402, title: 'Selección de Personal', href: `${BASE_PATH}/402`, displayNumber: 2 },
  { id: 403, title: 'El Personal Funcionario', href: `${BASE_PATH}/403`, displayNumber: 3 },
  { id: 404, title: 'Adquisición y Pérdida de la Condición de Funcionario', href: `${BASE_PATH}/404`, displayNumber: 4 },
  { id: 405, title: 'Provisión de Puestos de Trabajo', href: `${BASE_PATH}/405`, displayNumber: 5 },
  { id: 406, title: 'Las Incompatibilidades y Régimen Disciplinario', href: `${BASE_PATH}/406`, displayNumber: 6 },
  { id: 407, title: 'El Régimen de la Seguridad Social de los Funcionarios', href: `${BASE_PATH}/407`, displayNumber: 7 },
  { id: 408, title: 'El Personal Laboral', href: `${BASE_PATH}/408`, displayNumber: 8 },
  { id: 409, title: 'El Régimen de la Seguridad Social del Personal Laboral', href: `${BASE_PATH}/409`, displayNumber: 9 }
]

const BLOQUE5_THEMES = [
  { id: 501, title: 'El Presupuesto', href: `${BASE_PATH}/501`, displayNumber: 1 },
  { id: 502, title: 'El Presupuesto del Estado en España', href: `${BASE_PATH}/502`, displayNumber: 2 },
  { id: 503, title: 'El Procedimiento de Ejecución del Presupuesto de Gasto', href: `${BASE_PATH}/503`, displayNumber: 3 },
  { id: 504, title: 'Las Retribuciones e Indemnizaciones', href: `${BASE_PATH}/504`, displayNumber: 4 },
  { id: 505, title: 'Gastos para la Compra de Bienes y Servicios', href: `${BASE_PATH}/505`, displayNumber: 5 },
  { id: 506, title: 'Gestión Económica y Financiera', href: `${BASE_PATH}/506`, displayNumber: 6 }
]

const BLOQUE6_THEMES = [
  { id: 601, title: 'Informática Básica', href: `${BASE_PATH}/601`, displayNumber: 1 },
  { id: 602, title: 'Sistema Operativo Windows', href: `${BASE_PATH}/602`, displayNumber: 2 },
  { id: 603, title: 'El Explorador de Windows', href: `${BASE_PATH}/603`, displayNumber: 3 },
  { id: 604, title: 'Procesadores de Texto: Word 365', href: `${BASE_PATH}/604`, displayNumber: 4 },
  { id: 605, title: 'Hojas de Cálculo: Excel 365', href: `${BASE_PATH}/605`, displayNumber: 5 },
  { id: 606, title: 'Bases de Datos: Access 365', href: `${BASE_PATH}/606`, displayNumber: 6 },
  { id: 607, title: 'Correo Electrónico: Outlook 365', href: `${BASE_PATH}/607`, displayNumber: 7 },
  { id: 608, title: 'La Red Internet', href: `${BASE_PATH}/608`, displayNumber: 8 }
]

// Helpers de colores
const getAccuracyColor = (accuracy) => {
  if (accuracy >= 90) return 'green'
  if (accuracy >= 75) return 'emerald'
  if (accuracy >= 60) return 'yellow'
  if (accuracy >= 40) return 'orange'
  return 'red'
}

const COLOR_CLASSES = {
  green: 'bg-green-600 hover:bg-green-700 focus:ring-green-300',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
  yellow: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300',
  orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-300',
  red: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
  gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-300'
}

const BLOCK_GRADIENT = 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-300'

export default function TestsAdministrativoEstado() {
  const { user, loading } = useAuth()
  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('tema')
  const [showStatsInfo, setShowStatsInfo] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('administrativo-estado-expanded-blocks')
        if (saved) return JSON.parse(saved)
      } catch (e) {
        // localStorage bloqueado
      }
    }
    return { bloque1: true, bloque2: false, bloque3: false, bloque4: false, bloque5: false, bloque6: false }
  })

  // Cargar estadísticas usando la nueva API con Drizzle + Zod
  const loadUserThemeStats = useCallback(async (userId) => {
    setStatsLoading(true)
    try {
      const response = await fetch(`/api/user/theme-stats?userId=${userId}`)
      const data = await response.json()

      if (data.success && data.stats) {
        const themeStats = {}
        Object.entries(data.stats).forEach(([temaNumber, stat]) => {
          themeStats[temaNumber] = {
            total: stat.total,
            correct: stat.correct,
            accuracy: stat.accuracy,
            lastStudy: stat.lastStudy ? new Date(stat.lastStudy) : null,
            lastStudyFormatted: stat.lastStudyFormatted
          }
        })
        setUserStats(themeStats)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas:', error)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // Un solo useEffect - se ejecuta cuando el usuario está disponible
  useEffect(() => {
    if (user?.id && !loading) {
      loadUserThemeStats(user.id)
    }
  }, [user?.id, loading, loadUserThemeStats])

  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => {
      const newState = { ...prev, [blockId]: !prev[blockId] }
      try {
        localStorage.setItem('administrativo-estado-expanded-blocks', JSON.stringify(newState))
      } catch (e) {
        // localStorage bloqueado
      }
      return newState
    })
  }

  // Procesar temas con estadísticas
  const getThemesByBlock = useCallback(() => {
    const processThemes = (themes) => {
      return themes.map(theme => {
        const stats = userStats[theme.id]
        const accuracy = stats ? stats.accuracy : 0
        const color = stats ? getAccuracyColor(accuracy) : 'gray'
        return { ...theme, color, accuracy }
      })
    }

    return {
      bloque1: processThemes(BLOQUE1_THEMES),
      bloque2: processThemes(BLOQUE2_THEMES),
      bloque3: processThemes(BLOQUE3_THEMES),
      bloque4: processThemes(BLOQUE4_THEMES),
      bloque5: processThemes(BLOQUE5_THEMES),
      bloque6: processThemes(BLOQUE6_THEMES)
    }
  }, [userStats])

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
      <InteractiveBreadcrumbs />

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
                  <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                    Personalizable
                  </span>
                </div>
              </Link>

              {/* Bloque I */}
              <BlockSection
                blockId="bloque1"
                icon="🏛️"
                title="Bloque I: Organización del Estado"
                themes={blocks.bloque1}
                temasCount={11}
                expanded={expandedBlocks.bloque1}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque II */}
              <BlockSection
                blockId="bloque2"
                icon="📋"
                title="Bloque II: Organización de Oficinas Públicas"
                themes={blocks.bloque2}
                temasCount={4}
                expanded={expandedBlocks.bloque2}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque III */}
              <BlockSection
                blockId="bloque3"
                icon="⚖️"
                title="Bloque III: Derecho Administrativo General"
                themes={blocks.bloque3}
                temasCount={7}
                expanded={expandedBlocks.bloque3}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque IV */}
              <BlockSection
                blockId="bloque4"
                icon="👥"
                title="Bloque IV: Gestión de Personal"
                themes={blocks.bloque4}
                temasCount={9}
                expanded={expandedBlocks.bloque4}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque V */}
              <BlockSection
                blockId="bloque5"
                icon="💰"
                title="Bloque V: Gestión Financiera"
                themes={blocks.bloque5}
                temasCount={6}
                expanded={expandedBlocks.bloque5}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque VI */}
              <BlockSection
                blockId="bloque6"
                icon="💻"
                title="Bloque VI: Informática Básica y Ofimática"
                themes={blocks.bloque6}
                temasCount={8}
                expanded={expandedBlocks.bloque6}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />
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

// Componente para sección de bloque
function BlockSection({ blockId, icon, title, themes, temasCount, expanded, onToggle, userStats, onInfoClick }) {
  // Mapear blockId a anchor ID para navegación desde breadcrumbs
  const anchorMap = {
    bloque1: 'bloque-i',
    bloque2: 'bloque-ii',
    bloque3: 'bloque-iii',
    bloque4: 'bloque-iv',
    bloque5: 'bloque-v',
    bloque6: 'bloque-vi'
  }
  const anchorId = anchorMap[blockId] || blockId

  return (
    <div id={anchorId} className="bg-white rounded-lg shadow-lg overflow-hidden scroll-mt-20">
      <button
        onClick={() => onToggle(blockId)}
        className={`w-full bg-gradient-to-r ${BLOCK_GRADIENT} text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 focus:outline-none focus:ring-4`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="mr-3 text-xl">{icon}</span>
            <span>{title}</span>
            <span className="ml-3 bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
              {temasCount} temas
            </span>
          </div>
          <span className={`text-2xl transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-gray-50">
          {themes.map((theme) => (
            <ThemeLink
              key={theme.id}
              theme={theme}
              stats={userStats[theme.id]}
              onInfoClick={onInfoClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Componente para enlace de tema
function ThemeLink({ theme, stats, onInfoClick }) {
  const hasStats = !!stats

  return (
    <Link
      href={theme.href}
      className={`block py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 group ${
        hasStats
          ? `${COLOR_CLASSES[theme.color] || COLOR_CLASSES.gray} text-white`
          : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 focus:ring-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <span>Tema {theme.displayNumber || theme.id}: {theme.title}</span>
        <div className="flex items-center space-x-3">
          {hasStats ? (
            <>
              <div className="flex items-center space-x-1">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                  {stats.accuracy}% ({stats.correct}/{stats.total})
                </span>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onInfoClick()
                  }}
                  className="text-white/70 hover:text-white transition-colors p-1"
                  title="¿Qué significa este porcentaje?"
                >
                  ℹ️
                </button>
              </div>
              <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-medium">
                {stats.lastStudyFormatted}
              </span>
            </>
          ) : (
            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
              Empezar
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
