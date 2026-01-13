// lib/testFetchers.js - FETCHERS MODULARES PARA TODOS LOS TIPOS DE TEST - CON SOPORTE MULTI-LEY
import { getSupabaseClient } from './supabase'

const supabase = getSupabaseClient()

// =================================================================
// 🔧 HELPER: SAFE PARAM GETTER (URLSearchParams o objeto plano)
// =================================================================
// Algunos fetchers reciben searchParams desde hooks (URLSearchParams)
// y otros desde server components (objeto plano). Este helper maneja ambos.
function getParam(searchParams, key, defaultValue = null) {
  if (!searchParams) return defaultValue

  // Si es URLSearchParams (desde hook useSearchParams)
  if (typeof searchParams.get === 'function') {
    return searchParams.get(key) || defaultValue
  }

  // Si es objeto plano (desde server component o props)
  return searchParams[key] || defaultValue
}

// 🔥 CACHE GLOBAL DE SESIÓN para evitar duplicados entre llamadas
const sessionQuestionCache = new Map()

// Función para limpiar cache viejo (prevenimos memory leaks)
function cleanOldCacheEntries() {
  const now = Date.now()
  for (const [key, data] of sessionQuestionCache.entries()) {
    // Limpiar entradas de más de 30 minutos
    if (now - data.timestamp > 30 * 60 * 1000) {
      sessionQuestionCache.delete(key)
    }
  }
}

// 🔥 FUNCIÓN PÚBLICA para limpiar cache de sesión específica
export function clearSessionQuestionCache(userId, tema) {
  const sessionKey = userId ? `${userId}-${tema}-session` : `anon-${tema}-session`
  if (sessionQuestionCache.has(sessionKey)) {
    sessionQuestionCache.delete(sessionKey)
    console.log(`🧹 Cache de sesión limpiado: ${sessionKey}`)
  }
}

// =================================================================
// 🔧 HELPER: BATCHED QUERIES PARA EVITAR URLs MUY LARGAS
// =================================================================
// Supabase convierte .in() queries a GET con URL params - si hay muchos IDs, la URL excede límites
// Esta función divide las queries en lotes paralelos y combina resultados
const BATCH_SIZE = 50 // 50 UUIDs por lote para evitar límites de URL

async function batchedTestQuestionsQuery(testIds, selectFields, options = {}) {
  if (!testIds || testIds.length === 0) {
    return { data: [], error: null }
  }

  // Si hay pocos IDs, hacer query directa
  if (testIds.length <= BATCH_SIZE) {
    let query = supabase
      .from('test_questions')
      .select(selectFields)
      .in('test_id', testIds)

    if (options.gte) {
      query = query.gte(options.gte.column, options.gte.value)
    }
    if (options.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending })
    }
    if (options.limit) {
      query = query.limit(options.limit)
    }

    return await query
  }

  // Dividir en lotes
  const batches = []
  for (let i = 0; i < testIds.length; i += BATCH_SIZE) {
    batches.push(testIds.slice(i, i + BATCH_SIZE))
  }

  // Ejecutar queries en paralelo
  const batchLimit = options.limit ? Math.ceil(options.limit / batches.length) : undefined
  const results = await Promise.all(
    batches.map(async (batch) => {
      let query = supabase
        .from('test_questions')
        .select(selectFields)
        .in('test_id', batch)

      if (options.gte) {
        query = query.gte(options.gte.column, options.gte.value)
      }
      if (options.order) {
        query = query.order(options.order.column, { ascending: options.order.ascending })
      }
      if (batchLimit) {
        query = query.limit(batchLimit)
      }

      return await query
    })
  )

  // Combinar resultados
  let allData = []
  for (const result of results) {
    if (result.error) {
      return { data: null, error: result.error }
    }
    if (result.data) {
      allData = allData.concat(result.data)
    }
  }

  // Ordenar si es necesario
  if (options.order) {
    allData.sort((a, b) => {
      const aVal = a[options.order.column]
      const bVal = b[options.order.column]
      if (options.order.ascending) {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
    })
  }

  // Aplicar límite final
  if (options.limit && allData.length > options.limit) {
    allData = allData.slice(0, options.limit)
  }

  return { data: allData, error: null }
}

// =================================================================
// 🔧 FUNCIÓN DE TRANSFORMACIÓN COMÚN
// =================================================================
export function transformQuestions(supabaseQuestions) {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    console.error('❌ transformQuestions: Datos inválidos recibidos')
    return []
  }

  return supabaseQuestions.map((q, index) => {
    return {
      // ✅ PRESERVAR ID ORIGINAL DE LA BASE DE DATOS
      id: q.id,
      question: q.question_text,
      options: [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d
      ],
      // 🔒 SEGURIDAD: correct_option eliminado - validación solo via API /api/answer
      explanation: q.explanation,
      
      // 🔥 INCLUIR primary_article_id PARA HOT ARTICLES
      primary_article_id: q.primary_article_id,
      
      // 🎯 INCLUIR TEMA PARA TESTS ALEATORIOS
      tema: q.tema,
      
      article: {
        id: q.articles?.id,
        number: q.articles?.article_number || (index + 1).toString(),
        title: q.articles?.title || `Artículo ${index + 1}`,
        full_text: q.articles?.content || `Artículo ${q.articles?.article_number || index + 1} de la Ley 19/2013`,
        law_name: q.articles?.laws?.name || 'Ley 19/2013 de transparencia',
        law_short_name: q.articles?.laws?.short_name || 'Ley 19/2013',
        display_number: `Art. ${q.articles?.article_number || index + 1} ${q.articles?.laws?.short_name || 'Ley 19/2013'}`,
      },
      
      // 🎛️ METADATOS
      metadata: {
        id: q.id,
        difficulty: q.difficulty || 'auto',
        question_type: q.question_type || 'single',
        tags: q.tags || [],
        is_active: q.is_active,
        created_at: q.created_at,
        updated_at: q.updated_at,
        // 🏛️ Información de exámenes oficiales si aplica
        is_official_exam: q.is_official_exam,
        exam_source: q.exam_source,
        exam_date: q.exam_date,
        exam_entity: q.exam_entity,
        official_difficulty_level: q.official_difficulty_level,
      }
    }
  })
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Mezclar arrays
// =================================================================
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// =================================================================
// 🚀 HELPER: Obtener historial de preguntas del usuario (API optimizada)
// Reemplaza el patrón lento de IN clause con 250+ UUIDs
// =================================================================
async function fetchUserQuestionHistory(userId, onlyActiveQuestions = true) {
  try {
    if (!userId) return { history: [], error: null }

    const params = new URLSearchParams({
      action: 'history',
      userId,
      onlyActive: String(onlyActiveQuestions)
    })

    const response = await fetch(`/api/user/question-history?${params}`)
    const data = await response.json()

    if (!data.success) {
      console.warn('⚠️ Error obteniendo historial de preguntas:', data.error)
      return { history: [], error: data.error }
    }

    return { history: data.history || [], error: null }
  } catch (error) {
    console.warn('⚠️ Error en fetchUserQuestionHistory:', error.message)
    return { history: [], error: error.message }
  }
}

// =================================================================
// 🚀 HELPER: Obtener preguntas recientes para exclusión (API optimizada)
// =================================================================
async function fetchRecentQuestions(userId, days = 7) {
  try {
    if (!userId) return { questionIds: [], error: null }

    const params = new URLSearchParams({
      action: 'recent',
      userId,
      days: String(days)
    })

    const response = await fetch(`/api/user/question-history?${params}`)
    const data = await response.json()

    if (!data.success) {
      console.warn('⚠️ Error obteniendo preguntas recientes:', data.error)
      return { questionIds: [], error: data.error }
    }

    return { questionIds: data.questionIds || [], error: null }
  } catch (error) {
    console.warn('⚠️ Error en fetchRecentQuestions:', error.message)
    return { questionIds: [], error: error.message }
  }
}

// =================================================================
// 🎲 FETCHER: TEST ALEATORIO
// =================================================================
export async function fetchRandomQuestions(tema, searchParams, config) {
  try {
    console.log('🎲 Cargando test aleatorio para tema:', tema)

    const numQuestions = parseInt(getParam(searchParams, 'n', '25'))
    const adaptiveMode = getParam(searchParams, 'adaptive') === 'true'
    
    // 🧠 Si modo adaptativo, cargar pool más grande
    const poolSize = adaptiveMode ? numQuestions * 2 : numQuestions
    
    const { data, error } = await supabase.rpc('get_questions_dynamic', {
      tema_number: tema,
      total_questions: poolSize
    })
    
    if (error) {
      console.error('❌ Error en get_questions_dynamic:', error)
      throw error
    }
    
    if (!data || data.length === 0) {
      throw new Error(`No hay preguntas disponibles para el tema ${tema}`)
    }
    
    const questions = transformQuestions(data)
    
    if (adaptiveMode) {
      console.log('🧠 Modo adaptativo:', questions.length, 'preguntas en pool,', numQuestions, 'activas')
      // Separar en activas y pool de reserva
      return {
        activeQuestions: questions.slice(0, numQuestions),
        questionPool: questions,
        poolSize: questions.length,
        requestedCount: numQuestions,
        isAdaptive: true
      }
    }
    
    console.log('✅ Test aleatorio cargado:', questions.length, 'preguntas')
    return questions
    
  } catch (error) {
    console.error('❌ Error en fetchRandomQuestions:', error)
    throw error
  }
}

// =================================================================
// ⚡ FETCHER: TEST RÁPIDO - USA API CENTRALIZADA
// =================================================================
export async function fetchQuickQuestions(tema, searchParams, config) {
  try {
    console.log('⚡ Cargando test rápido via API centralizada, tema:', tema)

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const numQuestions = parseInt(getParam(searchParams, 'n', String(config?.numQuestions || 10)))
    const lawParam = getParam(searchParams, 'law')
    const articlesParam = getParam(searchParams, 'articles')
    const positionType = config?.positionType || 'auxiliar_administrativo'

    // Preparar filtros para la API
    const selectedLaws = lawParam ? [mapLawSlugToShortName(lawParam)] : []
    const selectedArticlesByLaw = {}

    if (articlesParam && lawParam) {
      const articleNumbers = articlesParam.split(',').map(a => parseInt(a.trim())).filter(Boolean)
      if (articleNumbers.length > 0) {
        selectedArticlesByLaw[mapLawSlugToShortName(lawParam)] = articleNumbers
      }
    }

    console.log('⚡ API Request (test rápido):', { tema, numQuestions, selectedLaws })

    // 🚀 LLAMAR A LA API CENTRALIZADA
    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: tema || 0, // 0 = sin filtro de tema
        positionType,
        numQuestions,
        selectedLaws,
        selectedArticlesByLaw,
        selectedSectionFilters: [],
        onlyOfficialQuestions: false,
        difficultyMode: 'random'
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error en API (test rápido):', data.error)
      throw new Error(data.error || 'Error obteniendo preguntas')
    }

    console.log(`✅ Test rápido: ${data.questions?.length || 0} preguntas (${data.totalAvailable} disponibles)`)
    return data.questions || []

  } catch (error) {
    console.error('❌ Error en fetchQuickQuestions:', error)
    throw error
  }
}

// =================================================================
// 🏛️ FETCHER: TEST OFICIAL - USA API CENTRALIZADA
// =================================================================
export async function fetchOfficialQuestions(tema, searchParams, config) {
  try {
    console.log('🏛️ Cargando test oficial via API centralizada, tema:', tema)

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const numQuestions = parseInt(getParam(searchParams, 'n', String(config?.numQuestions || 20)))
    const positionType = config?.positionType || 'auxiliar_administrativo'

    // 🚀 LLAMAR A LA API CENTRALIZADA CON FILTRO DE OFICIALES
    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: tema,
        positionType,
        numQuestions,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        onlyOfficialQuestions: true, // 🏛️ Solo oficiales
        difficultyMode: 'random'
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error en API (test oficial):', data.error)
      throw new Error(data.error || 'Error obteniendo preguntas oficiales')
    }

    if (!data.questions || data.questions.length === 0) {
      throw new Error(`No hay preguntas oficiales disponibles para el tema ${tema}`)
    }

    console.log(`✅ Test oficial: ${data.questions.length} preguntas (${data.totalAvailable} disponibles)`)
    return data.questions

  } catch (error) {
    console.error('❌ Error en fetchOfficialQuestions:', error)
    throw error
  }
}

