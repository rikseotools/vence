// app/api/questions/filtered/route.ts - API para obtener preguntas filtradas
// Usa Drizzle ORM + Zod para validación tipada
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getFilteredQuestions,
  countFilteredQuestions,
  safeParseGetFilteredQuestions,
  safeParseCountFilteredQuestions,
} from '@/lib/api/filtered-questions'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { checkRateLimit, getClientIp, RATE_LIMIT_QUESTIONS } from '@/lib/api/rateLimit'
import { logValidationError } from '@/lib/api/validation-error-log'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

// maxDuration bajado a 20s tras cascada del 8 may 23:27 UTC (504 a 300s).
// La query analítica de getFilteredQuestions puede ser pesada; 20s da margen.
export const maxDuration = 20

const FILTERED_TIMEOUT_MS = 15000
const COUNT_TIMEOUT_MS = 8000

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

    // Obtener preguntas filtradas via Drizzle (con quick-fail)
    const result = await withDbTimeout(
      () => getFilteredQuestions(validation.data),
      FILTERED_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.error?.includes('No se encontró') ? 404 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      questions: result.questions,
      totalAvailable: result.totalAvailable,
      filtersApplied: result.filtersApplied,
      ...(result.emptyReason && { emptyReason: result.emptyReason }),
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/questions/filtered] POST Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
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

    // Contar preguntas via Drizzle (con quick-fail)
    const result = await withDbTimeout(
      () => countFilteredQuestions(validation.data),
      COUNT_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      count: result.count,
      byLaw: result.byLaw,
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/questions/filtered] GET Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    console.error('❌ Error en API /questions/filtered (count):', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/questions/filtered', _POST)
export const GET = withErrorLogging('/api/questions/filtered', _GET)
