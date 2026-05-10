// app/api/questions/filtered/route.ts - API para obtener preguntas filtradas
// Usa Drizzle ORM + Zod para validación tipada
//
// Estrategia de cache + resiliencia (refactor 2026-05-10 tras blip recurrente):
// - POST: stale-if-error puro (RFC 5861). NO hay fast-path de cache fresco
//   porque las respuestas son aleatorias y reusarlas degrada UX (dos creates
//   con mismo body devolverían los mismos 25 IDs). Siempre se va a BD; en
//   timeout se sirve la cache stale si existe (200) en lugar de 503.
// - GET ?action=count: fresh + stale (count es determinista, mismo patrón
//   que weak-articles).
//
// Cache keys (DOBLE):
//   - Per-user: filtered_q[:count]:{userId|'anon'}:{hash} — preferida (UX óptima)
//   - Global:   filtered_q[:count]:any:{hash}              — fallback en blip
// En timeout buscamos PRIMERO la per-user; si no hay, caemos a la global. La
// global puede repetir selección entre usuarios durante el blip — UX inferior
// pero ENORMEMENTE mejor que 503. Sólo se consulta tras DbTimeoutError, no
// en operación normal. Documentado en ARCHITECTURE_ROADMAP.md (incidente 10 may).
//
// Retry CONNECT_TIMEOUT: withConnectRetry envuelve la query; un solo intento
// extra con backoff 500ms cubre blips <1s del Supavisor regional sin pagar
// 503 al usuario. Acotado dentro del withDbTimeout para no exceder 15s.
//
// userId siempre del Bearer token (server-side). Body normalizado con orden
// de claves fijo y arrays orden-insensibles ordenados.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import {
  getFilteredQuestions,
  countFilteredQuestions,
  safeParseGetFilteredQuestions,
  safeParseCountFilteredQuestions,
  type GetFilteredQuestionsRequest,
  type GetFilteredQuestionsResponse,
  type CountFilteredQuestionsRequest,
  type CountFilteredQuestionsResponse,
} from '@/lib/api/filtered-questions'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_QUESTIONS } from '@/lib/api/rateLimit'
import { logValidationError } from '@/lib/api/validation-error-log'
import { withDbTimeout, isDbTimeoutError, withConnectRetry } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

// maxDuration bajado a 20s tras cascada del 8 may 23:27 UTC (504 a 300s).
// La query analítica de getFilteredQuestions puede ser pesada; 20s da margen.
export const maxDuration = 20

const FILTERED_TIMEOUT_MS = 15000
const COUNT_TIMEOUT_MS = 8000

// TTL stale: 10 min. Cubre blips típicos (5-30s) y los atípicos del 8 may (3 min).
// Más allá de 10 min cachear preguntas tiene riesgo de servir contenido desactualizado
// (preguntas que pasaron a quarantine o fueron retiradas por lifecycle).
const STALE_TTL_S = 10 * 60
// Fresh window solo para count (determinista). 60s.
const COUNT_FRESH_WINDOW_MS = 60 * 1000

interface CachedFilteredResult {
  data: GetFilteredQuestionsResponse
  ts: number
}

interface CachedCountResult {
  data: CountFilteredQuestionsResponse
  ts: number
}

/**
 * Serializa el body validado en un formato canónico (orden de claves fijo,
 * arrays orden-insensibles ordenados) para usar como input del hash de cache key.
 *
 * Cualquier cambio de campo en GetFilteredQuestionsRequest debe reflejarse aquí
 * o tendremos colisiones de cache (dos bodies semánticamente distintos pero con
 * el mismo hash).
 */
function normalizeFilteredBody(b: GetFilteredQuestionsRequest): string {
  const sortedArticlesByLaw: Record<string, Array<number | string>> = {}
  for (const k of Object.keys(b.selectedArticlesByLaw || {}).sort()) {
    sortedArticlesByLaw[k] = [...(b.selectedArticlesByLaw![k] || [])].map(String).sort()
  }
  return JSON.stringify({
    topicNumber: b.topicNumber ?? 0,
    positionType: b.positionType,
    multipleTopics: [...(b.multipleTopics || [])].sort((a, b) => a - b),
    numQuestions: b.numQuestions ?? 25,
    selectedLaws: [...(b.selectedLaws || [])].sort(),
    selectedArticlesByLaw: sortedArticlesByLaw,
    // section filters: array de objetos — JSON.stringify con sort de claves manual
    selectedSectionFilters: (b.selectedSectionFilters || []).map(s => ({
      title: s.title,
      articleRange: s.articleRange,
      sectionNumber: s.sectionNumber,
      sectionType: s.sectionType,
    })),
    onlyOfficialQuestions: !!b.onlyOfficialQuestions,
    includeSharedOfficials: !!b.includeSharedOfficials,
    difficultyMode: b.difficultyMode || 'random',
    excludeRecentDays: b.excludeRecentDays ?? 0,
    focusEssentialArticles: !!b.focusEssentialArticles,
    prioritizeNeverSeen: !!b.prioritizeNeverSeen,
    proportionalByTopic: !!b.proportionalByTopic,
    onlyFailedQuestions: !!b.onlyFailedQuestions,
    failedQuestionIds: [...(b.failedQuestionIds || [])].sort(),
    primaryArticleIds: [...(b.primaryArticleIds || [])].sort(),
  })
}