// =================================================================
// 🎛️ FETCHER: TEST PERSONALIZADO - MONO-LEY (Tema 7, etc.)
// =================================================================
export async function fetchPersonalizedQuestions(tema, searchParams, config) {
  try {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`🎛️🔥 EJECUTANDO fetchPersonalizedQuestions para tema ${tema} - TIMESTAMP: ${timestamp}`)
    console.log(`🎛️🔥 STACK TRACE CORTO:`, new Error().stack.split('\n')[2]?.trim())
    
    // 🔥 LIMPIAR CACHE VIEJO Y CREAR CLAVE DE SESIÓN
    cleanOldCacheEntries()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }
    
    const sessionKey = `${user.id}-${tema}-personalizado-session`
    
    // 🔥 OBTENER O CREAR CACHE DE SESIÓN
    if (!sessionQuestionCache.has(sessionKey)) {
      sessionQuestionCache.set(sessionKey, {
        usedQuestionIds: new Set(),
        timestamp: Date.now()
      })
      console.log(`🆕🎛️ NUEVA SESIÓN PERSONALIZADA CREADA: ${sessionKey}`)
    } else {
      const existingCache = sessionQuestionCache.get(sessionKey)
      console.log(`♻️🎛️ USANDO SESIÓN PERSONALIZADA EXISTENTE: ${sessionKey}`)
      console.log(`♻️🎛️ IDs ya usados en esta sesión: ${Array.from(existingCache.usedQuestionIds).slice(0, 5).join(', ')}...`)
    }

    // Leer parámetros de configuración (usando helper para URLSearchParams u objeto)
    const configParams = {
      numQuestions: parseInt(getParam(searchParams, 'n', '25')),
      excludeRecent: getParam(searchParams, 'exclude_recent') === 'true',
      recentDays: parseInt(getParam(searchParams, 'recent_days', '15')),
      difficultyMode: getParam(searchParams, 'difficulty_mode', 'random'),
      // customDifficulty eliminado
      onlyOfficialQuestions: getParam(searchParams, 'only_official') === 'true',
      focusWeakAreas: getParam(searchParams, 'focus_weak') === 'true',
      timeLimit: getParam(searchParams, 'time_limit') ? parseInt(getParam(searchParams, 'time_limit')) : null
    }

    console.log('🎛️ Configuración personalizada MONO-LEY:', configParams)

    // 🔥 PASO 1: Obtener preguntas a excluir
    let excludedQuestionIds = []
    if (configParams.excludeRecent && user) {
      console.log(`🚫 Excluyendo preguntas respondidas en los últimos ${configParams.recentDays} días`)
      
      const cutoffDate = new Date(Date.now() - configParams.recentDays * 24 * 60 * 60 * 1000).toISOString()

      // ✅ OPTIMIZACIÓN: Query en dos pasos para evitar timeout
      const { data: userTests } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', user.id)

      const testIds = userTests?.map(t => t.id) || []

      const { data: recentAnswers, error: recentError } = await batchedTestQuestionsQuery(
        testIds,
        'question_id, test_id',
        { gte: { column: 'created_at', value: cutoffDate } }
      )

      if (!recentError && recentAnswers?.length > 0) {
        excludedQuestionIds = [...new Set(recentAnswers.map(answer => answer.question_id))]
        console.log(`📊 Total de preguntas a excluir: ${excludedQuestionIds.length}`)
      }
    }

    // 🔥 PASO 2: Construir query base para Ley 19/2013 (tema 7)
    let baseQuery = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, global_difficulty_category, question_type, tags,
        primary_article_id, is_official_exam, exam_source, exam_date,
        exam_entity, official_difficulty_level, is_active, created_at, updated_at,
        articles!inner (
          id, article_number, title, content, section,
          laws!inner (id, name, short_name, year, type, scope, current_version)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', 'Ley 19/2013')

    // 🏛️ Filtro por preguntas oficiales si está activado
    if (configParams.onlyOfficialQuestions) {
      baseQuery = baseQuery.eq('is_official_exam', true)
      console.log('🏛️ Filtro aplicado: Solo preguntas oficiales')
    }

    // 🎯 Aplicar filtro de dificultad (prioriza global_difficulty_category calculada, fallback a difficulty estática)
    switch (configParams.difficultyMode) {
      case 'easy':
        baseQuery = baseQuery.or(`global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)`)
        break
      case 'medium':
        baseQuery = baseQuery.or(`global_difficulty_category.eq.medium,and(global_difficulty_category.is.null,difficulty.eq.medium)`)
        break
      case 'hard':
        baseQuery = baseQuery.or(`global_difficulty_category.eq.hard,and(global_difficulty_category.is.null,difficulty.eq.hard)`)
        break
      case 'extreme':
        baseQuery = baseQuery.or(`global_difficulty_category.eq.extreme,and(global_difficulty_category.is.null,difficulty.eq.extreme)`)
        break
      // 'custom' eliminado
    }

    // 🔥 PASO 3: Obtener todas las preguntas
    const { data: allQuestions, error: questionsError } = await baseQuery
      .order('created_at', { ascending: false })

    if (questionsError) {
      console.error('❌ Error en consulta personalizada:', questionsError)
      throw questionsError
    }

    if (!allQuestions || allQuestions.length === 0) {
      throw new Error('No hay preguntas disponibles con esta configuración.')
    }

    // 🔥 PASO 4: Filtrar preguntas excluidas Y del cache de sesión
    let filteredQuestions = allQuestions
    
    // Filtrar exclusiones por fecha
    if (excludedQuestionIds.length > 0) {
      const excludedSet = new Set(excludedQuestionIds.map(id => String(id)))
      filteredQuestions = allQuestions.filter(question => {
        const questionId = String(question.id)
        return !excludedSet.has(questionId)
      })
      console.log(`✅ Después de exclusión por fecha: ${filteredQuestions.length} preguntas disponibles`)
    }
    
    // Filtrar preguntas ya usadas en esta sesión
    const sessionCache = sessionQuestionCache.get(sessionKey)
    const sessionUsedIds = sessionCache.usedQuestionIds
    
    filteredQuestions = filteredQuestions.filter(question => {
      return !sessionUsedIds.has(question.id)
    })
    
    console.log(`🎛️🔥 Después de exclusión de sesión: ${filteredQuestions.length} preguntas disponibles`)
    console.log(`🎛️🔥 IDs excluidos de sesión: ${Array.from(sessionUsedIds).slice(0, 3).join(', ')}...`)

    if (filteredQuestions.length === 0) {
      throw new Error('No hay preguntas disponibles después de aplicar exclusiones.')
    }

    // 🔥 PASO 5: Obtener historial del usuario para selección inteligente
    console.log(`🎛️🔥 PASO 5: Obteniendo historial del usuario para selección inteligente...`)

    // ✅ OPTIMIZACIÓN: Query en dos pasos para evitar timeout
    const { data: userTests } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', user.id)

    const testIds = userTests?.map(t => t.id) || []

    const { data: userAnswers, error: answersError } = await batchedTestQuestionsQuery(
      testIds,
      'question_id, created_at, test_id',
      { order: { column: 'created_at', ascending: false } }
    )

    if (answersError) {
      console.warn('⚠️🎛️ Error obteniendo historial, usando selección aleatoria:', answersError.message)
      // Fallback a selección aleatoria
      const shuffledQuestions = shuffleArray(filteredQuestions)
      const finalQuestions = shuffledQuestions.slice(0, configParams.numQuestions)
      
      // Agregar al cache de sesión
      finalQuestions.forEach(q => sessionUsedIds.add(q.id))
      
      console.log('✅🎛️ Test personalizado MONO-LEY cargado (fallback):', finalQuestions.length, 'preguntas')
      return transformQuestions(finalQuestions)
    }

    // 🔥 PASO 6: Clasificar preguntas en nunca vistas vs ya respondidas
    const answeredQuestionIds = new Set()
    const questionLastAnswered = new Map()

    if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id)
        const answerDate = new Date(answer.created_at)
        
        if (!questionLastAnswered.has(answer.question_id) || 
            answerDate > questionLastAnswered.get(answer.question_id)) {
          questionLastAnswered.set(answer.question_id, answerDate)
        }
      })
    }

    const neverSeenQuestions = filteredQuestions.filter(q => !answeredQuestionIds.has(q.id))
    const answeredQuestions = filteredQuestions.filter(q => answeredQuestionIds.has(q.id))

    // Ordenar respondidas por fecha (más antiguas primero para spaced repetition)
    answeredQuestions.sort((a, b) => {
      const dateA = questionLastAnswered.get(a.id) || new Date(0)
      const dateB = questionLastAnswered.get(b.id) || new Date(0)
      return dateA - dateB
    })

    console.log(`🎛️🔥 CLASIFICACIÓN:`)
    console.log(`🎛️🔥   📚 Total preguntas disponibles: ${filteredQuestions.length}`)
    console.log(`🎛️🔥   🟢 Nunca vistas: ${neverSeenQuestions.length}`)
    console.log(`🎛️🔥   🟡 Ya respondidas: ${answeredQuestions.length}`)

    // 🔥 PASO 7: Aplicar algoritmo inteligente de selección
    let selectedQuestions = []
    
    if (neverSeenQuestions.length >= configParams.numQuestions) {
      // ✅ 1º PRIORIDAD: Si hay suficientes preguntas nunca vistas, usar solo esas
      console.log('🎯🎛️ ESTRATEGIA: Solo preguntas nunca vistas')
      const shuffledNeverSeen = shuffleArray(neverSeenQuestions)
      selectedQuestions = shuffledNeverSeen.slice(0, configParams.numQuestions)
      
      console.log(`✅🎛️ Seleccionadas ${selectedQuestions.length} preguntas nunca vistas`)
      
    } else {
      // ✅ 2º PRIORIDAD: Distribución mixta - todas las nunca vistas + las más antiguas respondidas
      console.log('🎯🎛️ ESTRATEGIA: Distribución mixta')
      
      const neverSeenCount = neverSeenQuestions.length
      const reviewCount = configParams.numQuestions - neverSeenCount
      
      console.log(`📊🎛️ Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
      
      const shuffledNeverSeen = shuffleArray(neverSeenQuestions)
      const oldestForReview = answeredQuestions.slice(0, reviewCount)
      
      selectedQuestions = [...shuffledNeverSeen, ...oldestForReview]
      
      console.log(`✅🎛️ Combinadas: ${shuffledNeverSeen.length} + ${oldestForReview.length} = ${selectedQuestions.length}`)
    }

    // 🔥 PASO 8: Mezcla final y actualizar cache de sesión
    selectedQuestions = shuffleArray(selectedQuestions)
    
    // Agregar IDs al cache de sesión
    selectedQuestions.forEach(q => {
      sessionUsedIds.add(q.id)
      console.log(`🎛️📝 Agregado al cache de sesión: ${q.id}`)
    })
    
    console.log(`🎛️🔥 RESULTADO FINAL PERSONALIZADO:`)
    console.log(`🎛️🔥   📚 Preguntas seleccionadas: ${selectedQuestions.length}`)
    console.log(`🎛️🔥   🎯 IDs: ${selectedQuestions.map(q => q.id).slice(0, 3).join(', ')}...`)
    console.log(`🎛️🔥   📊 Total en cache de sesión: ${sessionUsedIds.size}`)

    return transformQuestions(selectedQuestions)

  } catch (error) {
    console.error('❌ Error en fetchPersonalizedQuestions:', error)
    throw error
  }
}

// =================================================================
// 🎯 FETCHER: TEST MULTI-LEY - PARA TEMAS CON MÚLTIPLES LEYES (Tema 6, etc.)
// =================================================================

// =================================================================
export async function fetchQuestionsByTopicScope(tema, searchParams, config) {
  try {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`🎯🔥 EJECUTANDO fetchQuestionsByTopicScope para tema ${tema} - TIMESTAMP: ${timestamp}`)
    console.log(`🎯🔥 STACK TRACE CORTO:`, new Error().stack.split('\n')[2]?.trim())
    
    // 🔥 OBTENER USUARIO PARA ALGORITMO DE HISTORIAL
    const { data: { user } } = await supabase.auth.getUser()
    
    // 🚨 CACHE DE SESIÓN ELIMINADO: El sistema ahora usa solo el historial
    // real de la base de datos para determinar qué preguntas ha visto el usuario
    console.log(`✅ SISTEMA SIMPLIFICADO: Sin cache de sesión artificial`)
    
    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const numQuestions = parseInt(getParam(searchParams, 'n', '25'))
    const onlyOfficialQuestions = getParam(searchParams, 'only_official') === 'true'
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const recentDays = parseInt(getParam(searchParams, 'recent_days', '15'))
    const difficultyMode = getParam(searchParams, 'difficulty_mode', 'random')
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'
    const adaptiveMode = getParam(searchParams, 'adaptive') === 'true' // 🧠 MODO ADAPTATIVO
    const focusWeakAreas = config?.focusWeakAreas ?? (getParam(searchParams, 'focus_weak') === 'true') // 🎯 ÁREAS DÉBILES (prioriza config)
    const onlyFailedQuestions = getParam(searchParams, 'only_failed') === 'true' // 🆕 SOLO PREGUNTAS FALLADAS
    const failedQuestionIdsStr = getParam(searchParams, 'failed_question_ids')
    const failedQuestionIds = failedQuestionIdsStr ? JSON.parse(failedQuestionIdsStr) : null // 🆕 IDs ESPECÍFICOS
    const failedQuestionsOrder = getParam(searchParams, 'failed_questions_order') // 🆕 TIPO DE ORDEN
    const positionType = config?.positionType || 'auxiliar_administrativo' // 🏢 TIPO DE OPOSICIÓN
    const timeLimitStr = getParam(searchParams, 'time_limit')
    const timeLimit = timeLimitStr ? parseInt(timeLimitStr) : null // ⏱️ LÍMITE DE TIEMPO
    
    // 🆕 FILTROS DE LEYES Y ARTÍCULOS DESDE CONFIG
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    const selectedSectionFilters = config?.selectedSectionFilters || [] // 📚 FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)

    // Debug removido - sistema funcionando

    console.log('🎛️ Configuración MULTI-LEY:', {
      numQuestions,
      focusWeakAreas, // 🧠 DEBUG: Ver si se activa modo adaptativo
      onlyOfficialQuestions,
      excludeRecent,
      recentDays,
      difficultyMode,
      focusEssentialArticles,
      adaptiveMode, // 🧠 NUEVO
      focusWeakAreas, // 🎯 NUEVO
      onlyFailedQuestions, // 🆕 NUEVO
      failedQuestionIds: failedQuestionIds?.length || 0, // 🆕 NUEVO
      failedQuestionsOrder, // 🆕 NUEVO
      timeLimit, // ⏱️ NUEVO
      selectedLaws: selectedLaws.length,
      selectedArticlesByLaw: Object.keys(selectedArticlesByLaw).length,
      selectedSectionFilters: selectedSectionFilters.length > 0 ? selectedSectionFilters.map(s => s.title).join(', ') : null // 📚 FILTRO DE SECCIONES
    })

    // 🆕 MANEJO ESPECIAL PARA PREGUNTAS FALLADAS CON IDs ESPECÍFICOS
    if (onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0) {
      console.log(`❌ Modo preguntas falladas específicas: ${failedQuestionIds.length} preguntas, orden: ${failedQuestionsOrder}`)
      
      try {
        // Obtener las preguntas específicas en el orden correcto
        const { data: specificQuestions, error: specificError } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .in('id', failedQuestionIds)
        
        if (specificError) {
          console.error('❌ Error obteniendo preguntas falladas específicas:', specificError)
          throw specificError
        }
        
        if (!specificQuestions || specificQuestions.length === 0) {
          throw new Error('No se encontraron las preguntas falladas especificadas')
        }
        
        // Ordenar las preguntas según la lista de IDs (mantener el orden elegido por el usuario)
        const orderedQuestions = failedQuestionIds
          .map(id => specificQuestions.find(q => q.id === id))
          .filter(q => q) // Filtrar preguntas no encontradas
        
        // Tomar solo el número solicitado
        const finalQuestions = orderedQuestions.slice(0, numQuestions)
        
        console.log(`✅ Test de preguntas falladas cargado: ${finalQuestions.length} preguntas en orden ${failedQuestionsOrder}`)
        return transformQuestions(finalQuestions)
        
      } catch (error) {
        console.error('❌ Error en modo preguntas falladas específicas:', error)
        throw error
      }
    }
    
    
    // 1. Obtener mapeo del tema desde topic_scope o construcción directa
    let mappings = []
    
    if (tema && tema > 0) {
      // Flujo normal: usar topic_scope para un tema específico
      const { data: topicMappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id, name),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', tema)
        .eq('topics.position_type', positionType)

      if (mappingError) {
        console.warn('⚠️ Error obteniendo mapeo:', mappingError?.message || 'Error desconocido')
        throw mappingError
      }
      
      if (!topicMappings?.length) {
        throw new Error(`No se encontró mapeo para tema ${tema}`)
      }
      
      mappings = topicMappings
      // Debug mapeo tema (comentado para producción)
      // console.log(`📊 Mapeo tema ${tema}:`, mappings.map(m => `${m.laws.short_name}: ${m.article_numbers.length} arts`))
      
    } else if (selectedLaws.length > 0) {
      // Flujo alternativo: construir mapeo directo desde leyes seleccionadas
      console.log(`🔧 Construyendo mapeo directo para leyes:`, selectedLaws)
      
      for (const lawShortName of selectedLaws) {
        const { data: lawData, error: lawError } = await supabase
          .from('laws')
          .select('id, name, short_name')
          .eq('short_name', lawShortName)
          .single()
        
        if (lawError || !lawData) {
          console.warn(`⚠️ No se pudo obtener ley ${lawShortName}:`, lawError?.message || 'No encontrada')
          continue
        }
        
        // Obtener todos los artículos de esta ley (o los filtrados si se especifican)
        let articleNumbers = []
        if (selectedArticlesByLaw[lawShortName]?.length > 0) {
          articleNumbers = selectedArticlesByLaw[lawShortName]
        } else {
          // Si no hay filtros específicos, obtener todos los artículos de la ley
          const { data: allArticles, error: articlesError } = await supabase
            .from('articles')
            .select('article_number')
            .eq('law_id', lawData.id)
            .order('article_number')
          
          if (!articlesError && allArticles) {
            articleNumbers = allArticles.map(a => a.article_number)
          }
        }
        
        if (articleNumbers.length > 0) {
          mappings.push({
            article_numbers: articleNumbers,
            laws: {
              id: lawData.id,
              name: lawData.name,
              short_name: lawData.short_name
            }
          })
        }
      }
      
      console.log(`📊 Mapeo directo construido:`, mappings.map(m => `${m.laws.short_name}: ${m.article_numbers.length} arts`))
      
    } else {
      throw new Error('No se especificó tema ni leyes para filtrar')
    }
    
    
    // 🆕 FILTRAR MAPEOS POR LEYES SELECCIONADAS
    let filteredMappings = mappings

    if (selectedLaws.length > 0) {
      filteredMappings = mappings.filter(mapping => {
        const lawShortName = mapping.laws.short_name
        return selectedLaws.includes(lawShortName)
      })
      console.log(`🔧 Filtrado por leyes seleccionadas: ${filteredMappings.length}/${mappings.length} leyes`)
    }
    
    // 🆕 APLICAR FILTRO DE ARTÍCULOS POR LEY
    if (Object.keys(selectedArticlesByLaw).length > 0) {
      filteredMappings = filteredMappings.map(mapping => {
        const lawShortName = mapping.laws.short_name
        const selectedArticles = selectedArticlesByLaw[lawShortName]
        
        if (selectedArticles && selectedArticles.length > 0) {
          // Filtrar solo los artículos seleccionados
          // 🔧 FIX: Convertir selectedArticles a strings para comparar con article_numbers (que son strings)
          const selectedArticlesAsStrings = selectedArticles.map(num => String(num))
          const filteredArticleNumbers = mapping.article_numbers.filter(articleNum => {
            return selectedArticlesAsStrings.includes(articleNum)
          })
          console.log(`🔧 Ley ${mapping.laws.short_name}: ${filteredArticleNumbers.length}/${mapping.article_numbers.length} artículos seleccionados`)
          
          return {
            ...mapping,
            article_numbers: filteredArticleNumbers
          }
        }
        
        return mapping
      }).filter(mapping => mapping.article_numbers.length > 0) // Eliminar mapeos sin artículos
    }

    // 📚 APLICAR FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)
    if (selectedSectionFilters && selectedSectionFilters.length > 0) {
      // Extraer todos los rangos de las secciones seleccionadas
      const ranges = selectedSectionFilters
        .filter(s => s.articleRange)
        .map(s => ({ start: s.articleRange.start, end: s.articleRange.end, title: s.title }))

      if (ranges.length > 0) {
        const rangeDescriptions = ranges.map(r => `${r.title} (${r.start}-${r.end})`).join(', ')
        console.log(`📚 Aplicando filtro de secciones: ${rangeDescriptions}`)

        filteredMappings = filteredMappings.map(mapping => {
          // Filtrar artículos que estén dentro de AL MENOS UNO de los rangos seleccionados
          const filteredArticleNumbers = mapping.article_numbers.filter(articleNum => {
            const num = parseInt(articleNum)
            return ranges.some(range => num >= range.start && num <= range.end)
          })

          console.log(`📚 Ley ${mapping.laws.short_name}: ${filteredArticleNumbers.length}/${mapping.article_numbers.length} artículos en rangos seleccionados`)

          return {
            ...mapping,
            article_numbers: filteredArticleNumbers
          }
        }).filter(mapping => mapping.article_numbers.length > 0)
      }
    }

    if (filteredMappings.length === 0) {
      throw new Error('No hay leyes o artículos seleccionados para generar el test')
    }

    // 2. Obtener usuario actual para exclusiones
    let excludedQuestionIds = []
    if (excludeRecent) {
      try {
        // Reutilizar la variable user ya declarada en la línea 485
        if (user) {
          console.log(`🚫 Excluyendo preguntas respondidas en los últimos ${recentDays} días`)
          
          const cutoffDate = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString()

          // ✅ OPTIMIZACIÓN: Query en dos pasos para evitar timeout
          const { data: userTests } = await supabase
            .from('tests')
            .select('id')
            .eq('user_id', user.id)

          const testIds = userTests?.map(t => t.id) || []

          const { data: recentAnswers, error: recentError } = await batchedTestQuestionsQuery(
            testIds,
            'question_id, test_id',
            { gte: { column: 'created_at', value: cutoffDate } }
          )

          if (!recentError && recentAnswers?.length > 0) {
            excludedQuestionIds = [...new Set(recentAnswers.map(answer => answer.question_id))]
            console.log(`📊 Total de preguntas a excluir: ${excludedQuestionIds.length}`)
          }
        }
      } catch (userError) {
        console.log('⚠️ No se pudo obtener usuario para exclusiones:', userError.message)
      }
    }

    // 3. ENFOQUE MEJORADO: Hacer múltiples consultas separadas con todos los filtros
    const allQuestions = []
    
    for (const mapping of filteredMappings) {
      // console.log(`🔍 Consultando ${mapping.laws.short_name}: ${mapping.article_numbers.length} artículos`)
      
      // Construir consulta base
      let baseQuery = supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, global_difficulty_category, question_type, tags,
          primary_article_id, is_official_exam, exam_source, exam_date,
          exam_entity, official_difficulty_level, is_active, created_at, updated_at,
          articles!inner (
            id, article_number, title, content, section,
            laws!inner (id, name, short_name, year, type, scope, current_version)
          )
        `)
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)

      // 🏛️ FILTRO CORREGIDO: Solo preguntas oficiales si está activado
      if (onlyOfficialQuestions) {
        baseQuery = baseQuery.eq('is_official_exam', true)
        console.log(`🏛️ ${mapping.laws.short_name}: Filtro aplicado - Solo preguntas oficiales`)
      }

      // 🎯 Aplicar filtro de dificultad (prioriza global_difficulty_category calculada, fallback a difficulty estática)
      switch (difficultyMode) {
        case 'easy':
          baseQuery = baseQuery.or(`global_difficulty_category.eq.easy,and(global_difficulty_category.is.null,difficulty.eq.easy)`)
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'easy'`)
          break
        case 'medium':
          baseQuery = baseQuery.or(`global_difficulty_category.eq.medium,and(global_difficulty_category.is.null,difficulty.eq.medium)`)
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'medium'`)
          break
        case 'hard':
          baseQuery = baseQuery.or(`global_difficulty_category.eq.hard,and(global_difficulty_category.is.null,difficulty.eq.hard)`)
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'hard'`)
          break
        case 'extreme':
          baseQuery = baseQuery.or(`global_difficulty_category.eq.extreme,and(global_difficulty_category.is.null,difficulty.eq.extreme)`)
          console.log(`🎯 ${mapping.laws.short_name}: Aplicando filtro dificultad = 'extreme'`)
          break
        default:
          // console.log(`🎲 ${mapping.laws.short_name}: Sin filtro de dificultad (modo: ${difficultyMode})`)
          break
      }
      
      // Ejecutar consulta
      const { data: lawQuestions, error: lawError } = await baseQuery
        .order('created_at', { ascending: false })
      
      if (lawError) {
        console.warn(`⚠️ Error consultando ${mapping.laws.short_name}:`, lawError?.message || 'Error desconocido')
        continue // Continuar con la siguiente ley en lugar de fallar todo
      }
      
      
      if (lawQuestions && lawQuestions.length > 0) {
        // console.log(`✅ ${mapping.laws.short_name}: ${lawQuestions.length} preguntas encontradas`)
        allQuestions.push(...lawQuestions)
      } else {
        console.log(`⚠️ ${mapping.laws.short_name}: Sin preguntas disponibles con filtros aplicados`)
      }
    }
    
    if (allQuestions.length === 0) {
      const filterInfo = []
      if (onlyOfficialQuestions) filterInfo.push('solo oficiales')
      if (difficultyMode !== 'random') filterInfo.push(`dificultad: ${difficultyMode}`)
      if (excludeRecent) filterInfo.push(`excluyendo recientes`)
      if (focusEssentialArticles) filterInfo.push('artículos imprescindibles')
      
      const filtersApplied = filterInfo.length > 0 ? ` (filtros: ${filterInfo.join(', ')})` : ''
      throw new Error(`No hay preguntas disponibles para tema ${tema}${filtersApplied}`)
    }
    
    console.log(`📋 Total preguntas encontradas: ${allQuestions.length}`)
    
    // 4. Aplicar filtro de exclusión de preguntas recientes EN MEMORIA
    let filteredQuestions = allQuestions
    
    if (excludedQuestionIds.length > 0) {
      const excludedSet = new Set(excludedQuestionIds.map(id => String(id)))
      filteredQuestions = allQuestions.filter(question => {
        const questionId = String(question.id)
        return !excludedSet.has(questionId)
      })
      
      console.log(`✅ Después de exclusión: ${filteredQuestions.length} preguntas disponibles`)
      
      if (filteredQuestions.length === 0) {
        throw new Error('No hay preguntas disponibles después de aplicar exclusiones.')
      }
    }

    
    // 5. Aplicar filtro de artículos imprescindibles si está activado
    let prioritizedQuestions = filteredQuestions
    
    if (focusEssentialArticles) {
      console.log('⭐ Aplicando filtro de artículos imprescindibles...')

      // CORRECCIÓN: Identificar artículos imprescindibles consultando TODA la base de datos
      const articleOfficialCount = {}

      // Obtener todos los artículos que tienen preguntas oficiales para los artículos FILTRADOS
      // 🔧 FIX: Usar filteredMappings en lugar de mappings para solo contar artículos seleccionados
      for (const mapping of filteredMappings) {
        for (const articleNumber of mapping.article_numbers) {
          const { count } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_official_exam', true)
            .eq('articles.laws.short_name', mapping.laws.short_name)
            .eq('articles.article_number', articleNumber)
          
          if (count > 0) {
            const articleKey = `${mapping.laws.short_name}-${articleNumber}`
            articleOfficialCount[articleKey] = count
          }
        }
      }
      
      console.log('📊 Artículos con preguntas oficiales (CORREGIDO):', articleOfficialCount)
      
      // Separar preguntas por si son de artículos imprescindibles o no
      const essentialQuestions = []
      const nonEssentialQuestions = []
      
      filteredQuestions.forEach(question => {
        if (question.articles?.article_number) {
          const articleKey = `${question.articles.laws.short_name}-${question.articles.article_number}`
          if (articleOfficialCount[articleKey] >= 1) {
            essentialQuestions.push(question)
          } else {
            nonEssentialQuestions.push(question)
          }
        } else {
          nonEssentialQuestions.push(question)
        }
      })
      
      console.log(`⭐ Artículos imprescindibles: ${essentialQuestions.length} preguntas`)
      console.log(`📝 Artículos normales: ${nonEssentialQuestions.length} preguntas`)
      
      // 🔍 DEBUG: Verificar dificultades de preguntas imprescindibles
      const difficultyStats = {}
      essentialQuestions.forEach(q => {
        const difficulty = q.difficulty || 'unknown'
        difficultyStats[difficulty] = (difficultyStats[difficulty] || 0) + 1
      })
      console.log('📊 Distribución de dificultades en artículos imprescindibles:', difficultyStats)
      
      if (difficultyMode !== 'random') {
        const filteredByDifficulty = essentialQuestions.filter(q => q.difficulty === difficultyMode)
        console.log(`🎯 Preguntas imprescindibles con dificultad "${difficultyMode}": ${filteredByDifficulty.length}`)
      }
      
      // 🔥 FILTRO EXCLUSIVO: Solo artículos imprescindibles (100%)
      console.log('⭐ MODO EXCLUSIVO: Solo preguntas de artículos imprescindibles')
      
      if (essentialQuestions.length === 0) {
        throw new Error(`No hay preguntas de artículos imprescindibles para tema ${tema}. Los artículos imprescindibles son aquellos que tienen preguntas oficiales.`)
      }
      
      // ✅ USAR TODAS las preguntas de artículos imprescindibles para priorización inteligente
      // NO hacer selección aleatoria aquí - dejar que la priorización inteligente decida
      prioritizedQuestions = essentialQuestions
      
      console.log(`⭐ Filtro exclusivo aplicado: ${prioritizedQuestions.length} preguntas SOLO de artículos imprescindibles`)
      console.log('📊 Artículos imprescindibles disponibles:', Object.keys(articleOfficialCount))
      
      // Debug: Mostrar qué artículos van a aparecer en el test
      const testArticles = new Set()
      prioritizedQuestions.forEach(q => {
        if (q.articles?.article_number) {
          const articleKey = `Art. ${q.articles.article_number} ${q.articles.laws.short_name}`
          testArticles.add(articleKey)
        }
      })
      
      console.log('🎯 ARTÍCULOS QUE APARECERÁN EN EL TEST:', Array.from(testArticles).sort())
    }
    
    // 🧠 CALCULAR TAMAÑO DEL POOL SEGÚN MODO ADAPTATIVO
    const poolSize = adaptiveMode ? Math.max(numQuestions * 2, 50) : numQuestions
    console.log(`🧠 Tamaño del pool: ${poolSize} preguntas (adaptativo: ${adaptiveMode})`)
    
    // 🧠 PRIORIZACIÓN INTELIGENTE (como en test aleatorio)
    let questionsToProcess = focusEssentialArticles ? prioritizedQuestions : filteredQuestions
    let finalQuestions = []
    
    // 🚨 LOG CRÍTICO: ¿Cuántas preguntas llegan al algoritmo?
    console.log(`\n🔍 PREGUNTAS ANTES DEL ALGORITMO:`)
    console.log(`   📊 questionsToProcess.length: ${questionsToProcess?.length || 0}`)
    console.log(`   📊 focusEssentialArticles: ${focusEssentialArticles}`)
    console.log(`   📊 filteredQuestions: ${filteredQuestions?.length || 0}`)
    console.log(`   📊 prioritizedQuestions: ${prioritizedQuestions?.length || 0}`)
    
    // Reutilizar la variable user ya declarada en la línea 485
    if (user) {
      // Aplicando priorización inteligente para test individual

      // 1. Obtener historial de respuestas del usuario SOLO a preguntas que siguen activas
      // 🚀 OPTIMIZADO: Usa API con Drizzle en lugar de IN clause con 250+ UUIDs
      const { history: userHistory, error: historyError } = await fetchUserQuestionHistory(user.id, true)

      console.log(`🚀 API OPTIMIZADA: Historial obtenido con ${userHistory.length} preguntas`)

      if (!historyError && userHistory && userHistory.length > 0) {
        // 2. Clasificar preguntas por prioridad
        const answeredQuestionIds = new Set()
        const questionLastAnswered = new Map()

        userHistory.forEach(item => {
          answeredQuestionIds.add(item.questionId)
          const answerDate = new Date(item.lastAnsweredAt)
          questionLastAnswered.set(item.questionId, answerDate)
        })
        
        // 3. Separar preguntas por prioridad
        const neverSeenQuestions = []
        const answeredQuestions = []
        
        questionsToProcess.forEach(question => {
          if (answeredQuestionIds.has(question.id)) {
            // Pregunta ya respondida - agregar fecha para ordenamiento
            question._lastAnswered = questionLastAnswered.get(question.id)
            answeredQuestions.push(question)
          } else {
            // Pregunta nunca vista - máxima prioridad
            neverSeenQuestions.push(question)
          }
        })
        
        
        // 4. Ordenar preguntas respondidas por fecha (más antiguas primero)
        answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
        
        // Logs de priorización comentados para producción
        // console.log(`🎯 DECISIÓN DE PRIORIZACIÓN TEMA ${tema}:`)
        // console.log(`- Nunca vistas: ${neverSeenQuestions.length}`)
        // console.log(`- Ya respondidas: ${answeredQuestions.length}`)
        // console.log(`- Pool solicitado: ${poolSize} (activas: ${numQuestions})`)

        // 5. Calcular distribución inteligente
        // 🔥 FIX CRÍTICO: Eliminar duplicados antes de procesar
        const uniqueNeverSeen = neverSeenQuestions.filter((question, index, arr) => 
          arr.findIndex(q => q.id === question.id) === index
        )
        
        const uniqueAnswered = answeredQuestions.filter((question, index, arr) => 
          arr.findIndex(q => q.id === question.id) === index
        )
        
        const neverSeenCount = uniqueNeverSeen.length
        
        console.log(`🔍 DEBUG: neverSeen originales: ${neverSeenQuestions.length}, únicos: ${uniqueNeverSeen.length}`)
        console.log(`🔍 DEBUG: answered originales: ${answeredQuestions.length}, únicos: ${uniqueAnswered.length}`)
        
        // 🚨 LOGS CRÍTICOS PARA DEBUG DEL FALLO
        console.log(`\n🎯 ANÁLISIS CRÍTICO:`)
        console.log(`   📊 neverSeenCount = ${neverSeenCount}`)
        console.log(`   📊 numQuestions = ${numQuestions}`)
        console.log(`   🔍 CONDICIÓN: ${neverSeenCount} >= ${numQuestions} = ${neverSeenCount >= numQuestions}`)
        console.log(`   📝 Tipo neverSeenCount: ${typeof neverSeenCount}`)
        console.log(`   📝 Tipo numQuestions: ${typeof numQuestions}`)
        
        // 🚨 FIX PROBLEMA PREGUNTAS REPETIDAS: Priorizar nunca vistas SIEMPRE
        if (neverSeenCount >= numQuestions) {
          // CASO A: Suficientes nunca vistas - NO incluir repaso
          console.log('🎯 CASO 2A: Solo preguntas nunca vistas (suficientes disponibles)')
          console.log(`📊 Distribución: ${numQuestions} nunca vistas (de ${neverSeenCount} disponibles)`)
          
          const shuffledNeverSeen = uniqueNeverSeen.sort(() => Math.random() - 0.5)
          finalQuestions = shuffledNeverSeen.slice(0, numQuestions)
          
          // 🔍 LOG CRÍTICO: IDs de las preguntas seleccionadas como "nunca vistas"
          const neverSeenIds = finalQuestions.map(q => q.id)
          console.log('🔍 IDS NUNCA VISTAS SELECCIONADAS:', neverSeenIds)
          console.log('🔍 IDS NUNCA VISTAS (JSON):', JSON.stringify(neverSeenIds))
          
        } else {
          // CASO B: Insuficientes nunca vistas - completar con repaso
          const reviewCount = numQuestions - neverSeenCount
          
          console.log('🎯 CASO 2B: Distribución mixta - insuficientes nunca vistas')
          console.log(`📊 Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
          
          // Todas las nunca vistas (mezcladas)
          const shuffledNeverSeen = uniqueNeverSeen.sort(() => Math.random() - 0.5)
          
          console.log(`🔍 IDS NUNCA VISTAS (CASO B):`, shuffledNeverSeen.map(q => q.id))
          
          // 🚨 FIX CRÍTICO: Filtrar preguntas respondidas recientemente para repaso
          const cutoffDate = new Date(Date.now() - (excludeRecent ? recentDays * 24 * 60 * 60 * 1000 : 0))
          const eligibleForReview = uniqueAnswered.filter(q => {
            const lastAnswered = questionLastAnswered.get(q.id)
            return !lastAnswered || lastAnswered < cutoffDate
          })

          console.log(`🔍 DEBUG REPASO: ${uniqueAnswered.length} respondidas → ${eligibleForReview.length} elegibles para repaso (${excludeRecent ? recentDays : 0} días mínimo)`)
          
          // Tomar las más elegibles para repaso
          const oldestForReview = eligibleForReview.slice(0, reviewCount)
          
          console.log(`🔍 IDS REPASO SELECCIONADAS:`, oldestForReview.map(q => q.id))
          
          finalQuestions = [...shuffledNeverSeen, ...oldestForReview]
        }
        
        // 6. Mezclar orden final para que no sea predecible
        finalQuestions = finalQuestions.sort(() => Math.random() - 0.5)
        
        // 🔥 VERIFICACIÓN FINAL: Eliminar duplicados del resultado final
        const finalUniqueQuestions = finalQuestions.filter((question, index, arr) => 
          arr.findIndex(q => q.id === question.id) === index
        )
        
        if (finalUniqueQuestions.length !== finalQuestions.length) {
          console.log(`🚨 DUPLICADOS DETECTADOS: ${finalQuestions.length} → ${finalUniqueQuestions.length}`)
          finalQuestions = finalUniqueQuestions
        }
        
        // Limpiar propiedades temporales
        finalQuestions.forEach(q => {
          delete q._lastAnswered
        })
        
      } else {
        // Fallback si no hay historial o error
        console.log('📊 Sin historial de usuario, usando selección aleatoria')
        
        // 🔥 FIX: Deduplicar también en fallback
        const uniqueQuestions = questionsToProcess.filter((question, index, arr) => 
          arr.findIndex(q => q.id === question.id) === index
        )
        console.log(`🔍 DEBUG fallback: originales: ${questionsToProcess.length}, únicos: ${uniqueQuestions.length}`)
        
        finalQuestions = shuffleArray(uniqueQuestions).slice(0, numQuestions)
      }
    } else {
      // Fallback si no hay usuario
      console.log('📊 Usuario no autenticado, usando selección aleatoria')
      
      // 🔥 FIX: Deduplicar también en fallback
      const uniqueQuestions = questionsToProcess.filter((question, index, arr) => 
        arr.findIndex(q => q.id === question.id) === index
      )
      console.log(`🔍 DEBUG no-auth: originales: ${questionsToProcess.length}, únicos: ${uniqueQuestions.length}`)
      
      finalQuestions = shuffleArray(uniqueQuestions).slice(0, numQuestions)
    }
    
    // 6. Log de resumen
    const lawDistribution = finalQuestions.reduce((acc, q) => {
      const law = q.articles?.laws?.short_name || 'N/A'
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})
    
    const officialCount = finalQuestions.filter(q => q.is_official_exam).length
    
    console.log(`\n✅ Tema ${tema} MULTI-LEY cargado: ${finalQuestions.length} preguntas de ${mappings.length} leyes`)
    console.log(`📊 Distribución por ley:`, lawDistribution)
    console.log(`🏛️ Preguntas oficiales: ${officialCount}/${finalQuestions.length}`)
    if (focusEssentialArticles) {
      console.log(`⭐ Filtro aplicado: SOLO artículos imprescindibles`)
    }
    
    // 🔍 DEBUG: Verificar dificultades de preguntas finales
    const finalDifficultyStats = {}
    finalQuestions.forEach(q => {
      const difficulty = q.difficulty || 'unknown'
      finalDifficultyStats[difficulty] = (finalDifficultyStats[difficulty] || 0) + 1
    })
    console.log(`🎯 Dificultades en test final:`, finalDifficultyStats)
    
    if (difficultyMode !== 'random') {
      const expectedDifficulty = difficultyMode
      const matchingCount = finalQuestions.filter(q => q.difficulty === expectedDifficulty).length
      console.log(`✅ Filtro de dificultad "${expectedDifficulty}": ${matchingCount}/${finalQuestions.length} preguntas coinciden`)
      
      if (matchingCount === 0) {
        console.log(`⚠️ ADVERTENCIA: No hay preguntas de dificultad "${expectedDifficulty}" en el test final`)
      } else if (matchingCount < finalQuestions.length) {
        console.log(`⚠️ ADVERTENCIA: Solo ${matchingCount} de ${finalQuestions.length} preguntas son de dificultad "${expectedDifficulty}"`)
      }
    }
    
    // 🔍 DEBUG MEJORADO: Análisis detallado de artículos en el test
    if (focusEssentialArticles) {
      console.log('\n🔍 ===== ANÁLISIS DETALLADO DE ARTÍCULOS IMPRESCINDIBLES =====')
      
      // Re-obtener articleOfficialCount para el debug (ya se calculó antes)
      const debugArticleOfficialCount = {}
      for (const mapping of mappings) {
        for (const articleNumber of mapping.article_numbers) {
          const { count } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_official_exam', true)
            .eq('articles.laws.short_name', mapping.laws.short_name)
            .eq('articles.article_number', articleNumber)
          
          if (count > 0) {
            const articleKey = `${mapping.laws.short_name}-${articleNumber}`
            debugArticleOfficialCount[articleKey] = count
          }
        }
      }
      
      // Mostrar todos los artículos imprescindibles identificados
      const allEssentialArticles = Object.keys(debugArticleOfficialCount || {}).map(key => {
        const [law, article] = key.split('-')
        return `Art. ${article} ${law} (${debugArticleOfficialCount[key]} oficiales)`
      })
      
      console.log('⭐ ARTÍCULOS IMPRESCINDIBLES IDENTIFICADOS:')
      allEssentialArticles.forEach(article => console.log(`   • ${article}`))
      
      // Analizar artículos que realmente aparecen en el test
      const testArticleStats = {}
      finalQuestions.forEach(q => {
        if (q.articles?.article_number) {
          const articleDisplay = `Art. ${q.articles.article_number} ${q.articles.laws.short_name}`
          const articleKey = `${q.articles.laws.short_name}-${q.articles.article_number}`
          const isEssential = (debugArticleOfficialCount || {})[articleKey] >= 1
          
          if (!testArticleStats[articleDisplay]) {
            testArticleStats[articleDisplay] = {
              count: 0,
              isEssential: isEssential,
              officialCount: (debugArticleOfficialCount || {})[articleKey] || 0
            }
          }
          testArticleStats[articleDisplay].count++
        }
      })
      
      console.log('\n🎯 ARTÍCULOS QUE APARECEN EN ESTE TEST:')
      Object.entries(testArticleStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([article, stats]) => {
          const marker = stats.isEssential ? '⭐' : '📄'
          const essentialInfo = stats.isEssential ? ` (${stats.officialCount} oficiales)` : ' (NO imprescindible)'
          console.log(`   ${marker} ${article}: ${stats.count} preguntas${essentialInfo}`)
        })
      
      const essentialInTest = Object.values(testArticleStats).filter(s => s.isEssential).length
      const totalInTest = Object.keys(testArticleStats).length
      
      console.log(`\n📊 RESUMEN: ${essentialInTest}/${totalInTest} artículos del test son imprescindibles`)
      console.log('================================================================\n')
    }
    
    // 🔥 VERIFICACIÓN FINAL ABSOLUTA: Eliminar duplicados del resultado
    const absoluteFinalQuestions = finalQuestions.filter((question, index, arr) => 
      arr.findIndex(q => q.id === question.id) === index
    )
    
    if (absoluteFinalQuestions.length !== finalQuestions.length) {
      console.log(`🚨 DUPLICADOS FINALES ELIMINADOS: ${finalQuestions.length} → ${absoluteFinalQuestions.length}`)
    }
    
    console.log(`✅ RESULTADO FINAL: ${absoluteFinalQuestions.length} preguntas únicas confirmadas`)
    
    // 🚨 CACHE DE SESIÓN ELIMINADO: Ya no es necesario porque el algoritmo
    // de historial funciona correctamente. Las preguntas respondidas se marcan
    // automáticamente como "ya vistas" en la base de datos.
    
    console.log(`✅ SISTEMA LIMPIO: Sin cache de sesión artificial`)
    console.log(`🎯 ALGORITMO DIRECTO: Solo lógica de historial real`)
    
    // Usar directamente el resultado del algoritmo inteligente
    const finalSessionQuestions = absoluteFinalQuestions.slice(0, numQuestions)
    
    // Log de IDs para debugging - CRÍTICO PARA DETECTAR DUPLICADOS
    const questionIds = finalSessionQuestions.map(q => q.id)
    const uniqueIds = new Set(questionIds)
    console.log(`🔍 IDS FINALES SELECCIONADOS:`, questionIds)
    console.log(`🔍 IDS FINALES (JSON):`, JSON.stringify(questionIds))
    
    if (uniqueIds.size !== questionIds.length) {
      console.error(`🚨 BUG CRÍTICO: AÚN HAY DUPLICADOS EN EL RESULTADO FINAL`)
      console.error(`IDs duplicados:`, questionIds)
      console.error(`Únicos: ${uniqueIds.size}, Total: ${questionIds.length}`)
    }
    
    // 🧠 VERIFICAR SI SE NECESITA CATÁLOGO ADAPTATIVO
    // ⚠️ DESACTIVAR en modos restrictivos (artículos imprescindibles, preguntas falladas)
    const isRestrictiveMode = focusEssentialArticles || onlyFailedQuestions
    const needsAdaptiveCatalog = !isRestrictiveMode && (focusWeakAreas || getParam(searchParams, 'adaptive') === 'true' || adaptiveMode)

    // Debug de activación removido

    if (needsAdaptiveCatalog && user) {
      console.log('🧠 PREPARANDO CATÁLOGO ADAPTATIVO para TestLayout')

      // Obtener historial del usuario para clasificar preguntas
      // ✅ OPTIMIZACIÓN: Query en dos pasos para evitar timeout
      const { data: userTests } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', user.id)

      const testIds = userTests?.map(t => t.id) || []

      const { data: userAnswers, error: answersError } = await batchedTestQuestionsQuery(
        testIds,
        'question_id, created_at, test_id'
      )

      console.log(`📊 Usuario tiene ${userAnswers?.length || 0} respuestas en total`)

      // Clasificar TODAS las preguntas disponibles por historial y dificultad
      const answeredQuestionIds = new Set()
      const questionLastAnswered = new Map()

      if (!answersError && userAnswers && userAnswers.length > 0) {
        userAnswers.forEach(answer => {
          answeredQuestionIds.add(answer.question_id)

          // 🕐 Guardar fecha de última respuesta para spaced repetition
          const answerDate = new Date(answer.created_at)
          if (!questionLastAnswered.has(answer.question_id) ||
              answerDate > questionLastAnswered.get(answer.question_id)) {
            questionLastAnswered.set(answer.question_id, answerDate)
          }
        })
      }

      // Separar nunca vistas vs ya respondidas
      const neverSeenQuestions = []
      const answeredQuestions = []

      questionsToProcess.forEach(question => {
        if (answeredQuestionIds.has(question.id)) {
          // Agregar fecha de última respuesta para ordenamiento
          question._lastAnswered = questionLastAnswered.get(question.id)
          answeredQuestions.push(question)
        } else {
          neverSeenQuestions.push(question)
        }
      })

      // 🕐 Ordenar preguntas respondidas por antigüedad (más antiguas primero = spaced repetition)
      answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)

      console.log(`📊 Spaced repetition activado: ${answeredQuestions.length} preguntas ordenadas por antigüedad`)

      // Clasificar por dificultad (prioriza global_difficulty_category, fallback a difficulty)
      const catalogByDifficulty = {
        neverSeen: {
          easy: neverSeenQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'easy'),
          medium: neverSeenQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'medium'),
          hard: neverSeenQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'hard'),
          extreme: neverSeenQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'extreme')
        },
        answered: {
          easy: answeredQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'easy'),
          medium: answeredQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'medium'),
          hard: answeredQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'hard'),
          extreme: answeredQuestions.filter(q => (q.global_difficulty_category || q.difficulty) === 'extreme')
        }
      }

      console.log('🧠 CATÁLOGO ADAPTATIVO GENERADO (usando global_difficulty_category):')
      console.log(`   📊 Nunca vistas: easy=${catalogByDifficulty.neverSeen.easy.length}, medium=${catalogByDifficulty.neverSeen.medium.length}, hard=${catalogByDifficulty.neverSeen.hard.length}, extreme=${catalogByDifficulty.neverSeen.extreme.length}`)
      console.log(`   📊 Ya respondidas: easy=${catalogByDifficulty.answered.easy.length}, medium=${catalogByDifficulty.answered.medium.length}, hard=${catalogByDifficulty.answered.hard.length}, extreme=${catalogByDifficulty.answered.extreme.length}`)

      // 🔥 CRÍTICO: Transformar TODAS las preguntas del catálogo (question_text → question)
      const transformedCatalog = {
        neverSeen: {
          easy: transformQuestions(catalogByDifficulty.neverSeen.easy),
          medium: transformQuestions(catalogByDifficulty.neverSeen.medium),
          hard: transformQuestions(catalogByDifficulty.neverSeen.hard),
          extreme: transformQuestions(catalogByDifficulty.neverSeen.extreme)
        },
        answered: {
          easy: transformQuestions(catalogByDifficulty.answered.easy),
          medium: transformQuestions(catalogByDifficulty.answered.medium),
          hard: transformQuestions(catalogByDifficulty.answered.hard),
          extreme: transformQuestions(catalogByDifficulty.answered.extreme)
        }
      }

      // 🎯 SELECCIÓN INTELIGENTE DE PREGUNTAS INICIALES con 4 niveles de fallback
      let initialQuestions = []

      // Prioridad 1: Medium nunca vistas (óptimo)
      if (transformedCatalog.neverSeen.medium.length >= numQuestions) {
        initialQuestions = shuffleArray(transformedCatalog.neverSeen.medium).slice(0, numQuestions)
      }
      // Prioridad 2: Mezclar medium + easy nunca vistas
      else if (transformedCatalog.neverSeen.medium.length + transformedCatalog.neverSeen.easy.length >= numQuestions) {
        initialQuestions = shuffleArray([...transformedCatalog.neverSeen.medium, ...transformedCatalog.neverSeen.easy]).slice(0, numQuestions)
      }
      // Prioridad 3: Usar todas las nunca vistas + completar con hard
      else {
        const allNeverSeen = [
          ...transformedCatalog.neverSeen.medium,
          ...transformedCatalog.neverSeen.easy,
          ...transformedCatalog.neverSeen.hard
        ]

        if (allNeverSeen.length >= numQuestions) {
          initialQuestions = shuffleArray(allNeverSeen).slice(0, numQuestions)
        } else {
          // Prioridad 4: No hay suficientes nunca vistas, usar ya respondidas (ordenadas por antigüedad)
          const needed = numQuestions - allNeverSeen.length
          const fromAnswered = [
            ...transformedCatalog.answered.medium,
            ...transformedCatalog.answered.easy,
            ...transformedCatalog.answered.hard
          ].slice(0, needed)

          // 🎲 Mezclar todo para que el orden sea aleatorio cada vez
          initialQuestions = shuffleArray([...allNeverSeen, ...fromAnswered])
          console.log(`⚠️ MODO ADAPTATIVO: Solo ${allNeverSeen.length} nunca vistas, completando con ${fromAnswered.length} ya respondidas (mezcladas aleatoriamente)`)
        }
      }

      // Retornar estructura adaptativa completa
      const adaptiveResult = {
        isAdaptive: true,
        activeQuestions: initialQuestions,
        questionPool: initialQuestions, // Pool inicial = preguntas activas
        adaptiveCatalog: transformedCatalog
      }

      console.log(`✅ Resultado adaptativo: ${initialQuestions.length} preguntas iniciales + catálogo completo`)
      return adaptiveResult
    }
    
    // En modo NO adaptativo, devolver solo las preguntas activas
    return transformQuestions(finalSessionQuestions)
    
  } catch (error) {
    console.warn(`⚠️ Error en fetchQuestionsByTopicScope tema ${tema}:`, error?.message || 'Error desconocido')
    throw error
  }
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Contar preguntas por tema multi-ley
// =================================================================
export async function countQuestionsByTopicScope(tema) {
  try {
    // 1. Obtener mapeo del tema
    const { data: mappings } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', tema)
      .eq('topics.position_type', 'auxiliar_administrativo')
    
    if (!mappings?.length) {
      return 0
    }
    
    // 2. ENFOQUE ALTERNATIVO: Contar con múltiples consultas separadas
    let totalCount = 0
    
    for (const mapping of mappings) {
      const { count, error } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)
      
      if (!error && count) {
        totalCount += count
        console.log(`📊 ${mapping.laws.short_name}: ${count} preguntas`)
      }
    }
    
    console.log(`📊 Tema ${tema} tiene ${totalCount} preguntas disponibles (total)`)
    return totalCount
    
  } catch (error) {
    console.error('Error en countQuestionsByTopicScope:', error)
    return 0
  }
}

