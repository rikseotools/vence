// components/test/TestHubClient.tsx - Client Component para interactividad
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import CcaaFlag, { hasCcaaFlag } from '@/components/CcaaFlag'

interface Topic {
  id: string
  topicNumber: number
  title: string
  description: string | null
  hasContent: boolean
}

interface Bloque {
  id: string
  name: string
  icon: string
  min: number
  max: number
  topics: Topic[]
}

interface OposicionInfo {
  short: string
  badge: string
  icon: string
  oposicionId?: string
}

interface ThemeStats {
  total: number
  correct: number
  accuracy: number
  lastStudy: Date | null
  lastStudyFormatted: string
}

interface Props {
  oposicion: string
  oposicionInfo: OposicionInfo
  bloques: Bloque[]
  basePath: string
  positionType: string
}

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

export default function TestHubClient({ oposicion, oposicionInfo, bloques, basePath, positionType }: Props) {
  const { user, loading } = useAuth() as { user: { id: string } | null; loading: boolean }
  const [userStats, setUserStats] = useState<Record<number, ThemeStats>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [showStatsInfo, setShowStatsInfo] = useState(false)

  // Estado de bloques expandidos (localStorage)
  const storageKey = `${oposicion}-expanded-blocks`
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) return JSON.parse(saved)
      } catch {
        // localStorage bloqueado
      }
    }
    // Por defecto: primer bloque expandido
    const defaults: Record<string, boolean> = {}
    bloques.forEach((b, i) => { defaults[b.id] = i === 0 })
    return defaults
  })

  // Cargar estadísticas del usuario usando API V2 con derivación dinámica por oposición
  const loadUserThemeStats = useCallback(async (userId: string) => {
    setStatsLoading(true)
    try {
      // V2: Pasar oposicionId para derivar tema desde article_id + topic_scope
      const response = await fetch(`/api/user/theme-stats?userId=${userId}&oposicionId=${oposicion}`)
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
  }, [oposicion])

  useEffect(() => {
    if (user?.id && !loading) {
      loadUserThemeStats(user.id)
    }
  }, [user?.id, loading, loadUserThemeStats])

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const newState = { ...prev, [blockId]: !prev[blockId] }
      try {
        localStorage.setItem(storageKey, JSON.stringify(newState))
      } catch {
        // localStorage bloqueado
      }
      return newState
    })
  }

  // Obtener color del tema basado en stats
  const getThemeColor = (topicNumber: number): string => {
    const stats = userStats[topicNumber]
    return stats ? getAccuracyColor(stats.accuracy) : 'gray'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-4xl w-full">
            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-2 rounded-full text-sm font-medium mb-6">
                {oposicionInfo.oposicionId && hasCcaaFlag(oposicionInfo.oposicionId) ? (
                  <CcaaFlag oposicionId={oposicionInfo.oposicionId} className="mr-2" />
                ) : (
                  <span className="mr-2">{oposicionInfo.icon}</span>
                )}
                {oposicionInfo.short} ({oposicionInfo.badge})
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
                href={`/${oposicion}/test/aleatorio`}
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

              {/* Bloques dinámicos */}
              {bloques.map((bloque) => (
                <BlockSection
                  key={bloque.id}
                  blockId={bloque.id}
                  icon={bloque.icon}
                  title={bloque.name}
                  topics={bloque.topics}
                  basePath={basePath}
                  expanded={expandedBlocks[bloque.id] ?? false}
                  onToggle={toggleBlock}
                  userStats={userStats}
                  getThemeColor={getThemeColor}
                  onInfoClick={() => setShowStatsInfo(true)}
                />
              ))}
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
  topics: Topic[]
  basePath: string
  expanded: boolean
  onToggle: (blockId: string) => void
  userStats: Record<number, ThemeStats>
  getThemeColor: (topicNumber: number) => string
  onInfoClick: () => void
}

function BlockSection({
  blockId,
  icon,
  title,
  topics,
  basePath,
  expanded,
  onToggle,
  userStats,
  getThemeColor,
  onInfoClick
}: BlockSectionProps) {
  // Anchor para navegación
  const anchorMap: Record<string, string> = {
    bloque1: 'bloque-i',
    bloque2: 'bloque-ii',
    bloque3: 'bloque-iii',
    bloque4: 'bloque-iv',
    bloque5: 'bloque-v',
    bloque6: 'bloque-vi',
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
              {topics.length} temas
            </span>
          </div>
          <span className={`text-2xl transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-gray-50">
          {topics.map((topic) => (
            <ThemeLink
              key={topic.id}
              topic={topic}
              basePath={basePath}
              stats={userStats[topic.topicNumber]}
              color={getThemeColor(topic.topicNumber)}
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
  topic: Topic
  basePath: string
  stats: ThemeStats | undefined
  color: string
  onInfoClick: () => void
}

function ThemeLink({ topic, basePath, stats, color, onInfoClick }: ThemeLinkProps) {
  const hasStats = !!stats
  const href = `${basePath}/${topic.topicNumber}`

  // Tema sin contenido: mostrar como deshabilitado
  if (!topic.hasContent) {
    return (
      <div
        className="block py-3 px-6 rounded-lg font-semibold bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-70"
      >
        <div className="flex items-center justify-between">
          <span>Tema {topic.topicNumber}: {topic.title}</span>
          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
            En desarrollo
          </span>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={href}
      className={`block py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 group ${
        hasStats
          ? `${COLOR_CLASSES[color]} text-white`
          : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 focus:ring-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <span>Tema {topic.topicNumber}: {topic.title}</span>
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