function normalizeCountBody(b: CountFilteredQuestionsRequest): string {
  const sortedArticlesByLaw: Record<string, Array<number | string>> = {}
  for (const k of Object.keys(b.selectedArticlesByLaw || {}).sort()) {
    sortedArticlesByLaw[k] = [...(b.selectedArticlesByLaw![k] || [])].map(String).sort()
  }
  return JSON.stringify({
    topicNumber: b.topicNumber,
    positionType: b.positionType,
    selectedLaws: [...(b.selectedLaws || [])].sort(),
    selectedArticlesByLaw: sortedArticlesByLaw,
    selectedSectionFilters: (b.selectedSectionFilters || []).map(s => ({
      title: s.title,
      articleRange: s.articleRange,
      sectionNumber: s.sectionNumber,
      sectionType: s.sectionType,
    })),
    onlyOfficialQuestions: !!b.onlyOfficialQuestions,
    includeSharedOfficials: !!b.includeSharedOfficials,
  })
}

function hashKey(normalized: string): string {
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

/** Extract userId from Bearer token (optional — returns null if not authenticated) */
async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return null

    const token = authHeader.split(' ')[1]
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

// ============================================
// POST /api/questions/filtered
// Obtener preguntas filtradas para test
// ============================================
async function _POST(request: NextRequest) {
  // Rate limiting anti-scraping
  const ip = getClientIp(request)
  const rateCheck = checkRateLimit(ip, RATE_LIMIT_QUESTIONS)
  if (!rateCheck.allowed) {
    logValidationError({
      endpoint: '/api/questions/filtered',
      errorType: 'rate_limit',
      errorMessage: `Rate limit exceeded: ${ip}`,
      severity: 'warning',
      httpStatus: 429,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.resetMs / 1000)) } }
    )
  }

  try {
    const body = await request.json()

    // 🔍 DEBUG: Ver qué recibe la API
    console.log('📥 [API/questions/filtered] Request recibido:', {
      selectedLaws: body.selectedLaws,
      selectedArticlesByLaw: body.selectedArticlesByLaw,
      numQuestions: body.numQuestions,
    })

    // Extract userId from auth token (secure, server-side)
    const authUserId = await getOptionalUserId(request)

    // Validar request con Zod. userId SIEMPRE se deriva de la sesión:
    // ignoramos cualquier userId que venga en el body para impedir que un
    // cliente se haga pasar por otra oposición (refactor oposicion-scope).
    const { userId: _clientUserId, ...safeBody } = body ?? {}
    const validation = safeParseGetFilteredQuestions({
      ...safeBody,
      userId: authUserId ?? undefined,
    })
    if (!validation.success) {
      const issues = validation.error?.issues || []
      console.error('❌ Validación fallida:', issues)
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: issues.map((e) => ({
            path: (e.path ?? []).map(String).join('.'),
            message: e.message || 'Error desconocido',
          })),
        },
        { status: 400 }
      )
    }

    // Doble cache key para stale-if-error: per-user (preferida) + global (fallback).
    // En condiciones normales no se lee ninguna; sólo poblamos al éxito.
    // En timeout: per-user → global → 503.
    const bodyHash = hashKey(normalizeFilteredBody(validation.data))
    const cacheKey = `filtered_q:${authUserId ?? 'anon'}:${bodyHash}`
    const cacheKeyGlobal = `filtered_q:any:${bodyHash}`

    try {
      // withConnectRetry: 1 reintento si el primer intento falla con CONNECT_TIMEOUT.
      // Cubre blips <1s del Supavisor regional sin pagar 503. El timeout total
      // sigue acotado por FILTERED_TIMEOUT_MS.
      const result = await withDbTimeout(
        () => withConnectRetry(() => getFilteredQuestions(validation.data)),
        FILTERED_TIMEOUT_MS,
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: result.error?.includes('No se encontró') ? 404 : 400 }
        )
      }

      const response = {
        success: true,
        questions: result.questions,
        totalAvailable: result.totalAvailable,
        filtersApplied: result.filtersApplied,
        ...(result.emptyReason && { emptyReason: result.emptyReason }),
      }

      // Cachear sólo respuestas útiles: éxito + al menos 1 pregunta. Escribimos
      // tanto la per-user como la global. La global permite que durante un blip
      // del pooler, otros usuarios con misma config hereden esta selección
      // (UX inferior — preguntas repetidas — pero ≫ 503). Fire-and-forget.
      if (result.questions && result.questions.length > 0) {
        const cached = { data: response, ts: Date.now() }
        setCached(cacheKey, cached, STALE_TTL_S)
        setCached(cacheKeyGlobal, cached, STALE_TTL_S)
      }

      return NextResponse.json(response)
    } catch (error) {
      // Stale-if-error si timeout O CONNECT_TIMEOUT no recuperable tras retry.
      // (withConnectRetry ya reintentó, si seguimos aquí es blip persistente.)
      const isRecoverable = isDbTimeoutError(error)
      if (isRecoverable) {
        // Per-user primero (UX óptima: la misma selección que vio antes este usuario)
        let cached = await getCached<CachedFilteredResult>(cacheKey)
        let source = 'per-user'
        // Fallback a global (cualquier usuario con esa misma config)
        if (!cached?.data?.success || !cached.data.questions?.length) {
          cached = await getCached<CachedFilteredResult>(cacheKeyGlobal)
          source = 'global'
        }
        if (cached?.data?.success && cached.data.questions && cached.data.questions.length > 0) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/questions/filtered] POST timeout, sirviendo cache stale (${source}, ${ageS}s old)`)
          return NextResponse.json(cached.data)
        }
        console.warn('⏱️ [API/questions/filtered] POST Timeout (quick-fail) sin cache:', error.timeoutMs, 'ms')
        return NextResponse.json(
          { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
          { status: 503, headers: { 'Retry-After': '5' } },
        )
      }
      throw error
    }
  } catch (error) {
    console.error('❌ Error en API /questions/filtered:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// GET /api/questions/filtered/count
// Contar preguntas disponibles (para UI)
// ============================================
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action !== 'count') {
      return NextResponse.json(
        { success: false, error: 'Usa POST para obtener preguntas o GET?action=count para contar' },
        { status: 400 }
      )
    }

    // Parsear parámetros de la URL
    const topicNumber = parseInt(searchParams.get('topicNumber') || '0')
    const positionType = searchParams.get('positionType') || 'auxiliar_administrativo_estado'
    const onlyOfficialQuestions = searchParams.get('onlyOfficialQuestions') === 'true'

    let selectedLaws: string[] = []
    let selectedArticlesByLaw: Record<string, number[]> = {}
    let selectedSectionFilters: unknown[] = []

    try {
      const lawsParam = searchParams.get('selectedLaws')
      if (lawsParam) selectedLaws = JSON.parse(lawsParam)

      const articlesParam = searchParams.get('selectedArticlesByLaw')
      if (articlesParam) selectedArticlesByLaw = JSON.parse(articlesParam)

      const sectionsParam = searchParams.get('selectedSectionFilters')
      if (sectionsParam) selectedSectionFilters = JSON.parse(sectionsParam)
    } catch (parseError) {
      console.error('Error parsing URL params:', parseError)
    }

    // Validar con Zod
    const validation = safeParseCountFilteredQuestions({
      topicNumber,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
    })

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos' },
        { status: 400 }
      )
    }

    // Cache: count es determinista → fast-path fresco (60s) + stale-if-error.
    // Anonymous porque count NO depende del usuario (es global por
    // topic/positionType/filtros). Una sola key — ya es shared por diseño.
    const cacheKey = `filtered_q_count:${hashKey(normalizeCountBody(validation.data))}`
    const cached = await getCached<CachedCountResult>(cacheKey)

    if (cached && Date.now() - cached.ts < COUNT_FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data)
    }

    try {
      // withConnectRetry: 1 reintento si CONNECT_TIMEOUT (blip <1s del pooler regional)
      const result = await withDbTimeout(
        () => withConnectRetry(() => countFilteredQuestions(validation.data)),
        COUNT_TIMEOUT_MS,
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        )
      }

      const response = {
        success: true as const,
        count: result.count,
        byLaw: result.byLaw,
      }

      setCached(cacheKey, { data: response, ts: Date.now() }, STALE_TTL_S)

      return NextResponse.json(response)
    } catch (error) {
      if (isDbTimeoutError(error)) {
        // Stale-if-error: cache de cualquier antigüedad mejor que 503.
        if (cached?.data?.success) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/questions/filtered] GET count timeout, sirviendo cache stale (${ageS}s old)`)
          return NextResponse.json(cached.data)
        }
        console.warn('⏱️ [API/questions/filtered] GET Timeout (quick-fail) sin cache:', error.timeoutMs, 'ms')
        return NextResponse.json(
          { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
          { status: 503, headers: { 'Retry-After': '5' } },
        )
      }
      throw error
    }
  } catch (error) {
    console.error('❌ Error en API /questions/filtered (count):', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/questions/filtered', _POST)
export const GET = withErrorLogging('/api/questions/filtered', _GET)
