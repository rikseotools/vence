// app/tramitacion-procesal/test/page.tsx - Hub de tests Tramitación Procesal (C1)
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

// Definición de los 3 bloques con 37 temas según BOE 30/12/2025
const BASE_PATH = '/tramitacion-procesal/test/tema'

interface Theme {
  id: number
  title: string
  href: string
  displayNumber?: number
  color?: string
  accuracy?: number
}

interface ThemeStats {
  total: number
  correct: number
  accuracy: number
  lastStudy: Date | null
  lastStudyFormatted: string
}

const BLOQUE1_THEMES: Theme[] = [
  { id: 1, title: 'La Constitución Española de 1978', href: `${BASE_PATH}/1` },
  { id: 2, title: 'Igualdad y no discriminación por razón de género', href: `${BASE_PATH}/2` },
  { id: 3, title: 'El Gobierno y la Administración', href: `${BASE_PATH}/3` },
  { id: 4, title: 'Organización territorial del Estado', href: `${BASE_PATH}/4` },
  { id: 5, title: 'La Unión Europea', href: `${BASE_PATH}/5` },
  { id: 6, title: 'El Poder Judicial', href: `${BASE_PATH}/6` },
  { id: 7, title: 'Organización y competencia de los órganos judiciales (I)', href: `${BASE_PATH}/7` },
  { id: 8, title: 'Organización y competencia de los órganos judiciales (II)', href: `${BASE_PATH}/8` },
  { id: 9, title: 'Carta de Derechos de los Ciudadanos ante la Justicia', href: `${BASE_PATH}/9` },
  { id: 10, title: 'La modernización de la oficina judicial', href: `${BASE_PATH}/10` },
  { id: 11, title: 'El Letrado de la Administración de Justicia', href: `${BASE_PATH}/11` },
  { id: 12, title: 'Los Cuerpos de funcionarios', href: `${BASE_PATH}/12` },
  { id: 13, title: 'Los Cuerpos Generales (I)', href: `${BASE_PATH}/13` },
  { id: 14, title: 'Los Cuerpos Generales (II)', href: `${BASE_PATH}/14` },
  { id: 15, title: 'Libertad sindical', href: `${BASE_PATH}/15` }
]

const BLOQUE2_THEMES: Theme[] = [
  { id: 16, title: 'Los procedimientos declarativos en la LEC', href: `${BASE_PATH}/16` },
  { id: 17, title: 'Los procedimientos de ejecución en la LEC', href: `${BASE_PATH}/17` },
  { id: 18, title: 'Los procesos especiales en la LEC', href: `${BASE_PATH}/18` },
  { id: 19, title: 'La jurisdicción voluntaria', href: `${BASE_PATH}/19` },
  { id: 20, title: 'Los procedimientos penales (I)', href: `${BASE_PATH}/20` },
  { id: 21, title: 'Los procedimientos penales (II)', href: `${BASE_PATH}/21` },
  { id: 22, title: 'El recurso contencioso-administrativo', href: `${BASE_PATH}/22` },
  { id: 23, title: 'El proceso laboral', href: `${BASE_PATH}/23` },
  { id: 24, title: 'Los recursos', href: `${BASE_PATH}/24` },
  { id: 25, title: 'Los actos procesales', href: `${BASE_PATH}/25` },
  { id: 26, title: 'Las resoluciones de los órganos judiciales', href: `${BASE_PATH}/26` },
  { id: 27, title: 'Los actos de comunicación con otros tribunales', href: `${BASE_PATH}/27` },
  { id: 28, title: 'Los actos de comunicación a las partes', href: `${BASE_PATH}/28` },
  { id: 29, title: 'El Registro Civil (I)', href: `${BASE_PATH}/29` },
  { id: 30, title: 'El Registro Civil (II)', href: `${BASE_PATH}/30` },
  { id: 31, title: 'El archivo judicial y la documentación', href: `${BASE_PATH}/31` }
]

const BLOQUE3_THEMES: Theme[] = [
  { id: 32, title: 'Informática básica', href: `${BASE_PATH}/32` },
  { id: 33, title: 'Sistema operativo Windows', href: `${BASE_PATH}/33` },
  { id: 34, title: 'El explorador de Windows', href: `${BASE_PATH}/34` },
  { id: 35, title: 'Procesadores de texto: Word 365', href: `${BASE_PATH}/35` },
  { id: 36, title: 'Correo electrónico: Outlook 365', href: `${BASE_PATH}/36` },
  { id: 37, title: 'La Red Internet', href: `${BASE_PATH}/37` }
]

