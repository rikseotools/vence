// app/auxiliar-administrativo-estado/test/page.tsx - Migrado a TypeScript
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import ExamActionsDropdown from '@/components/ExamActionsDropdown'
import OposicionChangeModal from '@/components/OposicionChangeModal'

// ============== TYPES ==============

interface AuthContextValue {
  user: { id: string } | null
  loading: boolean
}

interface Theme {
  id: number
  title: string
  href: string
  displayNumber?: number
}

interface ThemeWithStats extends Theme {
  color: ColorKey
  accuracy: number
}

interface ThemeStats {
  total: number
  correct: number
  accuracy: number
  lastStudy: Date | null
  lastStudyFormatted?: string
}

interface ExamStat {
  accuracy: number
  correct: number
  total: number
  lastAttempt: string
}

type ColorKey = 'green' | 'emerald' | 'yellow' | 'orange' | 'red' | 'gray'

type SortOption = 'tema' | 'accuracy_asc' | 'accuracy_desc' | 'last_study_new' | 'last_study_old'

// ============== CONSTANTS ==============

const BLOQUE1_THEMES: Theme[] = [
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
]

const BLOQUE2_THEMES: Theme[] = [
  { id: 101, title: 'Atención al público', href: '/auxiliar-administrativo-estado/test/tema/101', displayNumber: 1 },
  { id: 102, title: 'Los servicios de información administrativa', href: '/auxiliar-administrativo-estado/test/tema/102', displayNumber: 2 },
  { id: 103, title: 'Concepto de documento, registro y archivo', href: '/auxiliar-administrativo-estado/test/tema/103', displayNumber: 3 },
  { id: 104, title: 'Administración electrónica y servicios al ciudadano', href: '/auxiliar-administrativo-estado/test/tema/104', displayNumber: 4 },
  { id: 105, title: 'Informática básica: conceptos fundamentales sobre el hardware y el software', href: '/auxiliar-administrativo-estado/test/tema/105', displayNumber: 5 },
  { id: 106, title: 'Introducción al sistema operativo Windows 11', href: '/auxiliar-administrativo-estado/test/tema/106', displayNumber: 6 },
  { id: 107, title: 'El explorador de Windows 11', href: '/auxiliar-administrativo-estado/test/tema/107', displayNumber: 7 },
  { id: 108, title: 'Procesadores de texto: Word', href: '/auxiliar-administrativo-estado/test/tema/108', displayNumber: 8 },
  { id: 109, title: 'Hojas de cálculo: Excel', href: '/auxiliar-administrativo-estado/test/tema/109', displayNumber: 9 },
  { id: 110, title: 'Bases de datos: Access', href: '/auxiliar-administrativo-estado/test/tema/110', displayNumber: 10 },
  { id: 111, title: 'Correo electrónico: conceptos elementales y funcionamiento', href: '/auxiliar-administrativo-estado/test/tema/111', displayNumber: 11 },
  { id: 112, title: 'La Red Internet', href: '/auxiliar-administrativo-estado/test/tema/112', displayNumber: 12 }
]

const COLOR_CLASSES: Record<ColorKey, string> = {
  green: 'bg-green-600 hover:bg-green-700 focus:ring-green-300',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
  yellow: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-300',
  orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-300',
  red: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
  gray: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-300'
}

// ============== HELPERS ==============

function getAccuracyColor(accuracy: number): ColorKey {
  if (accuracy >= 90) return 'green'
  if (accuracy >= 75) return 'emerald'
  if (accuracy >= 60) return 'yellow'
  if (accuracy >= 40) return 'orange'
  return 'red'
}

/**
 * Get exam stat with fallback to base key (for backwards compatibility)
 * Old exams were saved without 'parte', so we check both:
 * 1. "2024-07-09-primera" (new format with parte)
 * 2. "2024-07-09" (old format without parte)
 */
function getExamStat(
  examStats: Record<string, ExamStat>,
  examDate: string,
  parte?: 'primera' | 'segunda'
): ExamStat | undefined {
  // First try the specific key with parte
  const parteKey = parte ? `${examDate}-${parte}` : examDate
  if (examStats[parteKey]) {
    return examStats[parteKey]
  }
  // Fallback to base key (for old exams without parte)
  return examStats[examDate]
}

// ============== COMPONENTS ==============

interface ThemeLinkProps {
  theme: ThemeWithStats
  stats: ThemeStats | undefined
  onInfoClick: () => void
}

