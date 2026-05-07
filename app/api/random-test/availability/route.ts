// app/api/random-test/availability/route.ts - API para verificar disponibilidad de preguntas
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { checkQuestionAvailability } from '@/lib/api/random-test/queries'
import {
  safeParseCheckAvailability,
  type AvailabilityResponse,
} from '@/lib/api/random-test/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'

// ============================================
// Cache in-memory por instancia Vercel Fluid (TTL 60s)
// ============================================
// La query subyacente tarda ~600ms en plan optimo y los inputs (oposicion,
// themes, difficulty, flags) son combinaciones limitadas que se repiten
// dentro de cada burst de configuracion. Sin cache, durante un pico de
// concurrencia las requests se serializan en pool max:1 → timeouts 30s+
// (ver validation_error_logs: 14 critical en 24h con duraciones 60-163s).
// Con cache, requests del mismo input dentro de 60s no tocan BD.
// Tras Fase 1 (Redis) este cache se promueve a L2 compartido entre instancias.
const CACHE_TTL_MS = 60_000
type CachedAvailability = { total: number; neverSeen: number; byTheme: Record<string, number> }
const cache = new Map<string, { value: CachedAvailability; expiresAt: number }>()

function getCacheKey(body: Record<string, unknown>): string {
  // Hash determinista del body con keys ordenadas (mismo input = misma key)
  const sortedKeys = Object.keys(body).sort()
  const normalized: Record<string, unknown> = {}
  for (const k of sortedKeys) {
    const v = body[k]
    // Arrays como selectedThemes: ordenar para que [1,2,3] === [3,2,1]
    normalized[k] = Array.isArray(v) ? [...v].sort() : v
  }
  return crypto.createHash('sha1').update(JSON.stringify(normalized)).digest('hex')
}

function pruneCacheIfNeeded(): void {
  // Cap simple: si supera 500 entries, eliminar las expiradas
  if (cache.size <= 500) return
  const now = Date.now()
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k)
  }
}

async function _POST(request: NextRequest): Promise<NextResponse<AvailabilityResponse>> {
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

    // Cache lookup. La cache key incluye el body completo (incluyendo userId
    // cuando se pasa), por lo que el conteo neverSeen queda aislado por usuario.
    const key = getCacheKey(parseResult.data as unknown as Record<string, unknown>)
    const cached = cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({
        success: true,
        availableQuestions: cached.value.total,
        availableNeverSeen: cached.value.neverSeen,
        byTheme: cached.value.byTheme,
      })
    }

    // Cache miss: query BD y guardar
    const availability = await checkQuestionAvailability(parseResult.data)
    cache.set(key, {
      value: {
        total: availability.total,
        neverSeen: availability.neverSeen,
        byTheme: availability.byTheme,
      },
      expiresAt: Date.now() + CACHE_TTL_MS,
    })
    pruneCacheIfNeeded()

    return NextResponse.json({
      success: true,
      availableQuestions: availability.total,
      availableNeverSeen: availability.neverSeen,
      byTheme: availability.byTheme,
    })
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
