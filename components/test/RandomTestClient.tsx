'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import { useDailyQuestionLimit } from '@/hooks/useDailyQuestionLimit'
import {
  QUESTION_COUNT_PRESETS,
  customQuestionCap,
  isCustomQuestionCount,
  clampCustomQuestionCount,
} from '@/lib/test/questionCount'
import type {
  OposicionSlug,
  DifficultyLevel,
  TestMode,
  UserThemeStats,
} from '@/lib/api/random-test/schemas'

// Type for useAuth hook from JS context
interface AuthContextValue {
  user: { id: string } | null
  loading: boolean
}

const useAuth = (): AuthContextValue => {
  const { useAuth: useAuthHook } = require('@/contexts/AuthContext')
  return useAuthHook()
}

interface EnrichedTheme {
  id: number
  name: string
  displayNumber?: number
  questionCount: number
  officialCount: number
}

interface EnrichedBlock {
  id: string
  title: string
  subtitle: string | null
  icon: string
  themes: EnrichedTheme[]
}

interface EnrichedConfig {
  slug: string
  name: string
  shortName: string
  badge: string
  icon: string
  positionType: string
  totalThemes: number
  blocks: EnrichedBlock[]
}

interface Props {
  oposicion: OposicionSlug
  config: EnrichedConfig
  totalQuestions: number
  totalOfficialQuestions: number
}

