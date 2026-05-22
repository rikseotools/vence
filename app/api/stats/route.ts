// app/api/stats/route.ts - API de estadísticas
//
// Estrategia de contención (2026-05-22 — incidente cascada statement_timeout):
// Antes el endpoint no tenía caché (CACHE_TTL=0 en queries.ts) ni quick-fail:
// cada hit corría 10 queries en paralelo, 4 de ellas full-scan de
// test_questions del usuario. Para heavy users → statement_timeout → 500
// crudo + presión de pool que cascadea a otros endpoints.
//
// Patrón fresh + stale-if-error (igual que /api/medals y
// /api/random-test/availability):
// - Cache fresco (<5min) → devuelve desde Redis sin tocar BD
// - Cache miss/stale → calcula con quick-fail timeout
// - Fallo/timeout BD + hay cache → sirve stale (200) en vez de 500
// - Fallo/timeout BD + sin cache → 503 retryable
//
// Cache key: stats:{userId}

import { NextRequest, NextResponse } from 'next/server'
import { getUserStats, safeParseGetUserStatsRequest } from '@/lib/api/stats'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
export const revalidate = 0
// Bajado de 300s: con caché la respuesta es inmediata y el cálculo no debe
// ocupar una lambda más de 15s.
export const maxDuration = 15

// Quick-fail: las 10 queries deberían completar muy por debajo de esto.
const READ_TIMEOUT_MS = 10000
// Fresh window: 5 min — un dashboard de stats no necesita precisión al segundo.
// Stale TTL: 24h — fallback ante blips largos del pooler.
const FRESH_WINDOW_MS = 5 * 60 * 1000
const STALE_TTL_S = 24 * 60 * 60

type StatsResponse = Awaited<ReturnType<typeof getUserStats>>
interface CachedStats {
  data: StatsResponse
  ts: number
}

async function _GET(request: NextRequest) {
  let cacheKey: string | null = null

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request
    const parseResult = safeParseGetUserStatsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    cacheKey = `stats:${parseResult.data.userId}`
    const cached = await getCached<CachedStats>(cacheKey)

    // Fast path: cache fresco (<5min) → devolver sin tocar BD
    if (cached?.data?.success && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'no-store', 'x-stats-cache': 'hit' },
      })
    }

    try {
      const stats = await withDbTimeout(
        () => getUserStats(parseResult.data.userId),
        READ_TIMEOUT_MS,
      )

      if (stats.success) {
        // Fire-and-forget — Redis lento NO bloquea la respuesta
        setCached(cacheKey, { data: stats, ts: Date.now() }, STALE_TTL_S)
        return NextResponse.json(stats, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }

      // getUserStats captura sus errores internamente y devuelve success:false
      // (p.ej. una query agotó statement_timeout). Stale-if-error: si hay
      // cache de cualquier antigüedad <24h, servirla en vez de un 500.
      if (cached?.data?.success) {
        console.warn(`⏱️ [API/stats] cálculo falló, sirviendo cache stale para user ${parseResult.data.userId.slice(0, 8)}`)
        return NextResponse.json(cached.data, {
          headers: { 'Cache-Control': 'no-store' },
        })
      }
      return NextResponse.json(stats, { status: 500 })
    } catch (innerError) {
      if (isDbTimeoutError(innerError)) {
        // Stale-if-error en timeout duro (getUserStats colgado).
        if (cached?.data?.success) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/stats] timeout, sirviendo cache stale (${ageS}s old) para user ${parseResult.data.userId.slice(0, 8)}`)
          return NextResponse.json(cached.data, {
            headers: { 'Cache-Control': 'no-store' },
          })
        }
        console.warn(`⏱️ [API/stats] Timeout (quick-fail) sin cache: ${innerError.timeoutMs}ms`)
        return NextResponse.json(
          { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
          { status: 503, headers: { 'Retry-After': '300' } },
        )
      }
      throw innerError
    }
  } catch (error) {
    console.error('Error en API de estadísticas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/stats', _GET)
