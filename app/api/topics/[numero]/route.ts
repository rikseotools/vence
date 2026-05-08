// app/api/topics/[numero]/route.ts - API endpoint para datos de tema
//
// Estrategia de cache (refactor 2026-05-08): stale-while-error con Redis,
// mismo patrón que /api/v2/topic-progress/theme-stats y
// /api/notifications/problematic-articles.
//
// - Cache fresco (<5min) → devolver inmediato sin tocar BD
// - Cache stale + BD OK → refresh y devolver
// - Cache stale + BD timeout → devolver stale (200, mejor que 503)
// - Cache vacío + BD timeout → 503 retryable (comportamiento histórico)
//
// El fix elimina el 503 user-facing en el caso "cache hit stale + blip pool"
// SIN cambiar el comportamiento del caso "cache vacío + blip" (sigue 503).
// Como la mayoría de usuarios revisitan los mismos topics, el cache se llena
// rápido y la cobertura efectiva es alta. La función getTopicFullData queda
// intacta — el cache es una capa por encima.
import { NextRequest, NextResponse } from 'next/server'
import { getTopicFullData } from '@/lib/api/topic-data'
import {
  safeParseGetTopicDataRequest,
  isValidTopicNumber,
  type OposicionKey,
  type GetTopicDataResponse,
} from '@/lib/api/topic-data'
import { ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'

// Quick-fail timeout 12s — getTopicFullData hace varias queries
// (topic_scope + counts + per-user analytics si hay userId). 12s da
// margen para la versión per-user; en cascada del 5 may aparecía
// /api/topics/12 y /api/topics/105 entre los 504s.
const TOPIC_TIMEOUT_MS = 12000

interface CachedTopicData {
  data: GetTopicDataResponse
  ts: number  // ms epoch — usado para freshness check, NO Redis TTL
}

const FRESH_WINDOW_MS = 5 * 60 * 1000   // 5 min: dentro de esta ventana es fresh
const STALE_TTL_S = 24 * 60 * 60        // 24h: cuánto retiene Redis (fallback en timeout)

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await params
    const searchParams = request.nextUrl.searchParams
    const oposicion = searchParams.get('oposicion') as OposicionKey
    const userId = searchParams.get('userId')

    // Validar número de tema
    const topicNumber = parseInt(numero, 10)
    if (isNaN(topicNumber)) {
      return NextResponse.json(
        { success: false, error: 'Número de tema inválido' },
        { status: 400 }
      )
    }

    // Validar oposición
    if (!oposicion || !ALL_OPOSICION_SLUGS.includes(oposicion)) {
      return NextResponse.json(
        { success: false, error: 'Oposición no válida' },
        { status: 400 }
      )
    }

    // Validar que el tema existe para la oposición
    if (!isValidTopicNumber(topicNumber, oposicion)) {
      return NextResponse.json(
        { success: false, error: `Tema ${topicNumber} no válido para ${oposicion}` },
        { status: 400 }
      )
    }

    // Validar request completo con Zod
    const parseResult = safeParseGetTopicDataRequest({
      topicNumber,
      oposicion,
      userId: userId || null,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    const cacheKey = `topic_data:${oposicion}:${topicNumber}:${userId || 'anon'}`
    const cached = await getCached<CachedTopicData>(cacheKey)

    // Fast path: cache fresco (<5min) → devolver sin tocar BD
    if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data)
    }

    try {
      // Obtener datos del tema con quick-fail
      const result = await withDbTimeout(
        () => getTopicFullData(
          parseResult.data.topicNumber,
          parseResult.data.oposicion as OposicionKey,
          parseResult.data.userId
        ),
        TOPIC_TIMEOUT_MS,
      )

      if (!result.success) {
        // Topic no encontrado u otro error de la query — NO cachear, NO usar stale
        return NextResponse.json(result, { status: 404 })
      }

      // Guardar en Redis con TTL 24h y timestamp para freshness check
      setCached(cacheKey, { data: result, ts: Date.now() }, STALE_TTL_S)

      return NextResponse.json(result)
    } catch (err) {
      // Timeout o error BD: si tenemos cache (aun si stale), devolverlo;
      // mejor servir datos viejos que 503. Si no hay cache, fallback al
      // comportamiento histórico (503 retryable).
      if (cached && cached.data?.success) {
        const ageS = Math.floor((Date.now() - cached.ts) / 1000)
        const tag = topicNumber + ':' + (userId?.slice(0, 8) ?? 'anon')
        console.warn(`⏱️ [API/topics] timeout for ${tag}, returning stale cache (${ageS}s old)`)
        return NextResponse.json(cached.data)
      }

      if (isDbTimeoutError(err)) {
        console.warn('⏱️ [API/topics] Timeout (quick-fail) — sin cache, devolviendo 503:', err.timeoutMs, 'ms')
        return NextResponse.json(
          { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
          { status: 503, headers: { 'Retry-After': '5' } },
        )
      }
      throw err  // propaga al outer catch
    }
  } catch (error) {
    console.error('Error en API /api/topics/[numero]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/topics/[numero]', _GET)