// Helpers de colores
const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 90) return 'green'
  if (accuracy >= 75) return 'emerald'
  if (accuracy >= 60) return 'yellow'
  if (accuracy >= 40) return 'orange'
  return 'red'
}

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-green-600 hover:bg-green-700 focus:ring-green-300',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
  yellow: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300',
  orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-300',
  red: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
  gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-300'
}

const BLOCK_GRADIENT = 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-300'

export default function TestsTramitacionProcesal() {
  const { user, loading } = useAuth() as { user: { id: string } | null; loading: boolean }
  const [userStats, setUserStats] = useState<Record<number, ThemeStats>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('tema')
  const [showStatsInfo, setShowStatsInfo] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('tramitacion-procesal-expanded-blocks')
        if (saved) return JSON.parse(saved)
      } catch {
        // localStorage bloqueado
      }
    }
    return { bloque1: true, bloque2: false, bloque3: false }
  })

  // Cargar estadísticas usando la API
  const loadUserThemeStats = useCallback(async (userId: string) => {
    setStatsLoading(true)
    try {
      const response = await fetch(`/api/user/theme-stats?userId=${userId}&positionType=tramitacion_procesal`)
      const data = await response.json()

      if (data.success && data.stats) {
        const themeStats: Record<number, ThemeStats> = {}
        Object.entries(data.stats).forEach(([temaNumber, stat]: [string, any]) => {
          themeStats[parseInt(temaNumber)] = {
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

  useEffect(() => {
    if (user?.id && !loading) {
      loadUserThemeStats(user.id)
    }
  }, [user?.id, loading, loadUserThemeStats])

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const newState = { ...prev, [blockId]: !prev[blockId] }
      try {
        localStorage.setItem('tramitacion-procesal-expanded-blocks', JSON.stringify(newState))
      } catch {
        // localStorage bloqueado
      }
      return newState
    })
  }

  // Procesar temas con estadísticas
  const getThemesByBlock = useCallback(() => {
    const processThemes = (themes: Theme[]): Theme[] => {
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
      bloque3: processThemes(BLOQUE3_THEMES)
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
                <span className="mr-2">⚖️</span>
                Tramitación Procesal (C1)
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

            {/* Bloques de temas */}
            <div className="space-y-6">
              {/* Test Aleatorio */}
              <Link
                href="/tramitacion-procesal/test/aleatorio"
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
                icon="⚖️"
                title="Bloque I: Organización del Estado y Administración de Justicia"
                themes={blocks.bloque1}
                temasCount={15}
                expanded={expandedBlocks.bloque1}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque II */}
              <BlockSection
                blockId="bloque2"
                icon="📜"
                title="Bloque II: Derecho Procesal"
                themes={blocks.bloque2}
                temasCount={16}
                expanded={expandedBlocks.bloque2}
                onToggle={toggleBlock}
                userStats={userStats}
                onInfoClick={() => setShowStatsInfo(true)}
              />

              {/* Bloque III */}
              <BlockSection
                blockId="bloque3"
                icon="💻"
                title="Bloque III: Informática"
                themes={blocks.bloque3}
                temasCount={6}
                expanded={expandedBlocks.bloque3}
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
interface BlockSectionProps {
  blockId: string
  icon: string
  title: string
  themes: Theme[]
  temasCount: number
  expanded: boolean
  onToggle: (blockId: string) => void
  userStats: Record<number, ThemeStats>
  onInfoClick: () => void
}

function BlockSection({ blockId, icon, title, themes, temasCount, expanded, onToggle, userStats, onInfoClick }: BlockSectionProps) {
  const anchorMap: Record<string, string> = {
    bloque1: 'bloque-i',
    bloque2: 'bloque-ii',
    bloque3: 'bloque-iii'
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
interface ThemeLinkProps {
  theme: Theme
  stats: ThemeStats | undefined
  onInfoClick: () => void
}

function ThemeLink({ theme, stats, onInfoClick }: ThemeLinkProps) {
  const hasStats = !!stats

  return (
    <Link
      href={theme.href}
      className={`block py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 group ${
        hasStats
          ? `${COLOR_CLASSES[theme.color || 'gray']} text-white`
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