// =================================================================
// 🎯 FETCHER PRINCIPAL: TEST DE ARTÍCULOS DIRIGIDO POR LEY ESPECÍFICA - CORREGIDO
// =================================================================
export async function fetchArticulosDirigido(lawName, searchParams, config) {
  console.log('🎯 INICIO fetchArticulosDirigido:', { lawName, timestamp: new Date().toISOString() })
  
  try {
    // ✅ MANEJAR searchParams como objeto plano o URLSearchParams
    const getParam = (key, defaultValue = null) => {
      if (!searchParams) return defaultValue
      
      // Si es URLSearchParams (desde hook)
      if (typeof searchParams.get === 'function') {
        return searchParams.get(key) || defaultValue
      }
      
      // Si es objeto plano (desde server component)
      return searchParams[key] || defaultValue
    }
    
    const articles = getParam('articles')
    const mode = getParam('mode', 'intensive')
    const requestedCount = parseInt(getParam('n', '10'))
    
    console.log('📋 Parámetros extraídos:', { 
      lawName, 
      articles, 
      mode, 
      requestedCount,
      searchParamsType: typeof searchParams?.get === 'function' ? 'URLSearchParams' : 'object'
    })

    // 🔄 ESTRATEGIA 1: Test dirigido por artículos específicos
    if (articles && articles.trim()) {
      console.log('🎯 Intentando test dirigido por artículos específicos...')
      
      const articleNumbers = articles.split(',').map(a => a.trim()).filter(Boolean)
      console.log('🔢 Tipos de articleNumbers:', articleNumbers.map(a => typeof a + ':' + a))
      
      // 🎯 SISTEMA UNIVERSAL: Intentar múltiples estrategias de mapeo
      let lawShortName = mapLawSlugToShortName(lawName)
      console.log('🔍 PASO 1 - Mapeo inicial:', lawName, '→', lawShortName)
      
      // 🚀 ESTRATEGIA UNIVERSAL: Probar múltiples variantes hasta encontrar preguntas
      const possibleNames = [
        lawShortName,  // Mapeo normal
        lawName,       // Slug original
        lawName.toUpperCase(), // MAYÚSCULAS
        lawName.replace(/-/g, ' '), // Reemplazar guiones por espacios
        lawName.replace(/^ley-/, 'Ley ').replace(/-(\d+)-(\d+)$/, ' $1/$2'), // ley-39-2015 → Ley 39/2015
        lawName.replace(/^constitucion-espanola$/, 'CE'), // Caso específico CE
        lawName.replace(/^ce$/, 'CE'), // ce → CE
      ].filter(Boolean).filter((name, index, arr) => arr.indexOf(name) === index) // Remover duplicados
      
      console.log('🔍 PASO 2 - Variantes a probar:', possibleNames)
      
      console.log('📚 Buscando artículos:')
      console.log('   articleNumbers:', articleNumbers)
      
      // 🚀 SISTEMA UNIVERSAL: Probar cada variante hasta encontrar resultados
      let specificQuestions = null
      let specificError = null
      let successfulLawName = null
      
      for (const testLawName of possibleNames) {
        console.log(`🔍 PROBANDO variante: "${testLawName}"`)
        
        try {
          const { data: questions, error } = await supabase
            .from('questions')
            .select(`
              id, question_text, option_a, option_b, option_c, option_d,
              correct_option, explanation, difficulty, is_official_exam,
              primary_article_id, exam_source, exam_date, exam_entity,
              articles!inner(
                id, article_number, title, content,
                laws!inner(short_name, name)
              )
            `)
            .eq('articles.laws.short_name', testLawName)
            .in('articles.article_number', articleNumbers)
            .eq('is_active', true)
            .limit(requestedCount * 2)
          
          if (!error && questions && questions.length > 0) {
            console.log(`✅ ÉXITO con variante: "${testLawName}" - ${questions.length} preguntas encontradas`)
            specificQuestions = questions
            specificError = error
            successfulLawName = testLawName
            break
          } else {
            console.log(`❌ Sin resultados para: "${testLawName}" (${questions?.length || 0} preguntas)`)
          }
        } catch (err) {
          console.log(`❌ Error probando "${testLawName}":`, err.message)
        }
      }
      
      try {
        
        console.log('🔍 Resultado de consulta específica:', {
          error: specificError,
          questionsFound: specificQuestions?.length || 0,
          firstQuestion: specificQuestions?.[0]?.question_text?.substring(0, 50) + '...' || 'N/A',
          queryParams: { lawShortName, articleNumbers },
          actualError: specificError
        })
        
        if (specificError) {
          console.error('❌ Error en consulta específica:', specificError)
        }
        
        if (!specificError && specificQuestions && specificQuestions.length > 0) {
          // 🧪 Log detallado de qué artículos encontró
          const foundArticles = [...new Set(specificQuestions.map(q => q.articles.article_number))].sort((a, b) => a - b)
          console.log('📋 Artículos encontrados en preguntas:', foundArticles)
          console.log('🎯 Preguntas por artículo:', 
            foundArticles.map(art => `Art.${art}: ${specificQuestions.filter(q => q.articles.article_number === art).length} preguntas`).join(', ')
          )
          
          const shuffled = shuffleArray(specificQuestions).slice(0, requestedCount)
          console.log(`✅ ${shuffled.length} preguntas específicas encontradas para test dirigido`)
          return transformQuestions(shuffled)
        } else {
          console.log('❌ No se encontraron preguntas específicas, activando fallback...')
          console.log('   Razón: specificError =', !!specificError, ', questionsLength =', specificQuestions?.length || 0)
        }
      } catch (specificErr) {
        console.log('⚠️ Error en búsqueda específica:', specificErr.message)
      }
    }

    // 🔄 ESTRATEGIA 2: Test por ley completa
    console.log('📚 Fallback: Cargando preguntas por ley completa...')
    
    // 🚀 SISTEMA UNIVERSAL FALLBACK: Probar múltiples variantes
    let lawShortName = mapLawSlugToShortName(lawName)
    const possibleNames = [
      lawShortName,
      lawName,
      lawName.toUpperCase(),
      lawName.replace(/-/g, ' '),
      lawName.replace(/^ley-/, 'Ley ').replace(/-(\d+)-(\d+)$/, ' $1/$2'),
      lawName.replace(/^constitucion-espanola$/, 'CE'),
      lawName.replace(/^ce$/, 'CE'),
    ].filter(Boolean).filter((name, index, arr) => arr.indexOf(name) === index)
    
    console.log('🔍 FALLBACK - Variantes a probar:', possibleNames)
    
    let lawQuestions = null
    let lawError = null
    let successfulFallbackLaw = null
    
    for (const testLawName of possibleNames) {
      console.log(`🔍 FALLBACK - Probando: "${testLawName}"`)
      
      try {
        const { data: questions, error } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('articles.laws.short_name', testLawName)
          .eq('is_active', true)
          .limit(requestedCount * 2)
        
        if (!error && questions && questions.length > 0) {
          console.log(`✅ FALLBACK ÉXITO con: "${testLawName}" - ${questions.length} preguntas`)
          lawQuestions = questions
          lawError = error
          successfulFallbackLaw = testLawName
          break
        } else {
          console.log(`❌ FALLBACK sin resultados para: "${testLawName}"`)
        }
      } catch (err) {
        console.log(`❌ FALLBACK error con "${testLawName}":`, err.message)
      }
    }
    
    try {
      if (!lawError && lawQuestions && lawQuestions.length > 0) {
        const shuffled = shuffleArray(lawQuestions).slice(0, requestedCount)
        console.log(`✅ ${shuffled.length} preguntas por ley encontradas con: ${successfulFallbackLaw}`)
        return transformQuestions(shuffled)
      }
    } catch (lawErr) {
      console.log('⚠️ Error en búsqueda por ley:', lawErr.message)
    }

    // 🔄 ESTRATEGIA 3: Fallback final - test rápido
    console.log('🎲 Fallback final: Test rápido general...')
    
    const { data: randomQuestions, error: randomError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles(
          id, article_number, title, content,
          laws(short_name, name)
        )
      `)
      .eq('is_active', true)
      .limit(requestedCount)
    
    if (randomError) throw randomError
    
    if (randomQuestions && randomQuestions.length > 0) {
      console.log(`✅ ${randomQuestions.length} preguntas aleatorias como último recurso`)
      return transformQuestions(shuffleArray(randomQuestions))
    }

    throw new Error('No se encontraron preguntas')

  } catch (error) {
    console.error('❌ Error en fetchArticulosDirigido:', error)
    throw new Error(`Error cargando test dirigido: ${error.message}`)
  }
}

// 🔧 FUNCIÓN AUXILIAR: Mapear slug de URL a short_name de BD
function mapLawSlugToShortName(lawSlug) {
  const mapping = {
    'ley-19-2013': 'Ley 19/2013',
    'ley-40-2015': 'LRJSP',
    'LRJSP': 'LRJSP',
    'ley-39-2015': 'LPAC',
    'LPAC': 'LPAC',
    'ley-50-1997': 'Ley 50/1997',
    'ley-7-1985': 'Ley 7/1985',
    'ley-2-2014': 'Ley 2/2014',
    'ley-25-2014': 'Ley 25/2014',
    'ley-38-2015': 'Ley 38/2015',
    'ce': 'CE',
    'CE': 'CE', // Mapeo directo para mayúsculas
    'constitucion-espanola': 'CE', // Sin tildes
    'constitución-española': 'CE', // Con tildes
    'tue': 'TUE',
    'tfue': 'TFUE'
  }
  
  // Buscar en mapping
  if (mapping[lawSlug]) {
    return mapping[lawSlug]
  }
  
  // 🚀 FALLBACK INTELIGENTE: Generar automáticamente para leyes nuevas
  if (!mapping[lawSlug]) {
    console.warn(`⚠️ Ley no encontrada en mapeo: ${lawSlug}, generando automáticamente...`)
    
    // Patrón específico para leyes numeradas (ley-XX-YYYY)
    if (lawSlug.match(/^ley-(\d+)-(\d+)$/)) {
      const [, number, year] = lawSlug.match(/^ley-(\d+)-(\d+)$/)
      const generated = `Ley ${number}/${year}`
      console.log(`🔧 Generado automáticamente: ${lawSlug} → ${generated}`)
      return generated
    }
    
    // Patrón para constitución
    if (lawSlug.match(/constitucion/i)) {
      console.log(`🔧 Generado automáticamente: ${lawSlug} → CE`)
      return 'CE'
    }
    
    // Otros patrones automáticos
    const autoGenerated = lawSlug
      .replace(/-/g, ' ')  // guiones → espacios
      .replace(/^([a-z])/, (match, p1) => p1.toUpperCase()) // Primera letra mayúscula
    
    console.log(`🔧 Generado automáticamente: ${lawSlug} → ${autoGenerated}`)
    return autoGenerated
  }
  
  // Si no está en mapping, intentar extraer de formato "Ley X/YYYY"
  if (lawSlug.includes('ley-') && lawSlug.includes('-')) {
    const parts = lawSlug.split('-')
    if (parts.length >= 3) {
      const number = parts[1]
      const year = parts[2]
      return `Ley ${number}/${year}`
    }
  }
  
  // Fallback: devolver tal como viene
  console.warn('⚠️ No se pudo mapear la ley:', lawSlug)
  return lawSlug
}


// =================================================================
// 🚀 FETCHER: MANTENER RACHA - 
// Prioriza temas con mejor rendimiento (≥50% aciertos), Distribuye preguntas entre 3 temas máximo para variedad, Solo preguntas fáciles para mantener motivación, mezcla aleatoria,
// =================================================================

// =================================================================
// 🚀 FETCHER: MANTENER RACHA - VERSIÓN UNIVERSAL INTELIGENTE
// =================================================================
export async function fetchMantenerRacha(tema, searchParams, config) {
  try {
    console.log('🚀 Cargando test inteligente para mantener racha')

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const n = parseInt(getParam(searchParams, 'n', '5'))
    const streakDays = parseInt(getParam(searchParams, 'streak_days', '0'))
    
    // 🧠 PASO 1: Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('⚠️ Usuario no autenticado, usando fallback universal')
      return await fetchMantenerRachaFallback(n, null)
    }

    // 🎯 PASO 2: Detectar temas que el usuario ha estudiado
    const { data: temasEstudiados, error: temasError } = await supabase
      .from('tests')
      .select('tema_number, COUNT(*) as tests_count, AVG(score) as avg_score')
      .eq('user_id', user.id)
      .not('tema_number', 'is', null)
      .eq('is_completed', true)
      .group('tema_number')
      .having('COUNT(*)', 'gte', 1) // Al menos 1 test completado
      .order('tests_count', { ascending: false })

    if (temasError) {
      console.error('❌ Error obteniendo temas estudiados:', temasError)
      return await fetchMantenerRachaFallback(n, user)
    }

    if (!temasEstudiados || temasEstudiados.length === 0) {
      console.log('📚 Usuario sin temas estudiados, usando fallback universal')
      return await fetchMantenerRachaFallback(n, user)
    }

    console.log('🎯 Temas estudiados detectados:', temasEstudiados.map(t => `Tema ${t.tema_number} (${t.tests_count} tests, ${Math.round(t.avg_score)}%)`))

    // 🔥 PASO 3: Estrategia inteligente de selección
    // Priorizar temas con mejor rendimiento para mantener motivación
    const temasParaRacha = temasEstudiados
      .filter(t => t.avg_score >= 50) // Solo temas con rendimiento decente
      .slice(0, 3) // Máximo 3 temas para mantener enfoque
      .map(t => t.tema_number)

    if (temasParaRacha.length === 0) {
      // Si no hay temas con buen rendimiento, usar todos los estudiados
      temasParaRacha.push(...temasEstudiados.map(t => t.tema_number))
    }

    console.log('🎯 Temas seleccionados para racha:', temasParaRacha)

    // 🚀 PASO 4: Obtener preguntas de temas estudiados con distribución inteligente
    const questionsPerTema = Math.ceil(n * 1.5 / temasParaRacha.length) // 1.5x para mezclar mejor
    const allQuestions = []

    for (const temaNummer of temasParaRacha) {
      console.log(`🔍 Obteniendo preguntas del tema ${temaNummer}...`)
      
      // Intentar con función específica para el tema
      const { data: temaQuestions, error: temaError } = await supabase.rpc('get_questions_by_tema_and_difficulty', {
        tema_number: temaNummer,
        total_questions: questionsPerTema,
        difficulty_filter: 'easy' // Preguntas fáciles para mantener motivación
      })

      if (!temaError && temaQuestions && temaQuestions.length > 0) {
        console.log(`✅ Tema ${temaNummer}: ${temaQuestions.length} preguntas obtenidas`)
        allQuestions.push(...temaQuestions)
      } else {
        console.log(`⚠️ Tema ${temaNummer}: Sin preguntas disponibles`)
      }
    }

    // 🎲 PASO 5: Mezclar y seleccionar cantidad final
    if (allQuestions.length === 0) {
      console.log('❌ No se obtuvieron preguntas de temas estudiados, usando fallback universal')
      return await fetchMantenerRachaFallback(n, user)
    }

    // Mezclar todas las preguntas obtenidas
    const shuffledQuestions = shuffleArray(allQuestions)
    const finalQuestions = shuffledQuestions.slice(0, n)

    console.log(`✅ Mantener racha INTELIGENTE: ${finalQuestions.length} preguntas de ${temasParaRacha.length} temas estudiados`)
    console.log(`📊 Distribución final: ${finalQuestions.map(q => q.articles?.laws?.short_name || 'N/A').reduce((acc, law) => {
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})}`)

    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fetchMantenerRacha inteligente:', error)
    return await fetchMantenerRachaFallback(n, user || null)
  }
}

// 🔄 FUNCIÓN FALLBACK UNIVERSAL INTELIGENTE
async function fetchMantenerRachaFallback(n, user) {
  try {
    console.log('🔄 Ejecutando fallback universal inteligente')
    
    // 🧠 PASO 1: Detectar leyes que el usuario ha estudiado (si tiene historial)
    let studiedLaws = null
    
    if (user) {
      console.log('👤 Usuario detectado, analizando historial de leyes estudiadas...')
      
      // Obtener leyes de preguntas que ha respondido
      // ✅ OPTIMIZACIÓN: Query en dos pasos para evitar timeout
      const { data: userTests } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', user.id)

      const testIds = userTests?.map(t => t.id) || []

      const { data: userQuestionHistory, error: historyError } = await batchedTestQuestionsQuery(
        testIds,
        `articles!inner(laws!inner(short_name)), test_id`,
        { limit: 10000 }
      )

      if (!historyError && userQuestionHistory?.length > 0) {
        // Extraer leyes únicas del historial
        const lawsFromHistory = [...new Set(
          userQuestionHistory
            .map(item => item.articles?.laws?.short_name)
            .filter(Boolean)
        )]
        
        if (lawsFromHistory.length > 0) {
          studiedLaws = lawsFromHistory
          console.log('🎯 Leyes detectadas del historial del usuario:', studiedLaws)
        }
      }
      
      // FALLBACK: Si no hay historial de preguntas, intentar detectar por oposición
      if (!studiedLaws) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('target_oposicion')
          .eq('id', user.id)
          .single()
        
        if (userProfile?.target_oposicion) {
          // Mapear oposición a leyes principales
          const oposicionLaws = {
            'auxiliar_administrativo_estado': ['Ley 19/2013', 'LRJSP', 'CE'],
            'auxiliar_administrativo': ['Ley 19/2013', 'LRJSP', 'CE'],
            'tecnico_hacienda': ['LRJSP', 'CE', 'Ley 7/1985'],
            // Agregar más mapeos según oposiciones disponibles
          }
          
          studiedLaws = oposicionLaws[userProfile.target_oposicion] || null
          if (studiedLaws) {
            console.log(`🎯 Leyes detectadas por oposición (${userProfile.target_oposicion}):`, studiedLaws)
          }
        }
      }
    }
    
    // 🚀 PASO 2: Construir query con filtro inteligente
    let query = supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, global_difficulty_category, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .eq('is_active', true)
      .or('global_difficulty_category.in.(easy,medium),and(global_difficulty_category.is.null,difficulty.in.(easy,medium))') // Mantener motivación con preguntas no muy difíciles

    // 🎯 PASO 3: Aplicar filtro de leyes solo si las detectamos
    if (studiedLaws && studiedLaws.length > 0) {
      query = query.in('articles.laws.short_name', studiedLaws)
      console.log('🔍 Aplicando filtro por leyes estudiadas:', studiedLaws)
    } else {
      console.log('🌍 Sin filtro de leyes - usando todas las leyes disponibles (comportamiento neutral)')
    }
    
    // 🎲 PASO 4: Obtener y mezclar preguntas
    const { data: fallbackData, error: fallbackError } = await query
      .limit(n * 3) // Obtener más para mezclar mejor

    if (fallbackError) throw fallbackError

    if (!fallbackData || fallbackData.length === 0) {
      // Si el filtro no devuelve resultados, intentar sin filtro
      if (studiedLaws) {
        console.log('⚠️ Sin resultados con filtro de leyes, reintentando sin filtro...')
        
        const { data: universalData, error: universalError } = await supabase
          .from('questions')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_option, explanation, difficulty, global_difficulty_category, is_official_exam,
            primary_article_id, exam_source, exam_date, exam_entity,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('is_active', true)
          .or('global_difficulty_category.in.(easy,medium),and(global_difficulty_category.is.null,difficulty.in.(easy,medium))')
          .limit(n * 3)
        
        if (universalError) throw universalError
        
        if (universalData && universalData.length > 0) {
          const shuffledQuestions = shuffleArray(universalData)
          const finalQuestions = shuffledQuestions.slice(0, n)
          console.log(`✅ Fallback universal: ${finalQuestions.length} preguntas de todas las leyes`)
          return transformQuestions(finalQuestions)
        }
      }
      
      throw new Error('No hay preguntas disponibles para mantener racha')
    }

    // 🎲 Mezclar y seleccionar
    const shuffledQuestions = shuffleArray(fallbackData)
    const finalQuestions = shuffledQuestions.slice(0, n)

    const lawDistribution = finalQuestions.reduce((acc, q) => {
      const law = q.articles?.laws?.short_name || 'N/A'
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {})

    console.log(`✅ Fallback inteligente: ${finalQuestions.length} preguntas`)
    console.log(`📊 Distribución por ley:`, lawDistribution)
    
    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fallback universal de mantener racha:', error)
    throw error
  }
}



// =================================================================
// 🔍 FETCHER: EXPLORAR CONTENIDO (Nuevo contenido añadido)
// =================================================================
export async function fetchExplorarContenido(tema, searchParams, config) {
  try {
    console.log('🔍 Cargando contenido nuevo para explorar')

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const n = parseInt(getParam(searchParams, 'n', '8'))
    const weeks = parseInt(getParam(searchParams, 'weeks', '1'))
    const weekAgo = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .eq('is_active', true)
      .gte('created_at', weekAgo)
      .order('created_at', { ascending: false })
      .limit(n)
      
    if (error) throw error
    
    if (!data || data.length === 0) {
      throw new Error(`No hay contenido nuevo de las últimas ${weeks} semanas`)
    }
    
    console.log(`✅ ${data.length} preguntas nuevas cargadas`)
    return transformQuestions(data)
    
  } catch (error) {
    console.error('❌ Error en fetchExplorarContenido:', error)
    throw error
  }
}

// =================================================================
// 🔧 FUNCIONES AUXILIARES
// =================================================================

// Convertir porcentaje a dificultad
function getDifficultyFromPercentage(percentage) {
  if (percentage <= 25) return 'easy'
  if (percentage <= 50) return 'medium'
  if (percentage <= 75) return 'hard'
  return 'extreme'
}

// =================================================================
// 🎲 FETCHER: TEST ALEATORIO MULTI-TEMA - MIGRADO A API CENTRALIZADA
// =================================================================
export async function fetchAleatorioMultiTema(themes, searchParams, config) {
  try {
    console.log('🎲 fetchAleatorioMultiTema via API centralizada, temas:', themes)

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Leer parámetros de configuración (usando helper para URLSearchParams u objeto)
    const positionType = config?.positionType || 'auxiliar_administrativo'
    const numQuestions = parseInt(getParam(searchParams, 'n', '20'))
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const excludeDays = parseInt(getParam(searchParams, 'exclude_days', '15'))
    const onlyOfficialQuestions = getParam(searchParams, 'official_only') === 'true'
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'

    console.log('🎛️ Configuración multi-tema:', { numQuestions, excludeRecent, excludeDays, onlyOfficialQuestions, focusEssentialArticles })

    // Llamar a la API centralizada
    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: 0, // Indica que usamos multipleTopics
        positionType,
        multipleTopics: themes,
        numQuestions,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        onlyOfficialQuestions,
        difficultyMode: 'random',
        excludeRecentDays: excludeRecent ? excludeDays : 0,
        userId: user?.id || undefined,
        focusEssentialArticles,
        prioritizeNeverSeen: true, // Multi-tema siempre prioriza nunca vistas
        proportionalByTopic: themes.length > 1, // Distribución proporcional si hay múltiples temas
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error obteniendo preguntas multi-tema')
    }

    console.log(`✅ Test aleatorio multi-tema generado: ${data.questions?.length || 0} preguntas de ${themes.length} temas`)

    return data.questions || []

  } catch (error) {
    console.error('❌ Error en fetchAleatorioMultiTema:', error)
    throw error
  }
}

// =================================================================
// 📋 FETCHEER PARA CONTENT_SCOPE - NUEVO
// =================================================================
export async function fetchContentScopeQuestions(config = {}, contentScopeConfig) {
  try {
    console.log('📋 Iniciando fetchContentScopeQuestions')
    console.log('📝 Config:', config)
    console.log('📋 Content Scope Config:', contentScopeConfig)
    
    if (!contentScopeConfig || !contentScopeConfig.articleIds || contentScopeConfig.articleIds.length === 0) {
      throw new Error('No se encontraron artículos en el content scope')
    }
    
    const defaultQuestions = config.numQuestions || 20
    
    console.log(`🔍 Buscando preguntas para ${contentScopeConfig.articleIds.length} artículos específicos`)
    
    // Buscar preguntas por primary_article_id específicos
    const { data: questions, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, is_official_exam,
        primary_article_id, exam_source, exam_date, exam_entity,
        articles!inner(
          id, article_number, title, content,
          laws!inner(short_name, name)
        )
      `)
      .in('primary_article_id', contentScopeConfig.articleIds)
      .eq('is_active', true)
      .order('id')
      .limit(defaultQuestions * 3) // Obtener más preguntas para seleccionar las mejores
    
    if (error) {
      console.error('❌ Error en query content_scope:', error)
      throw error
    }
    
    if (!questions || questions.length === 0) {
      throw new Error(`No se encontraron preguntas para los artículos del content_scope`)
    }
    
    console.log(`✅ Content scope: Encontradas ${questions.length} preguntas`)
    
    // Mezclar y limitar al número solicitado
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5)
    const selectedQuestions = shuffledQuestions.slice(0, defaultQuestions)
    
    console.log(`📋 Content scope final: ${selectedQuestions.length} preguntas para "${contentScopeConfig.sectionInfo.name}"`)
    
    return transformQuestions(selectedQuestions)

  } catch (error) {
    console.error('❌ Error en fetchContentScopeQuestions:', error)
    throw error
  }
}

