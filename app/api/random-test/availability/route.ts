// app/api/random-test/availability/route.ts - API para verificar disponibilidad de preguntas
//
// Estrategia de cache (refactor 2026-05-11 — cierre stale-if-error sprint):
// Promovido de cache in-memory por-lambda a Redis L2 compartido. Antes cada
// lambda Vercel Fluid tenía su propio Map → cold starts y bursts de scaling
// generaban repeated misses. Con Redis: una lambda calcula, las demás reusan.
//
// Patrón: fresh + stale-if-error (RFC 5861), mismo que weak-articles y
// theme-stats:
// - Cache fresco (<60s) → devolver inmediato sin tocar BD
// - Cache stale + BD OK → refresh y devolver
// - Cache stale + BD timeout → devolver stale (200, NO 503) ← el fix
// - Cache vacío + BD timeout → 503 retryable (igual que antes)
//
// La query subyacente tarda ~600ms en plan óptimo y los inputs (oposicion,
// themes, difficulty, flags) son combinaciones limitadas que se repiten
// dentro de cada burst de configuración del cliente.
//
// Cache key: random_avail:{sha1(body)} (mismo hash determinista que antes,
// keys ordenadas + arrays sorted para que [1,2,3] === [3,2,1]).

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { checkQuestionAvailability } from '@/lib/api/random-test/queries'
import {
  safeParseCheckAvailability,
  type AvailabilityResponse,
} from '@/lib/api/random-test/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
// maxDuration bajado a 15s tras cascada del 8 may 23:27 UTC (504 ×3 simultáneos
// en blip pool). La query subyacente normalmente <600ms, 15s da margen amplio.
export const maxDuration = 15

const AVAILABILITY_TIMEOUT_MS = 12000

// Fresh window: 60s — dentro de esta ventana se sirve cache sin tocar BD.
// Stale TTL: 24h — fallback en blip pooler (siguiente request lo refresca).
const FRESH_WINDOW_MS = 60 * 1000
const STALE_TTL_S = 24 * 60 * 60

type CachedAvailability = { total: number; neverSeen: number; byTheme: Record<string, number> }
interface CachedEntry {
  value: CachedAvailability
  ts: number  // ms epoch — usado para freshness check
}

function getCacheKey(body: Record<string, unknown>): string {
  // Hash determinista del body con keys ordenadas (mismo input = misma key)
  const sortedKeys = Object.keys(body).sort()
  const normalized: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    const v = body[k]
    // Arrays como selectedThemes: ordenar para que [1,2,3] === [3,2,1]
    normalized[k] = Array.isArray(v) ? [...v].sort() : v
  }
  const hash = crypto.createHash('sha1').update(JSON.stringify(normalized)).digest('hex')
  return `random_avail:${hash}`
}

async function _POST(request: NextRequest): Promise<NextResponse<AvailabilityResponse>> {
  let cacheKey: string | null = null

  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = safeParseCheckAvailability(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        availableQuestions: 0,
        error: parseResult.error.issues.map(e => e.message).join(', '),
      }, { status: 400 })
    }

    // Cache key estable. Incluye body completo (incl. userId si presente),
    // por lo que neverSeen queda aislado por usuario.
    cacheKey = getCacheKey(parseResult.data as unknown as Record<string, unknown>)
    const cached = await getCached<CachedEntry>(cacheKey)

    // Fast path: cache fresco (<60s) → devolver sin tocar BD
    if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json({
        success: true,
        availableQuestions: cached.value.total,
        availableNeverSeen: cached.value.neverSeen,
        byTheme: cached.value.byTheme,
      })
    }

    try {
      const availability = await withDbTimeout(
        () => checkQuestionAvailability(parseResult.data),
        AVAILABILITY_TIMEOUT_MS,
      )
      const value: CachedAvailability = {
        total: availability.total,
        neverSeen: availability.neverSeen,
        byTheme: availability.byTheme,
      }
      // Fire-and-forget — Redis lento NO bloquea al usuario
      setCached(cacheKey, { value, ts: Date.now() }, STALE_TTL_S)

      return NextResponse.json({
        success: true,
        availableQuestions: availability.total,
        availableNeverSeen: availability.neverSeen,
        byTheme: availability.byTheme,
      })
    } catch (innerError) {
      if (isDbTimeoutError(innerError)) {
        // Stale-if-error: si tenemos cache (cualquier antigüedad <24h),
        // servir stale en lugar de 503. Mejor UX en blip pooler regional.
        if (cached?.value) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/random-test/availability] timeout, sirviendo cache stale (${ageS}s old)`)
          return NextResponse.json({
            success: true,
            availableQuestions: cached.value.total,
            availableNeverSeen: cached.value.neverSeen,
            byTheme: cached.value.byTheme,
          })
        }
        console.warn(`⏱️ [API/random-test/availability] Timeout sin cache: ${innerError.timeoutMs}ms`)
        return NextResponse.json({
          success: false,
          availableQuestions: 0,
          error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.',
        }, { status: 503, headers: { 'Retry-After': '300' } })
      }
      throw innerError
    }
  } catch (error) {
    console.error('❌ [API/random-test/availability] Error:', error)
    return NextResponse.json({
      success: false,
      availableQuestions: 0,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/random-test/availability', _POST)
