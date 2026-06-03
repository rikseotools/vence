// lib/testFetchers.ts - FETCHERS MODULARES PARA TODOS LOS TIPOS DE TEST - CON SOPORTE MULTI-LEY
// fetchWithChallenge: drop-in de fetch que resuelve el reto humano (anti-scraping)
// si el servidor lo pide. Cuando la capa está apagada se comporta igual que fetch.
import { fetchWithChallenge } from './api/fetchWithChallenge'
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

// Tipos adaptativo importados de lib/types/adaptive.ts
import { topicKey, articleKey, emptyBuckets, pickDiverseByArticle } from '@/lib/types/adaptive'
import type { AdaptiveCatalog as AdaptiveCatalogNew, DifficultyBuckets } from '@/lib/types/adaptive'

// Legacy compat: el viejo AdaptiveCatalog era flat (difficulty como clave directa)
// El nuevo usa topic como clave intermedia. Para backward compat con TestLayout,
// convertimos al formato viejo al devolver al cliente.
type AdaptiveCatalog = {
  neverSeen: Record<string, TransformedQuestion[]>
  answered: Record<string, TransformedQuestion[]>
  topicDistribution?: Record<string, number>
  articlesSeen?: string[]
}

// =====================================================================
// CACHE: Historial de preguntas del usuario (evita consultar la BD en
// cada test cuando un usuario hace varios tests seguidos).
// TTL 10 min — el historial solo cambia cuando el usuario responde
// preguntas, y el cache se invalida al responder.
// =====================================================================
interface HistoryCacheEntry {
  answeredIds: Set<string>
  history: QuestionHistoryItem[]
  timestamp: number
}
const historyCache = new Map<string, HistoryCacheEntry>()
const HISTORY_CACHE_TTL = 10 * 60 * 1000 // 10 minutos

/** Obtener answeredIds con cache. Evita re-consultar la BD en tests seguidos. */
async function getCachedAnsweredIds(userId: string): Promise<Set<string>> {
  const cached = historyCache.get(userId)
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL) {
    console.log(`📦 [AdaptCache] Hit para ${userId.slice(0, 8)}: ${cached.answeredIds.size} IDs`)
    return cached.answeredIds
  }

  const { history } = await fetchUserQuestionHistory(userId, true)
  const answeredIds = new Set(history.map(item => item.questionId))

  historyCache.set(userId, {
    answeredIds,
    history,
    timestamp: Date.now(),
  })
  console.log(`🔄 [AdaptCache] Cargado para ${userId.slice(0, 8)}: ${answeredIds.size} IDs`)
  return answeredIds
}

/** Invalidar cache de un usuario (llamar tras guardar respuesta). */
export function invalidateHistoryCache(userId: string): void {
  historyCache.delete(userId)
}

/**
 * Construye el catálogo adaptativo organizado por tema → dificultad × visto/no-visto.
 * Funciona para 1 o N temas.
 */