// =================================================================
// 🚀 NUEVO: FETCHER VIA API (Drizzle + Zod)
// Reemplaza la lógica duplicada de queries Supabase
// =================================================================
export async function fetchQuestionsViaAPI(tema, searchParams, config) {
  try {
    console.log(`🚀 fetchQuestionsViaAPI para tema ${tema}`)

    // Extraer configuración de searchParams y config
    const numQuestions = parseInt(searchParams?.get?.('n')) || config?.numQuestions || 25
    const onlyOfficialQuestions = searchParams?.get?.('only_official') === 'true' || config?.onlyOfficialQuestions || false
    const difficultyMode = searchParams?.get?.('difficulty_mode') || config?.difficultyMode || 'random'
    const positionType = config?.positionType || 'auxiliar_administrativo'

    // Filtros de leyes, artículos y secciones
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    const selectedSectionFilters = config?.selectedSectionFilters || []

    // Convertir selectedArticlesByLaw a formato esperado por la API
    // La API espera: { "CE": [1, 2, 3] } con números
    const articlesForAPI = {}
    for (const [lawName, articles] of Object.entries(selectedArticlesByLaw)) {
      if (articles && (Array.isArray(articles) ? articles.length > 0 : articles.size > 0)) {
        // Convertir Set a Array si es necesario y asegurar que son números
        const articlesArray = Array.isArray(articles) ? articles : Array.from(articles)
        articlesForAPI[lawName] = articlesArray.map(a => parseInt(a, 10)).filter(n => !isNaN(n))
      }
    }

    console.log('🚀 API Request:', {
      topicNumber: tema,
      positionType,
      numQuestions,
      selectedLaws: selectedLaws.length,
      selectedArticlesByLaw: Object.keys(articlesForAPI).length,
      selectedSectionFilters: selectedSectionFilters.length
    })

    // Llamar a la API
    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: tema,
        positionType,
        numQuestions,
        selectedLaws,
        selectedArticlesByLaw: articlesForAPI,
        selectedSectionFilters,
        onlyOfficialQuestions,
        difficultyMode
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error en API /questions/filtered:', data.error)
      throw new Error(data.error || 'Error obteniendo preguntas')
    }

    console.log(`✅ API devolvió ${data.questions?.length || 0} preguntas (${data.totalAvailable} disponibles)`)

    // La API ya devuelve las preguntas en el formato correcto (transformadas)
    return data.questions || []

  } catch (error) {
    console.error('❌ Error en fetchQuestionsViaAPI:', error)
    throw error
  }
}