export default function RandomTestClient({
  oposicion,
  config,
  totalQuestions,
  totalOfficialQuestions,
}: Props) {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const {
    questionsRemaining,
    dailyLimit,
    hasLimit,
    isPremiumUser,
    loading: limitLoading,
  } = useDailyQuestionLimit()

  // Theme config
  const themeBlocks = config.blocks

  // Estados de seleccion
  const [selectedThemes, setSelectedThemes] = useState<number[]>([])
  const [numQuestions, setNumQuestions] = useState(25)
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('mixed')
  const [testMode, setTestMode] = useState<TestMode>('practica')
  const [onlyOfficialQuestions, setOnlyOfficialQuestions] = useState(false)
  const [includeSharedOfficials, setIncludeSharedOfficials] = useState(false)
  const [focusEssentialArticles, setFocusEssentialArticles] = useState(false)
  const [adaptiveMode, setAdaptiveMode] = useState(true)

  // Estados de UI
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    config.blocks.forEach(block => { initial[block.id] = true })
    return initial
  })
  const [generating, setGenerating] = useState(false)

  // Estados de datos
  const [userStats, setUserStats] = useState<Record<number, UserThemeStats>>({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [availableQuestions, setAvailableQuestions] = useState(0)
  const [availableNeverSeen, setAvailableNeverSeen] = useState<number | null>(null)
  const [includeSeenQuestions, setIncludeSeenQuestions] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // Modales
  const [showOfficialModal, setShowOfficialModal] = useState(false)
  const [showEssentialModal, setShowEssentialModal] = useState(false)
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false)

  // Lista plana de temas
  const allThemes = config.blocks.flatMap(block => block.themes)

  // Ajustar numQuestions si la cuota diaria es menor que la selección actual
  useEffect(() => {
    if (hasLimit && !limitLoading && questionsRemaining > 0 && numQuestions > questionsRemaining) {
      setNumQuestions(questionsRemaining)
    }
  }, [hasLimit, limitLoading, questionsRemaining])

  // Cargar preferencia de modo
  useEffect(() => {
    const savedMode = localStorage.getItem('preferredTestMode') as TestMode | null
    if (savedMode === 'practica' || savedMode === 'examen') {
      setTestMode(savedMode)
    }
  }, [])

  // Cargar estadisticas del usuario
  useEffect(() => {
    if (user?.id && !authLoading) {
      loadUserStats(user.id)
    }
  }, [user?.id, authLoading])

  // Verificar disponibilidad cuando cambian los criterios
  useEffect(() => {
    if (selectedThemes.length > 0) {
      checkAvailability()
      // Adaptive mode ahora funciona con múltiples temas
    } else {
      setAvailableQuestions(0)
      setAvailableNeverSeen(null)
    }
  }, [selectedThemes, difficulty, onlyOfficialQuestions, includeSharedOfficials, focusEssentialArticles])

  const loadUserStats = async (userId: string) => {
    setStatsLoading(true)
    try {
      const response = await fetch('/api/random-test/user-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oposicion, userId }),
      })
      const data = await response.json()
      if (data.success && data.stats) {
        const statsMap: Record<number, UserThemeStats> = {}
        data.stats.forEach((stat: UserThemeStats) => {
          statsMap[stat.themeId] = stat
        })
        setUserStats(statsMap)
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const checkAvailability = useCallback(async () => {
    if (selectedThemes.length === 0) return
    setCheckingAvailability(true)
    console.log('🔍 [RandomTest] Checking availability for themes:', selectedThemes)
    try {
      const response = await fetch('/api/random-test/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oposicion,
          selectedThemes,
          difficulty,
          onlyOfficialQuestions,
          includeSharedOfficials,
          focusEssentialArticles,
          userId: user?.id ?? null,
        }),
      })
      const data = await response.json()
      console.log('📊 [RandomTest] Availability response:', data)
      if (data.success) {
        setAvailableQuestions(data.availableQuestions)
        setAvailableNeverSeen(
          typeof data.availableNeverSeen === 'number' ? data.availableNeverSeen : null
        )
        console.log('✅ [RandomTest] Set available questions:', data.availableQuestions, 'neverSeen:', data.availableNeverSeen)
      } else {
        console.error('❌ [RandomTest] API error:', data.error)
        setAvailableQuestions(0)
        setAvailableNeverSeen(null)
      }
    } catch (error) {
      console.error('❌ [RandomTest] Error checking availability:', error)
      setAvailableQuestions(0)
      setAvailableNeverSeen(null)
    } finally {
      setCheckingAvailability(false)
    }
  }, [selectedThemes, difficulty, onlyOfficialQuestions, includeSharedOfficials, focusEssentialArticles, oposicion, user?.id])

  const handleTestModeChange = (newMode: TestMode) => {
    setTestMode(newMode)
    localStorage.setItem('preferredTestMode', newMode)
    // La dificultad se mantiene al cambiar de modo (funciona en ambos)
  }

  const toggleTheme = (themeId: number) => {
    setSelectedThemes(prev =>
      prev.includes(themeId) ? prev.filter(id => id !== themeId) : [...prev, themeId]
    )
  }

  const selectBlockThemes = (blockId: string) => {
    const block = config.blocks.find(b => b.id === blockId)
    if (!block) return
    const blockThemeIds = block.themes.map(t => t.id)
    const allSelected = blockThemeIds.every(id => selectedThemes.includes(id))
    if (allSelected) {
      setSelectedThemes(prev => prev.filter(id => !blockThemeIds.includes(id)))
    } else {
      setSelectedThemes(prev => [...new Set([...prev, ...blockThemeIds])])
    }
  }

  const selectAllThemes = () => {
    const allIds = allThemes.map(t => t.id)
    setSelectedThemes(allIds.every(id => selectedThemes.includes(id)) ? [] : allIds)
  }

  const clearSelection = () => setSelectedThemes([])

  const getThemeAccuracy = (themeId: number): number => {
    const stats = userStats[themeId]
    return stats?.accuracy || 0
  }

  // Cap del pool según el toggle: nunca-vistas si el usuario quiere preguntas nuevas
  // (default), pool total si activó "incluir vistas". Caemos a `availableQuestions`
  // si el endpoint todavía no devolvió neverSeen (compat con respuestas antiguas).
  const poolCap = includeSeenQuestions
    ? availableQuestions
    : (availableNeverSeen ?? availableQuestions)

  // Número efectivo de preguntas considerando cuota diaria + pool real
  const effectiveNumQuestions = hasLimit
    ? Math.min(numQuestions, poolCap || numQuestions, questionsRemaining)
    : Math.min(numQuestions, poolCap || numQuestions)

  const generateTest = async () => {
    if (selectedThemes.length === 0) return
    if (hasLimit && questionsRemaining <= 0) return
    setGenerating(true)
    try {
      const testParams = new URLSearchParams({
        themes: selectedThemes.join(','),
        n: effectiveNumQuestions.toString(),
        difficulty: difficulty,
        mode: 'aleatorio',
      })
      if (onlyOfficialQuestions) testParams.append('official_only', 'true')
      if (includeSharedOfficials) testParams.append('include_shared_officials', 'true')
      if (focusEssentialArticles) testParams.append('focus_essential', 'true')
      if (adaptiveMode) testParams.append('adaptive', 'true')
      // Solo pasamos el flag cuando el usuario opta explícitamente por incluir vistas;
      // el default del fetcher es prioritizar nunca-vistas (preserva comportamiento previo).
      if (includeSeenQuestions) testParams.append('prioritize_never_seen', 'false')

      const testPath = testMode === 'examen' ? 'test-aleatorio-examen' : 'test-personalizado'
      router.push(`/${oposicion}/test/${testPath}?${testParams.toString()}`)
    } catch (error) {
      console.error('Error generating test:', error)
    } finally {
      setGenerating(false)
    }
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  // Login required
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600 mb-6">Inicia sesion para acceder al test aleatorio</p>
          <Link href="/auth/login" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity">
            Iniciar Sesion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <InteractiveBreadcrumbs />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🎲 Test Aleatorio</h1>
          <p className="text-gray-600">Configura tu test personalizado seleccionando los temas que quieres practicar</p>
          <p className="text-sm text-gray-500 mt-1">{config.name}</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {/* 1. Numero de Preguntas */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                📝 Numero de preguntas: <span className="text-blue-600">{numQuestions}</span>
              </label>
              {/* Aviso de cuota diaria para usuarios free */}
              {hasLimit && !limitLoading && (
                <div className="mb-3 flex items-center gap-2 text-sm">
                  <span className={questionsRemaining === 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                    {questionsRemaining === 0
                      ? 'Has agotado tus preguntas de hoy'
                      : `Te quedan ${questionsRemaining} preguntas hoy`}
                  </span>
                  <span className="text-gray-400">·</span>
                  <Link href="/premium" className="text-purple-600 hover:text-purple-700 font-medium hover:underline">
                    Sin límites con Premium
                  </Link>
                </div>
              )}
              <div className="grid grid-cols-4 gap-2 mb-2">
                {QUESTION_COUNT_PRESETS.map((num) => {
                  const exceedsAvailable = num > availableQuestions && availableQuestions > 0
                  const exceedsDailyLimit = hasLimit && num > questionsRemaining
                  const needsPremium = exceedsDailyLimit && !exceedsAvailable

                  if (needsPremium) {
                    return (
                      <Link
                        key={num}
                        href="/premium"
                        className="py-2 px-3 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-700 hover:from-purple-100 hover:to-indigo-100 text-center"
                      >
                        {num} 👑
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={num}
                      onClick={() => setNumQuestions(num)}
                      disabled={exceedsAvailable}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        numQuestions === num
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${exceedsAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {num}
                    </button>
                  )
                })}
              </div>
              {/* Cantidad personalizada: los presets cubren 10/25/50/100; aquí
                  cualquier número (ej. 70 para simular el examen real mezclando
                  temas). Mismo patrón que TestConfigurator (tema individual). */}
              <div className="flex items-center gap-2">
                <label htmlFor="random-custom-question-count" className="text-xs text-gray-600">
                  O personalizado:
                </label>
                <input
                  id="random-custom-question-count"
                  type="number"
                  min={1}
                  max={customQuestionCap(availableQuestions)}
                  inputMode="numeric"
                  placeholder="ej. 70"
                  value={isCustomQuestionCount(numQuestions) ? numQuestions : ''}
                  onChange={(e) => {
                    const next = clampCustomQuestionCount(parseInt(e.target.value, 10), availableQuestions)
                    if (next !== null) setNumQuestions(next)
                  }}
                  className={`w-20 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                    isCustomQuestionCount(numQuestions)
                      ? 'border-blue-600 ring-1 ring-blue-600 text-blue-700'
                      : 'border-gray-300 text-gray-700'
                  } focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none`}
                />
                <span className="text-xs text-gray-400">máx. {customQuestionCap(availableQuestions)}</span>
              </div>
            </div>

            {/* 2. Dificultad */}
            <div className="mb-6">
              <label className={`block text-sm font-bold mb-3 ${onlyOfficialQuestions || testMode === 'examen' ? 'text-gray-400' : 'text-gray-700'}`}>
                🎯 Dificultad del Test
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 'mixed' as const, label: 'Aleatoria', emoji: '🎲', color: 'blue' },
                  { value: 'easy' as const, label: 'Facil', emoji: '🟢', color: 'green' },
                  { value: 'medium' as const, label: 'Medio', emoji: '🟡', color: 'yellow' },
                  { value: 'hard' as const, label: 'Dificil', emoji: '🟠', color: 'orange' },
                ].map(({ value, label, emoji }) => (
                  <button
                    key={value}
                    onClick={() => !onlyOfficialQuestions && setDifficulty(value)}
                    disabled={onlyOfficialQuestions}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      onlyOfficialQuestions
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        : difficulty === value
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {emoji} {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Opciones Avanzadas */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
              {/* Solo preguntas oficiales */}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyOfficialQuestions}
                  onChange={(e) => {
                    setOnlyOfficialQuestions(e.target.checked)
                    if (e.target.checked) {
                      setFocusEssentialArticles(false)
                      setDifficulty('mixed')
                    }
                  }}
                  disabled={focusEssentialArticles}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">🏛️ Solo preguntas oficiales de <strong>{config.shortName}</strong></span>
              </label>

              {onlyOfficialQuestions && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                  <p className="text-sm font-bold text-red-800">Modo Oficial Activado</p>
                  <p className="text-xs text-red-700">Solo preguntas de exámenes oficiales de {config.shortName}</p>
                  <label className="flex items-center space-x-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={includeSharedOfficials}
                      onChange={(e) => setIncludeSharedOfficials(e.target.checked)}
                      className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs text-red-700">Incluir oficiales de otras oposiciones con temario compartido</span>
                  </label>
                </div>
              )}

              {/* Articulos imprescindibles */}
              <label className="flex items-center space-x-2 cursor-pointer border-t border-gray-200 pt-4">
                <input
                  type="checkbox"
                  checked={focusEssentialArticles}
                  onChange={(e) => {
                    setFocusEssentialArticles(e.target.checked)
                    if (e.target.checked) setOnlyOfficialQuestions(false)
                  }}
                  disabled={onlyOfficialQuestions}
                  className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                />
                <span className="text-sm font-medium text-gray-700">⭐ Artículos imprescindibles de <strong>{config.shortName}</strong></span>
              </label>

              {focusEssentialArticles && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-bold text-yellow-800">Artículos Imprescindibles Activado</p>
                  <p className="text-xs text-yellow-700">Solo preguntas de los artículos que más se repiten en exámenes oficiales de {config.shortName}. Ideal para centrarte en lo que más cae.</p>
                </div>
              )}

              {/* Modo adaptativo */}
              {selectedThemes.length >= 1 && (
                <label className="flex items-center space-x-2 cursor-pointer border-t border-gray-200 pt-4">
                  <input
                    type="checkbox"
                    checked={adaptiveMode}
                    onChange={(e) => setAdaptiveMode(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">✨ Modo adaptativo</span>
                </label>
              )}
              {selectedThemes.length >= 1 && adaptiveMode && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">Ajusta la dificultad en tiempo real según tus respuestas. Si fallas varias seguidas, las siguientes preguntas serán más fáciles. Empieza con preguntas que aún no has visto.</p>
                </div>
              )}
            </div>

            {/* Seleccion de temas */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">📚 Selecciona temas</h3>
                <div className="flex gap-2">
                  <button onClick={selectAllThemes} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200">
                    {allThemes.every(t => selectedThemes.includes(t.id)) ? 'Deseleccionar' : 'Todos'}
                  </button>
                  <button onClick={clearSelection} className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded-lg hover:bg-orange-200">
                    Limpiar
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {themeBlocks.map(block => {
                  const isExpanded = expandedBlocks[block.id]
                  const selectedInBlock = block.themes.filter(t => selectedThemes.includes(t.id)).length

                  return (
                    <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <button
                          onClick={() => setExpandedBlocks(prev => ({ ...prev, [block.id]: !prev[block.id] }))}
                          className="flex items-center gap-3 hover:opacity-70"
                        >
                          <span>{isExpanded ? '▼' : '▶'}</span>
                          <div className="text-left">
                            <h4 className="font-bold text-gray-800 text-sm">{block.title}</h4>
                            {block.subtitle && <p className="text-xs text-gray-600">{block.subtitle}</p>}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            {selectedInBlock}/{block.themes.length}
                          </span>
                          <button
                            onClick={() => selectBlockThemes(block.id)}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200"
                          >
                            {selectedInBlock === block.themes.length ? 'Quitar' : 'Todos'}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-4 bg-white">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {block.themes.map(theme => {
                              const accuracy = getThemeAccuracy(theme.id)
                              const isSelected = selectedThemes.includes(theme.id)

                              return (
                                <div
                                  key={theme.id}
                                  onClick={() => toggleTheme(theme.id)}
                                  className={`p-2 border-2 rounded-lg cursor-pointer transition-all ${
                                    isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center mb-1">
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center mr-1.5 ${
                                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="font-medium text-gray-800 text-xs">T{theme.displayNumber ?? theme.id}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-1 leading-tight line-clamp-2">{theme.name}</p>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-500">{theme.questionCount} preg.</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                      accuracy >= 80 ? 'bg-green-100 text-green-700' :
                                      accuracy >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {accuracy}%
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Resumen y disponibilidad */}
            {selectedThemes.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📋 Resumen del test</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>{selectedThemes.length}</strong> temas seleccionados</p>
                    <p>• <strong>{effectiveNumQuestions}</strong> preguntas</p>
                    <p>• Modo: <strong>{testMode === 'practica' ? '📚 Practica' : '📝 Examen'}</strong></p>
                    <p>• Dificultad: <strong>{difficulty === 'mixed' ? 'Mixto' : difficulty}</strong></p>
                  </div>
                </div>

                {/* Disponibilidad */}
                <div className={`p-4 border rounded-lg ${
                  checkingAvailability ? 'bg-gray-50 border-gray-200' :
                  poolCap >= numQuestions ? 'bg-green-50 border-green-200' :
                  poolCap > 0 ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  {checkingAvailability ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span>Verificando preguntas disponibles...</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span>{poolCap >= numQuestions ? '✅' : poolCap > 0 ? '⚠️' : '❌'}</span>
                        <span className="font-semibold">
                          {availableNeverSeen !== null && availableNeverSeen < availableQuestions ? (
                            <>📊 {availableQuestions} preguntas ({availableNeverSeen} nuevas · {availableQuestions - availableNeverSeen} ya vistas)</>
                          ) : (
                            <>📊 Preguntas disponibles: {availableQuestions}</>
                          )}
                        </span>
                      </div>

                      {/* Toggle "incluir vistas" — solo se muestra si hay déficit de nunca-vistas */}
                      {availableNeverSeen !== null
                        && availableNeverSeen < numQuestions
                        && availableQuestions > availableNeverSeen && (
                        <div className="mt-3 p-3 bg-white border border-blue-200 rounded-lg">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={includeSeenQuestions}
                              onChange={(e) => setIncludeSeenQuestions(e.target.checked)}
                              className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <div className="text-sm">
                              <p className="font-medium text-gray-800">
                                🔁 Incluir preguntas que ya he respondido
                              </p>
                              <p className="text-gray-600 mt-1">
                                Solo hay <strong>{availableNeverSeen}</strong> preguntas nuevas.
                                Marca esta opción para repasar también las que ya hiciste y llegar a las {numQuestions} que pediste.
                              </p>
                            </div>
                          </label>
                        </div>
                      )}

                      {poolCap < numQuestions && poolCap > 0 && !includeSeenQuestions && availableNeverSeen === null && (
                        <p className="text-sm text-yellow-700">Solo hay {poolCap} preguntas disponibles</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Modo test */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Modo de test</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => handleTestModeChange('practica')}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        testMode === 'practica' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">📚</div>
                      <h4 className="font-bold text-gray-800">Practica</h4>
                      <p className="text-xs text-gray-600">Feedback inmediato tras cada pregunta</p>
                    </div>
                    <div
                      onClick={() => handleTestModeChange('examen')}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        testMode === 'examen' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">📝</div>
                      <h4 className="font-bold text-gray-800">Examen</h4>
                      <p className="text-xs text-gray-600">Correccion al final del test</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Boton generar */}
            <div className="mt-6">
              {hasLimit && questionsRemaining <= 0 ? (
                <Link
                  href="/premium"
                  className="block w-full py-4 rounded-xl font-bold text-lg text-center transition-all bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl"
                >
                  👑 Hazte Premium para seguir practicando
                </Link>
              ) : (
                <button
                  onClick={generateTest}
                  disabled={generating || selectedThemes.length === 0 || poolCap === 0}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                    generating || selectedThemes.length === 0 || poolCap === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {generating ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Generando...
                    </span>
                  ) : selectedThemes.length === 0 ? (
                    'Selecciona al menos un tema'
                  ) : availableQuestions === 0 ? (
                    'No hay preguntas disponibles'
                  ) : poolCap === 0 ? (
                    'Has visto todas — marca "incluir vistas" para repasar'
                  ) : (
                    `🎲 Generar Test de ${effectiveNumQuestions} preguntas`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