function buildAdaptiveCatalog(
  allQuestions: TransformedQuestion[],
  answeredIds: Set<string>,
  themes: number[],
  numQuestions: number
): { catalog: AdaptiveCatalog; initialQuestions: TransformedQuestion[] } {
  const getDifficulty = (q: TransformedQuestion) => q.metadata?.difficulty || 'medium'

  // Clasificar por tema
  const byTopic = new Map<string, TransformedQuestion[]>()
  for (const q of allQuestions) {
    const key = themes.length <= 1 ? 'all' : topicKey(q.tema)
    if (!byTopic.has(key)) byTopic.set(key, [])
    byTopic.get(key)!.push(q)
  }

  // Construir catálogo con formato legacy (difficulty como clave directa en neverSeen/answered)
  const catalogNeverSeen: Record<string, TransformedQuestion[]> = {}
  const catalogAnswered: Record<string, TransformedQuestion[]> = {}
  const topicDistribution: Record<string, number> = {}

  for (const [tKey, questions] of byTopic) {
    const neverSeen = questions.filter(q => !answeredIds.has(q.id))
    const answered = questions.filter(q => answeredIds.has(q.id))

    // Formato legacy: difficulty como clave
    for (const diff of ['easy', 'medium', 'hard', 'extreme'] as const) {
      const nsKey = themes.length <= 1 ? diff : `${tKey}:${diff}`
      catalogNeverSeen[nsKey] = neverSeen.filter(q => getDifficulty(q) === diff)
      catalogAnswered[nsKey] = answered.filter(q => getDifficulty(q) === diff)
    }

    console.log(`[AdaptCatalog] ${tKey}: ${neverSeen.length} neverSeen, ${answered.length} answered`)
  }

  // Selección inicial: proporcional por tema, diversificada por artículo
  let initialQuestions: TransformedQuestion[]

  if (themes.length <= 1) {
    // Single tema: priorizar neverSeen medium
    const neverSeenAll = allQuestions.filter(q => !answeredIds.has(q.id))
    const medNS = neverSeenAll.filter(q => getDifficulty(q) === 'medium')
    const easyNS = neverSeenAll.filter(q => getDifficulty(q) === 'easy')
    const hardNS = neverSeenAll.filter(q => getDifficulty(q) === 'hard')

    let pool: TransformedQuestion[]
    if (medNS.length >= numQuestions) pool = medNS
    else if (medNS.length + easyNS.length >= numQuestions) pool = [...medNS, ...easyNS]
    else pool = [...medNS, ...easyNS, ...hardNS]

    if (pool.length < numQuestions) pool = [...pool, ...allQuestions.filter(q => !pool.includes(q))]

    // Seleccionar sin repetir artículo hasta agotar los disponibles
    initialQuestions = pickDiverseByArticle(pool, numQuestions, q => articleKey(q.article?.number, q.article?.law_short_name))
  } else {
    // Multi-tema: proporcional por tema, luego diversificar artículos
    const perTopic = Math.floor(numQuestions / themes.length)
    const remainder = numQuestions % themes.length
    const selected: TransformedQuestion[] = []

    const topicKeys = [...byTopic.keys()].sort(() => Math.random() - 0.5)
    let extra = remainder

    for (const tKey of topicKeys) {
      const topicQs = byTopic.get(tKey) || []
      const neverSeen = topicQs.filter(q => !answeredIds.has(q.id)).sort(() => Math.random() - 0.5)
      const count = perTopic + (extra > 0 ? 1 : 0)
      if (extra > 0) extra--

      const pick = neverSeen.length >= count ? neverSeen.slice(0, count) : [...neverSeen, ...topicQs.filter(q => answeredIds.has(q.id)).sort(() => Math.random() - 0.5)].slice(0, count)
      selected.push(...pick)
      topicDistribution[tKey] = pick.length
    }

    initialQuestions = selected.sort(() => Math.random() - 0.5)
  }

  // Registrar distribución para single tema
  if (themes.length <= 1) {
    topicDistribution['all'] = initialQuestions.length
  }

  console.log(`[AdaptCatalog] Initial: ${initialQuestions.length} preguntas, topics: ${JSON.stringify(topicDistribution)}`)

  return {
    catalog: {
      neverSeen: catalogNeverSeen,
      answered: catalogAnswered,
      topicDistribution,
      articlesSeen: initialQuestions.map(q => articleKey(q.article?.number, q.article?.law_short_name)),
    },
    initialQuestions,
  }
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
      options: [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter((v: string | null | undefined): v is string => v != null && v !== ''),
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

    const response = await fetchWithChallenge('/api/questions/filtered', {
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
    const response = await fetchWithChallenge('/api/questions/filtered', {
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
    const response = await fetchWithChallenge('/api/questions/filtered', {
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

    const response = await fetchWithChallenge('/api/questions/filtered', {
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
    const includeSharedOfficials = getParam(searchParams, 'include_shared_officials') === 'true'
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
    // Pool adaptativo: 4x las preguntas solicitadas (suficiente para diversidad por
    // dificultad y artículo). Antes era 500 fijo — saturaba Supabase con queries pesadas.
    const requestSize = needsAdaptiveCatalog ? Math.min(numQuestions * 4, 200) : numQuestions

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

    const response = await fetchWithChallenge('/api/questions/filtered', {
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
        includeSharedOfficials,
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

    // Pool pequeño (< numQuestions): saltar adaptativo y devolver todo.
    // Caso típico: "solo oficiales" en temas con pocas preguntas oficiales (ej. Outlook con 9).
    // El adaptativo filtra por neverSeen/dificultad y reduce el pool a 2-3 preguntas,
    // confundiendo al usuario que ve "(9)" en el configurador pero recibe 3.
    // Bug reportado por gaditadelgado@gmail.com (21/04/2026).
    if (needsAdaptiveCatalog && allQuestions.length <= numQuestions) {
      console.log(`⏩ Pool pequeño (${allQuestions.length} ≤ ${numQuestions}): saltando adaptativo, devolviendo todo`)
      return shuffleArray([...allQuestions]).slice(0, numQuestions)
    }

    // Modo adaptativo: construir catálogo con buildAdaptiveCatalog()
    if (needsAdaptiveCatalog) {
      console.log('🧠 Construyendo catálogo adaptativo')

      const answeredIds = user ? await getCachedAnsweredIds(user.id) : new Set<string>()

      const { catalog, initialQuestions } = buildAdaptiveCatalog(
        allQuestions, answeredIds, [tema], numQuestions
      )

      console.log(`✅ Catálogo adaptativo: ${initialQuestions.length} iniciales, total: ${allQuestions.length}`)

      return {
        isAdaptive: true,
        activeQuestions: initialQuestions,
        questionPool: initialQuestions,
        adaptiveCatalog: catalog,
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
// 🎯 FETCHER: TEST DIRIGIDO POR ARTÍCULOS - USA API CENTRALIZADA
// 3 estrategias: (1) artículos específicos, (2) ley completa, (3) random.
// Migrado de Supabase directo con loop de variantes de nombres.
// =================================================================
export async function fetchArticulosDirigido(lawName: string, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try { const { warmSlugCache } = await import('./api/laws/warmCache'); await warmSlugCache() } catch {}

  try {
    const articles = getParam(searchParams, 'articles')
    const requestedCount = parseInt(getParam(searchParams, 'n', '10') || '10')
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'
    const lawShortName = mapLawSlugToShortName(lawName) || lawName

    console.log('🎯 fetchArticulosDirigido via API:', { lawName, lawShortName, articles, n: requestedCount, pos: positionType })

    // Estrategia 1: Artículos específicos
    if (articles?.trim()) {
      const articleNumbers = articles.split(',').map(a => parseInt(a.trim())).filter(n => !isNaN(n))
      console.log('🎯 Estrategia 1: artículos específicos:', articleNumbers)

      const result = await callFilteredAPI({
        positionType, numQuestions: requestedCount,
        selectedLaws: [lawShortName],
        selectedArticlesByLaw: { [lawShortName]: articleNumbers },
      })

      if (result.length > 0) {
        console.log(`✅ Estrategia 1: ${result.length} preguntas de artículos específicos`)
        return result
      }
      console.log('⚠️ Estrategia 1 sin resultados, probando ley completa...')
    }

    // Estrategia 2: Ley completa
    console.log('📚 Estrategia 2: ley completa:', lawShortName)
    const lawResult = await callFilteredAPI({
      positionType, numQuestions: requestedCount,
      selectedLaws: [lawShortName],
    })

    if (lawResult.length > 0) {
      console.log(`✅ Estrategia 2: ${lawResult.length} preguntas de ${lawShortName}`)
      return lawResult
    }
    console.log('⚠️ Estrategia 2 sin resultados, probando random...')

    // Estrategia 3: Random general
    console.log('🎲 Estrategia 3: random general')
    const randomResult = await callFilteredAPI({
      positionType, numQuestions: requestedCount,
    })

    if (randomResult.length > 0) {
      console.log(`✅ Estrategia 3: ${randomResult.length} preguntas aleatorias`)
      return randomResult
    }

    throw new Error('No se encontraron preguntas')
  } catch (error) {
    console.error('❌ Error en fetchArticulosDirigido:', error)
    throw new Error(`Error cargando test dirigido: ${(error as Error).message}`)
  }
}

async function callFilteredAPI(params: {
  positionType: string; numQuestions: number;
  selectedLaws?: string[]; selectedArticlesByLaw?: Record<string, number[]>;
}): Promise<TransformedQuestion[]> {
  const response = await fetchWithChallenge('/api/questions/filtered', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topicNumber: 0,
      positionType: params.positionType,
      numQuestions: params.numQuestions,
      selectedLaws: params.selectedLaws || [],
      selectedArticlesByLaw: params.selectedArticlesByLaw || {},
      selectedSectionFilters: [],
      difficultyMode: 'random',
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  if (!data.success) return []
  return data.questions || []
}


// =================================================================
// 🚀 FETCHER: MANTENER RACHA - USA API CENTRALIZADA
// Detecta temas estudiados (query a tests, no a questions),
// luego obtiene preguntas fáciles de esos temas via API.
// =================================================================
export async function fetchMantenerRacha(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    const n = parseInt(getParam(searchParams, 'n', '5'))
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    console.log('🚀 Cargando test para mantener racha via API, n:', n, 'pos:', positionType)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('⚠️ Usuario no autenticado, usando API en modo global')
      return await callFilteredAPI({ positionType, numQuestions: n })
    }

    // Detectar temas estudiados (query a tests, NO a questions → no afectada por RLS)
    const { data: temasEstudiados, error: temasError } = await supabase
      .from('tests')
      .select('tema_number')
      .eq('user_id', user.id)
      .not('tema_number', 'is', null)
      .eq('is_completed', true)

    if (temasError || !temasEstudiados?.length) {
      console.log('📚 Sin temas estudiados, usando API en modo global')
      return await fetchMantenerRachaViaAPI(n, positionType, [])
    }

    const temaNumbers: number[] = temasEstudiados
      .map((t: { tema_number: number }) => t.tema_number)
      .filter((n: number): n is number => typeof n === 'number' && !isNaN(n))
    const uniqueTemas = [...new Set<number>(temaNumbers)].slice(0, 3)

    console.log('🎯 Temas para racha:', uniqueTemas)

    return await fetchMantenerRachaViaAPI(n, positionType, uniqueTemas)
  } catch (error) {
    console.error('❌ Error en fetchMantenerRacha:', error)
    const fallbackN = parseInt(getParam(searchParams, 'n', '5'))
    const fallbackPos = config?.positionType || 'auxiliar_administrativo_estado'
    return await fetchMantenerRachaViaAPI(fallbackN, fallbackPos, [])
  }
}

async function fetchMantenerRachaViaAPI(n: number, positionType: string, topics: number[]): Promise<TransformedQuestion[]> {
  let authToken: string | null = null
  try {
    const { data: { session } } = await supabase.auth.getSession()
    authToken = session?.access_token ?? null
  } catch {}

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`

  const response = await fetchWithChallenge('/api/questions/filtered', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topicNumber: 0,
      positionType,
      multipleTopics: topics,
      numQuestions: n,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      difficultyMode: 'easy',
      prioritizeNeverSeen: true,
      proportionalByTopic: topics.length > 1,
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  if (!data.success || !data.questions?.length) {
    console.log('⚠️ API sin preguntas para racha, probando sin filtros...')
    return await callFilteredAPI({ positionType, numQuestions: n })
  }

  console.log(`✅ Mantener racha via API: ${data.questions.length} preguntas de ${topics.length || 'todos los'} temas`)
  return data.questions
}



// =================================================================
// 🔍 FETCHER: EXPLORAR CONTENIDO - USA API CENTRALIZADA
// Migrado de Supabase directo a /api/questions/filtered.
// La API no tiene filtro por created_at, así que pedimos preguntas
// aleatorias en modo global — el usuario descubre contenido variado.
// =================================================================
export async function fetchExplorarContenido(tema: number, searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[]> {
  try {
    const n = parseInt(getParam(searchParams, 'n', '8'))
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    console.log('🔍 Cargando contenido para explorar via API, n:', n, 'pos:', positionType)

    const response = await fetchWithChallenge('/api/questions/filtered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicNumber: 0,
        positionType,
        numQuestions: n,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        difficultyMode: 'random',
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()
    if (!data.success || !data.questions?.length) {
      throw new Error(data.emptyReason || 'No hay contenido disponible para explorar')
    }

    console.log(`✅ ${data.questions.length} preguntas para explorar via API`)
    return data.questions
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
export async function fetchAleatorioMultiTema(themes: number[], searchParams: SearchParamsLike, config: FetchConfig): Promise<TransformedQuestion[] | AdaptiveResult> {
  try {
    console.log('🎲 fetchAleatorioMultiTema via API centralizada, temas:', themes)

    // Obtener usuario actual
    const { data: { user } } = await supabase.auth.getUser()

    // Leer parámetros de configuración (usando helper para URLSearchParams u objeto)
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'
    const numQuestions = parseInt(getParam(searchParams, 'n', '20'))
    const isAdaptive = getParam(searchParams, 'adaptive') === 'true'
    const requestSize = isAdaptive ? Math.min(numQuestions * 4, 200) : numQuestions
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const excludeDays = parseInt(getParam(searchParams, 'exclude_days', '15'))
    const onlyOfficialQuestions = getParam(searchParams, 'official_only') === 'true'
    const includeSharedOfficials = getParam(searchParams, 'include_shared_officials') === 'true'
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'
    // Toggle UI "incluir preguntas vistas". Default true (preferir nuevas) preserva
    // el comportamiento previo. Solo cuando el usuario activa el toggle pasa a false.
    const prioritizeNeverSeen = getParam(searchParams, 'prioritize_never_seen', 'true') !== 'false'
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

    const response = await fetchWithChallenge('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: 0,
        positionType,
        multipleTopics: themes,
        numQuestions: requestSize,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        onlyOfficialQuestions,
        includeSharedOfficials,
        difficultyMode,
        excludeRecentDays: excludeRecent ? excludeDays : 0,
        focusEssentialArticles,
        prioritizeNeverSeen,
        proportionalByTopic: themes.length > 1,
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error obteniendo preguntas multi-tema')
    }

    const allQuestions: TransformedQuestion[] = data.questions || []
    console.log(`✅ Test aleatorio multi-tema: ${allQuestions.length} preguntas de ${themes.length} temas`)

    // Modo adaptativo multi-tema
    const adaptiveMode = getParam(searchParams, 'adaptive') === 'true'
    if (adaptiveMode && allQuestions.length > numQuestions) {
      console.log('🧠 Construyendo catálogo adaptativo multi-tema')
      const answeredIds = user ? await getCachedAnsweredIds(user.id) : new Set<string>()

      const { catalog, initialQuestions } = buildAdaptiveCatalog(
        allQuestions, answeredIds, themes, numQuestions
      )

      return {
        isAdaptive: true,
        activeQuestions: initialQuestions,
        questionPool: initialQuestions,
        adaptiveCatalog: catalog,
      } as AdaptiveResult
    }

    return allQuestions

  } catch (error) {
    console.error('❌ Error en fetchAleatorioMultiTema:', error)
    throw error
  }
}

// =================================================================
// 📋 FETCHER: CONTENT SCOPE - USA API CENTRALIZADA
// Migrado de Supabase directo a /api/questions/filtered con primaryArticleIds.
// =================================================================
export async function fetchContentScopeQuestions(config: FetchConfig = {}, contentScopeConfig: ContentScopeConfig): Promise<TransformedQuestion[]> {
  try {
    if (!contentScopeConfig?.articleIds?.length) {
      throw new Error('No se encontraron artículos en el content scope')
    }

    const numQuestions = config.numQuestions || 20
    const positionType = config?.positionType || 'auxiliar_administrativo_estado'

    console.log('📋 Cargando content scope via API:', {
      articleIds: contentScopeConfig.articleIds.length,
      section: contentScopeConfig.sectionInfo?.name,
      n: numQuestions,
      pos: positionType,
    })

    let authToken: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token ?? null
    } catch {
      console.warn('⚠️ No se pudo obtener token de sesión')
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetchWithChallenge('/api/questions/filtered', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        topicNumber: 0,
        positionType,
        numQuestions,
        primaryArticleIds: contentScopeConfig.articleIds,
        selectedLaws: [],
        selectedArticlesByLaw: {},
        selectedSectionFilters: [],
        difficultyMode: 'random',
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMsg = errorData.error || `HTTP ${response.status}`
      console.error(`❌ Error en fetchContentScopeQuestions (API): ${errorMsg}`)
      throw new Error(errorMsg)
    }

    const data = await response.json()
    if (!data.success || !data.questions?.length) {
      throw new Error(data.emptyReason || 'No se encontraron preguntas para los artículos del content_scope')
    }

    console.log(`✅ Content scope via API: ${data.questions.length} preguntas para "${contentScopeConfig.sectionInfo?.name}"`)
    return data.questions
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
    const focusEssentialArticles = getParam(searchParams, 'focus_essential') === 'true'
    const excludeRecent = getParam(searchParams, 'exclude_recent') === 'true'
    const recentDays = parseInt(getParam(searchParams, 'recent_days', '15'))

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
    // Necesario para: excludeRecentDays, prioritizeNeverSeen, onlyFailedQuestions
    let authToken: string | null = null
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token ?? null
    } catch {
      console.warn('⚠️ No se pudo obtener token de sesión')
    }

    // Llamar a la API
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    const response = await fetchWithChallenge('/api/questions/filtered', {
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
        focusEssentialArticles,
        excludeRecentDays: excludeRecent ? recentDays : 0,
        prioritizeNeverSeen: true,
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