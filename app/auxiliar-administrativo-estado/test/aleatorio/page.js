'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function TestAleatorioPage() {
  const { user, loading } = useAuth()
  
  const [userStats, setUserStats] = useState({})
  const [statsLoading, setStatsLoading] = useState(false)
  const [selectedThemes, setSelectedThemes] = useState([])
  const [numQuestions, setNumQuestions] = useState(25)
  const [difficulty, setDifficulty] = useState('mixed')
  const [generating, setGenerating] = useState(false)
  const [onlyOfficialQuestions, setOnlyOfficialQuestions] = useState(false)
  const [focusEssentialArticles, setFocusEssentialArticles] = useState(false)
  const [adaptiveMode, setAdaptiveMode] = useState(true) // Activado por defecto
  const [showOfficialModal, setShowOfficialModal] = useState(false)
  const [showEssentialModal, setShowEssentialModal] = useState(false)
  const [showAdaptiveModal, setShowAdaptiveModal] = useState(false)
  const [showPrioritizationModal, setShowPrioritizationModal] = useState(false)
  const [showThemeSelectionModal, setShowThemeSelectionModal] = useState(false)
  const [availableQuestions, setAvailableQuestions] = useState(0)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [checkingProgress, setCheckingProgress] = useState({ current: 0, total: 0, themeName: '' })
  const [showDetailedStatsPerTheme, setShowDetailedStatsPerTheme] = useState({}) // Por tema: {1: true, 3: false}
  const [detailedStats, setDetailedStats] = useState({})
  const [loadingDetailedStatsPerTheme, setLoadingDetailedStatsPerTheme] = useState({}) // Por tema: {1: true}
  const [loadingThemeCounts, setLoadingThemeCounts] = useState(true)
  const [testMode, setTestMode] = useState('practica') // 'practica' o 'examen'
  const [expandedBlocks, setExpandedBlocks] = useState({ block1: true, block2: true }) // Bloques expandidos por defecto

  const router = useRouter()

  const themeBlocks = [
    {
      id: 'block1',
      title: 'Bloque I: Temas Generales',
      subtitle: 'Derecho Constitucional y Administrativo',
      themes: [
        { id: 1, name: "La Constitución Española de 1978" },
        { id: 2, name: "El Tribunal Constitucional. La Corona" },
        { id: 3, name: "Las Cortes Generales" },
        { id: 4, name: "El Poder Judicial" },
        { id: 5, name: "El Gobierno y la Administración" },
        { id: 6, name: "El Gobierno Abierto. Agenda 2030" },
        { id: 7, name: "Ley 19/2013 de Transparencia" },
        { id: 8, name: "La Administración General del Estado" },
        { id: 9, name: "La Organización Territorial del Estado" },
        { id: 10, name: "La Organización de la Unión Europea" },
        { id: 11, name: "Las Leyes del Procedimiento Administrativo Común" },
        { id: 12, name: "La Protección de Datos Personales" },
        { id: 13, name: "El Personal Funcionario de las Administraciones Públicas" },
        { id: 14, name: "Derechos y Deberes de los Funcionarios" },
        { id: 15, name: "El Presupuesto del Estado en España" },
        { id: 16, name: "Políticas de Igualdad y contra la Violencia de Género" }
      ]
    },
    {
      id: 'block2',
      title: 'Bloque II: Temas Específicos',
      subtitle: 'Informática y Atención al Ciudadano',
      themes: [
        { id: 101, name: "Tema 1: Atención al ciudadano" },
        { id: 102, name: "Tema 2: Servicios de información administrativa" },
        { id: 103, name: "Tema 3: Documento, registro y archivo" },
        { id: 104, name: "Tema 4: Administración electrónica" },
        { id: 105, name: "Tema 5: Informática básica" },
        { id: 106, name: "Tema 6: Sistema operativo" },
        { id: 107, name: "Tema 7: Explorador de Windows" },
        { id: 108, name: "Tema 8: Word" },
        { id: 109, name: "Tema 9: Excel" },
        { id: 110, name: "Tema 10: Access" },
        { id: 111, name: "Tema 11: Correo electrónico" },
        { id: 112, name: "Tema 12: Internet" }
      ]
    }
  ]

  // Lista plana de todos los temas para compatibilidad con funciones existentes
  const themes = themeBlocks.flatMap(block => block.themes)

  const loadThemeQuestionCounts = async () => {
    setLoadingThemeCounts(true)
    try {
      const { getSupabaseClient } = await import('../../../../lib/supabase')
      const supabase = getSupabaseClient()
      const counts = {}
      
      // Procesar todos los temas EN PARALELO para mayor velocidad
      const themePromises = themes.map(async (theme) => {
        if (theme.id === 1) {
        }
        try {
          // Obtener mapeo del tema desde topic_scope
          const { data: mappings, error: mappingError } = await supabase
            .from('topic_scope')
            .select(`
              article_numbers,
              laws!inner(short_name, id, name),
              topics!inner(topic_number, position_type)
            `)
            .eq('topics.topic_number', theme.id)
            .eq('topics.position_type', 'auxiliar_administrativo')

          if (mappingError || !mappings?.length) {
            // Actualizar inmediatamente este tema específico
            setThemeTotalQuestions(prev => ({ ...prev, [theme.id]: 0 }))
            return { themeId: theme.id, count: 0 }
          }

          // Método original de topic_scope
          const mappingPromises = mappings.map(async (mapping) => {
            const { count, error: countError } = await supabase
              .from('questions')
              .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
              .eq('is_active', true)
              .eq('articles.laws.short_name', mapping.laws.short_name)
              .in('articles.article_number', mapping.article_numbers)

            return !countError && count > 0 ? count : 0
          })

          const mappingCounts = await Promise.all(mappingPromises)
          const totalCount = mappingCounts.reduce((sum, count) => sum + count, 0)
          
          // Debug específico para tema 1
          if (theme.id === 1) {
          }
          
          // Actualizar inmediatamente este tema específico conforme va llegando
          setThemeTotalQuestions(prev => ({ ...prev, [theme.id]: totalCount }))
          if (theme.id === 1 || theme.id === 3) {
          }
          
          return { themeId: theme.id, count: totalCount }

        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error contando tema ${theme.id}:`, error)
          }
          // No usar fallback hardcoded, usar 0 para forzar recálculo
          setThemeTotalQuestions(prev => ({ ...prev, [theme.id]: 0 }))
          return { themeId: theme.id, count: 0 }
        }
      })

      // Esperar a que todos los temas terminen para finalizar el estado de carga
      await Promise.all(themePromises)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error cargando conteos de temas:', error)
      }
      // Fallback a valores hardcodeados si falla
      const fallbackCounts = {}
      for (const theme of themes) {
        fallbackCounts[theme.id] = getThemeTotalQuestions(theme.id)
      }
      setThemeTotalQuestions(fallbackCounts)
    } finally {
      setLoadingThemeCounts(false)
    }
  }

  // Cargar preferencia de modo desde localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('preferredTestMode')
    if (savedMode === 'practica' || savedMode === 'examen') {
      setTestMode(savedMode)
    }
  }, [])

  // Función helper para cambiar modo y guardar preferencia
  const handleTestModeChange = (newMode) => {
    setTestMode(newMode)
    localStorage.setItem('preferredTestMode', newMode)

    // Si se cambia a modo examen, resetear la dificultad a 'mixed' (aleatorio)
    if (newMode === 'examen' && difficulty !== 'mixed') {
      setDifficulty('mixed')
    }
  }

  // Verificar preguntas disponibles cuando cambien los criterios
  useEffect(() => {
    if (selectedThemes.length > 0) {
      checkAvailableQuestions()
      // Desactivar modo adaptativo automáticamente si hay más de un tema
      if (selectedThemes.length > 1 && adaptiveMode) {
        setAdaptiveMode(false)
      }
    } else {
      setAvailableQuestions(0)
    }
  }, [selectedThemes, difficulty, onlyOfficialQuestions, focusEssentialArticles, user])

  const loadUserStats = async (userId) => {
    setStatsLoading(true)
    try {
      const { getSupabaseClient } = await import('../../../../lib/supabase')
      const supabase = getSupabaseClient()

      // MÉTODO OPTIMIZADO: Dos queries para evitar timeout en el join
      // 1. Obtener test IDs del usuario (últimos 6 meses)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const { data: userTests, error: testsError } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', sixMonthsAgo.toISOString())
        .limit(1000)

      if (testsError || !userTests || userTests.length === 0) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error obteniendo tests del usuario:', testsError)
        }
        setUserStats({})
        return
      }

      const testIds = userTests.map(t => t.id)

      // 2. Obtener respuestas de esos tests (más eficiente con índice en test_id)
      const { data: responses, error: allError } = await supabase
        .from('test_questions')
        .select('tema_number, is_correct, created_at, question_id, test_id')
        .in('test_id', testIds)
        .order('created_at', { ascending: false })

      if (allError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Error obteniendo respuestas:', allError)
        }
        return
      }
      
      const themeStats = {}
      
      responses.forEach(response => {
        const theme = response.tema_number
        if (!theme) return

        if (!themeStats[theme]) {
          themeStats[theme] = { 
            total: 0, 
            correct: 0, 
            lastStudy: null 
          }
        }
        
        themeStats[theme].total++
        if (response.is_correct) {
          themeStats[theme].correct++
        }
        
        const studyDate = new Date(response.created_at)
        if (!themeStats[theme].lastStudy || studyDate > themeStats[theme].lastStudy) {
          themeStats[theme].lastStudy = studyDate
        }
      })

      Object.keys(themeStats).forEach(theme => {
        const stats = themeStats[theme]
        stats.accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
      })
      
      setUserStats(themeStats)
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading user stats:', error)
      }
    } finally {
      setStatsLoading(false)
    }
  }

  // ✅ FUNCIÓN para cargar estadísticas detalladas de UN tema específico
  const loadDetailedStatsForTheme = async (themeId, userId) => {
    // Marcar este tema como "cargando"
    setLoadingDetailedStatsPerTheme(prev => ({ ...prev, [themeId]: true }))
    
    try {
      const { getSupabaseClient } = await import('../../../../lib/supabase')
      const supabase = getSupabaseClient()

      // 1. Obtener mapeo del tema desde topic_scope
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', themeId)
        .eq('topics.position_type', 'auxiliar_administrativo')

      if (mappingError || !mappings?.length) {
        setDetailedStats(prev => ({ ...prev, [themeId]: { total: 0, answered: 0, neverSeen: 0 } }))
        return
      }

      // 2. Contar preguntas totales disponibles
      const allQuestionIds = new Set()
      
      for (const mapping of mappings) {
        const { data: questionIds, error: qError } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))')
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
          .eq('is_active', true)

        if (qError || !questionIds?.length) continue
        
        questionIds.forEach(q => allQuestionIds.add(q.id))
      }
      
      const totalQuestions = allQuestionIds.size
      
      // 3. Obtener preguntas respondidas por el usuario (usando Set para evitar duplicados)
      const { data: responses, error: rError } = await supabase
        .from('test_questions')
        .select('question_id, tests!inner(user_id)')
        .eq('tests.user_id', userId)
        .in('question_id', Array.from(allQuestionIds))

      const answeredQuestionIds = new Set()
      if (responses) {
        responses.forEach(response => {
          answeredQuestionIds.add(response.question_id)
        })
      }
      
      const answeredCount = answeredQuestionIds.size
      const neverSeenCount = totalQuestions - answeredCount
      
      // Actualizar solo este tema específico
      setDetailedStats(prev => ({
        ...prev,
        [themeId]: {
          total: totalQuestions,
          answered: answeredCount,
          neverSeen: neverSeenCount
        }
      }))
      
      console.log(`📊 Stats detalladas T${themeId}: ${totalQuestions} total, ${answeredCount} vistas, ${neverSeenCount} nunca vistas`)
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`Error calculando detailed stats tema ${themeId}:`, error)
      }
      setDetailedStats(prev => ({ ...prev, [themeId]: { total: 0, answered: 0, neverSeen: 0 } }))
    } finally {
      // Quitar el estado de "cargando" para este tema
      setLoadingDetailedStatsPerTheme(prev => ({ ...prev, [themeId]: false }))
    }
  }

  // Función para alternar vista detallada de un tema
  const toggleThemeDetailedStats = (themeId) => {
    const currentlyShowing = showDetailedStatsPerTheme[themeId]
    
    if (currentlyShowing) {
      // Ocultar estadísticas detalladas
      setShowDetailedStatsPerTheme(prev => ({ ...prev, [themeId]: false }))
    } else {
      // Mostrar estadísticas detalladas
      setShowDetailedStatsPerTheme(prev => ({ ...prev, [themeId]: true }))
      
      // Si no las tenemos cargadas, cargarlas
      if (!detailedStats[themeId]) {
        loadDetailedStatsForTheme(themeId, user?.id)
      }
    }
  }

  const getStudiedThemes = () => {
    const studiedThemes = themes.filter(theme => {
      const stats = userStats[theme.id]
      const qualifies = stats && stats.total >= 10 && stats.accuracy > 10
      
      // Debug específico para Tema 1
      if (theme.id === 1) {
      }
      
      return qualifies
    })
    
    return studiedThemes
  }

  const getAllThemes = () => {
    return themes // Todos los temas disponibles
  }

  const [themeTotalQuestions, setThemeTotalQuestions] = useState({})

  const getThemeTotalQuestions = (themeId) => {
    const themeQuestionCounts = {
      1: 559,   // La Constitución Española de 1978  
      2: 235,   // El Tribunal Constitucional. La Corona  
      3: 257,   // Las Cortes Generales
      4: 132,   // El Poder Judicial
      5: 123,   // El Gobierno y la Administración
      6: 226,   // El Gobierno Abierto. Agenda 2030
      7: 546,   // Ley 19/2013 de Transparencia
      8: 202,   // La Administración General del Estado
      9: 10,    // La Organización Territorial del Estado
      10: 6,    // La Organización de la Unión Europea
      11: 77,   // Las Leyes del Procedimiento Administrativo Común
      12: 11,   // La Protección de Datos Personales
      13: 18,   // El Personal Funcionario de las Administraciones Públicas
      14: 48,   // Derechos y Deberes de los Funcionarios (mantener si no hay datos)
      15: 26,   // El Presupuesto del Estado en España (mantener si no hay datos)
      16: 137   // Políticas de Igualdad y contra la Violencia de Género (mantener si no hay datos)
    }

    return themeQuestionCounts[themeId] || 0
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

  const selectAllStudiedThemes = () => {
    const allThemeIds = getAllThemes().map(theme => theme.id)
    setSelectedThemes(allThemeIds)
  }

  const clearSelection = () => {
    setSelectedThemes([])
  }

  const selectBlockThemes = (blockId) => {
    const block = themeBlocks.find(b => b.id === blockId)
    if (!block) return

    const blockThemeIds = block.themes.map(t => t.id)
    const otherSelectedThemes = selectedThemes.filter(id => !blockThemeIds.includes(id))
    const allBlockSelected = blockThemeIds.every(id => selectedThemes.includes(id))

    // Si todos están seleccionados, deseleccionar; si no, seleccionar todos
    if (allBlockSelected) {
      setSelectedThemes(otherSelectedThemes)
    } else {
      setSelectedThemes([...otherSelectedThemes, ...blockThemeIds])
    }
  }

  // Función para verificar preguntas disponibles con los criterios actuales
  const checkAvailableQuestions = async () => {

    if (selectedThemes.length === 0) {
      setAvailableQuestions(0)
      return
    }

    setCheckingAvailability(true)
    setCheckingProgress({ current: 0, total: selectedThemes.length, themeName: '' })

    try {
      const { getSupabaseClient } = await import('../../../../lib/supabase')
      const supabase = getSupabaseClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAvailableQuestions(selectedThemes.length * 50)
        return
      }

      let totalQuestions = 0
      let currentThemeIndex = 0

      for (const tema of selectedThemes) {
        // Actualizar progreso con el nombre del tema actual
        const currentTheme = themes.find(t => t.id === tema)
        setCheckingProgress({
          current: currentThemeIndex + 1,
          total: selectedThemes.length,
          themeName: currentTheme?.name || `Tema ${tema}`
        })
        try {
          const { data: mappings, error: mappingError } = await supabase
            .from('topic_scope')
            .select(`
              article_numbers,
              laws!inner(short_name, id, name),
              topics!inner(topic_number, position_type)
            `)
            .eq('topics.topic_number', tema)
            .eq('topics.position_type', 'auxiliar_administrativo')

          if (mappingError || !mappings?.length) continue

          for (const mapping of mappings) {
            const lawShortName = mapping.laws.short_name
            const articleNumbers = mapping.article_numbers

            let filteredArticleNumbers = articleNumbers
            if (focusEssentialArticles) {
              // ✅ Solo filtrar si hay artículos imprescindibles, no bloquear todo
              
              const { count: essentialArticles, error: essentialError } = await supabase
                .from('questions')
                .select('id, articles!inner(article_number, laws!inner(short_name))', { count: 'exact', head: true })
                .eq('is_active', true)
                .eq('is_official_exam', true)
                .eq('articles.laws.short_name', lawShortName)
                .in('articles.article_number', articleNumbers)

              if (essentialError) {
                continue  // Solo saltar esta ley específica
              }
              
              if (!essentialArticles || essentialArticles === 0) {
                continue  // Solo saltar esta ley específica
              }
              
            }

            let query = supabase
              .from('questions')
              .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
              .eq('is_active', true)
              .eq('articles.laws.short_name', lawShortName)
              .in('articles.article_number', filteredArticleNumbers)

            if (difficulty !== 'mixed') {
              const difficultyMap = {
                'easy': 'easy',
                'medium': 'medium', 
                'hard': 'hard'
              }
              const targetDifficulty = difficultyMap[difficulty]
              if (targetDifficulty) {
                query = query.eq('difficulty', targetDifficulty)
              }
            }

            if (onlyOfficialQuestions) {
              query = query.eq('is_official_exam', true)
            }

            if (focusEssentialArticles) {
              query = query.eq('is_official_exam', true)
            }

            const { count, error: countError } = await query

            if (countError) continue

            if (count > 0) {
              totalQuestions += count
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error procesando tema ${tema}:`, error)
          }
        }
        currentThemeIndex++ // Incrementar índice para el siguiente tema
      }

      setAvailableQuestions(totalQuestions)

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

  const generateRandomTest = async () => {
    if (selectedThemes.length === 0) {
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
        utm_source: 'test_aleatorio'
      })

      // Agregar parámetros adicionales si están activados
      if (onlyOfficialQuestions) {
        testParams.append('official_only', 'true')
      }
      
      if (focusEssentialArticles) {
        testParams.append('focus_essential', 'true')
      }
      
      if (adaptiveMode) {
        testParams.append('adaptive', 'true')
      }

      // 🆕 REDIRIGIR SEGÚN EL MODO SELECCIONADO
      const testPath = testMode === 'examen' ? 'test-aleatorio-examen' : 'test-personalizado'
      router.push(`/auxiliar-administrativo-estado/test/${testPath}?${testParams.toString()}`)
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating random test:', error)
      }
      alert('Error al generar el test aleatorio. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }


  useEffect(() => {
    // NO cargar estadísticas automáticamente - solo cuando sea necesario
    // Las estadísticas se cargarán cuando:
    // 1. El usuario seleccione temas (para mostrar preguntas disponibles)
    // 2. El usuario haga hover sobre un tema (para ver detalles)
    // Esto hace que la página cargue INSTANTÁNEAMENTE
  }, [user?.id, loading])

  // 🔄 REFRESH STATS WHEN PAGE BECOMES VISIBLE (user returns from completed test)
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      // Solo recargar si hay temas seleccionados (el usuario está trabajando activamente)
      if (!document.hidden && user && !loading && !statsLoading && selectedThemes.length > 0) {
        loadUserStats(user.id)
        // No cargar loadThemeQuestionCounts - se hace on-demand
      }
    }

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for window focus (alternative method for when user returns)
    const handleWindowFocus = () => {
      // Solo recargar si hay temas seleccionados
      if (user && !loading && !statsLoading && selectedThemes.length > 0) {
        loadUserStats(user.id)
        // No cargar loadThemeQuestionCounts - se hace on-demand
      }
    }

    window.addEventListener('focus', handleWindowFocus)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [user, loading, statsLoading, selectedThemes.length])

  // Solo mostrar cargando si realmente estamos cargando la autenticación
  // No mostrar cargando para estadísticas (se cargan on-demand)
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }


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

  const availableThemes = getAllThemes() // Mostrar TODOS los temas, no solo los estudiados

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link 
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Tests
          </Link>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎲 Test Aleatorio
          </h1>
          <p className="text-gray-600">
            Configura tu test personalizado seleccionando los temas que quieres practicar
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {/* Configuración */}
            <div className="space-y-6 mb-6">
              
              {/* 1. Número de Preguntas */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  📝 Número de preguntas: <span className="text-blue-600">{numQuestions}</span>
                  {onlyOfficialQuestions && (
                    <span className="ml-2 text-red-600 text-xs">🏛️ Solo oficiales</span>
                  )}
                  {focusEssentialArticles && (
                    <span className="ml-2 text-orange-600 text-xs">⭐ Artículos clave</span>
                  )}
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
                {(numQuestions > availableQuestions && availableQuestions > 0) && (
                  <p className="text-xs text-orange-600 mt-1">
                    * Solo hay {availableQuestions} preguntas {
                      onlyOfficialQuestions ? 'oficiales' : 
                      focusEssentialArticles ? 'de artículos imprescindibles' :
                      ''
                    } disponibles
                  </p>
                )}
              </div>

              {/* 2. Configuración de Dificultad */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-3">
                  <label className={`text-sm font-bold ${
                    onlyOfficialQuestions || testMode === 'examen' ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    🎯 Dificultad del Test
                    {onlyOfficialQuestions && (
                      <span className="text-xs text-gray-500 ml-2">(deshabilitado con preguntas oficiales)</span>
                    )}
                    {testMode === 'examen' && !onlyOfficialQuestions && (
                      <span className="text-xs text-gray-500 ml-2">(aleatorio en modo examen)</span>
                    )}
                  </label>
                  <button
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-sm transition-colors ${
                      onlyOfficialQuestions || testMode === 'examen'
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setShowPrioritizationModal(true)}
                    disabled={onlyOfficialQuestions || testMode === 'examen'}
                  >
                    ℹ️
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-2 mb-4">
                  <button
                    onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setDifficulty('mixed')}
                    disabled={onlyOfficialQuestions || testMode === 'examen'}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      onlyOfficialQuestions || testMode === 'examen'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        : difficulty === 'mixed'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🎲 Aleatoria
                  </button>
                  <button
                    onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setDifficulty('easy')}
                    disabled={onlyOfficialQuestions || testMode === 'examen'}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      onlyOfficialQuestions || testMode === 'examen'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        : difficulty === 'easy'
                        ? 'bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🟢 Fácil
                  </button>
                  <button
                    onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setDifficulty('medium')}
                    disabled={onlyOfficialQuestions || testMode === 'examen'}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      onlyOfficialQuestions || testMode === 'examen'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        : difficulty === 'medium'
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🟡 Medio
                  </button>
                  <button
                    onClick={() => !onlyOfficialQuestions && testMode !== 'examen' && setDifficulty('hard')}
                    disabled={onlyOfficialQuestions || testMode === 'examen'}
                    className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                      onlyOfficialQuestions || testMode === 'examen'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                        : difficulty === 'hard'
                        ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    🟠 Difícil
                  </button>
                </div>
              </div>

              {/* 3. Configuraciones Avanzadas */}
              <div className="mb-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                  {/* Solo preguntas oficiales */}
                  <div>
                    <label className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={onlyOfficialQuestions}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setOnlyOfficialQuestions(checked);
                            
                            // 🔄 Si se activa, desactivar artículos imprescindibles
                            if (checked && focusEssentialArticles) {
                              setFocusEssentialArticles(false);
                            }
                            
                            // 🎯 Si se activa, resetear dificultad a aleatoria
                            if (checked && difficulty !== 'mixed') {
                              setDifficulty('mixed');
                            }
                          }}
                          disabled={focusEssentialArticles}
                          className={`rounded border-gray-300 text-red-600 focus:ring-red-500 ${
                            focusEssentialArticles ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        />
                        <span className={`text-sm font-medium ${
                          focusEssentialArticles ? 'text-gray-400' : 'text-gray-700'
                        }`}>
                          🏛️ Preguntas oficiales
                        </span>
                        <button
                          className="w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center text-sm transition-colors"
                          onClick={() => setShowOfficialModal(true)}
                        >
                          ℹ️
                        </button>
                      </div>
                    </label>

                    {onlyOfficialQuestions && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className="text-red-600 text-lg">🏛️</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-red-800">
                              Modo Oficial Activado
                            </p>
                            <p className="text-xs text-red-700">
                              Solo incluirá preguntas de exámenes oficiales reales
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Artículos imprescindibles */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={focusEssentialArticles}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setFocusEssentialArticles(checked);
                          
                          // 🔄 Si se activa, desactivar preguntas oficiales
                          if (checked && onlyOfficialQuestions) {
                            setOnlyOfficialQuestions(false);
                          }
                        }}
                        disabled={onlyOfficialQuestions}
                        className={`rounded border-gray-300 text-red-600 focus:ring-red-500 ${
                          onlyOfficialQuestions ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                      <span className={`text-sm font-medium ${
                        onlyOfficialQuestions ? 'text-gray-400' : 'text-gray-700'
                      }`}>
                        ⭐ Enfocar en artículos imprescindibles
                      </span>
                      <button
                        className="w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center text-sm transition-colors"
                        onClick={() => setShowEssentialModal(true)}
                      >
                        ℹ️
                      </button>
                    </label>

                    {focusEssentialArticles && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className="text-yellow-600 text-lg">⭐</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-yellow-800">
                              Artículos Imprescindibles Activado
                            </p>
                            <p className="text-xs text-yellow-700">
                              Solo incluirá preguntas de artículos que aparecen frecuentemente en exámenes
                            </p>
                            <p className="text-xs text-yellow-600 mt-1">
                              📋 Artículos clave: Art. 1, 8, 20, 53, 55 CE y otros recurrentes
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modo adaptativo - SOLO para un tema */}
                  {selectedThemes.length === 1 && (
                    <div className="border-t border-gray-200 pt-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={adaptiveMode}
                          onChange={(e) => setAdaptiveMode(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          ✨ Modo adaptativo anti-frustración
                        </span>
                        <button
                          className="w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center text-sm transition-colors"
                          onClick={() => setShowAdaptiveModal(true)}
                        >
                          ℹ️
                        </button>
                      </label>

                      {adaptiveMode && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <span className="text-blue-600 text-lg">✨</span>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-blue-800">
                                Modo Adaptativo Activado
                              </p>
                              <p className="text-xs text-blue-700">
                                Ajusta automáticamente la dificultad según tu % de aciertos
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Selección de temas */}
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 whitespace-nowrap">
                      📚 Selecciona temas
                    </h3>
                    <button
                      onClick={() => setShowThemeSelectionModal(true)}
                      className="w-5 h-5 rounded-full bg-gray-300 hover:bg-gray-400 text-gray-600 hover:text-gray-700 flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0"
                      title="¿Cómo funciona la selección de temas?"
                    >
                      ℹ️
                    </button>
                  </div>
                </div>
                
                {/* Botones de control - Debajo del título */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={selectAllStudiedThemes}
                    className="text-xs sm:text-sm bg-blue-100 text-blue-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                  >
                    <span className="hidden sm:inline">Seleccionar todos</span>
                    <span className="sm:hidden">Todos</span>
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs sm:text-sm bg-orange-100 text-orange-700 px-2 sm:px-3 py-1 rounded-lg hover:bg-orange-200 transition-colors font-medium"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Renderizar temas agrupados por bloques */}
              <div className="space-y-4">
                {themeBlocks.map(block => {
                  const isExpanded = expandedBlocks[block.id]
                  const blockThemes = block.themes
                  const selectedInBlock = blockThemes.filter(t => selectedThemes.includes(t.id)).length

                  return (
                    <div key={block.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Header del bloque */}
                      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                        {/* Botón expandir/contraer + info */}
                        <button
                          onClick={() => setExpandedBlocks(prev => ({ ...prev, [block.id]: !prev[block.id] }))}
                          className="flex items-center gap-3 hover:opacity-70 transition-opacity"
                        >
                          <span className="text-lg">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <div className="text-left">
                            <h4 className="font-bold text-gray-800 text-sm">{block.title}</h4>
                            <p className="text-xs text-gray-600">{block.subtitle}</p>
                          </div>
                        </button>

                        {/* Botones de acción */}
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
                            {selectedInBlock === blockThemes.length ? 'Deseleccionar' : 'Seleccionar todo'}
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
                              const showDetails = showDetailedStatsPerTheme[theme.id] || false
                              const isLoadingDetails = loadingDetailedStatsPerTheme[theme.id] || false

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
                                      isSelected
                                        ? 'border-blue-500 bg-blue-500'
                                        : 'border-gray-300'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <span className="font-medium text-gray-800 text-xs">
                                      {theme.id >= 101 ? `T${theme.id - 100}` : `T${theme.id}`}
                                    </span>
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
                  <h4 className="font-semibold text-blue-800 mb-2">
                    📋 Resumen del test
                  </h4>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p>• <strong>{selectedThemes.length}</strong> temas seleccionados</p>
                    <p>• <strong>{numQuestions}</strong> preguntas totales</p>
                    <p>• Modo: <strong>{testMode === 'practica' ? '📚 Práctica' : '📝 Examen'}</strong></p>
                    <p>• Dificultad: <strong>{
                      difficulty === 'mixed' ? 'Mixto' :
                      difficulty === 'easy' ? 'Fácil' :
                      difficulty === 'medium' ? 'Intermedio' : 'Difícil'
                    }</strong></p>
                    
                    {/* Opciones avanzadas activadas */}
                    {(onlyOfficialQuestions || focusEssentialArticles || adaptiveMode) && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <p className="font-medium mb-1">Opciones avanzadas activadas:</p>
                        {onlyOfficialQuestions && (
                          <p>• 🏛️ Solo preguntas de exámenes oficiales</p>
                        )}
                        {focusEssentialArticles && (
                          <p>• ⭐ Solo artículos imprescindibles</p>
                        )}
                        {adaptiveMode && selectedThemes.length === 1 && (
                          <p>• ✨ Modo adaptativo anti-frustración</p>
                        )}
                      </div>
                    )}
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
                  <div className="flex items-center gap-2 mb-2">
                    {checkingAvailability ? (
                      <div className="flex flex-col space-y-2 w-full">
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                          <h4 className="font-semibold text-gray-800">Verificando preguntas disponibles...</h4>
                        </div>
                        {checkingProgress.themeName && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Analizando:</span> {checkingProgress.themeName}
                            {checkingProgress.total > 1 && (
                              <span className="ml-2 text-blue-600">
                                ({checkingProgress.current}/{checkingProgress.total})
                              </span>
                            )}
                          </div>
                        )}
                        {checkingProgress.total > 1 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${(checkingProgress.current / checkingProgress.total) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <span className="text-lg">
                          {availableQuestions >= numQuestions ? '✅' : availableQuestions > 0 ? '⚠️' : '❌'}
                        </span>
                        <h4 className={`font-semibold ${
                          availableQuestions >= numQuestions ? 'text-green-800' :
                          availableQuestions > 0 ? 'text-yellow-800' : 'text-red-800'
                        }`}>
                          📊 Preguntas disponibles: {availableQuestions}
                        </h4>
                      </>
                    )}
                  </div>

                  {!checkingAvailability && (
                    <div className={`text-sm ${
                      availableQuestions >= numQuestions ? 'text-green-700' :
                      availableQuestions > 0 ? 'text-yellow-700' : 'text-red-700'
                    }`}>
                      {availableQuestions >= numQuestions ? (
                        <p>✅ Perfecto! Hay suficientes preguntas para generar tu test en base a tus criterios.</p>
                      ) : availableQuestions > 0 ? (
                        <div>
                          <p>⚠️ Solo hay {availableQuestions} preguntas disponibles, pero solicitas {numQuestions}.</p>
                          <p className="mt-1 font-medium">💡 Sugerencias:</p>
                          <ul className="mt-1 space-y-1 text-xs">
                            <li>• Reduce el número de preguntas a {availableQuestions} o menos</li>
                            {difficulty !== 'mixed' && <li>• Cambia la dificultad a "Mixto"</li>}
                            {onlyOfficialQuestions && <li>• Desactiva "Solo preguntas oficiales"</li>}
                            {focusEssentialArticles && <li>• Desactiva "Artículos imprescindibles"</li>}
                            <li>• Selecciona más temas estudiados</li>
                          </ul>
                        </div>
                      ) : (
                        <div>
                          <p>❌ No hay preguntas disponibles con estos criterios.</p>
                          <p className="mt-1 font-medium">🔧 Prueba cambiando:</p>
                          <ul className="mt-1 space-y-1 text-xs">
                            {difficulty !== 'mixed' && <li>• Cambia la dificultad a "Mixto"</li>}
                            {onlyOfficialQuestions && <li>• Desactiva "Solo preguntas oficiales"</li>}
                            {focusEssentialArticles && <li>• Desactiva "Artículos imprescindibles"</li>}
                            <li>• Selecciona diferentes temas</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Selector de Modo: Práctica vs Examen */}
            {selectedThemes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  🎯 Selecciona el modo de test
                </h3>
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
                        testMode === 'practica'
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300'
                      }`}>
                        {testMode === 'practica' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-800 flex items-center">
                        <span className="mr-2">📚</span>
                        Modo Práctica
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Corrección inmediata después de cada pregunta. Ideal para aprender y consolidar conocimientos.
                    </p>
                    <div className="space-y-2 text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="text-green-600 mr-2">✓</span>
                        <span>Retroalimentación instantánea</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-green-600 mr-2">✓</span>
                        <span>Explicación detallada de cada respuesta</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-green-600 mr-2">✓</span>
                        <span>Aprendizaje progresivo</span>
                      </div>
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
                        testMode === 'examen'
                          ? 'border-orange-500 bg-orange-500'
                          : 'border-gray-300'
                      }`}>
                        {testMode === 'examen' && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                      <h4 className="font-bold text-gray-800 flex items-center">
                        <span className="mr-2">📝</span>
                        Modo Examen
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      Todas las preguntas de una vez, corrección al final. Simula las condiciones del examen real.
                    </p>
                    <div className="space-y-2 text-xs text-gray-500">
                      <div className="flex items-center">
                        <span className="text-orange-600 mr-2">✓</span>
                        <span>Experiencia real de examen</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-orange-600 mr-2">✓</span>
                        <span>Cronómetro de tiempo transcurrido</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-orange-600 mr-2">✓</span>
                        <span>Evalúa tu preparación global</span>
                      </div>
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
                className={`px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 ${
                  selectedThemes.length === 0 || availableQuestions < numQuestions
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : generating
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl active:scale-95 focus:ring-blue-300'
                }`}
              >
                {generating ? (
                  <div className="flex flex-col items-center space-y-1">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>
                        {testMode === 'examen' ? 'Preparando examen...' : 'Generando test...'}
                      </span>
                    </div>
                    {selectedThemes.length > 1 && (
                      <div className="text-xs opacity-90">
                        Mezclando {selectedThemes.length} temas • {numQuestions} preguntas
                      </div>
                    )}
                  </div>
                ) : checkingAvailability ? (
                  <div className="flex flex-col items-center space-y-1">
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verificando disponibilidad...
                    </div>
                    {checkingProgress.themeName && (
                      <div className="text-xs opacity-90">
                        {checkingProgress.themeName.split(':')[0]} ({checkingProgress.current}/{checkingProgress.total})
                      </div>
                    )}
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
                    : `Solo hay ${availableQuestions} preguntas disponibles, pero solicitas ${numQuestions}`
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      </div>


      {/* Modal: Solo preguntas oficiales */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowOfficialModal(false)}
            ></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">🏛️</span>
                  Solo preguntas oficiales
                </h3>
                <button
                  onClick={() => setShowOfficialModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Qué significa "oficial"?</h4>
                    <p className="text-gray-600 text-sm">
                      Preguntas que han aparecido en convocatorias reales de oposiciones al puesto de Auxiliar Administrativo del Estado.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Por qué elegir solo oficiales?</h4>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Máxima precisión:</strong> Exactamente lo que preguntarán en el examen</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Nivel real:</strong> Conoce la dificultad exacta del examen</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Patrones oficiales:</strong> Aprende cómo formulan las preguntas</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-orange-800 text-sm">
                      <strong>⚠️ Limitación:</strong> Habrá menos preguntas disponibles, pero serán de máxima calidad y utilidad para el examen real.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowOfficialModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Artículos imprescindibles */}
      {showEssentialModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowEssentialModal(false)}
            ></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">⭐</span>
                  Artículos imprescindibles
                </h3>
                <button
                  onClick={() => setShowEssentialModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Qué son los artículos imprescindibles?</h4>
                    <p className="text-gray-600 text-sm">
                      Artículos de la Constitución Española que han aparecido repetidamente en exámenes oficiales de oposiciones reales.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Por qué son importantes?</h4>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Mayor probabilidad:</strong> Muy posible que aparezcan en tu examen</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Estudio dirigido:</strong> Enfoca en lo más importante</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✓</span>
                        <span><strong>Máximo rendimiento:</strong> Optimiza tu tiempo de preparación</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Artículos más frecuentes:</h4>
                    <p className="text-gray-600 text-sm">
                      Art. 1, 8, 20, 53, 55 CE y otros que han demostrado ser recurrentes en convocatorias oficiales.
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm">
                      <strong>💡 Estrategia:</strong> Ideal para repasos intensivos antes del examen. Te asegura dominar los contenidos con mayor probabilidad de aparecer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowEssentialModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Priorización Inteligente */}
      {showPrioritizationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-xl font-bold">Priorización Inteligente</h3>
                  <p className="text-green-100 text-sm">Optimización pedagógica automática</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrioritizationModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Introducción */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2 flex items-center">
                  <span className="mr-2">✨</span>
                  ¿Qué es la Priorización Inteligente?
                </h4>
                <p className="text-green-700 text-sm">
                  Es un sistema que selecciona automáticamente las mejores preguntas para maximizar tu aprendizaje, 
                  sin necesidad de configuraciones complejas.
                </p>
              </div>

              {/* Algoritmo */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🔍</span>
                  ¿Cómo funciona el algoritmo?
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h5 className="font-bold text-blue-800">1º Prioridad: Preguntas nunca vistas</h5>
                      <p className="text-blue-700 text-sm">
                        El sistema identifica preguntas que nunca has respondido y las prioriza para 
                        expandir tu conocimiento hacia nuevas áreas.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <span className="text-2xl">⏰</span>
                    <div>
                      <h5 className="font-bold text-orange-800">2º Prioridad: Repaso inteligente</h5>
                      <p className="text-orange-700 text-sm">
                        Para preguntas ya respondidas, selecciona las más antiguas para hacer repaso efectivo, 
                        siguiendo la curva del olvido para consolidar conocimientos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sistema de Dificultad Automático */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                <h4 className="font-bold text-purple-800 mb-3 flex items-center">
                  <span className="mr-2">🧠</span>
                  Sistema de Dificultad Inteligente
                </h4>
                <div className="space-y-3 text-sm">
                  <p className="text-purple-700">
                    <strong>🔄 Actualización Automática:</strong> Cada vez que alguien responde una pregunta, 
                    el sistema recalcula su dificultad usando inteligencia artificial.
                  </p>
                  <p className="text-purple-700">
                    <strong>👥 Inteligencia Colectiva:</strong> La dificultad se basa en cómo responden 
                    TODOS los usuarios, no solo tú. ¡Tu participación ayuda a mejorar la experiencia de todos!
                  </p>
                  <div className="bg-white rounded p-3 border border-purple-100">
                    <p className="font-medium text-purple-800 mb-2">🧮 Algoritmo Multifactorial:</p>
                    <ul className="text-purple-700 space-y-1 text-xs">
                      <li>• <strong>50%</strong> - Tasa de aciertos de todos los usuarios</li>
                      <li>• <strong>25%</strong> - Tiempo promedio de respuesta</li>
                      <li>• <strong>25%</strong> - Nivel de confianza en las respuestas</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Dificultades */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">📊</span>
                  Niveles de Dificultad
                </h4>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded">
                    <span className="text-lg">🟢</span>
                    <span className="font-medium text-green-800 text-sm">Fácil</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <span className="text-lg">🟡</span>
                    <span className="font-medium text-yellow-800 text-sm">Medio</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <span className="text-lg">🟠</span>
                    <span className="font-medium text-orange-800 text-sm">Difícil</span>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded">
                    <span className="text-lg">🎲</span>
                    <span className="font-medium text-blue-800 text-sm">Aleatoria</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Todos los niveles son calculados automáticamente por IA
                </p>
              </div>

              {/* Beneficios */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🚀</span>
                  Beneficios del Sistema
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Aprendizaje progresivo y estructurado</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Repaso espaciado automático</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Sin configuraciones complejas</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Optimizado pedagógicamente</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Cobertura completa del temario</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Consolidación de conocimientos</span>
                  </div>
                </div>
              </div>

              {/* Recomendación */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  Recomendación
                </h4>
                <p className="text-blue-700 text-sm">
                  Para la mayoría de estudiantes, la opción <strong>"Aleatoria"</strong> es la más efectiva, 
                  ya que combina todos los niveles de dificultad de forma inteligente y adapta el test a tu progreso.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPrioritizationModal(false)}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity"
              >
                ¡Entendido! Empezar Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modo Adaptativo */}
      {showAdaptiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-xl font-bold">Modo Adaptativo Anti-Frustración</h3>
                  <p className="text-blue-100 text-sm">Ajuste inteligente de dificultad en tiempo real</p>
                </div>
              </div>
              <button
                onClick={() => setShowAdaptiveModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Cómo funciona */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">⚙️</span>
                  ¿Cómo funciona?
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-blue-600 text-lg mt-0.5">1️⃣</span>
                    <div>
                      <p className="font-medium text-blue-800">Monitoreo continuo</p>
                      <p className="text-blue-700">Evalúa tu % de aciertos en tiempo real durante todo el test</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-green-600 text-lg mt-0.5">2️⃣</span>
                    <div>
                      <p className="font-medium text-green-800">Adaptación inteligente</p>
                      <p className="text-green-700">Si accuracy &lt; 60%: preguntas más fáciles. Si &gt; 70%: vuelve al nivel normal</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="text-purple-600 text-lg mt-0.5">3️⃣</span>
                    <div>
                      <p className="font-medium text-purple-800">Equilibrio automático</p>
                      <p className="text-purple-700">Mantiene el nivel óptimo para tu aprendizaje sin frustración</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beneficios */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">✨</span>
                  Beneficios
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Reduce la frustración y el abandono</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Mantiene la motivación alta</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Aprendizaje progresivo y sostenible</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Respeta el ritmo individual de cada persona</span>
                  </div>
                </div>
              </div>

              {/* Recomendación */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  ¿Cuándo usarlo?
                </h4>
                <p className="text-blue-700 text-sm">
                  Ideal para <strong>sesiones de estudio relajadas</strong> o cuando quieras mantener alta motivación. 
                  Para simulacros de examen real, recomendamos desactivarlo.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowAdaptiveModal(false)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-bold hover:opacity-90 transition-opacity"
              >
                ¡Entendido!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Selección de temas */}
      {showThemeSelectionModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowThemeSelectionModal(false)}
            ></div>

            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <span className="mr-2">📚</span>
                  ¿Cómo funciona la selección de temas?
                </h3>
                <button
                  onClick={() => setShowThemeSelectionModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Todos los temas están disponibles:</h4>
                    <p className="text-gray-600 text-sm">
                      Puedes seleccionar cualquier tema para tu test aleatorio, incluso los que nunca has estudiado.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Cómo interpretar las estadísticas?</h4>
                    <ul className="text-gray-600 text-sm space-y-2">
                      <li className="flex items-start">
                        <span className="text-green-600 mr-2">✅</span>
                        <span><strong>Temas con estadísticas:</strong> Ya los has practicado y conoces tu nivel</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-600 mr-2">📊</span>
                        <span><strong>Temas sin estadísticas:</strong> Nunca los has estudiado (aparecerán con 0%)</span>
                      </li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">¿Cómo funciona el test aleatorio?</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-gray-700 text-sm space-y-2">
                        <span className="block"><strong>1️⃣</strong> Selecciona los temas que quieres practicar</span>
                        <span className="block"><strong>2️⃣</strong> Configura número de preguntas y dificultad</span>
                        <span className="block"><strong>3️⃣</strong> El sistema mezclará preguntas de todos los temas seleccionados</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-800 text-sm">
                      <strong>💡 Consejo:</strong> Puedes mezclar temas que ya dominas con temas nuevos para un aprendizaje más completo y variado.
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-4">
                <button
                  onClick={() => setShowThemeSelectionModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}