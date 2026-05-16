// components/test/TestHubClient.tsx - Client Component para interactividad
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useDailyQuestionLimit } from '@/hooks/useDailyQuestionLimit'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import CcaaFlag, { hasCcaaFlag } from '@/components/CcaaFlag'
import OposicionChangeModal from '@/components/OposicionChangeModal'
import ExamActionsDropdown from '@/components/ExamActionsDropdown'
import SimulacroPaywallModal from '@/components/test/SimulacroPaywallModal'
import {
  SIMULACRO_AVAILABLE_OPOSICIONES,
  getSimulacroConfig,
} from '@/lib/api/simulacro/config'
import type { OfficialExamConvocatoria } from '@/lib/config/oposiciones'

// Oposiciones para las que el Simulacro de Examen está disponible.
// SIMULACRO_AVAILABLE_OPOSICIONES y getSimulacroConfig se importan ahora desde
// `@/lib/api/simulacro/config` (single source of truth).

interface Topic {
  id: string
  topicNumber: number
  displayNumber: number
  title: string
  description: string | null
  hasContent: boolean
  isActive?: boolean
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
  name?: string
  badge: string
  icon: string
  oposicionId?: string
}

interface ThemeStats {
  total: number
  correct: number
  accuracy: number
  accuracy30d: number | null
  total_30d: number
  lastStudy: Date | null
  lastStudyFormatted: string
}

interface ExamStat {
  accuracy: number
  correct: number
  total: number
  lastAttempt: string
}

type SortOption = 'tema' | 'accuracy_asc' | 'accuracy_desc' | 'last_study_new' | 'last_study_old'