// =================================================================
// 🔢 NUEVO: CONTAR PREGUNTAS VIA API
// Para UI del configurador
// =================================================================
export async function countQuestionsViaAPI(tema, config) {
  try {
    const positionType = config?.positionType || 'auxiliar_administrativo'
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    const selectedSectionFilters = config?.selectedSectionFilters || []
    const onlyOfficialQuestions = config?.onlyOfficialQuestions || false

    // Construir URL con parámetros
    const params = new URLSearchParams({
      action: 'count',
      topicNumber: String(tema),
      positionType,
      onlyOfficialQuestions: String(onlyOfficialQuestions)
    })

    if (selectedLaws.length > 0) {
      params.set('selectedLaws', JSON.stringify(selectedLaws))
    }
    if (Object.keys(selectedArticlesByLaw).length > 0) {
      params.set('selectedArticlesByLaw', JSON.stringify(selectedArticlesByLaw))
    }
    if (selectedSectionFilters.length > 0) {
      params.set('selectedSectionFilters', JSON.stringify(selectedSectionFilters))
    }

    const response = await fetch(`/api/questions/filtered?${params.toString()}`)
    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error contando preguntas:', data.error)
      return { count: 0, byLaw: {} }
    }

    return {
      count: data.count || 0,
      byLaw: data.byLaw || {}
    }

  } catch (error) {
    console.error('❌ Error en countQuestionsViaAPI:', error)
    return { count: 0, byLaw: {} }
  }
}