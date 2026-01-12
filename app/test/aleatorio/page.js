'use client'
import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import { getOposicionConfig, getAllThemes, getAvailableOposiciones, slugToPositionType } from '@/lib/config/oposiciones'

function TestAleatorioContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Detectar oposición desde URL o perfil del usuario
  const oposicionParam = searchParams.get('oposicion')
  const [currentOposicion, setCurrentOposicion] = useState(null)
  const [oposicionConfig, setOposicionConfig] = useState(null)

  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedThemes, setSelectedThemes] = useState([])
  const [numQuestions, setNumQuestions] = useState(25)
  const [difficulty, setDifficulty] = useState('mixed')
  const [generating, setGenerating] = useState(false)
  const [onlyOfficialQuestions, setOnlyOfficialQuestions] = useState(false)
  const [focusEssentialArticles, setFocusEssentialArticles] = useState(false)
  const [adaptiveMode, setAdaptiveMode] = useState(true)
  const [availableQuestions, setAvailableQuestions] = useState(0)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [checkingProgress, setCheckingProgress] = useState({ current: 0, total: 0, themeName: '' })
  const [loadingThemeCounts, setLoadingThemeCounts] = useState(true)
  const [testMode, setTestMode] = useState('practica')
  const [expandedBlocks, setExpandedBlocks] = useState({})
  const [themeTotalQuestions, setThemeTotalQuestions] = useState({})

  // Modales
  const [showOfficialModal, setShowOfficialModal] = useState(false)
  const [showEssentialModal, setShowEssentialModal] = useState(false)
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false)
  const [showPrioritizationModal, setShowPrioritizationModal] = useState(false)
  const [showThemeSelectionModal, setShowThemeSelectionModal] = useState(false)

  // Inicializar oposición cuando se carga el usuario
  useEffect(() => {
    if (loading) return

    let targetOposicion = oposicionParam

    // Si no hay parámetro, intentar obtener del perfil del usuario
    if (!targetOposicion && user?.user_metadata?.position_type) {
      targetOposicion = user.user_metadata.position_type
    }

    // Default a auxiliar_administrativo si no hay nada
    if (!targetOposicion) {
      targetOposicion = 'auxiliar_administrativo'
    }

    const config = getOposicionConfig(targetOposicion)
    if (config) {
      setCurrentOposicion(targetOposicion)
      setOposicionConfig(config)

      // Expandir el primer bloque por defecto
      const initialExpanded = {}
      config.themeBlocks.forEach((block, index) => {
        initialExpanded[block.id] = index === 0
      })
      setExpandedBlocks(initialExpanded)
    }
  }, [loading, user, oposicionParam])

  // Lista plana de temas
  const themes = oposicionConfig ? getAllThemes(oposicionConfig.id) : []

  // Cargar datos iniciales
  const loadInitialData = async (userId) => {
    if (!oposicionConfig) return

    setLoadingThemeCounts(true)
    setStatsLoading(true)
    try {
      const params = new URLSearchParams({
        oposicion: oposicionConfig.slug,
      })
      if (userId) {
        params.append('userId', userId)
      }

      const response = await fetch(`/api/random-test-data?${params.toString()}`)
      const result = await response.json()

      if (!result.success) {
        console.error('Error cargando datos:', result.error)
        return
      }

      if (result.themeQuestionCounts) {
        setThemeTotalQuestions(result.themeQuestionCounts)
      }

      if (result.userStats) {
        setUserStats(result.userStats)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error cargando datos iniciales:', error)
      }
    } finally {
      setLoadingThemeCounts(false)
      setStatsLoading(false)
    }
  }

  // Cargar preferencia de modo desde localStorage
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('preferredTestMode')
      if (savedMode === 'practica' || savedMode === 'examen') {
        setTestMode(savedMode)
      }
    } catch (e) {
      // localStorage bloqueado
    }
  }, [])

  const handleTestModeChange = (newMode) => {
    setTestMode(newMode)
    try {
      localStorage.setItem('preferredTestMode', newMode)
    } catch (e) {}

    if (newMode === 'examen' && difficulty !== 'mixed') {
      setDifficulty('mixed')
    }
  }

  // Verificar preguntas disponibles
  useEffect(() => {
    if (selectedThemes.length > 0 && oposicionConfig) {
      checkAvailableQuestions()
      if (selectedThemes.length > 1 && adaptiveMode) {
        setAdaptiveMode(false)
      }
    } else {
      setAvailableQuestions(0)
    }
  }, [selectedThemes, difficulty, onlyOfficialQuestions, focusEssentialArticles, user, oposicionConfig])

  const checkAvailableQuestions = async () => {
    if (selectedThemes.length === 0 || !oposicionConfig) {
      setAvailableQuestions(0)
      return
    }

    setCheckingAvailability(true)

    try {
      const response = await fetch('/api/random-test-data/check-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oposicion: oposicionConfig.slug,
          selectedThemes,
          difficulty,
          onlyOfficialQuestions,
          focusEssentialArticles,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        console.error('Error verificando disponibilidad:', result.error)
        const fallback = selectedThemes.length * (onlyOfficialQuestions ? 10 : focusEssentialArticles ? 8 : 50)
        setAvailableQuestions(fallback)
        return
      }

      setAvailableQuestions(result.availableQuestions || 0)

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error verificando preguntas disponibles:', error)
      }
      const fallback = selectedThemes.length * (onlyOfficialQuestions ? 10 : focusEssentialArticles ? 8 : 50)
      setAvailableQuestions(fallback)
    } finally {
      setCheckingAvailability(false)
    }
  }

  const getThemeAccuracy = (themeId) => {
    const stats = userStats[themeId]
    if (!stats || stats.total === 0) return 0
    return stats.accuracy
  }

  const toggleTheme = (themeId) => {
    const newSelection = selectedThemes.includes(themeId)
      ? selectedThemes.filter(id => id !== themeId)
      : [...selectedThemes, themeId]
    setSelectedThemes(newSelection)
  }

  const selectAllThemes = () => {
    const allThemeIds = themes.map(theme => theme.id)
    setSelectedThemes(allThemeIds)
  }

  const clearSelection = () => {
    setSelectedThemes([])
  }

  const selectBlockThemes = (blockId) => {
    if (!oposicionConfig) return
    const block = oposicionConfig.themeBlocks.find(b => b.id === blockId)
    if (!block) return

    const blockThemeIds = block.themes.map(t => t.id)
    const otherSelectedThemes = selectedThemes.filter(id => !blockThemeIds.includes(id))
    const allBlockSelected = blockThemeIds.every(id => selectedThemes.includes(id))

    if (allBlockSelected) {
      setSelectedThemes(otherSelectedThemes)
    } else {
      setSelectedThemes([...otherSelectedThemes, ...blockThemeIds])
    }
  }

  const generateRandomTest = async () => {
    if (selectedThemes.length === 0 || !oposicionConfig) {
      alert('Selecciona al menos un tema para generar el test aleatorio')
      return
    }

    setGenerating(true)

    try {
      const testParams = new URLSearchParams({
        themes: selectedThemes.join(','),
        n: numQuestions.toString(),
        difficulty: difficulty,
        mode: 'aleatorio',
        oposicion: oposicionConfig.positionType,
        utm_source: 'test_aleatorio'
      })

      if (onlyOfficialQuestions) {
        testParams.append('official_only', 'true')
      }

      if (focusEssentialArticles) {
        testParams.append('focus_essential', 'true')
      }

      if (adaptiveMode) {
        testParams.append('adaptive', 'true')
      }

      // Redirigir a rutas genéricas
      const testPath = testMode === 'examen' ? 'aleatorio-examen' : 'personalizado'
      router.push(`/test/${testPath}?${testParams.toString()}`)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating random test:', error)
      }
      alert('Error al generar el test aleatorio. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  // Refresh stats when page becomes visible
  useEffect(() => {
    if (!user || !oposicionConfig) return

    const handleVisibilityChange = () => {
      if (!document.hidden && user && !loading && !statsLoading && selectedThemes.length > 0) {
        loadInitialData(user.id)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [user, loading, statsLoading, selectedThemes.length, oposicionConfig])

  // Loading state
  if (loading || !oposicionConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acceso Requerido</h2>
          <p className="text-gray-600 mb-6">Inicia sesión para acceder al test aleatorio</p>
          <Link
            href="/auth/login"
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Iniciar Sesión
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
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎲 Test Aleatorio
          </h1>
          <p className="text-gray-600 mb-2">
            Configura tu test personalizado seleccionando los temas que quieres practicar
          </p>
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            📚 {oposicionConfig.name}
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {/* Configuración */}
            <div className="space-y-6 mb-6">

              {/* 1. Número de Preguntas */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  📝 Número de preguntas: <span className="text-blue-600">{numQuestions}</span>
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[10, 25, 50, 100].map((num) => (
                    <button
                      key={num}
                      onClick={() => setNumQuestions(num)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        numQuestions === num
                          ? 'bg-blue-600 text-white shadow-lg scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      } ${num > availableQuestions && availableQuestions > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      disabled={num > availableQuestions && availableQuestions > 0}
                    >
                      {(num > availableQuestions && availableQuestions > 0) ? `${num}*` : num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Configuración de Dificultad */}
              <div className="mb-6">
                <label className={`text-sm font-bold mb-3 block ${
                  onlyOfficialQuestions || testMode === 'examen' ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  🎯 Dificultad del Test
                </label>

                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { value: 'mixed', label: '🎲 Aleatoria', color: 'blue' },
                    { value: 'easy', label: '🟢 Fácil', color: 'green' },
                    { value: 'medium', label: '🟡 Medio', color: 'yellow' },
                    { value: 'hard', label: '🟠 Difícil', color: 'orange' }
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setDifficulty(opt.value)}
                      disabled={onlyOfficialQuestions || testMode === 'examen'}
                      className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                        onlyOfficialQuestions || testMode === 'examen'
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                          : difficulty === opt.value
                          ? `bg-gradient-to-r from-${opt.color}-500 to-${opt.color}-600 text-white shadow-lg`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Configuraciones Avanzadas */}
              <div className="mb-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                  {/* Solo preguntas oficiales */}
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyOfficialQuestions}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setOnlyOfficialQuestions(checked)
                        if (checked && focusEssentialArticles) setFocusEssentialArticles(false)
                        if (checked && difficulty !== 'mixed') setDifficulty('mixed')
                      }}
                      disabled={focusEssentialArticles}
                      className={`rounded border-gray-300 text-red-600 focus:ring-red-500 ${
                        focusEssentialArticles ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className={`text-sm font-medium ${focusEssentialArticles ? 'text-gray-400' : 'text-gray-700'}`}>
                      🏛️ Solo preguntas oficiales
                    </span>
                  </label>

                  {/* Artículos imprescindibles */}
                  <label className="flex items-center space-x-2 cursor-pointer border-t border-gray-200 pt-4">
                    <input
                      type="checkbox"
                      checked={focusEssentialArticles}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setFocusEssentialArticles(checked)
                        if (checked && onlyOfficialQuestions) setOnlyOfficialQuestions(false)
                      }}
                      disabled={onlyOfficialQuestions}
                      className={`rounded border-gray-300 text-orange-600 focus:ring-orange-500 ${
                        onlyOfficialQuestions ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className={`text-sm font-medium ${onlyOfficialQuestions ? 'text-gray-400' : 'text-gray-700'}`}>
                      ⭐ Enfocar en artículos imprescindibles
                    </span>
                  </label>

                  {/* Modo adaptativo - Solo para un tema */}
                  {selectedThemes.length === 1 && (
                    <label className="flex items-center space-x-2 cursor-pointer border-t border-gray-200 pt-4">
                      <input
                        type="checkbox"
                        checked={adaptiveMode}
                        onChange={(e) => setAdaptiveMode(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        ✨ Modo adaptativo anti-frustración
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Selección de temas */}
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                    📚 Selecciona temas
                  </h3>
                </div>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={selectAllThemes}
                    className="text-xs sm:text-sm bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs sm:text-sm bg-orange-100 text-orange-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-orange-200 transition-colors font-medium"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Renderizar temas por bloques */}
              <div className="space-y-4">
                {oposicionConfig.themeBlocks.map(block => {
                  const isExpanded = expandedBlocks[block.id]
                  const blockThemes = block.themes
                  const selectedInBlock = blockThemes.filter(t => selectedThemes.includes(t.id)).length

                  return (
                    <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header del bloque */}
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        <button
                          onClick={() => setExpandedBlocks(prev => ({ ...prev, [block.id]: !prev[block.id] }))}
                          className="flex items-center gap-3 hover:opacity-70 transition-opacity"
                        >
                          <span className="text-lg">{isExpanded ? '▼' : '▶'}</span>
                          <div className="text-left">
                            <h4 className="font-bold text-gray-800 text-sm">{block.title}</h4>
                            <p className="text-xs text-gray-600">{block.subtitle}</p>
                          </div>
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                            {selectedInBlock}/{blockThemes.length}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              selectBlockThemes(block.id)
                            }}
                            className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors font-medium"
                          >
                            {selectedInBlock === blockThemes.length ? 'Deseleccionar' : 'Seleccionar'}
                          </button>
                        </div>
                      </div>

                      {/* Contenido del bloque */}
                      {isExpanded && (
                        <div className="p-4 bg-white">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                            {blockThemes.map(theme => {
                              const accuracy = getThemeAccuracy(theme.id)
                              const isSelected = selectedThemes.includes(theme.id)

                              return (
                                <div
                                  key={theme.id}
                                  onClick={() => toggleTheme(theme.id)}
                                  className={`p-2 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center mb-1">
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center mr-1.5 flex-shrink-0 ${
                                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="font-medium text-gray-800 text-xs">T{theme.id}</span>
                                  </div>
                                  <p className="text-xs text-gray-600 mb-1 leading-tight overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                                    {theme.name}
                                  </p>
                                  <div className={`text-xs px-1.5 py-0.5 rounded-full text-center ${
                                    accuracy >= 80 ? 'bg-green-100 text-green-700' :
                                    accuracy >= 60 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {accuracy}%
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

            {/* Resumen de selección */}
            {selectedThemes.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📋 Resumen del test</h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>{selectedThemes.length}</strong> temas seleccionados</p>
                    <p>• <strong>{numQuestions}</strong> preguntas totales</p>
                    <p>• Modo: <strong>{testMode === 'practica' ? '📚 Práctica' : '📝 Examen'}</strong></p>
                    <p>• Dificultad: <strong>{
                      difficulty === 'mixed' ? 'Mixto' :
                      difficulty === 'easy' ? 'Fácil' :
                      difficulty === 'medium' ? 'Intermedio' : 'Difícil'
                    }</strong></p>
                  </div>
                </div>

                {/* Contador de preguntas disponibles */}
                <div className={`p-4 border rounded-lg ${
                  checkingAvailability
                    ? 'bg-gray-50 border-gray-200'
                    : availableQuestions >= numQuestions
                    ? 'bg-green-50 border-green-200'
                    : availableQuestions > 0
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  {checkingAvailability ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="font-semibold text-gray-800">Verificando preguntas disponibles...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {availableQuestions >= numQuestions ? '✅' : availableQuestions > 0 ? '⚠️' : '❌'}
                      </span>
                      <span className={`font-semibold ${
                        availableQuestions >= numQuestions ? 'text-green-800' :
                        availableQuestions > 0 ? 'text-yellow-800' : 'text-red-800'
                      }`}>
                        📊 Preguntas disponibles: {availableQuestions}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selector de Modo: Práctica vs Examen */}
            {selectedThemes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🎯 Selecciona el modo de test</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Modo Práctica */}
                  <div
                    onClick={() => handleTestModeChange('practica')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      testMode === 'practica'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center mb-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                        testMode === 'practica' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                      }`}>
                        {testMode === 'practica' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <h4 className="font-bold text-gray-800 flex items-center">
                        <span className="mr-2">📚</span>
                        Modo Práctica
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Corrección inmediata después de cada pregunta.
                    </p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex items-center"><span className="text-green-600 mr-2">✓</span>Retroalimentación instantánea</div>
                      <div className="flex items-center"><span className="text-green-600 mr-2">✓</span>Explicación detallada</div>
                    </div>
                  </div>

                  {/* Modo Examen */}
                  <div
                    onClick={() => handleTestModeChange('examen')}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      testMode === 'examen'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center mb-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${
                        testMode === 'examen' ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                      }`}>
                        {testMode === 'examen' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                      </div>
                      <h4 className="font-bold text-gray-800 flex items-center">
                        <span className="mr-2">📝</span>
                        Modo Examen
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Todas las preguntas, corrección al final.
                    </p>
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex items-center"><span className="text-orange-600 mr-2">✓</span>Experiencia real de examen</div>
                      <div className="flex items-center"><span className="text-orange-600 mr-2">✓</span>Cronómetro de tiempo</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botón de generar */}
            <div className="mt-8 text-center">
              <button
                onClick={generateRandomTest}
                disabled={selectedThemes.length === 0 || generating || availableQuestions < numQuestions}
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                  selectedThemes.length === 0 || availableQuestions < numQuestions
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : generating
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl active:scale-95'
                }`}
              >
                {generating ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {testMode === 'examen' ? 'Preparando examen...' : 'Generando test...'}
                  </div>
                ) : (
                  <div className="flex items-center">
                    <span className="mr-3 text-2xl">🚀</span>
                    Generar Test Aleatorio
                  </div>
                )}
              </button>

              {(selectedThemes.length === 0 || availableQuestions < numQuestions) && (
                <p className="text-sm text-gray-500 mt-2">
                  {selectedThemes.length === 0
                    ? 'Selecciona al menos un tema para continuar'
                    : availableQuestions === 0
                    ? 'No hay preguntas disponibles con estos criterios'
                    : `Solo hay ${availableQuestions} preguntas disponibles`
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TestAleatorioPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <TestAleatorioContent />
    </Suspense>
  )
}