interface Props {
  oposicion: string
  oposicionInfo: OposicionInfo
  bloques: Bloque[]
  basePath: string
  positionType: string
  officialExams?: OfficialExamConvocatoria[]
  hasSpellingTest?: boolean
  hasPsychometricTest?: boolean
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

const SORT_OPTIONS: { id: SortOption; label: string; icon: string }[] = [
  { id: 'tema', label: 'Por Tema', icon: '🔢' },
  { id: 'accuracy_asc', label: '% Más Bajo', icon: '📉' },
  { id: 'accuracy_desc', label: '% Más Alto', icon: '📈' },
  { id: 'last_study_new', label: 'Más Reciente', icon: '🕐' },
  { id: 'last_study_old', label: 'Más Antiguo', icon: '🕰️' },
]

/**
 * Get exam stat with fallback to base key (backwards compatibility).
 * Old exams were saved without 'parte', so we check both formats.
 */
function getExamStat(
  examStats: Record<string, ExamStat>,
  examDate: string,
  parte?: string
): ExamStat | undefined {
  const parteKey = parte ? `${examDate}-${parte}` : examDate
  return examStats[parteKey] || examStats[examDate]
}

export default function TestHubClient({ oposicion, oposicionInfo, bloques, basePath, positionType, officialExams, hasSpellingTest, hasPsychometricTest }: Props) {
  const { user, loading } = useAuth() as { user: { id: string } | null; loading: boolean }

  // Límite diario para gating de simulacro/debilidades en usuarios FREE.
  // hasLimit = true SOLO para free (no premium / legacy / trial / admin).
  const { hasLimit, questionsRemaining, dailyLimit } = useDailyQuestionLimit()
  const [showSimulacroPaywall, setShowSimulacroPaywall] = useState(false)
  // Inicializar stats desde localStorage (instantáneo) y refrescar desde API
  const [userStats, setUserStats] = useState<Record<number, ThemeStats>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const cached = localStorage.getItem(`theme-stats:${oposicion}`)
      if (cached) return JSON.parse(cached)
    } catch { /* ignore */ }
    return {}
  })
  const [statsLoading, setStatsLoading] = useState(true)
  const [showOposicionModal, setShowOposicionModal] = useState(false)
  const [sortBy, setSortBy] = useState<SortOption>('tema')
  const [showStatsInfo, setShowStatsInfo] = useState(false)

  // Official exams state
  const [examStats, setExamStats] = useState<Record<string, ExamStat>>({})
  const [expandedConvocatorias, setExpandedConvocatorias] = useState<Record<string, boolean>>({})

  // Los simulacros pendientes se gestionan SOLO desde el dropdown del
  // header (📝 Tests pendientes). El hub siempre genera uno nuevo para
  // evitar tener dos puntos de entrada distintos al mismo recurso.

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
    console.log('📊 [TestHubClient] Cargando theme-stats para', userId.slice(0, 8))
    try {
      // Usa /api/v2/topic-progress/theme-stats (con timeout + cache + accuracy_30d)
      // Antes usaba /api/user/theme-stats que tardaba 16s para heavy users
      const response = await fetch(`/api/v2/topic-progress/theme-stats?userId=${userId}`)
      const data = await response.json()

      if (data.success && data.stats) {
        const themeStats: Record<number, ThemeStats> = {}
        data.stats.forEach((stat: any) => {
          // tema_number ya es 1-indexed (coincide con topics.topic_number)
          const temaNumber = stat.tema_number
          themeStats[temaNumber] = {
            total: stat.total,
            correct: stat.correct,
            accuracy: stat.accuracy,
            accuracy30d: stat.accuracy_30d ?? null,
            total_30d: stat.total_30d ?? 0,
            lastStudy: stat.last_study ? new Date(stat.last_study) : null,
            lastStudyFormatted: stat.last_study
              ? new Date(stat.last_study).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
              : ''
          }
        })
        console.log('📊 [TestHubClient] Stats cargadas:', Object.keys(themeStats).length, 'temas. Ejemplo T1:', themeStats[1] ? 'acc=' + themeStats[1].accuracy + ' acc30d=' + themeStats[1].accuracy30d : 'sin datos')
        setUserStats(themeStats)
        // Persistir en localStorage para carga instantánea en siguiente visita
        try { localStorage.setItem(`theme-stats:${oposicion}`, JSON.stringify(themeStats)) } catch { /* ignore */ }
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

    // Refrescar stats cuando la pestaña vuelve a ser visible (el usuario vuelve de un test)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        loadUserThemeStats(user.id)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.id, loading, loadUserThemeStats])

  // Cargar estadísticas de exámenes oficiales (lazy, al expandir)
  const loadExamStats = useCallback(async () => {
    if (!user?.id) return
    try {
      const response = await fetch(`/api/v2/official-exams/user-stats?userId=${user.id}&oposicion=${oposicion}`)
      const data = await response.json()
      if (data.success && data.stats) {
        setExamStats(data.stats)
      }
    } catch (error) {
      console.warn('Error cargando estadísticas de exámenes:', error)
    }
  }, [user?.id, oposicion])

  // Refrescar stats cuando se completa un examen y el usuario vuelve
  useEffect(() => {
    const handleExamCompleted = () => { loadExamStats() }
    window.addEventListener('exam-completed', handleExamCompleted)
    // También refrescar cuando la pestaña vuelve a ser visible (el usuario vuelve de un examen)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && Object.keys(examStats).length > 0) {
        loadExamStats()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('exam-completed', handleExamCompleted)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadExamStats, examStats])

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
    // Cargar estadísticas cuando se expande la sección de exámenes
    if (blockId === 'examenesOficiales' && !expandedBlocks.examenesOficiales) {
      loadExamStats()
    }
  }

  const toggleConvocatoria = (examDate: string) => {
    setExpandedConvocatorias(prev => ({
      ...prev,
      [examDate]: !prev[examDate]
    }))
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
              <button
                onClick={() => setShowOposicionModal(true)}
                className="inline-flex items-center bg-gradient-to-r from-blue-700 to-blue-900 text-white px-6 py-2 rounded-full text-sm font-medium mb-6 hover:from-blue-600 hover:to-blue-800 transition-all cursor-pointer group"
              >
                {oposicionInfo.oposicionId && hasCcaaFlag(oposicionInfo.oposicionId) ? (
                  <CcaaFlag oposicionId={oposicionInfo.oposicionId} className="mr-2" />
                ) : (
                  <span className="mr-2">{oposicionInfo.icon}</span>
                )}
                {oposicionInfo.name || oposicionInfo.short}
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
                  {SORT_OPTIONS.map((option) => (
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
                href={`/${oposicion}/test/aleatorio`}
                className="block bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-300 group"
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

              {/* Bloques dinámicos (estudio por temas — flujo principal) */}
              {bloques.map((bloque, idx) => (
                <BlockSection
                  key={bloque.id}
                  blockId={bloque.id}
                  bloqueNumber={idx + 1}
                  icon={bloque.icon}
                  title={bloque.name}
                  topics={bloque.topics}
                  basePath={basePath}
                  positionType={positionType}
                  expanded={expandedBlocks[bloque.id] ?? false}
                  onToggle={toggleBlock}
                  userStats={userStats}
                  statsLoading={statsLoading}
                  getThemeColor={getThemeColor}
                  onInfoClick={() => setShowStatsInfo(true)}
                />
              ))}

              {/* Mis Debilidades — repaso cross-tema de preguntas falladas */}
              <DebilidadesCard
                positionType={positionType}
                hasLimit={hasLimit}
                questionsRemaining={questionsRemaining}
                dailyLimit={dailyLimit}
              />

              {/* Simulacro de Examen — fase final, después del estudio.
                  El hub siempre genera uno nuevo (?nuevo=1). FREE → paywall.
                  Los simulacros pendientes se gestionan desde el dropdown
                  del header (📝 Tests pendientes). */}
              {SIMULACRO_AVAILABLE_OPOSICIONES.includes(oposicion) && (
                <SimulacroCard
                  oposicion={oposicion}
                  hasLimit={hasLimit}
                  onOpenPaywall={() => setShowSimulacroPaywall(true)}
                />
              )}

              {/* Exámenes Oficiales — convocatorias reales pasadas */}
              {officialExams && officialExams.length > 0 && (
                <OfficialExamsSection
                  oposicion={oposicion}
                  convocatorias={officialExams}
                  expanded={expandedBlocks.examenesOficiales ?? false}
                  onToggle={() => toggleBlock('examenesOficiales')}
                  examStats={examStats}
                  expandedConvocatorias={expandedConvocatorias}
                  onToggleConvocatoria={toggleConvocatoria}
                />
              )}

              {/* Test de Ortografía y Gramática (config-driven) */}
              {hasSpellingTest && (
                <Link
                  href={`/${oposicion}/test/ortografia`}
                  className="block bg-gradient-to-r from-pink-600 to-rose-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-pink-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-2xl group-hover:animate-bounce">Aa</span>
                      <span>Ortografía y Gramática</span>
                    </div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      Multi-respuesta
                    </span>
                  </div>
                </Link>
              )}

              {/* Test Psicotécnico (config-driven) */}
              {hasPsychometricTest && (
                <Link
                  href={`/psicotecnicos/test`}
                  className="block bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-purple-300 group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-3 text-2xl group-hover:animate-bounce">🧠</span>
                      <span>Tests Psicotécnicos</span>
                    </div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
                      Razonamiento + Series
                    </span>
                  </div>
                </Link>
              )}
            </div>

            {/* Modal de información de estadísticas */}
            {showStatsInfo && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Estadísticas de Rendimiento</h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    <p><strong>Porcentaje de aciertos:</strong> Calculado como (respuestas correctas / total respuestas) × 100</p>
                    <p><strong>Respuestas:</strong> Formato (correctas/total)</p>
                    <p><strong>Último estudio:</strong> Fecha de tu última sesión de test en ese tema</p>
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

      {/* Paywall del simulacro para usuarios FREE (componente reutilizable).
          Solo se renderiza si la oposición tiene config de simulacro. */}
      {(() => {
        const simulacroConfig = getSimulacroConfig(oposicion)
        if (!simulacroConfig) return null
        return (
          <SimulacroPaywallModal
            isOpen={showSimulacroPaywall}
            onClose={() => setShowSimulacroPaywall(false)}
            config={simulacroConfig}
            dailyLimit={dailyLimit}
            oposicionSlug={oposicion}
          />
        )
      })()}
    </div>
  )
}

// ============================================================
// Sección de Exámenes Oficiales
// ============================================================

interface OfficialExamsSectionProps {
  oposicion: string
  convocatorias: OfficialExamConvocatoria[]
  expanded: boolean
  onToggle: () => void
  examStats: Record<string, ExamStat>
  expandedConvocatorias: Record<string, boolean>
  onToggleConvocatoria: (date: string) => void
}

function OfficialExamsSection({
  oposicion,
  convocatorias,
  expanded,
  onToggle,
  examStats,
  expandedConvocatorias,
  onToggleConvocatoria,
}: OfficialExamsSectionProps) {
  return (
    <div id="examenes-oficiales" className="bg-white rounded-lg shadow-lg overflow-hidden scroll-mt-20">
      <button
        onClick={onToggle}
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 hover:from-amber-700 hover:to-orange-700 focus:outline-none focus:ring-4 focus:ring-amber-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="mr-3 text-xl">📋</span>
            <span>Exámenes Oficiales</span>
          </div>
          <span className={`text-2xl transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-gray-50">
          <div className="space-y-3">
            {convocatorias.map((conv) => (
              <ConvocatoriaCard
                key={conv.date}
                convocatoria={conv}
                oposicion={oposicion}
                examStats={examStats}
                expanded={expandedConvocatorias[conv.date] ?? false}
                onToggle={() => onToggleConvocatoria(conv.date)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface ConvocatoriaCardProps {
  convocatoria: OfficialExamConvocatoria
  oposicion: string
  examStats: Record<string, ExamStat>
  expanded: boolean
  onToggle: () => void
}

function ConvocatoriaCard({ convocatoria, oposicion, examStats, expanded, onToggle }: ConvocatoriaCardProps) {
  const isComingSoon = convocatoria.comingSoon === true

  // Color del header basado en mejor resultado de las partes
  const bestAccuracy = Math.max(
    ...convocatoria.partes.map(p => getExamStat(examStats, convocatoria.date, p.id)?.accuracy || 0)
  )
  const hasAnyStats = convocatoria.partes.some(p => getExamStat(examStats, convocatoria.date, p.id))
  const headerColor = isComingSoon
    ? 'bg-gray-400'
    : hasAnyStats
      ? COLOR_CLASSES[getAccuracyColor(bestAccuracy)]
      : 'bg-gray-500 hover:bg-gray-600'

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <button
        onClick={isComingSoon ? undefined : onToggle}
        className={`w-full ${headerColor} text-white py-3 px-4 text-left font-semibold transition-all duration-300 focus:outline-none ${isComingSoon ? 'cursor-default opacity-80' : ''}`}
        disabled={isComingSoon}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="mr-2 text-lg">{isComingSoon ? '🔒' : '📋'}</span>
            <div>
              <div className="font-bold">{convocatoria.title}</div>
              <div className="text-xs text-white/80">{convocatoria.oep}</div>
            </div>
          </div>
          {isComingSoon ? (
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
              En preparacion
            </span>
          ) : (
            <span className={`text-xl transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          )}
        </div>
      </button>

      {expanded && !isComingSoon && (
        <div className="p-3 space-y-2 bg-gray-100">
          {convocatoria.partes.map((parte) => {
            const stat = getExamStat(examStats, convocatoria.date, parte.id)
            return (
              <div key={parte.id} className="rounded-lg overflow-hidden">
                <Link
                  href={`/${oposicion}/test/examen-oficial?fecha=${convocatoria.date}&parte=${parte.id}`}
                  className={`block ${COLOR_CLASSES[stat ? getAccuracyColor(stat.accuracy) : 'gray']} text-white py-3 px-4 font-semibold transition-all duration-300 hover:brightness-110 active:brightness-90`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="mr-2 text-lg">{parte.icon}</span>
                      <div>
                        <div className="font-bold">{parte.title}</div>
                        <div className="text-xs text-white/80">{parte.description}</div>
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
                      examDate={convocatoria.date}
                      parte={parte.id}
                      oposicion={oposicion}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {convocatoria.note && (
            <div className="text-xs text-gray-600 px-2 pt-1">
              {convocatoria.note}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Componente para sección de bloque
// ============================================================

interface BlockSectionProps {
  blockId: string
  bloqueNumber: number
  icon: string
  title: string
  topics: Topic[]
  basePath: string
  positionType: string
  expanded: boolean
  onToggle: (blockId: string) => void
  userStats: Record<number, ThemeStats>
  statsLoading: boolean
  getThemeColor: (topicNumber: number) => string
  onInfoClick: () => void
}

function BlockSection({
  blockId,
  bloqueNumber,
  icon,
  title,
  topics,
  basePath,
  positionType,
  expanded,
  onToggle,
  userStats,
  statsLoading,
  getThemeColor,
  onInfoClick,
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
              statsLoading={statsLoading}
              color={getThemeColor(topic.topicNumber)}
              onInfoClick={onInfoClick}
            />
          ))}

          {/* Repaso de fallos del bloque (feature 06/05/2026, feedback Alba) */}
          <Link
            href={`/test/repaso-fallos-v2?bloque=${bloqueNumber}&positionType=${encodeURIComponent(positionType)}&n=20`}
            className="flex items-center justify-between bg-gradient-to-r from-red-500 to-orange-600 text-white py-3 px-4 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-red-300"
          >
            <div className="flex items-center min-w-0">
              <span className="mr-3 text-xl flex-shrink-0">🎯</span>
              <div className="flex flex-col min-w-0">
                <span className="text-sm opacity-90">Repaso de Fallos</span>
                <span className="font-bold truncate">{title}</span>
              </div>
            </div>
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ml-2">
              20 preguntas
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Componente para enlace de tema
// ============================================================

interface ThemeLinkProps {
  topic: Topic
  basePath: string
  stats: ThemeStats | undefined
  statsLoading: boolean
  color: string
  onInfoClick: () => void
}

function ThemeLink({ topic, basePath, stats, statsLoading, color, onInfoClick }: ThemeLinkProps) {
  const hasStats = !!stats
  const href = `${basePath}/${topic.topicNumber}`

  // Mostrar solo la primera frase del título (antes del primer punto seguido de espacio)
  const shortTitle = topic.title.split(/\.\s/)[0]

  // Tema inactivo (en elaboración): mostrar como deshabilitado con badge diferente
  if (topic.isActive === false) {
    return (
      <div
        className="block py-3 px-6 rounded-lg font-semibold bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-70"
      >
        <div className="flex items-center justify-between">
          <span>Tema {topic.displayNumber}: {shortTitle}</span>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            En elaboración
          </span>
        </div>
      </div>
    )
  }

  // Tema sin contenido: mostrar como deshabilitado
  if (!topic.hasContent) {
    return (
      <div
        className="block py-3 px-6 rounded-lg font-semibold bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-70"
      >
        <div className="flex items-center justify-between">
          <span>Tema {topic.displayNumber}: {shortTitle}</span>
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
        <span>Tema {topic.displayNumber}: {shortTitle}</span>
        <div className="flex items-center space-x-3">
          {statsLoading && !hasStats ? (
            <span className="bg-gray-200 animate-pulse px-3 py-1 rounded-full text-sm font-bold text-transparent">
              --% (-/-)
            </span>
          ) : hasStats ? (
            <>
              <div className="flex items-center space-x-1">
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold">
                  {stats.accuracy}% ({stats.correct}/{stats.total})
                  {stats.accuracy30d != null && stats.total_30d >= 5 && stats.accuracy30d !== stats.accuracy && (
                    <span className={`ml-1 text-xs font-semibold ${stats.accuracy30d > stats.accuracy ? 'text-green-200' : 'text-red-200'}`}>
                      {stats.accuracy30d > stats.accuracy ? '▲' : '▼'}{Math.abs(stats.accuracy30d - stats.accuracy)}%
                    </span>
                  )}
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

// ============================================================
// Card del Simulacro de Examen
//
// Política UX clara: el hub SIEMPRE genera un simulacro nuevo (con `?nuevo=1`).
// La gestión de simulacros pendientes (continuar/descartar) vive en el
// dropdown del header — es el ÚNICO lugar donde se reanuda. Esto evita
// la confusión de tener dos puntos de entrada distintos.
//
// 2 estados:
//   - FREE → botón que abre modal Premium (paywall)
//   - Premium → link directo a /simulacro?nuevo=1
// ============================================================

interface SimulacroCardProps {
  oposicion: string
  hasLimit: boolean
  onOpenPaywall: () => void
}

function SimulacroCard({ oposicion, hasLimit, onOpenPaywall }: SimulacroCardProps) {
  // Config compartida (totalQuestions, breakdownLines) — usada también por
  // el paywall y el endpoint /api/v2/simulacro/questions. Single source of truth.
  const config = getSimulacroConfig(oposicion)
  const cardClasses =
    'block py-4 px-8 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-4 group w-full text-left bg-gradient-to-r from-amber-600 to-orange-600 text-white focus:ring-amber-300'

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start min-w-0">
        <span className="mr-3 text-2xl group-hover:animate-bounce flex-shrink-0">🏆</span>
        <div className="min-w-0">
          <div>
            Simulacro de Examen: {config?.totalQuestions ?? 110} preguntas
          </div>
          {/* Desglose detallado por partes (bases oficiales) — letra pequeña */}
          {config?.breakdownLines && config.breakdownLines.length > 0 && (
            <ul className="mt-1 text-xs font-normal opacity-90 leading-snug list-none">
              {config.breakdownLines.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium flex-shrink-0">
        {hasLimit ? '⭐ Premium' : 'Nuevo'}
      </span>
    </div>
  )

  // FREE → paywall (no entra al simulacro)
  if (hasLimit) {
    return (
      <button type="button" onClick={onOpenPaywall} className={cardClasses}>
        {inner}
      </button>
    )
  }

  // Premium → SIEMPRE genera uno nuevo. La gestión de pendings se hace
  // desde el dropdown del header (📝 Tests pendientes).
  return (
    <Link href={`/${oposicion}/test/simulacro?nuevo=1`} className={cardClasses}>
      {inner}
    </Link>
  )
}

// ============================================================
// Card "Mis Debilidades" — preguntas falladas de TODA la oposición
// Reusa /test/repaso-fallos-v2 enviando scope { type: 'position' }
// al endpoint vía positionType sin bloque.
// ============================================================

function DebilidadesCard({
  positionType,
  hasLimit,
  questionsRemaining,
  dailyLimit,
}: {
  positionType: string
  hasLimit: boolean
  questionsRemaining: number
  dailyLimit: number
}) {
  const [open, setOpen] = useState(false)
  // Defaults sensatos: todo el periodo (365d cubre cualquier usuario hasta 1 año)
  // y 20 preguntas — formato cómodo para una sesión de repaso típica.
  const [selectedDays, setSelectedDays] = useState<number>(365)
  const [selectedCount, setSelectedCount] = useState<number>(20)

  const PERIOD_OPTIONS: { days: number; label: string }[] = [
    { days: 365, label: 'Todo' },
    { days: 30,  label: 'Último mes' },
    { days: 7,   label: 'Última semana' },
  ]
  const COUNT_OPTIONS: number[] = [10, 20, 30, 50]

  // Para usuarios FREE: deshabilitar las cantidades que excedan su cuota
  // diaria restante. Evita la frustración de seleccionar 50 y solo poder
  // responder X antes del modal de upgrade.
  const isCountAvailable = (n: number): boolean => !hasLimit || n <= questionsRemaining

  // Si el default (20) excede la cuota, bajar al máximo viable disponible
  useEffect(() => {
    if (hasLimit && !isCountAvailable(selectedCount)) {
      const fallback = COUNT_OPTIONS.filter(n => n <= questionsRemaining).pop()
      if (fallback && fallback !== selectedCount) setSelectedCount(fallback)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLimit, questionsRemaining])
  const ORDER_OPTIONS: { id: string; icon: string; label: string; desc: string }[] = [
    { id: 'most_failed', icon: '🔥', label: 'Más veces falladas primero', desc: 'Empieza por las que más te cuesta dominar' },
    { id: 'recent',      icon: '⏰', label: 'Últimas falladas primero',    desc: 'Repasa tus errores más recientes' },
    { id: 'oldest',      icon: '📅', label: 'Más antiguas primero',         desc: 'Refuerza conceptos que llevas tiempo sin repasar' },
    { id: 'random',      icon: '🎲', label: 'Orden aleatorio',              desc: 'Mezcladas para variar el repaso' },
  ]

  function buildHref(order: string): string {
    const params = new URLSearchParams({
      positionType,
      order,
      n: String(selectedCount),
      days: String(selectedDays),
    })
    return `/test/repaso-fallos-v2?${params.toString()}`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full bg-gradient-to-r from-red-600 to-rose-700 text-white py-4 px-6 text-left font-bold text-lg transition-all duration-300 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-red-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <span className="mr-3 text-2xl">🎯</span>
            <div className="flex flex-col min-w-0">
              <span>Mis Debilidades</span>
              <span className="text-sm font-normal opacity-90 mt-0.5">
                Tus preguntas falladas de toda la oposición
              </span>
            </div>
          </div>
          <span className={`text-2xl transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 bg-gray-50 space-y-4">
          {/* Selector de periodo */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
              <span className="mr-1">📅</span> Periodo
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map(opt => {
                const active = selectedDays === opt.days
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => setSelectedDays(opt.days)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                      active
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-red-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selector de cantidad — para usuarios FREE deshabilita las
              cantidades que excedan su cuota diaria restante. */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center justify-between">
              <span className="flex items-center"><span className="mr-1">🔢</span> Nº preguntas</span>
              {hasLimit && (
                <span className="text-[10px] font-normal text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {questionsRemaining}/{dailyLimit} hoy
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {COUNT_OPTIONS.map(n => {
                const active = selectedCount === n
                const available = isCountAvailable(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => available && setSelectedCount(n)}
                    disabled={!available}
                    title={available ? undefined : `Hoy te quedan ${questionsRemaining} preguntas. Hazte Premium para más.`}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors min-w-[44px] ${
                      !available
                        ? 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed line-through'
                        : active
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-red-400'
                    }`}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
            {hasLimit && questionsRemaining < COUNT_OPTIONS[COUNT_OPTIONS.length - 1] && (
              <p className="text-[11px] text-gray-500 mt-2">
                Cantidades en gris exceden tu cuota diaria.{' '}
                <Link href="/premium" className="text-amber-700 hover:underline font-medium">
                  Hazte Premium para sin límite
                </Link>.
              </p>
            )}
          </div>

          {/* Selector de orden — al click navega con los params elegidos arriba */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2">
              ¿Cómo ordenamos?
            </div>
            <div className="space-y-2">
              {ORDER_OPTIONS.map(opt => (
                <Link
                  key={opt.id}
                  href={buildHref(opt.id)}
                  className="flex items-center justify-between bg-white border border-gray-200 hover:border-red-400 hover:bg-red-50 rounded-lg p-3 transition-all group"
                >
                  <div className="flex items-center min-w-0">
                    <span className="mr-3 text-xl flex-shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-800 text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </div>
                  </div>
                  <span className="text-gray-400 group-hover:text-red-500 transition-colors text-lg flex-shrink-0 ml-2">→</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
