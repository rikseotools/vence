// app/api/medals/route.ts - API endpoint para medallas de ranking
//
// Estrategia de contención (2026-05-11 — incidente statement_timeout):
// GET es cache-first en Redis. Si hay cache fresco, no toca BD. En miss lee
// medallas ya guardadas en user_medals (lookup por user_id) y conserva
// stale-if-error como fallback.
// GET nunca recalcula ranking; el cálculo pesado solo ocurre en POST y cachea
// el ranking de período en Redis. Se puede cortar con
// MEDALS_RUNTIME_RECALC_ENABLED=false hasta moverlo a job/materialización.
//
// Comportamiento GET:
// - Cache fresco → devuelve desde Redis sin tocar BD
// - Cache miss/stale → intenta lectura ligera de user_medals
// - Éxito BD → guarda en cache + devuelve fresco
// - Timeout BD → sirve cache stale (200) en lugar de 503
// - Sin cache + timeout → 503 retryable (igual que antes)
//
// POST verifica nuevas medallas tras completar test. Si el feature flag se
// desactiva o hay timeout, no bloquea navegación ni invalida cache.
//
// Cache key: medals:{userId}

import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
  getUserMedals,
  checkAndSaveNewMedals,
  type GetMedalsResponse,
} from '@/lib/api/medals'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached, invalidate } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Quick-fail timeouts (Phase 3)
const READ_TIMEOUT_MS = 3000
const WRITE_TIMEOUT_MS = 15000  // checkAndSaveNewMedals hace SELECT + N inserts

// Fresh window: 6h. Medallas/ranking no necesitan precisión en cada navegación.
// Stale TTL: 24h. Suficiente para sobrevivir blips largos del pooler.
const FRESH_WINDOW_MS = 6 * 60 * 60 * 1000
const STALE_TTL_S = 24 * 60 * 60

interface CachedMedals {
  data: GetMedalsResponse
  ts: number  // timestamp para debugging (no usado en lógica)
}

function timeoutResponse() {
  return NextResponse.json(
    { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
    { status: 503, headers: { 'Retry-After': '300' } },
  )
}

// ============================================
// GET: Obtener medallas del usuario
// ============================================

async function _GET(request: NextRequest) {
  let cacheKey: string | null = null

  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    const parseResult = safeParseGetMedalsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    cacheKey = `medals:${parseResult.data.userId}`
    const cached = await getCached<CachedMedals>(cacheKey)

    if (cached?.data?.success && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'x-medals-cache': 'hit',
        },
      })
    }

    try {
      const result = await withDbTimeout(
        () => getUserMedals(parseResult.data.userId),
        READ_TIMEOUT_MS,
      )

      // Cachear solo si éxito + datos válidos. Fire-and-forget (Redis no
      // bloquea respuesta). Sirve de fallback para próximo blip de pooler.
      if (result && result.success) {
        setCached(cacheKey, { data: result, ts: Date.now() }, STALE_TTL_S)
      }

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    } catch (innerError) {
      if (isDbTimeoutError(innerError)) {
        // Stale-if-error: si tenemos cache (cualquier antigüedad <24h),
        // servir stale en lugar de 503. Mejor UX que blip → 503 visible.
        if (cached?.data?.success) {
          const ageS = Math.floor((Date.now() - cached.ts) / 1000)
          console.warn(`⏱️ [API/medals GET] timeout, sirviendo cache stale (${ageS}s old) para user ${parseResult.data.userId.slice(0, 8)}`)
          return NextResponse.json(cached.data, {
            headers: {
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          })
        }
        console.warn(`⏱️ [API/medals GET] Timeout (quick-fail) sin cache: ${innerError.timeoutMs}ms`)
        return timeoutResponse()
      }
      throw innerError
    }
  } catch (error) {
    console.error('❌ [API/medals] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Verificar y guardar medallas nuevas
// ============================================

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parseResult = safeParseCheckMedalsRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId invalido o faltante' },
        { status: 400 }
      )
    }

    const result = await withDbTimeout(
      () => checkAndSaveNewMedals(parseResult.data.userId),
      WRITE_TIMEOUT_MS,
    )

    // Write-through: si el POST modificó algo (nueva medalla ganada), invalidar
    // cache para que el próximo GET vea los datos frescos. Sin esto, el user
    // podría ver hasta 24h de stale tras ganar una medalla durante un blip.
    if (result && result.success) {
      invalidate(`medals:${parseResult.data.userId}`).catch(() => {
        // Si falla invalidate, no es crítico — eventualmente la cache caducará
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/medals POST] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return timeoutResponse()
    }
    console.error('❌ [API/medals] Error POST:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/medals', _GET)
export const POST = withErrorLogging('/api/medals', _POST)