function ThemeLink({ theme, stats, onInfoClick }: ThemeLinkProps) {
  return (
    <Link
      href={theme.href}
      className={`block ${COLOR_CLASSES[theme.color] || COLOR_CLASSES.gray} text-white py-3 px-6 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 group`}
    >
      <div className="flex items-center justify-between">
        <span>Tema {theme.displayNumber || theme.id}: {theme.title}</span>
        <div className="flex items-center space-x-3">
          {stats ? (
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
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
              Empezar
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ============== MAIN COMPONENT ==============

export default function TestsAuxiliarAdministrativoEstado() {
  const { user, loading } = useAuth() as AuthContextValue
  const [userStats, setUserStats] = useState<Record<number, ThemeStats>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [showOposicionModal, setShowOposicionModal] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('tema')
  const [showStatsInfo, setShowStatsInfo] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({
    bloque1: true,
    bloque2: false,
    examenesOficiales: false
  })
  const [expandedConvocatorias, setExpandedConvocatorias] = useState<Record<string, boolean>>({})
  const [examStats, setExamStats] = useState<Record<string, ExamStat>>({})
  const [examStatsLoading, setExamStatsLoading] = useState(false)

  // Cargar estadísticas usando la nueva API V2 con derivación dinámica por oposición
  const loadUserThemeStats = useCallback(async (userId: string) => {
    setStatsLoading(true)
    try {
      const response = await fetch(`/api/user/theme-stats?userId=${userId}&oposicionId=auxiliar-administrativo-estado`)
      const data = await response.json()

      if (data.success && data.stats) {
        const themeStats: Record<number, ThemeStats> = {}

        Object.entries(data.stats).forEach(([temaNumber, stat]) => {
          const s = stat as { total: number; correct: number; accuracy: number; lastStudy?: string; lastStudyFormatted?: string }
          themeStats[Number(temaNumber)] = {
            total: s.total,
            correct: s.correct,
            accuracy: s.accuracy,
            lastStudy: s.lastStudy ? new Date(s.lastStudy) : null,
            lastStudyFormatted: s.lastStudyFormatted
          }
        })

        setUserStats(themeStats)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas por tema:', error)
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

  // Cargar estadísticas de exámenes oficiales del usuario
  const loadExamStats = useCallback(async () => {
    if (!user?.id || Object.keys(examStats).length > 0) return // Ya cargadas o no hay usuario
    setExamStatsLoading(true)
    try {
      const response = await fetch(`/api/v2/official-exams/user-stats?userId=${user.id}&oposicion=auxiliar-administrativo-estado`)
      const data = await response.json()
      if (data.success && data.stats) {
        setExamStats(data.stats)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas de exámenes:', error)
    } finally {
      setExamStatsLoading(false)
    }
  }, [user?.id, examStats])

  // Alternar expansión de bloques
  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
    // Cargar estadísticas cuando se expande la sección de exámenes
    if (blockId === 'examenesOficiales' && !expandedBlocks.examenesOficiales) {
      loadExamStats()
    }
  }

  // Alternar expansión de convocatorias individuales
  const toggleConvocatoria = (examDate: string) => {
    setExpandedConvocatorias(prev => ({
      ...prev,
      [examDate]: !prev[examDate]
    }))
  }

  // Procesar temas con estadísticas y colores
  const getThemesByBlock = useCallback((): { bloque1: ThemeWithStats[]; bloque2: ThemeWithStats[] } => {
    const processThemes = (themes: Theme[]): ThemeWithStats[] => {
      return themes.map(theme => {
        const stats = userStats[theme.id]
        const accuracy = stats ? stats.accuracy : 0
        const color: ColorKey = stats ? getAccuracyColor(accuracy) : 'gray'
        return { ...theme, color, accuracy }
      })
    }

    return {
      bloque1: processThemes(BLOQUE1_THEMES),
      bloque2: processThemes(BLOQUE2_THEMES)
    }
  }, [userStats])

  // Mostrar loading durante verificación de auth
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

  const themes = getThemesByBlock()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-4xl w-full">
            {/* Header */}
            <div className="mb-8">
              <button
                onClick={() => setShowOposicionModal(true)}
                className="inline-flex items-center bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-2 rounded-full text-sm font-medium mb-6 hover:from-gray-600 hover:to-gray-800 transition-all cursor-pointer group"
              >
                <span className="mr-2">🏛️</span>
                Auxiliar Administrativo del Estado
                <span className="ml-2 text-xs opacity-70 group-hover:opacity-100">Cambiar ›</span>
              </button>
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
                  {([
                    { id: 'tema', label: 'Por Tema', icon: '🔢' },
                    { id: 'accuracy_asc', label: '% Más Bajo', icon: '📉' },
                    { id: 'accuracy_desc', label: '% Más Alto', icon: '📈' },
                    { id: 'last_study_new', label: 'Más Reciente', icon: '🕐' },
                    { id: 'last_study_old', label: 'Más Antiguo', icon: '🕰️' }
                  ] as const).map((option) => (
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

              {/* EXÁMENES OFICIALES */}
              <div id="examenes-oficiales" className="bg-white rounded-lg shadow-lg overflow-hidden scroll-mt-20">
                <button
                  onClick={() => toggleBlock('examenesOficiales')}
                  className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-4 focus:ring-amber-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-xl">📋</span>
                      <span>Exámenes Oficiales</span>
                    </div>
                    <span className={`text-2xl transition-transform duration-300 ${expandedBlocks.examenesOficiales ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {expandedBlocks.examenesOficiales && (
                  <div className="p-4 space-y-3 bg-gray-50">
                    <div className="space-y-3">
                      {/* ===== CONVOCATORIA 2024 ===== */}
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                            <button
                              onClick={() => toggleConvocatoria('2024-07-09')}
                              className={`w-full ${
                                (getExamStat(examStats, '2024-07-09', 'primera') || getExamStat(examStats, '2024-07-09', 'segunda'))
                                  ? COLOR_CLASSES[getAccuracyColor(Math.max(
                                      getExamStat(examStats, '2024-07-09', 'primera')?.accuracy || 0,
                                      getExamStat(examStats, '2024-07-09', 'segunda')?.accuracy || 0
                                    ))]
                                  : 'bg-gray-500 hover:bg-gray-600'
                              } text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="mr-2 text-lg">📋</span>
                                  <div>
                                    <div className="font-bold">Convocatoria 9 de julio de 2024</div>
                                    <div className="text-xs text-white/80">OEP 2023-2024</div>
                                  </div>
                                </div>
                                <span className={`text-xl transition-transform duration-300 ${expandedConvocatorias['2024-07-09'] ? 'rotate-180' : ''}`}>
                                  ▼
                                </span>
                              </div>
                            </button>

                            {expandedConvocatorias['2024-07-09'] && (
                              <div className="p-3 space-y-2 bg-gray-100">
                                {/* Primera parte 2024 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2024-07-09', 'primera')
                                  return (
                                    <div className={`rounded-lg overflow-hidden ${stat ? '' : ''}`}>
                                      {/* Header con título */}
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2024-07-09&parte=primera"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📘</span>
                                            <div>
                                              <div className="font-bold">Primera parte</div>
                                              <div className="text-xs text-white/80">
                                                Bloque I: Organización del Estado (64 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {/* Botones de acciones (solo si hay stats) */}
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2024-07-09"
                                            parte="primera"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Segunda parte 2024 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2024-07-09', 'segunda')
                                  return (
                                    <div className={`rounded-lg overflow-hidden ${stat ? '' : ''}`}>
                                      {/* Header con título */}
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2024-07-09&parte=segunda"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📗</span>
                                            <div>
                                              <div className="font-bold">Segunda parte</div>
                                              <div className="text-xs text-white/80">
                                                Bloque II: Actividad Administrativa y Ofimática (55 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {/* Botones de acciones (solo si hay stats) */}
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2024-07-09"
                                            parte="segunda"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Nota de corte */}
                                <div className="text-xs text-gray-600 px-2 pt-1">
                                  <span className="text-amber-600 font-medium">📊 Nota de corte:</span>
                                  <span className="ml-1">1ª parte: 5,31/10 | 2ª parte: 5,0/10</span>
                                </div>
                              </div>
                            )}
                          </div>

                      {/* ===== CONVOCATORIA 2023 ===== */}
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                        <button
                              onClick={() => toggleConvocatoria('2023-01-20')}
                              className={`w-full ${
                                (getExamStat(examStats, '2023-01-20', 'primera') || getExamStat(examStats, '2023-01-20', 'segunda'))
                                  ? COLOR_CLASSES[getAccuracyColor(Math.max(
                                      getExamStat(examStats, '2023-01-20', 'primera')?.accuracy || 0,
                                      getExamStat(examStats, '2023-01-20', 'segunda')?.accuracy || 0
                                    ))]
                                  : 'bg-gray-500 hover:bg-gray-600'
                              } text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="mr-2 text-lg">📋</span>
                                  <div>
                                    <div className="font-bold">Convocatoria 20 de enero de 2023</div>
                                    <div className="text-xs text-white/80">OEP 2021-2022</div>
                                  </div>
                                </div>
                                <span className={`text-xl transition-transform duration-300 ${expandedConvocatorias['2023-01-20'] ? 'rotate-180' : ''}`}>
                                  ▼
                                </span>
                              </div>
                            </button>

                            {expandedConvocatorias['2023-01-20'] && (
                              <div className="p-3 space-y-2 bg-gray-100">
                                {/* Primera parte 2023 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2023-01-20', 'primera')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2023-01-20&parte=primera"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📘</span>
                                            <div>
                                              <div className="font-bold">Primera parte</div>
                                              <div className="text-xs text-white/80">
                                                31 legislativas + 32 psicotécnicas (63 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2023-01-20"
                                            parte="primera"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Segunda parte 2023 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2023-01-20', 'segunda')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2023-01-20&parte=segunda"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📗</span>
                                            <div>
                                              <div className="font-bold">Segunda parte</div>
                                              <div className="text-xs text-white/80">
                                                Actividad administrativa y Ofimática (50 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2023-01-20"
                                            parte="segunda"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}
                          </div>

                      {/* ===== CONVOCATORIA 2021 (OEP 2020) ===== */}
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                        <button
                              onClick={() => toggleConvocatoria('2021-05-26')}
                              className={`w-full ${
                                (getExamStat(examStats, '2021-05-26', 'primera') || getExamStat(examStats, '2021-05-26', 'segunda'))
                                  ? COLOR_CLASSES[getAccuracyColor(Math.max(
                                      getExamStat(examStats, '2021-05-26', 'primera')?.accuracy || 0,
                                      getExamStat(examStats, '2021-05-26', 'segunda')?.accuracy || 0
                                    ))]
                                  : 'bg-gray-500 hover:bg-gray-600'
                              } text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="mr-2 text-lg">📋</span>
                                  <div>
                                    <div className="font-bold">Convocatoria 26 de mayo de 2021</div>
                                    <div className="text-xs text-white/80">OEP 2020</div>
                                  </div>
                                </div>
                                <span className={`text-xl transition-transform duration-300 ${expandedConvocatorias['2021-05-26'] ? 'rotate-180' : ''}`}>
                                  ▼
                                </span>
                              </div>
                            </button>

                            {expandedConvocatorias['2021-05-26'] && (
                              <div className="p-3 space-y-2 bg-gray-100">
                                {/* Primera parte 2021 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2021-05-26', 'primera')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2021-05-26&parte=primera"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📘</span>
                                            <div>
                                              <div className="font-bold">Primera parte</div>
                                              <div className="text-xs text-white/80">
                                                Legislativas + Psicotécnicas (62 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2021-05-26"
                                            parte="primera"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Segunda parte 2021 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2021-05-26', 'segunda')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2021-05-26&parte=segunda"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📗</span>
                                            <div>
                                              <div className="font-bold">Segunda parte</div>
                                              <div className="text-xs text-white/80">
                                                Bloque II: Actividad Administrativa y Ofimática (53 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2021-05-26"
                                            parte="segunda"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Nota informativa */}
                                <div className="text-xs text-gray-600 px-2 pt-1">
                                  <span className="text-amber-600 font-medium">ℹ️ Nota:</span>
                                  <span className="ml-1">Preguntas de informática actualizadas a Office 365 y Windows 11</span>
                                </div>
                              </div>
                            )}
                          </div>

                      {/* ===== CONVOCATORIA 2019 (OEP 2018-2019) ===== */}
                      <div className="bg-white rounded-lg shadow overflow-hidden">
                        <button
                              onClick={() => toggleConvocatoria('2019-06-14')}
                              className={`w-full ${
                                (getExamStat(examStats, '2019-06-14', 'primera') || getExamStat(examStats, '2019-06-14', 'segunda'))
                                  ? COLOR_CLASSES[getAccuracyColor(Math.max(
                                      getExamStat(examStats, '2019-06-14', 'primera')?.accuracy || 0,
                                      getExamStat(examStats, '2019-06-14', 'segunda')?.accuracy || 0
                                    ))]
                                  : 'bg-gray-500 hover:bg-gray-600'
                              } text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <span className="mr-2 text-lg">📋</span>
                                  <div>
                                    <div className="font-bold">Convocatoria 14 de junio de 2019</div>
                                    <div className="text-xs text-white/80">OEP 2018-2019</div>
                                  </div>
                                </div>
                                <span className={`text-xl transition-transform duration-300 ${expandedConvocatorias['2019-06-14'] ? 'rotate-180' : ''}`}>
                                  ▼
                                </span>
                              </div>
                            </button>

                            {expandedConvocatorias['2019-06-14'] && (
                              <div className="p-3 space-y-2 bg-gray-100">
                                {/* Primera parte 2019 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2019-06-14', 'primera')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2019-06-14&parte=primera"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📘</span>
                                            <div>
                                              <div className="font-bold">Primera parte</div>
                                              <div className="text-xs text-white/80">
                                                Legislativas + Psicotécnicas (64 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2019-06-14"
                                            parte="primera"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Segunda parte 2019 */}
                                {(() => {
                                  const stat = getExamStat(examStats, '2019-06-14', 'segunda')
                                  return (
                                    <div className="rounded-lg overflow-hidden">
                                      <Link
                                        href="/auxiliar-administrativo-estado/test/examen-oficial?fecha=2019-06-14&parte=segunda"
                                        className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center">
                                            <span className="mr-2 text-lg">📗</span>
                                            <div>
                                              <div className="font-bold">Segunda parte</div>
                                              <div className="text-xs text-white/80">
                                                Bloque II: Actividad Administrativa y Ofimática (34 preguntas)
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {stat ? (
                                              <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                                                {stat.accuracy}%
                                              </span>
                                            ) : (
                                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-sm font-medium">
                                                Empezar →
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </Link>
                                      {stat && (
                                        <div className="bg-gray-200 p-3">
                                          <ExamActionsDropdown
                                            examDate="2019-06-14"
                                            parte="segunda"
                                            oposicion="auxiliar-administrativo-estado"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}

                                {/* Nota informativa */}
                                <div className="text-xs text-gray-600 px-2 pt-1">
                                  <span className="text-amber-600 font-medium">ℹ️ Nota:</span>
                                  <span className="ml-1">Preguntas de informática actualizadas a Office 365 y Windows 11</span>
                                </div>
                              </div>
                            )}
                          </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BLOQUE I */}
              <div id="bloque-i" className="bg-white rounded-lg shadow-lg overflow-hidden scroll-mt-20">
                <button
                  onClick={() => toggleBlock('bloque1')}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-xl">🏛️</span>
                      <span>Bloque I: Organización Pública</span>
                      <span className="ml-3 bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                        16 temas
                      </span>
                    </div>
                    <span className={`text-2xl transition-transform duration-300 ${expandedBlocks.bloque1 ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {expandedBlocks.bloque1 && (
                  <div className="p-4 space-y-3 bg-gray-50">
                    {themes.bloque1.map((theme) => (
                      <ThemeLink
                        key={theme.id}
                        theme={theme}
                        stats={userStats[theme.id]}
                        onInfoClick={() => setShowStatsInfo(true)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* BLOQUE II */}
              <div id="bloque-ii" className="bg-white rounded-lg shadow-lg overflow-hidden scroll-mt-20">
                <button
                  onClick={() => toggleBlock('bloque2')}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-xl">💻</span>
                      <span>Bloque II: Actividad Administrativa y Ofimática</span>
                      <span className="ml-3 bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                        En desarrollo
                      </span>
                    </div>
                    <span className={`text-2xl transition-transform duration-300 ${expandedBlocks.bloque2 ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </button>

                {expandedBlocks.bloque2 && (
                  <div className="p-4 space-y-3 bg-gray-50">
                    {themes.bloque2.map((theme) => (
                      <ThemeLink
                        key={theme.id}
                        theme={theme}
                        stats={userStats[theme.id]}
                        onInfoClick={() => setShowStatsInfo(true)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal de información */}
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

      <OposicionChangeModal open={showOposicionModal} onClose={() => setShowOposicionModal(false)} />
    </div>
  )
}
