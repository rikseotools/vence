// app/auxiliar-administrativo-estado/test/tema/[numero]/page.js - PÁGINA DINÁMICA MEJORADA
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '../../../../../lib/supabase'
import TestConfigurator from '@/components/TestConfigurator'
import ArticleModal from '@/components/ArticleModal'

const supabase = getSupabaseClient()

export default function TemaPage({ params }) {
  // ✅ ESTADOS PRINCIPALES
  const [resolvedParams, setResolvedParams] = useState(null)
  const [temaNumber, setTemaNumber] = useState(null)
  const [topicData, setTopicData] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [temaNotFound, setTemaNotFound] = useState(false)
  
  // ✅ ESTADOS PARA ESTADÍSTICAS
  const [difficultyStats, setDifficultyStats] = useState({})
  const [userStats, setUserStats] = useState(null)
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0)
  const [articlesCountByLaw, setArticlesCountByLaw] = useState([])
  
  // ✅ ESTADOS PARA CONFIGURADOR AVANZADO
  const [testLoading, setTestLoading] = useState(false)
  const [userRecentStats, setUserRecentStats] = useState(null)
  const [userAnswers, setUserAnswers] = useState([])
  
  // ✅ ESTADOS PARA MODAL DE ARTÍCULO
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState({ number: null, lawSlug: null })

  // 🔄 REFRESH STATS WHEN PAGE BECOMES VISIBLE (user returns from completed test)
  useEffect(() => {
    if (!currentUser || !temaNumber) return

    const handleVisibilityChange = async () => {
      console.log('🔍 [EVENT] visibilitychange disparado:', {
        hidden: document.hidden,
        currentUser: !!currentUser,
        loading,
        temaNumber
      })
      
      if (!document.hidden && currentUser && !loading) {
        console.log('🔄 Página tema visible de nuevo - Refrescando estadísticas completas...')
        // ✅ CORREGIDO: Recargar estadísticas de dificultad ANTES que las del usuario
        await loadDifficultyStats(temaNumber)
        await getUserPersonalStats(currentUser.id, temaNumber)
        console.log('✅ Estadísticas actualizadas tras visibilitychange')
      }
    }

    const handleWindowFocus = async () => {
      console.log('🔍 [EVENT] focus disparado:', {
        currentUser: !!currentUser,
        loading,
        temaNumber
      })
      
      if (currentUser && !loading) {
        console.log('🔄 Ventana tema enfocada - Refrescando estadísticas completas...')
        // ✅ CORREGIDO: Recargar estadísticas de dificultad ANTES que las del usuario
        await loadDifficultyStats(temaNumber)
        await getUserPersonalStats(currentUser.id, temaNumber)
        console.log('✅ Estadísticas actualizadas tras focus')
      }
    }

    // ✅ AGREGAR TAMBIÉN LISTENER DE NAVEGACIÓN
    const handlePageShow = async () => {
      console.log('🔍 [EVENT] pageshow disparado')
      if (currentUser && !loading) {
        console.log('🔄 Página tema mostrada - Refrescando estadísticas...')
        await loadDifficultyStats(temaNumber)
        await getUserPersonalStats(currentUser.id, temaNumber)
        console.log('✅ Estadísticas actualizadas tras pageshow')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [currentUser, temaNumber, loading])

  // 🔄 ADICIONAL: Refresco cuando cambie la URL del navegador (usuario navega con botones)
  useEffect(() => {
    if (!currentUser || !temaNumber || loading) return
    
    console.log('🔄 [URL] URL o dependencias cambiaron, refrescando estadísticas...')
    
    const refreshStats = async () => {
      await loadDifficultyStats(temaNumber)
      await getUserPersonalStats(currentUser.id, temaNumber)
    }
    
    refreshStats()
  }, [currentUser?.id, temaNumber]) // Solo cuando cambie el usuario o tema

  // ✅ RESOLVER PARAMS ASYNC
  useEffect(() => {
    async function resolveParams() {
      const resolved = await params
      const tema = parseInt(resolved.numero)
      
      setResolvedParams(resolved)
      setTemaNumber(tema)
      
      // Validar número de tema
      if (isNaN(tema) || tema < 1 || tema > 50) {
        if (process.env.NODE_ENV === 'development') {
          console.log('❌ Número de tema inválido:', tema)
        }
        setTemaNotFound(true)
        setLoading(false)
        return
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Tema dinámico cargado:', tema)
      }
    }
    
    resolveParams()
  }, [params])

  // ✅ CARGAR DATOS DEL TEMA Y USUARIO
  useEffect(() => {
    if (!temaNumber || temaNotFound) return
    
    async function checkUserAndStats() {
      try {
        // Obtener datos del tema
        const topicDataResult = await getTopicData(temaNumber)
        if (!topicDataResult) {
          if (process.env.NODE_ENV === 'development') {
            console.log('❌ Tema no encontrado en BD:', temaNumber)
          }
          setTemaNotFound(true)
          setLoading(false)
          return
        }
        setTopicData(topicDataResult)

        // Obtener usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)

        // ✅ CONSULTA MULTI-LEY para estadísticas
        await loadDifficultyStats(temaNumber)

        // ✅ CONTAR preguntas oficiales usando topic_scope
        await loadOfficialQuestionsCount(temaNumber)

        // ✅ CARGAR conteo de artículos por ley (MEJORADO)
        await loadArticlesCountByLaw(temaNumber)

        if (user) {
          await getUserPersonalStats(user.id, temaNumber)
          await loadUserRecentStats(user.id, temaNumber)
        }

      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error obteniendo datos tema dinámico:', error)
        }
        setTemaNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    
    checkUserAndStats()
  }, [temaNumber, temaNotFound])

  // ✅ FUNCIÓN: Obtener datos del tema desde BD
  async function getTopicData(temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 Buscando tema dinámico:', temaNumber)
      }
      
      const { data: topicData, error } = await supabase
        .from('topics')
        .select(`
          id,
          topic_number,
          title,
          description,
          difficulty,
          estimated_hours
        `)
        .eq('position_type', 'auxiliar_administrativo')
        .eq('topic_number', temaNumber)
        .eq('is_active', true)
        .single()

      if (error || !topicData) {
        console.error('❌ Error obteniendo datos del tema dinámico:', error)
        return null
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Tema dinámico encontrado:', topicData.title)
      }
      return topicData
    } catch (error) {
      console.error('❌ Error en getTopicData dinámico:', error)
      return null
    }
  }

  // ✅ FUNCIÓN DIRECTA: Obtener estadísticas sin depender del estado
  async function loadDifficultyStatsDirectly(temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎯 Obteniendo estadísticas DIRECTAS MULTI-LEY para tema ${temaNumber}...`)
      }
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'auxiliar_administrativo')
      
      if (mappingError) {
        console.warn(`Error obteniendo mapeo tema ${temaNumber}:`, mappingError)
        return {}
      }
      
      if (!mappings?.length) {
        console.warn(`No se encontró mapeo para tema ${temaNumber}`)
        return {}
      }
      
      // 2️⃣ PARA CADA LEY MAPEADA, HACER CONSULTA SEPARADA
      let allQuestions = []
      
      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) {
          console.warn(`⚠️ Mapeo sin ley válida para tema ${temaNumber}:`, mapping)
          continue
        }

        // ✅ CONSULTA SEPARADA POR LEY (patrón multi-ley)
        const { data: questions, error } = await supabase
          .from('questions')
          .select(`
            difficulty,
            articles!inner(
              laws!inner(short_name)
            )
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
        
        if (!error && questions) {
          allQuestions = [...allQuestions, ...questions]
        }
      }
      
      // 3️⃣ PROCESAR TODAS LAS PREGUNTAS JUNTAS
      const stats = allQuestions.reduce((acc, question) => {
        const difficulty = question.difficulty || 'auto'
        acc[difficulty] = (acc[difficulty] || 0) + 1
        return acc
      }, {})
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Estadísticas directas tema ${temaNumber}:`, stats)
        console.log(`📊 Total preguntas directas:`, Object.values(stats).reduce((sum, count) => sum + count, 0))
      }
      
      return stats

    } catch (error) {
      console.error(`❌ Error cargando estadísticas directas tema ${temaNumber}:`, error)
      return {}
    }
  }

  // ✅ FUNCIÓN MULTI-LEY: Cargar estadísticas por dificultad
  async function loadDifficultyStats(temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🎯 Cargando estadísticas MULTI-LEY para tema ${temaNumber}...`)
      }
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'auxiliar_administrativo')
      
      if (mappingError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Error obteniendo mapeo tema ${temaNumber}:`, mappingError)
        }
        setDifficultyStats({})
        return
      }
      
      if (!mappings?.length) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`No se encontró mapeo para tema ${temaNumber}`)
        }
        setDifficultyStats({})
        return
      }
      
      // 2️⃣ PARA CADA LEY MAPEADA, HACER CONSULTA SEPARADA
      let allQuestions = []
      
      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`⚠️ Mapeo sin ley válida para tema ${temaNumber}:`, mapping)
          }
          continue
        }

        // ✅ CONSULTA SEPARADA POR LEY (patrón multi-ley)
        const { data: questions, error } = await supabase
          .from('questions')
          .select(`
            difficulty,
            articles!inner(
              laws!inner(short_name)
            )
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
        
        if (!error && questions) {
          allQuestions = [...allQuestions, ...questions]
        }
      }
      
      // 3️⃣ PROCESAR TODAS LAS PREGUNTAS JUNTAS
      const diffCount = allQuestions.reduce((acc, q) => {
        acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
        return acc
      }, {})
      
      setDifficultyStats(diffCount)
      const totalFromDiffCount = Object.values(diffCount).reduce((sum, count) => sum + count, 0)
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Estadísticas tema ${temaNumber} finales:`, diffCount)
        console.log(`📊 Total preguntas desde difficultyStats: ${totalFromDiffCount}`)
      }
      
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Error cargando estadísticas tema ${temaNumber}:`, error)
      }
      setDifficultyStats({})
    }
  }

  // ✅ FUNCIÓN MULTI-LEY: Contar preguntas oficiales usando topic_scope
  async function loadOfficialQuestionsCount(temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🏛️ Cargando conteo MULTI-LEY de preguntas oficiales tema ${temaNumber}...`)
      }
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'auxiliar_administrativo')
      
      if (mappingError || !mappings?.length) {
        setOfficialQuestionsCount(0)
        return
      }
      
      // 2️⃣ PARA CADA LEY, CONTAR OFICIALES POR SEPARADO
      let totalOfficials = 0
      
      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) continue

        // ✅ CONSULTA SEPARADA PARA CONTAR (patrón multi-ley)
        const { count, error } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })  
          .eq('is_active', true)
          .eq('is_official_exam', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
        
        if (!error && count) {
          totalOfficials += count
        }
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Total preguntas oficiales tema ${temaNumber}:`, totalOfficials)
      }
      setOfficialQuestionsCount(totalOfficials)

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Error cargando conteo oficial tema ${temaNumber}:`, error)
      }
      setOfficialQuestionsCount(0)
    }
  }

  // ✅ FUNCIÓN NUEVA MEJORADA: Cargar conteo de artículos por ley
  async function loadArticlesCountByLaw(temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📚 Cargando conteo de artículos por ley para tema ${temaNumber}...`)
      }
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', temaNumber)
        .eq('topics.position_type', 'auxiliar_administrativo')
      
      if (mappingError || !mappings?.length) {
        setArticlesCountByLaw([])
        return
      }

      // 2️⃣ PROCESAR CONTEO POR LEY Y OBTENER ARTÍCULOS CON PREGUNTAS
      const lawArticlesCounts = []
      
      for (const mapping of mappings) {
        if (!mapping.laws || !mapping.laws.short_name) continue

        // Consultar cuántos artículos tienen preguntas para esta ley
        const { data: articlesData, error } = await supabase
          .from('questions')
          .select(`
            articles!inner(
              article_number,
              laws!inner(short_name)
            )
          `)
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
        
        if (!error && articlesData) {
          // Contar artículos únicos con preguntas
          const uniqueArticlesWithQuestions = new Set(
            articlesData.map(q => q.articles.article_number)
          ).size

          if (uniqueArticlesWithQuestions > 0) {
            lawArticlesCounts.push({
              law_short_name: mapping.laws.short_name,
              law_name: mapping.laws.name,
              articles_with_questions: uniqueArticlesWithQuestions
            })
          }
        }
      }
      
      // 3️⃣ ORDENAR DE MAYOR A MENOR NÚMERO DE ARTÍCULOS
      const sortedCounts = lawArticlesCounts.sort((a, b) => 
        b.articles_with_questions - a.articles_with_questions
      )
      
      setArticlesCountByLaw(sortedCounts)

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Conteo artículos tema ${temaNumber}:`, sortedCounts)
      }

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Error cargando conteo artículos tema ${temaNumber}:`, error)
      }
      setArticlesCountByLaw([])
    }
  }

  // ✅ FUNCIÓN: Cargar estadísticas de preguntas recientes del usuario
  async function loadUserRecentStats(userId, temaNumber) {
    if (!userId) return null

    try {
      console.log(`🔍 Obteniendo preguntas recientes para tema ${temaNumber} (último 30 días)`)
      
      // ✅ USAR DIRECTAMENTE CONSULTA QUE YA FUNCIONA
      const { data: allUserAnswers, error } = await supabase
        .from('test_questions')
        .select('question_id, created_at, tests!inner(user_id)')
        .eq('tests.user_id', userId)
        .eq('tema_number', temaNumber)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        
      if (error) throw error
      
      const finalRecentAnswers = allUserAnswers || []

      console.log(`✅ Preguntas recientes cargadas para tema ${temaNumber}:`, {
        totalAnswers: finalRecentAnswers?.length || 0,
        timeRange: '30 días',
        firstFew: finalRecentAnswers?.slice(0, 3)?.map(a => ({
          questionId: a.question_id,
          date: new Date(a.created_at).toLocaleDateString('es-ES')
        }))
      })

      // Función para calcular exclusiones por días
      const getExcludedCount = (days) => {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        const uniqueQuestions = new Set()
        
        finalRecentAnswers?.forEach(answer => {
          const answerDate = new Date(answer.created_at)
          if (answerDate >= cutoffDate && answer.question_id) {
            uniqueQuestions.add(answer.question_id)
          }
        })
        
        console.log(`🔍 Exclusiones tema ${temaNumber} (${days} días):`, {
          totalAnswersInRange: finalRecentAnswers?.length || 0,
          cutoffDate: cutoffDate.toLocaleDateString('es-ES'),
          uniqueQuestionsExcluded: uniqueQuestions.size,
          sampleExcluded: Array.from(uniqueQuestions).slice(0, 5)
        })
        
        return uniqueQuestions.size
      }

      const stats = {
        getExcludedCount,
        recentlyAnswered: getExcludedCount(15),
        last7Days: getExcludedCount(7),
        last15Days: getExcludedCount(15),
        last30Days: getExcludedCount(30)
      }

      setUserRecentStats(stats)

    } catch (error) {
      setUserRecentStats({ 
        getExcludedCount: () => 0,
        recentlyAnswered: 0 
      })
    }
  }

  // ✅ FUNCIÓN: Obtener estadísticas reales del usuario
  async function getUserPersonalStats(userId, temaNumber) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Cargando estadísticas reales para usuario tema ${temaNumber}:`, userId)
      }
      
      // ✅ FILTRAR SOLO RESPUESTAS A PREGUNTAS ACTIVAS para datos exactos
      const { data: userAnswers, error } = await supabase
        .from('test_questions')
        .select(`
          question_id,
          is_correct,
          difficulty,
          created_at,
          time_spent_seconds,
          article_number,
          tests!inner(user_id),
          questions!inner(is_active)
        `)
        .eq('tests.user_id', userId)
        .eq('tema_number', temaNumber)
        .eq('questions.is_active', true)

      if (error || !userAnswers || userAnswers.length === 0) {
        setUserStats(null)
        setUserAnswers([])
        return
      }

      setUserAnswers(userAnswers)
      
      // ✅ SOLUCIÓN DEFINITIVA: Obtener estadísticas directamente y pasarlas
      console.log('🔄 Obteniendo estadísticas frescas directamente...')
      const currentStats = await loadDifficultyStatsDirectly(temaNumber)
      
      console.log('🧮 [PROCESANDO] estadísticas obtenidas directamente:', currentStats)
      console.log('🔍 [VERIFICACIÓN] ¿estadísticas tienen datos?', Object.keys(currentStats).length > 0)
      
      processUserStats(userAnswers, currentStats)

    } catch (error) {
      setUserStats(null)
      setUserAnswers([])
    }
  }

  // ✅ FUNCIÓN: Procesar estadísticas reales
  function processUserStats(userAnswers, currentDifficultyStats) {
    // Agrupar por dificultad (datos reales) 
    const performanceByDifficulty = userAnswers.reduce((acc, answer) => {
      const difficulty = answer.difficulty || 'auto'
      if (!acc[difficulty]) {
        acc[difficulty] = { total: 0, correct: 0 }
      }
      acc[difficulty].total++
      if (answer.is_correct) acc[difficulty].correct++
      return acc
    }, {})

    // Calcular precisión real
    Object.keys(performanceByDifficulty).forEach(difficulty => {
      const stats = performanceByDifficulty[difficulty]
      stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0
    })

    // Estadísticas reales finales
    const totalCorrect = userAnswers.filter(a => a.is_correct).length
    const overallAccuracy = (totalCorrect / userAnswers.length) * 100

    // Calcular preguntas únicas respondidas vs nunca vistas
    const uniqueQuestionIds = userAnswers.map(a => a.question_id)
    const uniqueQuestionsAnswered = new Set(uniqueQuestionIds).size
    
    // ✅ CORREGIDO: Usar estadísticas actuales si están disponibles, sino usar globales
    // Eliminado el fallback problemático de 128
    const fromCurrentStats = Object.values(currentDifficultyStats || {}).reduce((sum, count) => sum + count, 0)
    const fromGlobalStats = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)
    const totalQuestionsAvailable = fromCurrentStats > 0 ? fromCurrentStats : fromGlobalStats
    
    console.log('🧮 [CALCULO] Estadísticas corregidas para cálculo:', {
      fromCurrentStats,
      fromGlobalStats, 
      totalQuestionsAvailable,
      currentDifficultyStats,
      difficultyStats,
      uniqueQuestionsAnswered
    })
    const neverSeen = Math.max(0, totalQuestionsAvailable - uniqueQuestionsAnswered)
    
    console.log('🔍 [DEBUG] Progreso usuario DETALLADO:', {
      uniqueQuestionsAnswered,
      totalQuestionsAvailable, 
      neverSeen,
      currentDifficultyStats,
      globalDifficultyStats: difficultyStats,
      userAnswersLength: userAnswers.length,
      totalRespuestas: userAnswers.length,
      preguntasUnicasIds: uniqueQuestionIds.slice(0, 10), // Primeras 10 para debug
      todasLasPreguntas: uniqueQuestionIds.length,
      setSize: new Set(uniqueQuestionIds).size
    })

    const userStatsData = {
      totalAnswers: userAnswers.length,           
      overallAccuracy: overallAccuracy,           
      performanceByDifficulty,                    
      isRealData: true,                          
      dataSource: 'supabase_real',               
      periodAnalyzed: 'historial completo',
      lastUpdated: new Date().toISOString(),
      // ✅ NUEVOS CAMPOS PARA MOSTRAR PROGRESO
      uniqueQuestionsAnswered,
      totalQuestionsAvailable,
      neverSeen
    }

    console.log('💾 [GUARDANDO] userStatsData que se guarda en estado:', {
      uniqueQuestionsAnswered,
      totalQuestionsAvailable,
      neverSeen,
      userStatsData
    })
    
    setUserStats(userStatsData)
  }

  // ✅ FUNCIÓN: Abrir modal de artículo
  function openArticleModal(articleNumber, lawName) {
    // Convertir nombre de ley a slug
    const lawSlug = lawName?.toLowerCase().replace(/\s+/g, '-') || 'ley-desconocida'
    setSelectedArticle({ number: articleNumber, lawSlug })
    setModalOpen(true)
  }

  // ✅ FUNCIÓN: Cerrar modal de artículo
  function closeArticleModal() {
    setModalOpen(false)
    setSelectedArticle({ number: null, lawSlug: null })
  }

  // ✅ FUNCIÓN: Manejar configuración del test personalizado
  async function handleStartCustomTest(config) {
    setTestLoading(true)
    
    try {
      // Construir la URL con los parámetros de configuración
      const params = new URLSearchParams({
        n: config.numQuestions.toString(),
        exclude_recent: config.excludeRecent.toString(),
        recent_days: config.recentDays.toString(),
        difficulty_mode: config.difficultyMode,
        // customDifficulty eliminado
        ...(config.onlyOfficialQuestions && { only_official: 'true' }),
        ...(config.focusEssentialArticles && { focus_essential: 'true' }),
        ...(config.focusWeakAreas && { focus_weak: 'true' }),
        ...(config.adaptiveMode && { adaptive: 'true' }), // ✨ Agregar modo adaptativo
        ...(config.timeLimit && { time_limit: config.timeLimit.toString() })
      })
      
      // 🆕 AGREGAR FILTROS DE LEYES Y ARTÍCULOS
      if (config.selectedLaws && config.selectedLaws.length > 0) {
        params.set('selected_laws', JSON.stringify(config.selectedLaws))
      }
      
      if (config.selectedArticlesByLaw && Object.keys(config.selectedArticlesByLaw).length > 0) {
        params.set('selected_articles_by_law', JSON.stringify(config.selectedArticlesByLaw))
      }

      // Redirigir al test personalizado del tema dinámico
      const testUrl = `/auxiliar-administrativo-estado/test/tema/${temaNumber}/test-personalizado?${params.toString()}`
      window.location.href = testUrl

    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ Error iniciando test personalizado tema ${temaNumber}:`, error)
      }
      setTestLoading(false)
    }
  }

  // ✅ CALCULAR TOTALES
  const totalQuestions = Object.values(difficultyStats).reduce((sum, count) => sum + count, 0)

  // ✅ LOADING STATE
  if (loading && !temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">Cargando tema dinámico...</p>
        </div>
      </div>
    )
  }

  // ✅ TEMA NO ENCONTRADO
  if (temaNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center p-6">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Tema No Encontrado
          </h1>
          <p className="text-gray-600 mb-6">
            {temaNumber ? 
              `El Tema ${temaNumber} no existe o no está disponible para Auxiliar Administrativo del Estado.` :
              'Número de tema inválido.'
            }
          </p>
          <Link 
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 py-6">
        
        {/* ✅ HEADER DINÁMICO */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium mb-3">
            <span className="mr-1">🏛️</span>
            Auxiliar Administrativo del Estado
          </div>
          
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Tema {temaNumber}: {topicData.title}
          </h1>
          
          <p className="text-gray-600 text-sm md:text-base mb-4">
            {topicData.description}
          </p>
          
          <div className="space-y-2">
            <p className="text-gray-600 text-sm md:text-base">
              {totalQuestions > 0 ? `${totalQuestions} preguntas disponibles para este tema` : 'Cargando preguntas...'}
            </p>
            
            {officialQuestionsCount > 0 && (
              <p className="text-purple-600 font-medium text-sm md:text-base">
                🏛️ {officialQuestionsCount} preguntas de exámenes oficiales disponibles
              </p>
            )}
            
            {/* ✅ MOSTRAR PROGRESO DEL USUARIO */}
            {currentUser && userStats && userStats.uniqueQuestionsAnswered > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-green-600 font-medium text-sm">
                  ✅ {userStats.uniqueQuestionsAnswered} vistas
                </p>
                <p className="text-blue-600 font-medium text-sm">
                  👁️ {userStats.neverSeen} nunca vistas
                </p>
              </div>
            )}

            {/* ✅ MOSTRAR ARTÍCULOS CON PREGUNTAS - FORMATO MEJORADO */}
            {articlesCountByLaw.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-700 font-medium text-sm mb-2">📖 Artículos con preguntas disponibles:</p>
                <div className="text-center space-y-1">
                  {articlesCountByLaw.map((lawData, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      <span className="font-medium">{lawData.law_short_name}:</span> {lawData.articles_with_questions} artículo{lawData.articles_with_questions > 1 ? 's' : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ 1️⃣ CONFIGURADOR AVANZADO DINÁMICO */}
        <section className="mb-8">
          <TestConfigurator
            tema={temaNumber}
            totalQuestions={difficultyStats}
            onStartTest={handleStartCustomTest}
            userStats={userRecentStats}
            loading={testLoading}
            currentUser={currentUser}
            lawsData={articlesCountByLaw}
          />
        </section>

        {/* ✅ 2️⃣ TU PROGRESO - DINÁMICO */}
        {currentUser && userStats && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4 text-center">
              📊 Tu Progreso en el Tema {temaNumber}
            </h2>
            
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg">👤 Rendimiento Personal</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{userStats.overallAccuracy.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">{userStats.totalAnswers} respuestas en Tema {temaNumber}</div>
                  {userStats.isRealData && (
                    <div className="text-xs text-green-600 font-medium">✅ Datos reales</div>
                  )}
                </div>
              </div>
              
              {/* ✅ MÉTRICAS ÚTILES DINÁMICAS */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                
                {/* Métrica 1: Tendencia Reciente */}
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="font-bold text-blue-800 mb-2 text-sm">📈 Últimos 7 días</div>
                  <div className="text-xl font-bold text-blue-600 mb-1">
                    {(() => {
                      const recent7Days = userAnswers?.filter(a => 
                        new Date(a.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ) || []
                      const recentAccuracy = recent7Days.length > 0 
                        ? (recent7Days.filter(a => a.is_correct).length / recent7Days.length * 100).toFixed(0)
                        : 'N/A'
                      return `${recentAccuracy}%`
                    })()}
                  </div>
                  <div className="text-xs text-blue-600">
                    {(() => {
                      const recent7Days = userAnswers?.filter(a => 
                        new Date(a.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                      ) || []
                      return `${recent7Days.length} respuestas`
                    })()}
                  </div>
                </div>

                {/* Métrica 2: Velocidad Promedio */}
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="font-bold text-green-800 mb-2 text-sm">⚡ Velocidad</div>
                  <div className="text-xl font-bold text-green-600 mb-1">
                    {(() => {
                      const avgTime = userAnswers?.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0) / (userAnswers?.length || 1)
                      return avgTime > 0 ? `${Math.round(avgTime)}s` : 'N/A'
                    })()}
                  </div>
                  <div className="text-xs text-green-600">por pregunta</div>
                </div>

                {/* Métrica 3: Racha Actual */}
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="font-bold text-purple-800 mb-2 text-sm">🔥 Racha</div>
                  <div className="text-xl font-bold text-purple-600 mb-1">
                    {(() => {
                      const dates = [...new Set(userAnswers?.map(a => 
                        new Date(a.created_at).toDateString()
                      ) || [])].sort((a, b) => new Date(b) - new Date(a))
                      
                      let streak = 0
                      let currentDate = new Date()
                      
                      for (let date of dates) {
                        const diffDays = Math.floor((currentDate - new Date(date)) / (1000 * 60 * 60 * 24))
                        if (diffDays === streak) {
                          streak++
                          currentDate = new Date(date)
                        } else {
                          break
                        }
                      }
                      
                      return streak
                    })()}
                  </div>
                  <div className="text-xs text-purple-600">días seguidos</div>
                </div>

                {/* Métrica 4: Artículos Únicos */}
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="font-bold text-orange-800 mb-2 text-sm">📚 Cobertura</div>
                  <div className="text-xl font-bold text-orange-600 mb-1">
                    {(() => {
                      const uniqueArticles = new Set(userAnswers?.map(a => a.article_number).filter(Boolean) || [])
                      return uniqueArticles.size
                    })()}
                  </div>
                  <div className="text-xs text-orange-600">artículos distintos</div>
                </div>
              </div>

              {/* ✅ ANÁLISIS INTELIGENTE DINÁMICO */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🎯</span>
                  Análisis Inteligente de Estudio - Tema {temaNumber}
                </h4>
                
                <ArticulosEstudioPrioritario 
                  userId={currentUser.id}
                  tema={temaNumber}
                  totalRespuestas={userStats.totalAnswers}
                  openArticleModal={openArticleModal}
                />
              </div>
            </div>
          </section>
        )}

        {/* ✅ MENSAJE CUANDO NO HAY ESTADÍSTICAS */}
        {currentUser && !userStats && (
          <section className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">📊</div>
              <h3 className="font-bold text-blue-800 mb-2">¡Empieza a practicar!</h3>
              <p className="text-blue-700 text-sm">
                Completa algunos tests para ver tus estadísticas personales del Tema {temaNumber}.
              </p>
            </div>
          </section>
        )}

        {/* ✅ PREGUNTAS POR DIFICULTAD - FORMATO LISTADO */}
        {Object.keys(difficultyStats).length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📊 Preguntas por Dificultad
            </h2>
            
            <div className="space-y-2">
              {Object.entries(difficultyStats)
                .sort(([,a], [,b]) => b - a) // Ordenar de mayor a menor
                .map(([difficulty, count]) => (
                <div key={difficulty} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-3" style={{
                      backgroundColor: {
                        'easy': '#10b981',
                        'medium': '#f59e0b', 
                        'hard': '#ef4444',
                        'extreme': '#8b5cf6',
                        'auto': '#6b7280'
                      }[difficulty] || '#6b7280'
                    }}></span>
                    <span className="font-medium text-gray-700 capitalize">
                      {difficulty === 'auto' ? 'Automática' : 
                       difficulty === 'easy' ? 'Fácil' :
                       difficulty === 'medium' ? 'Media' :
                       difficulty === 'hard' ? 'Difícil' :
                       difficulty === 'extreme' ? 'Extrema' : difficulty}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-gray-900 mr-2">{count}</span>
                    <span className="text-sm text-gray-500">
                      ({((count / totalQuestions) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-800">Total:</span>
                <span className="font-bold text-blue-600 text-lg">{totalQuestions} preguntas</span>
              </div>
            </div>
          </div>
        )}

        {/* ✅ NAVEGACIÓN DE VUELTA */}
        <div className="mt-8 text-center">
          <Link 
            href="/auxiliar-administrativo-estado/test"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Volver a todos los temas
          </Link>
        </div>

      </div>
      
      {/* ✅ MODAL DE ARTÍCULO */}
      <ArticleModal 
        isOpen={modalOpen}
        onClose={closeArticleModal}
        articleNumber={selectedArticle.number}
        lawSlug={selectedArticle.lawSlug}
      />
    </div>
  )
}

// ✅ COMPONENTE: Artículos de Estudio Prioritario DINÁMICO
function ArticulosEstudioPrioritario({ userId, tema, totalRespuestas, openArticleModal }) {
  const [articulosFallados, setArticulosFallados] = useState([])
  const [loading, setLoading] = useState(true)
  const [recomendaciones, setRecomendaciones] = useState([])

  useEffect(() => {
    async function cargarArticulosFallados() {
      if (!userId) return

      try {
        setLoading(true)
        
        // Consultar artículos con peor rendimiento del usuario en tema dinámico
        const { data: articleStats, error } = await supabase
          .from('test_questions')
          .select(`
            article_id,
            article_number,
            law_name,
            is_correct,
            time_spent_seconds,
            confidence_level,
            created_at,
            tests!inner(user_id)
          `)
          .eq('tests.user_id', userId)
          .eq('tema_number', tema)

        if (!error && articleStats && articleStats.length > 0) {
          const totalRespuestasReales = articleStats.length
          
          // Procesar estadísticas por artículo
          const articulosAgrupados = articleStats.reduce((acc, respuesta) => {
            const key = respuesta.article_number || 'sin-articulo'
            
            if (!acc[key]) {
              acc[key] = {
                article_number: respuesta.article_number,
                law_name: respuesta.law_name,
                total_respuestas: 0,
                correctas: 0,
                incorrectas: 0,
                tiempo_promedio: 0,
                confianza_baja: 0,
                ultima_respuesta: respuesta.created_at,
                fallos_consecutivos: 0,
                ultima_correcta: null
              }
            }
            
            acc[key].total_respuestas++
            if (respuesta.is_correct) {
              acc[key].correctas++
              acc[key].ultima_correcta = respuesta.created_at
              acc[key].fallos_consecutivos = 0
            } else {
              acc[key].incorrectas++
              acc[key].fallos_consecutivos++
            }
            
            acc[key].tiempo_promedio += respuesta.time_spent_seconds || 0
            if (respuesta.confidence_level === 'unsure' || respuesta.confidence_level === 'guessing') {
              acc[key].confianza_baja++
            }
            
            return acc
          }, {})

          // Calcular métricas de cada artículo
          const articulosProblematicos = Object.values(articulosAgrupados)
            .map(articulo => {
              const precision = (articulo.correctas / articulo.total_respuestas) * 100
              const tiempo_promedio = articulo.tiempo_promedio / articulo.total_respuestas
              const porcentaje_confianza_baja = (articulo.confianza_baja / articulo.total_respuestas) * 100
              const tasa_fallos = (articulo.incorrectas / articulo.total_respuestas) * 100
              
              return {
                ...articulo,
                precision: precision.toFixed(1),
                tiempo_promedio: Math.round(tiempo_promedio),
                porcentaje_confianza_baja: porcentaje_confianza_baja.toFixed(1),
                tasa_fallos: tasa_fallos.toFixed(1),
                score_problema: (100 - precision) + porcentaje_confianza_baja + (articulo.fallos_consecutivos * 10)
              }
            })
            .filter(articulo => {
              // ✅ FILTROS FLEXIBLES SEGÚN CANTIDAD DE DATOS
              if (totalRespuestasReales < 10) {
                return articulo.incorrectas >= 1
              } else {
                return (
                  articulo.total_respuestas >= 2 && 
                  (
                    articulo.precision < 75 ||
                    articulo.porcentaje_confianza_baja > 25 ||
                    articulo.incorrectas >= 2
                  )
                )
              }
            })
            .sort((a, b) => b.score_problema - a.score_problema)
            .slice(0, 12)

          setArticulosFallados(articulosProblematicos)
          generarRecomendacionesInteligentes(articulosProblematicos, totalRespuestasReales, tema)
        } else {
          generarRecomendacionesInteligentes([], 0, tema)
        }

      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Error cargando artículos fallados tema ${tema}:`, error)
        }
        generarRecomendacionesInteligentes([], 0, tema)
      } finally {
        setLoading(false)
      }
    }

    cargarArticulosFallados()
  }, [userId, tema, totalRespuestas])

  // 🧠 FUNCIÓN: Generar recomendaciones inteligentes dinámicas
  function generarRecomendacionesInteligentes(articulosFallados, totalRespuestasReales, temaNumero) {
    const recomendacionesGeneradas = []

    // 🎯 CASO 1: SIN DATOS (0 respuestas)
    if (totalRespuestasReales === 0) {
      recomendacionesGeneradas.push({
        tipo: 'sin_datos',
        prioridad: 'info',
        titulo: `🚀 ¡EMPIEZA TU ESTUDIO DEL TEMA ${temaNumero}!`,
        descripcion: `No tienes respuestas registradas en el Tema ${temaNumero} aún.`,
        articulos: [],
        accion: 'Completa tu primer test para comenzar el análisis personalizado',
        iconoGrande: '🎯',
        colorScheme: 'blue'
      })
      setRecomendaciones(recomendacionesGeneradas)
      return
    }

    // 🎯 CASO 2: DATOS INSUFICIENTES (1-9 respuestas)
    if (totalRespuestasReales < 10) {
      recomendacionesGeneradas.push({
        tipo: 'datos_insuficientes',
        prioridad: 'info',
        titulo: '📊 DATOS INSUFICIENTES PARA ANÁLISIS COMPLETO',
        descripcion: `Solo tienes ${totalRespuestasReales} respuesta${totalRespuestasReales > 1 ? 's' : ''} en el Tema ${temaNumero}. Necesitas al menos 10-15 para un análisis confiable.`,
        articulos: [],
        accion: 'Completa más tests para obtener recomendaciones personalizadas detalladas',
        iconoGrande: '📈',
        colorScheme: 'yellow'
      })

      if (articulosFallados.length > 0) {
        recomendacionesGeneradas.push({
          tipo: 'observacion_preliminar',
          prioridad: 'info',
          titulo: '👀 PRIMERAS OBSERVACIONES',
          descripcion: `Hemos detectado ${articulosFallados.length} artículo${articulosFallados.length > 1 ? 's' : ''} con fallos iniciales en el Tema ${temaNumero}.`,
          articulos: articulosFallados.slice(0, 3),
          accion: 'Estos artículos podrían necesitar atención, pero necesitamos más datos para confirmarlo',
          colorScheme: 'blue'
        })
      }

      setRecomendaciones(recomendacionesGeneradas)
      return
    }

    // 🎯 CASO 3: DATOS LIMITADOS PERO SUFICIENTES (10-24 respuestas)
    if (totalRespuestasReales < 25) {
      recomendacionesGeneradas.push({
        tipo: 'analisis_limitado',
        prioridad: 'info',
        titulo: '⚠️ ANÁLISIS PRELIMINAR',
        descripcion: `Con ${totalRespuestasReales} respuestas en el Tema ${temaNumero} podemos dar recomendaciones básicas. Para análisis completo necesitas 25+ respuestas.`,
        articulos: articulosFallados.slice(0, 3),
        accion: 'Continúa practicando para obtener análisis más detallado y confiable',
        iconoGrande: '📊',
        colorScheme: 'yellow'
      })

      if (articulosFallados.length > 0) {
        const articulosMasFallados = articulosFallados.slice(0, 3)
        recomendacionesGeneradas.push({
          tipo: 'fallos_detectados',
          prioridad: 'media',
          titulo: '🔍 ÁREAS DE MEJORA DETECTADAS',
          descripcion: `${articulosMasFallados.length} artículo${articulosMasFallados.length > 1 ? 's' : ''} del Tema ${temaNumero} que ya muestra${articulosMasFallados.length > 1 ? 'n' : ''} dificultades`,
          articulos: articulosMasFallados,
          accion: 'Revisar estos conceptos específicos del temario',
          colorScheme: 'orange'
        })
      } else {
        recomendacionesGeneradas.push({
          tipo: 'buen_inicio',
          prioridad: 'positiva',
          titulo: `✅ BUEN INICIO EN EL TEMA ${temaNumero}`,
          descripcion: 'No se detectan problemas graves en tus primeras respuestas.',
          articulos: [],
          accion: 'Sigue practicando para consolidar tu conocimiento',
          colorScheme: 'green'
        })
      }

      setRecomendaciones(recomendacionesGeneradas)
      return
    }

    // 🎯 CASO 4: DATOS SUFICIENTES PARA ANÁLISIS COMPLETO (25+ respuestas)
    if (articulosFallados.length > 0) {
      recomendacionesGeneradas.push({
        tipo: 'fallos_importantes',
        prioridad: 'alta',
        titulo: `🔍 REVISAR CONCEPTOS DEL TEMA ${temaNumero}`,
        descripcion: `${articulosFallados.length} artículo${articulosFallados.length > 1 ? 's' : ''} que necesita${articulosFallados.length > 1 ? 'n' : ''} más práctica`,
        articulos: articulosFallados.slice(0, 6),
        accion: `Repasar los conceptos fundamentales del Tema ${temaNumero}`,
        colorScheme: 'red'
      })
    } else {
      recomendacionesGeneradas.push({
        tipo: 'excelente_dominio',
        prioridad: 'positiva',
        titulo: `🎉 EXCELENTE DOMINIO DEL TEMA ${temaNumero}`,
        descripcion: `Con ${totalRespuestasReales} respuestas analizadas, no se detectan áreas problemáticas.`,
        articulos: [],
        accion: 'Mantén este excelente nivel y considera avanzar a otros temas',
        iconoGrande: '🏆',
        colorScheme: 'green'
      })
    }

    setRecomendaciones(recomendacionesGeneradas)
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-gray-600 text-sm">Analizando tu rendimiento en el Tema {tema}...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      {/* 🧠 RECOMENDACIONES INTELIGENTES */}
      {recomendaciones.length > 0 && (
        <div>
          <div className="space-y-3">
            {recomendaciones.map((rec, index) => (
              <RecomendacionCard key={index} recomendacion={rec} openArticleModal={openArticleModal} />
            ))}
          </div>
        </div>
      )}

      {/* 📊 DETALLE DE ARTÍCULOS FALLADOS */}
      {articulosFallados.length > 0 && totalRespuestas >= 10 && (
        <div>
          <h5 className="font-bold text-gray-800 mb-3">📊 Artículos que Necesitan Atención</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articulosFallados.slice(0, 6).map((articulo, index) => (
              <div 
                key={index}
                className="p-3 rounded-lg border bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-800">
                      Artículo {articulo.article_number}
                    </div>
                    <div className="text-xs text-gray-600">{articulo.law_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      parseFloat(articulo.precision) >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {articulo.precision}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {articulo.correctas}/{articulo.total_respuestas}
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      ❌ {articulo.incorrectas} fallos
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-600 space-y-1">
                  <div>⏱️ Tiempo: {articulo.tiempo_promedio}s promedio</div>
                  <div>🤔 Dudas: {articulo.porcentaje_confianza_baja}%</div>
                  {articulo.fallos_consecutivos > 0 && (
                    <div className="text-red-600 font-medium">
                      🔄 {articulo.fallos_consecutivos} fallos consecutivos
                    </div>
                  )}
                  {articulo.ultima_correcta && (
                    <div className="text-green-600">
                      ✅ Última correcta: {new Date(articulo.ultima_correcta).toLocaleDateString()}
                    </div>
                  )}
                </div>
                
                {/* Botones de acción */}
                <div className="mt-3 flex gap-2 flex-wrap">
                  {/* Botón Ver Artículo - Abre modal */}
                  <button
                    onClick={() => openArticleModal(articulo.article_number, articulo.law_name)}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-md font-medium transition-colors flex items-center"
                  >
                    📖 Ver artículo {articulo.article_number} de {articulo.law_name}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {articulosFallados.length > 6 && (
            <div className="text-center mt-3">
              <span className="text-sm text-gray-500">
                Y {articulosFallados.length - 6} artículo{articulosFallados.length - 6 > 1 ? 's' : ''} más que necesita{articulosFallados.length - 6 > 1 ? 'n' : ''} atención
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 🎨 COMPONENTE: Card de Recomendación
function RecomendacionCard({ recomendacion, openArticleModal }) {
  const estilosColor = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      texto: 'text-blue-800',
      titulo: 'text-blue-900'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      texto: 'text-yellow-800',
      titulo: 'text-yellow-900'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      texto: 'text-red-800',
      titulo: 'text-red-900'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      texto: 'text-green-800',
      titulo: 'text-green-900'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      texto: 'text-orange-800',
      titulo: 'text-orange-900'
    }
  }

  const colores = estilosColor[recomendacion.colorScheme] || estilosColor.blue

  return (
    <div className={`p-4 rounded-lg border ${colores.bg} ${colores.border}`}>
      {recomendacion.iconoGrande && (
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{recomendacion.iconoGrande}</div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <h6 className={`font-bold ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center w-full text-lg' : ''}`}>
          {recomendacion.titulo}
        </h6>
        {recomendacion.articulos.length > 0 && !recomendacion.iconoGrande && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold bg-white bg-opacity-50 ${colores.texto}`}>
            {recomendacion.articulos.length} artículo{recomendacion.articulos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      <p className={`text-sm mb-3 ${colores.texto} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        {recomendacion.descripcion}
      </p>
      
      <div className={`text-sm font-medium ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        👉 {recomendacion.accion}
      </div>
      
      {recomendacion.articulos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium mb-2 text-gray-700">
            Artículos detectados:
          </div>
          <div className="flex flex-wrap gap-2">
            {recomendacion.articulos.slice(0, 6).map((articulo, idx) => (
              <span 
                key={idx}
                className="px-2 py-1 rounded text-xs font-medium bg-white bg-opacity-50"
              >
                Art. {articulo.article_number}
                {articulo.precision && ` (${articulo.precision}%)`}
                {articulo.incorrectas && ` ❌${articulo.incorrectas}`}
              </span>
            ))}
            {recomendacion.articulos.length > 6 && (
              <span className="text-xs text-gray-500 self-center">
                +{recomendacion.articulos.length - 6} más
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

