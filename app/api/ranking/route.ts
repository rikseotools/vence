// app/api/ranking/route.ts - API endpoint para ranking
//
// Estrategia de cache (2026-05-15 — incidente blip pooler 14 may 15:48-15:52):
// Redis L2 con fresh-window 60s + stale-if-error 24h, mismo patrón que
// /api/medals (046456f3) y /api/random-test/availability (e2ce0dc4).
//
// Antes: cache in-memory por-lambda en lib/api/ranking/queries.ts (rankingCache).
// Cada lambda Vercel Fluid tenía su propio Map → cold starts y nuevas instancias
// siempre iban a BD. Durante el blip del 14 may saturó 18 veces en 5 min.
//
// Ahora: cache compartido entre lambdas. Cache-first → si fresco (<60s) no toca
// BD. Si miss/stale → BD con timeout 12s. Si BD timeout y hay cache (<24h) →
// servir stale (200) en vez de 503. Sin cache + timeout → 503 (igual que antes).
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetRankingRequest,
  getRanking,
  type GetRankingResponse,
} from '@/lib/api/ranking'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Quick-fail timeout 12s — getRanking hace aggregation sobre user_profiles
// + test_questions. Apareció en el cascade del 5 may.
const RANKING_TIMEOUT_MS = 12000

// Fresh window 60s coincide con el cache CDN (s-maxage=60) y con el rankingCache
// in-memory existente. Stale 24h da margen para sobrevivir blips largos.
const FRESH_WINDOW_MS = 60 * 1000
const STALE_TTL_S = 24 * 60 * 60

interface CachedRanking {
  data: GetRankingResponse
  ts: number
}

// ============================================
// GET: Obtener ranking
// ============================================

async function _GET(request: NextRequest) {
  let cacheKey: string | null = null

  try {
    const { searchParams } = new URL(request.url)
    const timeFilter = searchParams.get('timeFilter')
    const userId = searchParams.get('userId') || undefined
    const minQuestions = searchParams.get('minQuestions')
      ? Number(searchParams.get('minQuestions'))
      : undefined
    const limit = searchParams.get('limit')
      ? Number(searchParams.get('limit'))
      : undefined
    const offset = searchParams.get('offset')
      ? Number(searchParams.get('offset'))
      : undefined

    // Validar request con Zod
    const parseResult = safeParseGetRankingRequest({
      timeFilter,
      userId,
      minQuestions,
      limit,
      offset,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parametros invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    cacheKey = `ranking:${parseResult.data.timeFilter}:${parseResult.data.minQuestions ?? 5}:${parseResult.data.limit ?? 50}:${parseResult.data.offset ?? 0}:${parseResult.data.userId ?? 'anon'}`
    const cached = await getCached<CachedRanking>(cacheKey)

    // Fast path: cache fresco (<60s) → devolver sin tocar BD
    if (cached?.data?.success && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      })
    }

    try {
      const result = await withDbTimeout(
        () => getRanking(parseResult.data),
        RANKING_TIMEOUT_MS,
      )

      // Cachear solo si éxito + datos válidos. Fire-and-forget (Redis no
      // bloquea respuesta). Sirve de fallback para próximo blip de pooler.
      if (result?.success) {
        setCached(cacheKey, { data: result, ts: Date.now() }, STALE_TTL_S)
      }

      if (!result.success) {
        return NextResponse.json(result, { status: 500 })
      }

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        },
      })
    } catch (innerError) {
      if (isDbTimeoutError(innerError)) {
        // Stale-if-error: si tenemos cache (cualquier antigüedad <24h),
        // servir stale en lugar de 503. No-store para que el CDN no propague
        // el stale fuera del momento del blip.
        if (cached?.data?.success) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/ranking] timeout, sirviendo cache stale (${ageS}s old) key=${cacheKey}`)
          return NextResponse.json(cached.data, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          })
        }
        console.warn('⏱️ [API/ranking] Timeout (quick-fail) sin cache:', innerError.timeoutMs, 'ms')
        return NextResponse.json(
          { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
          { status: 503, headers: { 'Retry-After': '300' } },
        )
      }
      throw innerError
    }
  } catch (error) {
    console.error('❌ [API/ranking] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/ranking', _GET)
