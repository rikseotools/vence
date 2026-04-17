// lib/testFetchers.ts - FETCHERS MODULARES PARA TODOS LOS TIPOS DE TEST - CON SOPORTE MULTI-LEY
import { getSupabaseClient } from './supabase'
import { mapSlugToShortName as mapLawSlugToShortName } from './lawSlugSync'
import { getValidExamPositions, applyExamPositionFilter } from './config/exam-positions'
import { isDisposicionArticle } from './boe-extractor'

type SearchParamsLike = URLSearchParams | Record<string, string | undefined> | null | undefined

interface FetchConfig {
  testType?: string
  numQuestions?: number
  positionType?: string
  defaultConfig?: { numQuestions?: number }
  focusWeakAreas?: boolean
  onlyOfficialQuestions?: boolean
  difficultyMode?: string
  failedQuestionIds?: string[]
  selectedLaws?: string[]
  selectedArticlesByLaw?: Record<string, (string | number)[]>
  selectedSectionFilters?: SectionFilterItem[]
  [key: string]: unknown
}

interface SectionFilterItem {
  title: string
  articleRange?: { start: number; end: number }
  [key: string]: unknown
}

interface BatchedQueryOptions {
  gte?: { column: string; value: string }
  order?: { column: string; ascending: boolean }
  limit?: number
}

interface CacheEntry {
  usedQuestionIds: Set<string>
  timestamp: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseQuestionAny = any

interface TransformedQuestion {
  id: string
  question: string
  options: string[]
  explanation: string | null
  primary_article_id: string | null
  tema?: number | string
  article: {
    id: string | undefined
    number: string
    title: string
    full_text: string
    law_name: string
    law_short_name: string
    display_number: string
  }
  metadata: {
    id: string
    difficulty: string
    question_type: string
    tags: string[]
    is_active: boolean
    created_at: string
    updated_at: string | null
    is_official_exam: boolean | null
    exam_source: string | null
    exam_date: string | null
    exam_entity: string | null
    official_difficulty_level: string | null
  }
}

interface AdaptiveResult {
  isAdaptive: true
  activeQuestions: TransformedQuestion[]
  questionPool: TransformedQuestion[]
  poolSize?: number
  requestedCount?: number
  adaptiveCatalog?: AdaptiveCatalog
}

interface AdaptiveCatalog {
  neverSeen: DifficultyBuckets
  answered: DifficultyBuckets
}

interface DifficultyBuckets {
  easy: TransformedQuestion[]
  medium: TransformedQuestion[]
  hard: TransformedQuestion[]
  extreme: TransformedQuestion[]
}

interface TopicMapping {
  article_numbers: string[]
  laws: {
    id?: string
    name: string
    short_name: string
    slug?: string
  }
  topics?: {
    topic_number: number
    position_type: string
  }
}

interface ContentScopeConfig {
  articleIds: string[]
  sectionInfo: { name: string; [key: string]: unknown }
}

interface CountResult {
  count: number
  byLaw: Record<string, number>
}

interface QuestionHistoryItem {
  questionId: string
  lastAnsweredAt: string
}

const supabase = getSupabaseClient()

// =================================================================
// HELPER: SAFE PARAM GETTER (URLSearchParams o objeto plano)
// =================================================================
function getParam(searchParams: SearchParamsLike, key: string): string | null
function getParam(searchParams: SearchParamsLike, key: string, defaultValue: string): string
function getParam(searchParams: SearchParamsLike, key: string, defaultValue: string | null = null): string | null {
  if (!searchParams) return defaultValue

  // Si es URLSearchParams (desde hook useSearchParams)
  if (typeof (searchParams as URLSearchParams).get === 'function') {
    return (searchParams as URLSearchParams).get(key) || defaultValue
  }

  // Si es objeto plano (desde server component o props)
  return (searchParams as Record<string, string | undefined>)[key] || defaultValue
}

// CACHE GLOBAL DE SESIÓN para evitar duplicados entre llamadas
const sessionQuestionCache = new Map<string, CacheEntry>()

// Función para limpiar cache viejo (prevenimos memory leaks)
function cleanOldCacheEntries(): void {
  const now = Date.now()
  for (const [key, data] of sessionQuestionCache.entries()) {
    // Limpiar entradas de más de 30 minutos
    if (now - data.timestamp > 30 * 60 * 1000) {
      sessionQuestionCache.delete(key)
    }
  }
}

// FUNCIÓN PÚBLICA para limpiar cache de sesión específica
export function clearSessionQuestionCache(userId: string | null, tema: number | string): void {
  const sessionKey = userId ? `${userId}-${tema}-session` : `anon-${tema}-session`
  if (sessionQuestionCache.has(sessionKey)) {
    sessionQuestionCache.delete(sessionKey)
    console.log(`🧹 Cache de sesión limpiado: ${sessionKey}`)
  }
}

// Limpiar TODO el cache de sesión (útil para tests)
export function clearAllSessionQuestionCache(): void {
  sessionQuestionCache.clear()
}

// =================================================================
// HELPER: BATCHED QUERIES PARA EVITAR URLs MUY LARGAS
// =================================================================
// Supabase convierte .in() queries a GET con URL params - si hay muchos IDs, la URL excede límites
// Esta función divide las queries en lotes paralelos y combina resultados
const BATCH_SIZE = 50 // 50 UUIDs por lote para evitar límites de URL

async function batchedTestQuestionsQuery(testIds: string[], selectFields: string, options: BatchedQueryOptions = {}): Promise<{ data: SupabaseQuestionAny[] | null; error: SupabaseQuestionAny }> {
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
  let allData: SupabaseQuestionAny[] = []
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
    const orderCol = options.order.column
    const ascending = options.order.ascending
    allData.sort((a: SupabaseQuestionAny, b: SupabaseQuestionAny) => {
      const aVal = a[orderCol]
      const bVal = b[orderCol]
      if (ascending) {
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
export function transformQuestions(supabaseQuestions: SupabaseQuestionAny[] | null | undefined): TransformedQuestion[] {
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
      // Respuesta correcta incluida para validación client-side instantánea
      correct_option: q.correct_option,
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
function shuffleArray<T>(array: T[]): T[] {
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
async function fetchUserQuestionHistory(userId: string, onlyActiveQuestions = true): Promise<{ history: QuestionHistoryItem[]; error: string | null }> {
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
    console.warn('⚠️ Error en fetchUserQuestionHistory:', (error as Error).message)
    return { history: [], error: (error as Error).message }
  }
}

// =================================================================
// 🚀 HELPER: Obtener preguntas recientes para exclusión (API optimizada)
// =================================================================
async function fetchRecentQuestions(userId: string, days = 7): Promise<{ questionIds: string[]; error: string | null }> {
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
    console.warn('⚠️ Error en fetchRecentQuestions:', (error as Error).message)
    return { questionIds: [], error: (error as Error).message }
  }
}

// =================================================================
// 🎲 FETCHER: TEST ALEATORIO - USA API CENTRALIZADA
// Migrado de supabase.rpc('get_questions_dynamic') a /api/questions/filtered
// para cerrar vector de scraping vía Supabase directo con anon key.
// =================================================================
export async function fetchRandomQuestions(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[] | AdaptiveResult> {
  try {
    const numQuestions = parseInt(getParam(searchParams, 'n', '25'))
    const adaptiveMode = getParam(searchParams, 'adaptive') === 'true'
    const poolSize = adaptiveMode ? numQuestions * 2 : numQuestions
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    console.log('🎲 Cargando test aleatorio via API, tema:', tema, 'n:', poolSize, 'pos:', positionType)

    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: tema || 0,
        positionType,
        numQuestions: poolSize,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        difficultyMode: 'random',
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error || `HTTP ${response.status}`
      console.error(`❌ Error en fetchRandomQuestions (API): ${errorMsg}`, { status: response.status, tema, positionType })
      throw new Error(errorMsg)
    }

    const data = await response.json()

    if (!data.success) {
      const errorMsg = data.emptyReason || data.error || 'Error desconocido'
      console.error('❌ fetchRandomQuestions: API devolvió success=false:', errorMsg)
      throw new Error(errorMsg)
    }

    const questions: TransformedQuestion[] = data.questions || []

    if (questions.length === 0) {
      throw new Error(data.emptyReason || `No hay preguntas disponibles para el tema ${tema}`)
    }

    if (adaptiveMode) {
      console.log('🧠 Modo adaptativo:', questions.length, 'preguntas en pool,', numQuestions, 'activas')
      return {
        activeQuestions: questions.slice(0, numQuestions),
        questionPool: questions,
        poolSize: questions.length,
        requestedCount: numQuestions,
        isAdaptive: true
      }
    }

    console.log('✅ Test aleatorio cargado via API:', questions.length, 'preguntas')
    return questions

  } catch (error) {
    console.error('❌ Error en fetchRandomQuestions:', error)
    throw error
  }
}

// =================================================================
// ⚡ FETCHER: TEST RÁPIDO - USA API CENTRALIZADA
// =================================================================
export async function fetchQuickQuestions(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    // Calentar cache BD → lawMappingUtils (no-op si ya cargado)
    try { const { warmSlugCache } = await import('./api/laws/warmCache'); await warmSlugCache() } catch {}

    console.log('⚡ Cargando test rápido via API centralizada, tema:', tema)

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const numQuestions = parseInt(getParam(searchParams, 'n', String(config?.numQuestions || 10)))
    const lawShortNameDirect = getParam(searchParams, 'law_short_name')
    const lawParam = getParam(searchParams, 'law')
    const articlesParam = getParam(searchParams, 'articles')
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    // Preparar filtros para la API
    // Preferir law_short_name directo (desde notificaciones) sobre slug → short_name
    const lawShortName = lawShortNameDirect || (lawParam ? mapLawSlugToShortName(lawParam) : null)
    const selectedLaws = lawShortName ? [lawShortName] : []
    const selectedArticlesByLaw: Record<string, number[]> = {}

    if (articlesParam && lawShortName) {
      const articleNumbers = articlesParam.split(',').map(a => parseInt(a.trim())).filter(Boolean)
      if (articleNumbers.length > 0) {
        selectedArticlesByLaw[lawShortName] = articleNumbers
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
export async function fetchOfficialQuestions(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    console.log('🏛️ Cargando test oficial via API centralizada, tema:', tema)

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const numQuestions = parseInt(getParam(searchParams, 'n', String(config?.numQuestions || 20)))
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

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
// 🎛️ FETCHER: TEST PERSONALIZADO - USA API CENTRALIZADA
// Migrado de queries Supabase directas a /api/questions/filtered
// para cerrar vector de scraping. Mantiene session cache como post-filter.
// =================================================================
export async function fetchPersonalizedQuestions(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    // Auth check — personalizado requiere usuario
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    // Session cache — evita repetir preguntas en la misma sesión de browser
    cleanOldCacheEntries()
    const sessionKey = `${user.id}-${tema}-personalizado-session`
    if (!sessionQuestionCache.has(sessionKey)) {
      sessionQuestionCache.set(sessionKey, { usedQuestionIds: new Set(), timestamp: Date.now() })
    }
    const sessionUsedIds = sessionQuestionCache.get(sessionKey)!.usedQuestionIds

    // Leer parámetros
    const numQuestions = parseInt(getParam(searchParams, 'n', '25'))
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const recentDays = parseInt(getParam(searchParams, 'recent_days', '15'))
    const difficultyMode = getParam(searchParams, 'difficulty_mode', 'random')
    const onlyOfficialQuestions = getParam(searchParams, 'only_official') === 'true'
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    // Pedir más preguntas para compensar las que filtrará el session cache
    const requestSize = Math.min(numQuestions + sessionUsedIds.size, 500)

    console.log('🎛️ Cargando test personalizado via API, tema:', tema, 'n:', numQuestions,
      'request:', requestSize, 'pos:', positionType, 'cached:', sessionUsedIds.size)

    // Obtener token para que la API resuelva userId y active excludeRecent/prioritizeNeverSeen
    let authToken: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token ?? null
    } catch {
      console.warn('⚠️ No se pudo obtener token de sesión')
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: tema || 0,
        positionType,
        numQuestions: requestSize,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        onlyOfficialQuestions,
        difficultyMode,
        excludeRecentDays: excludeRecent ? recentDays : 0,
        prioritizeNeverSeen: true,
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error || `HTTP ${response.status}`
      console.error(`❌ Error en fetchPersonalizedQuestions (API): ${errorMsg}`, { status: response.status, tema, positionType })
      throw new Error(errorMsg)
    }

    const data = await response.json()

    if (!data.success) {
      const errorMsg = data.emptyReason || data.error || 'Error desconocido'
      console.error('❌ fetchPersonalizedQuestions: API devolvió success=false:', errorMsg)
      throw new Error(errorMsg)
    }

    let questions: TransformedQuestion[] = data.questions || []

    // Post-filter: excluir preguntas ya mostradas en esta sesión de browser
    if (sessionUsedIds.size > 0) {
      const before = questions.length
      questions = questions.filter(q => !sessionUsedIds.has(q.id))
      if (before !== questions.length) {
        console.log(`🎛️ Session cache: ${before} → ${questions.length} (excluidas ${before - questions.length})`)
      }
    }

    // Tomar solo las que necesitamos
    questions = questions.slice(0, numQuestions)

    if (questions.length === 0) {
      throw new Error(data.emptyReason || 'No hay preguntas disponibles con esta configuración.')
    }

    // Actualizar session cache
    questions.forEach(q => sessionUsedIds.add(q.id))

    console.log(`✅ Test personalizado cargado via API: ${questions.length} preguntas (cache: ${sessionUsedIds.size})`)
    return questions

  } catch (error) {
    console.error('❌ Error en fetchPersonalizedQuestions:', error)
    throw error
  }
}

// =================================================================
// 🎯 FETCHER: TEST MULTI-LEY - USA API CENTRALIZADA
// Migrado de ~830 líneas de queries Supabase directas a /api/questions/filtered.
// Mantiene catálogo adaptativo client-side (agrupa por dificultad × historial).
// =================================================================
export async function fetchQuestionsByTopicScope(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[] | AdaptiveResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    const numQuestions = parseInt(getParam(searchParams, 'n', '25'))
    const onlyOfficialQuestions = getParam(searchParams, 'only_official') === 'true'
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const recentDays = parseInt(getParam(searchParams, 'recent_days', '15'))
    const difficultyMode = getParam(searchParams, 'difficulty_mode', 'random')
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'
    const adaptiveMode = getParam(searchParams, 'adaptive') === 'true'
    const focusWeakAreas = config?.focusWeakAreas ?? (getParam(searchParams, 'focus_weak') === 'true')
    const onlyFailedQuestions = config?.onlyFailedQuestions ?? (getParam(searchParams, 'only_failed') === 'true')
    const failedQuestionIdsStr = getParam(searchParams, 'failed_question_ids')
    const failedQuestionIds = config?.failedQuestionIds || (failedQuestionIdsStr ? JSON.parse(failedQuestionIdsStr) : [])
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    const selectedSectionFilters = config?.selectedSectionFilters || []

    const isRestrictiveMode = focusEssentialArticles || onlyFailedQuestions
    const needsAdaptiveCatalog = !isRestrictiveMode && (focusWeakAreas || adaptiveMode)
    const requestSize = needsAdaptiveCatalog ? 500 : numQuestions

    console.log('🎯 Cargando test multi-ley via API, tema:', tema, 'n:', numQuestions,
      'adaptive:', needsAdaptiveCatalog, 'pos:', positionType)


    // Obtener token para auth server-side
    let authToken = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token ?? null
    } catch {
      console.warn('⚠️ No se pudo obtener token de sesión')
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    // Convertir selectedArticlesByLaw a formato API (números)
    const articlesForAPI: Record<string, number[]> = {}
    for (const [lawName, arts] of Object.entries(selectedArticlesByLaw)) {
      if (arts && (Array.isArray(arts) ? arts.length > 0 : false)) {
        const artsArray = Array.isArray(arts) ? arts : []
        articlesForAPI[lawName] = artsArray.map((a: any) => parseInt(a, 10)).filter((n: number) => !isNaN(n))
      }
    }

    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: tema,
        positionType,
        numQuestions: requestSize,
        selectedLaws,
        selectedArticlesByLaw: Object.keys(articlesForAPI).length > 0 ? articlesForAPI : selectedArticlesByLaw,
        selectedSectionFilters,
        onlyOfficialQuestions,
        difficultyMode: needsAdaptiveCatalog ? 'random' : difficultyMode,
        excludeRecentDays: excludeRecent ? recentDays : 0,
        focusEssentialArticles,
        prioritizeNeverSeen: true,
        onlyFailedQuestions,
        failedQuestionIds: failedQuestionIds || [],
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error || `HTTP ${response.status}`
      console.error(`❌ Error en fetchQuestionsByTopicScope (API): ${errorMsg}`, { status: response.status, tema, positionType })
      throw new Error(errorMsg)
    }

    const data = await response.json()

    if (!data.success) {
      const errorMsg = data.emptyReason || data.error || 'Error desconocido'
      console.error('❌ fetchQuestionsByTopicScope: API devolvió success=false:', errorMsg)
      throw new Error(errorMsg)
    }

    const allQuestions: TransformedQuestion[] = data.questions || []

    if (allQuestions.length === 0) {
      throw new Error(data.emptyReason || `No hay preguntas disponibles para tema ${tema}`)
    }

    console.log(`✅ API devolvió ${allQuestions.length} preguntas (${data.totalAvailable} disponibles)`)

    // Modo adaptativo: construir catálogo por dificultad client-side
    if (needsAdaptiveCatalog) {
      console.log('🧠 Construyendo catálogo adaptativo client-side')

      // Obtener historial del usuario para clasificar neverSeen vs answered
      const answeredIds = new Set<string>()
      if (user) {
        const { history } = await fetchUserQuestionHistory(user.id, true)
        history.forEach(item => answeredIds.add(item.questionId))
        console.log(`📊 Historial: ${answeredIds.size} preguntas respondidas`)
      }

      const neverSeenQs = allQuestions.filter(q => !answeredIds.has(q.id))
      const answeredQs = allQuestions.filter(q => answeredIds.has(q.id))

      const getDifficulty = (q: TransformedQuestion) => q.metadata.difficulty || 'medium'

      const catalogByDifficulty = {
        neverSeen: {
          easy: neverSeenQs.filter(q => getDifficulty(q) === 'easy'),
          medium: neverSeenQs.filter(q => getDifficulty(q) === 'medium'),
          hard: neverSeenQs.filter(q => getDifficulty(q) === 'hard'),
          extreme: neverSeenQs.filter(q => getDifficulty(q) === 'extreme'),
        },
        answered: {
          easy: answeredQs.filter(q => getDifficulty(q) === 'easy'),
          medium: answeredQs.filter(q => getDifficulty(q) === 'medium'),
          hard: answeredQs.filter(q => getDifficulty(q) === 'hard'),
          extreme: answeredQs.filter(q => getDifficulty(q) === 'extreme'),
        }
      }

      console.log(`🧠 Catálogo: neverSeen=${neverSeenQs.length}, answered=${answeredQs.length}`)

      // Selección inteligente de preguntas iniciales
      let initialQuestions: TransformedQuestion[] = []
      const medNS = catalogByDifficulty.neverSeen.medium
      const easyNS = catalogByDifficulty.neverSeen.easy
      const hardNS = catalogByDifficulty.neverSeen.hard

      if (medNS.length >= numQuestions) {
        initialQuestions = shuffleArray([...medNS]).slice(0, numQuestions)
      } else if (medNS.length + easyNS.length >= numQuestions) {
        initialQuestions = shuffleArray([...medNS, ...easyNS]).slice(0, numQuestions)
      } else {
        const allNS = [...medNS, ...easyNS, ...hardNS]
        initialQuestions = shuffleArray(allNS.length >= numQuestions ? allNS : [...allQuestions]).slice(0, numQuestions)
      }

      console.log(`✅ Catálogo adaptativo: ${initialQuestions.length} iniciales, total: ${allQuestions.length}`)

      return {
        isAdaptive: true,
        activeQuestions: initialQuestions,
        questionPool: initialQuestions,
        adaptiveCatalog: catalogByDifficulty,
      } as AdaptiveResult
    }

    // Modo normal: devolver las N preguntas
    const finalQuestions = allQuestions.slice(0, numQuestions)
    console.log(`✅ Test multi-ley cargado via API: ${finalQuestions.length} preguntas`)
    return finalQuestions
    
  } catch (error) {
    console.warn(`⚠️ Error en fetchQuestionsByTopicScope tema ${tema}:`, (error as Error)?.message || 'Error desconocido')
    throw error
  }
}

// =================================================================
// 🔧 FUNCIÓN AUXILIAR: Contar preguntas por tema multi-ley
// =================================================================
export async function countQuestionsByTopicScope(tema: number): Promise<number> {
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
      .eq('topics.position_type', 'auxiliar_administrativo_estado')
    
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
      .is('exam_case_id', null)
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
export async function fetchArticulosDirigido(lawName: string, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  console.log('🎯 INICIO fetchArticulosDirigido:', { lawName, timestamp: new Date().toISOString() })

  // Calentar cache BD → lawMappingUtils (no-op si ya cargado)
  try { const { warmSlugCache } = await import('./api/laws/warmCache'); await warmSlugCache() } catch {}

  try {
    // MANEJAR searchParams como objeto plano o URLSearchParams
    const getLocalParam = (key: string, defaultValue: string | null = null): string | null => {
      if (!searchParams) return defaultValue

      // Si es URLSearchParams (desde hook)
      if (typeof (searchParams as URLSearchParams).get === 'function') {
        return (searchParams as URLSearchParams).get(key) || defaultValue
      }

      // Si es objeto plano (desde server component)
      return (searchParams as Record<string, string | undefined>)[key] || defaultValue
    }
    
    const articles = getLocalParam('articles')
    const mode = getLocalParam('mode', 'intensive')
    const requestedCount = parseInt(getLocalParam('n', '10') || '10')
    
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
      .is('exam_case_id', null)
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
          console.log(`❌ Error probando "${testLawName}":`, (err as Error).message)
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
          const foundArticles = [...new Set(specificQuestions.map((q: any) => q.articles.article_number))].sort((a: any, b: any) => a - b)
          console.log('📋 Artículos encontrados en preguntas:', foundArticles)
          console.log('🎯 Preguntas por artículo:',
            foundArticles.map((art: any) => `Art.${art}: ${specificQuestions.filter((q: any) => q.articles.article_number === art).length} preguntas`).join(', ')
          )
          
          const shuffled = shuffleArray(specificQuestions).slice(0, requestedCount)
          console.log(`✅ ${shuffled.length} preguntas específicas encontradas para test dirigido`)
          return transformQuestions(shuffled)
        } else {
          console.log('❌ No se encontraron preguntas específicas, activando fallback...')
          console.log('   Razón: specificError =', !!specificError, ', questionsLength =', specificQuestions?.length || 0)
        }
      } catch (specificErr) {
        console.log('⚠️ Error en búsqueda específica:', (specificErr as Error).message)
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
            primary_article_id, exam_source, exam_date, exam_entity, image_url, content_data,
            articles!inner(
              id, article_number, title, content,
              laws!inner(short_name, name)
            )
          `)
          .eq('articles.laws.short_name', testLawName)
          .eq('is_active', true)
      .is('exam_case_id', null)
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
        console.log(`❌ FALLBACK error con "${testLawName}":`, (err as Error).message)
      }
    }
    
    try {
      if (!lawError && lawQuestions && lawQuestions.length > 0) {
        const shuffled = shuffleArray(lawQuestions).slice(0, requestedCount)
        console.log(`✅ ${shuffled.length} preguntas por ley encontradas con: ${successfulFallbackLaw}`)
        return transformQuestions(shuffled)
      }
    } catch (lawErr) {
      console.log('⚠️ Error en búsqueda por ley:', (lawErr as Error).message)
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
      .is('exam_case_id', null)
      .limit(requestedCount)
    
    if (randomError) throw randomError
    
    if (randomQuestions && randomQuestions.length > 0) {
      console.log(`✅ ${randomQuestions.length} preguntas aleatorias como último recurso`)
      return transformQuestions(shuffleArray(randomQuestions))
    }

    throw new Error('No se encontraron preguntas')

  } catch (error) {
    console.error('❌ Error en fetchArticulosDirigido:', error)
    throw new Error(`Error cargando test dirigido: ${(error as Error).message}`)
  }
}

// 🔧 mapLawSlugToShortName importada desde ./lawMappingUtils (600+ mapeos canónicos)


// =================================================================
// 🚀 FETCHER: MANTENER RACHA - 
// Prioriza temas con mejor rendimiento (≥50% aciertos), Distribuye preguntas entre 3 temas máximo para variedad, Solo preguntas fáciles para mantener motivación, mezcla aleatoria,
// =================================================================

// =================================================================
// 🚀 FETCHER: MANTENER RACHA - VERSIÓN UNIVERSAL INTELIGENTE
// =================================================================
export async function fetchMantenerRacha(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    console.log('🚀 Cargando test inteligente para mantener racha')

    // 🔧 Usar getParam helper para manejar URLSearchParams u objeto plano
    const n = parseInt(getParam(searchParams, 'n', '5'))
    const streakDays = parseInt(getParam(searchParams, 'streak_days', '0'))
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    // 🧠 PASO 1: Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('⚠️ Usuario no autenticado, usando fallback universal')
      return await fetchMantenerRachaFallback(n, null, positionType)
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
      return await fetchMantenerRachaFallback(n, user, positionType)
    }

    if (!temasEstudiados || temasEstudiados.length === 0) {
      console.log('📚 Usuario sin temas estudiados, usando fallback universal')
      return await fetchMantenerRachaFallback(n, user, positionType)
    }

    console.log('🎯 Temas estudiados detectados:', temasEstudiados.map((t: any) => `Tema ${t.tema_number} (${t.tests_count} tests, ${Math.round(t.avg_score)}%)`))

    // 🔥 PASO 3: Estrategia inteligente de selección
    // Priorizar temas con mejor rendimiento para mantener motivación
    const temasParaRacha = temasEstudiados
      .filter((t: any) => t.avg_score >= 50) // Solo temas con rendimiento decente
      .slice(0, 3) // Máximo 3 temas para mantener enfoque
      .map((t: any) => t.tema_number)

    if (temasParaRacha.length === 0) {
      // Si no hay temas con buen rendimiento, usar todos los estudiados
      temasParaRacha.push(...temasEstudiados.map((t: any) => t.tema_number))
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
      return await fetchMantenerRachaFallback(n, user, positionType)
    }

    // Mezclar todas las preguntas obtenidas
    const shuffledQuestions = shuffleArray(allQuestions)
    const finalQuestions = shuffledQuestions.slice(0, n)

    console.log(`✅ Mantener racha INTELIGENTE: ${finalQuestions.length} preguntas de ${temasParaRacha.length} temas estudiados`)
    console.log(`📊 Distribución final: ${JSON.stringify(finalQuestions.map((q: any) => q.articles?.laws?.short_name || 'N/A').reduce((acc: Record<string, number>, law: string) => {
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {} as Record<string, number>))}`)

    return transformQuestions(finalQuestions)

  } catch (error) {
    console.error('❌ Error en fetchMantenerRacha inteligente:', error)
    const fallbackN = parseInt(getParam(searchParams, 'n', '5'))
    const fallbackPositionType = config?.positionType || 'auxiliar_administrativo_estado'
    return await fetchMantenerRachaFallback(fallbackN, null, fallbackPositionType)
  }
}

// Obtiene los short_names de leyes configuradas en topic_scope para un positionType.
// Fuente de verdad: topic_scope JOIN topics WHERE position_type = positionType.
// Evita hardcodear leyes por oposición — si se añade una ley al scope, se recoge automáticamente.
async function getLawShortNamesForPosition(positionType: string): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from('topic_scope')
      .select('laws!inner(short_name), topics!inner(position_type)')
      .eq('topics.position_type', positionType)

    if (error || !data || data.length === 0) return null

    const shortNames = [...new Set(
      data.map((r: any) => r.laws?.short_name).filter(Boolean)
    )] as string[]

    return shortNames.length > 0 ? shortNames : null
  } catch {
    return null
  }
}

// 🔄 FUNCIÓN FALLBACK UNIVERSAL INTELIGENTE
async function fetchMantenerRachaFallback(n: number, user: { id: string } | null, positionType: string = 'auxiliar_administrativo_estado'): Promise<TransformedQuestion[]> {
  try {
    console.log(`🔄 Ejecutando fallback universal inteligente (positionType: ${positionType})`)
    
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

      const testIds = userTests?.map((t: any) => t.id) || []

      const { data: userQuestionHistory, error: historyError } = await batchedTestQuestionsQuery(
        testIds,
        `articles!inner(laws!inner(short_name)), test_id`,
        { limit: 10000 }
      )

      if (!historyError && userQuestionHistory && userQuestionHistory.length > 0) {
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
      
      // FALLBACK: Si no hay historial de preguntas, usar topic_scope dinámico
      if (!studiedLaws) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('target_oposicion')
          .eq('id', user.id)
          .single()

        const oposicionToQuery = userProfile?.target_oposicion || positionType
        studiedLaws = await getLawShortNamesForPosition(oposicionToQuery)
        if (studiedLaws) {
          console.log(`🎯 Leyes detectadas por oposición (${oposicionToQuery}):`, studiedLaws)
        }
      }
    }

    // Si no hay usuario o no se pudo detectar leyes, aplicar scope del positionType
    if (!studiedLaws) {
      studiedLaws = await getLawShortNamesForPosition(positionType)
      if (studiedLaws) {
        console.log(`🎯 Leyes por scope de positionType (${positionType}):`, studiedLaws)
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
      .is('exam_case_id', null)
      .or('global_difficulty_category.in.(easy,medium),and(global_difficulty_category.is.null,difficulty.in.(easy,medium))') // Mantener motivación con preguntas no muy difíciles

    // 🎯 PASO 3: Aplicar filtro de leyes
    // SIEMPRE se aplica: si studiedLaws es null aquí, significa que ni el historial
    // ni el topic_scope devolvieron leyes → fallar en lugar de devolver preguntas de
    // otras oposiciones (comportamiento anterior que causaba el bug de LECrim en auxiliar).
    if (studiedLaws && studiedLaws.length > 0) {
      query = query.in('articles.laws.short_name', studiedLaws)
      console.log('🔍 Aplicando filtro por leyes:', studiedLaws.length, 'leyes')
    } else {
      console.warn(`⚠️ fetchMantenerRachaFallback: sin leyes para positionType="${positionType}" — devolviendo vacío`)
      return []
    }
    
    // 🎲 PASO 4: Obtener y mezclar preguntas
    const { data: fallbackData, error: fallbackError } = await query
      .limit(n * 3) // Obtener más para mezclar mejor

    if (fallbackError) throw fallbackError

    if (!fallbackData || fallbackData.length === 0) {
      // Si el filtro de dificultad no devuelve resultados, reintentar sin filtro de dificultad
      // pero MANTENER el filtro de leyes del scope (no devolver preguntas de otras oposiciones)
      console.log('⚠️ Sin resultados con filtro de dificultad, reintentando sin él (mismo scope de leyes)...')

      const { data: nodifficultData, error: nodiffError } = await supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, difficulty, global_difficulty_category, is_official_exam,
          primary_article_id, exam_source, exam_date, exam_entity, image_url, content_data,
          articles!inner(
            id, article_number, title, content,
            laws!inner(short_name, name)
          )
        `)
        .eq('is_active', true)
        .is('exam_case_id', null)
        .in('articles.laws.short_name', studiedLaws)  // scope siempre aplicado
        .limit(n * 3)

      if (nodiffError) throw nodiffError

      if (nodifficultData && nodifficultData.length > 0) {
        const shuffledQuestions = shuffleArray(nodifficultData)
        const finalQuestions = shuffledQuestions.slice(0, n)
        console.log(`✅ Retry sin dificultad: ${finalQuestions.length} preguntas`)
        return transformQuestions(finalQuestions)
      }

      throw new Error('No hay preguntas disponibles para mantener racha')
    }

    // 🎲 Mezclar y seleccionar
    const shuffledQuestions = shuffleArray(fallbackData)
    const finalQuestions = shuffledQuestions.slice(0, n)

    const lawDistribution = finalQuestions.reduce((acc: Record<string, number>, q: any) => {
      const law = q.articles?.laws?.short_name || 'N/A'
      acc[law] = (acc[law] || 0) + 1
      return acc
    }, {} as Record<string, number>)

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
export async function fetchExplorarContenido(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
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
      .is('exam_case_id', null)
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
function getDifficultyFromPercentage(percentage: number): string {
  if (percentage <= 25) return 'easy'
  if (percentage <= 50) return 'medium'
  if (percentage <= 75) return 'hard'
  return 'extreme'
}

// =================================================================
// 🎲 FETCHER: TEST ALEATORIO MULTI-TEMA - MIGRADO A API CENTRALIZADA
// =================================================================
export async function fetchAleatorioMultiTema(themes: number[], searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    console.log('🎲 fetchAleatorioMultiTema via API centralizada, temas:', themes)

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Leer parámetros de configuración (usando helper para URLSearchParams u objeto)
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'
    const numQuestions = parseInt(getParam(searchParams, 'n', '20'))
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const excludeDays = parseInt(getParam(searchParams, 'exclude_days', '15'))
    const onlyOfficialQuestions = getParam(searchParams, 'official_only') === 'true'
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'
    // Mapear 'mixed' (UI) → 'random' (API), el resto coincide ('easy','medium','hard')
    const rawDifficulty = getParam(searchParams, 'difficulty', 'mixed')
    const difficultyMode = rawDifficulty === 'mixed' ? 'random' : rawDifficulty

    console.log('🎛️ Configuración multi-tema:', { numQuestions, difficultyMode, excludeRecent, excludeDays, onlyOfficialQuestions, focusEssentialArticles })

    // Obtener token para que la API resuelva userId (excludeRecent, prioritizeNeverSeen)
    let authToken: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token ?? null
    } catch {
      console.warn('⚠️ No se pudo obtener token de sesión')
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: 0,
        positionType,
        multipleTopics: themes,
        numQuestions,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        onlyOfficialQuestions,
        difficultyMode,
        excludeRecentDays: excludeRecent ? excludeDays : 0,
        focusEssentialArticles,
        prioritizeNeverSeen: true,
        proportionalByTopic: themes.length > 1,
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
export async function fetchContentScopeQuestions(config: FetchConfig = {}, contentScopeConfig: ContentScopeConfig): Promise<TransformedQuestion[]> {
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
      .is('exam_case_id', null)
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
export async function fetchQuestionsViaAPI(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    console.log(`🚀 fetchQuestionsViaAPI para tema ${tema}`)

    // Extraer configuración de searchParams y config
    const numQuestions = parseInt(getParam(searchParams, 'n', '25')) || config?.numQuestions || 25
    const onlyOfficialQuestions = getParam(searchParams, 'only_official') === 'true' || config?.onlyOfficialQuestions || false
    const difficultyMode = getParam(searchParams, 'difficulty_mode') || config?.difficultyMode || 'random'
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    // 🔄 Filtro de preguntas falladas
    const onlyFailedQuestions = getParam(searchParams, 'only_failed') === 'true' || config?.onlyFailedQuestions || false
    let failedQuestionIds = config?.failedQuestionIds || []
    // También intentar parsear de searchParams si viene como string JSON
    const failedIdsParam = getParam(searchParams, 'failed_question_ids')
    if (failedQuestionIds.length === 0 && failedIdsParam) {
      try {
        failedQuestionIds = JSON.parse(failedIdsParam)
      } catch (e) {
        console.warn('⚠️ Error parseando failed_question_ids:', e)
      }
    }

    // Filtros de leyes, artículos y secciones
    const selectedLaws = config?.selectedLaws || []
    const selectedArticlesByLaw = config?.selectedArticlesByLaw || {}
    const selectedSectionFilters = config?.selectedSectionFilters || []

    // Convertir selectedArticlesByLaw a formato esperado por la API
    // La API espera: { "CE": [1, 2, 3] } con números
    const articlesForAPI: Record<string, number[]> = {}
    for (const [lawName, articles] of Object.entries(selectedArticlesByLaw)) {
      if (articles && (Array.isArray(articles) ? articles.length > 0 : (articles as any).size > 0)) {
        // Convertir Set a Array si es necesario y asegurar que son números
        const articlesArray = Array.isArray(articles) ? articles : Array.from(articles as any)
        articlesForAPI[lawName] = articlesArray.map((a: any) => parseInt(a, 10)).filter((num: number) => !isNaN(num))
      }
    }

    console.log('🚀 API Request:', {
      topicNumber: tema,
      positionType,
      numQuestions,
      selectedLaws: selectedLaws.length,
      selectedArticlesByLaw: Object.keys(articlesForAPI).length,
      selectedSectionFilters: selectedSectionFilters.length,
      onlyFailedQuestions,
      failedQuestionIds: failedQuestionIds.length
    })

    // Obtener token de auth para que la API resuelva userId server-side
    let authToken: string | null = null
    if (onlyFailedQuestions) {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        authToken = session?.access_token ?? null
      } catch {
        console.warn('⚠️ No se pudo obtener token para filtrar falladas')
      }
    }

    // Llamar a la API
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetch('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: tema,
        positionType,
        numQuestions,
        selectedLaws,
        selectedArticlesByLaw: articlesForAPI,
        selectedSectionFilters,
        onlyOfficialQuestions,
        difficultyMode,
        onlyFailedQuestions,
        failedQuestionIds,
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      console.error('❌ Error en API /questions/filtered:', data.error)
      throw new Error(data.error || 'Error obteniendo preguntas')
    }

    console.log(`✅ API devolvió ${data.questions?.length || 0} preguntas (${data.totalAvailable} disponibles)`)

    // Si la API devolvió 0 preguntas con motivo, propagar el motivo
    if (data.questions?.length === 0 && data.emptyReason) {
      throw new Error(data.emptyReason)
    }

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
export async function countQuestionsViaAPI(tema: number, config: FetchConfig): Promise<CountResult> {
  try {
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'
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