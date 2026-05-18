// app/api/daily-limit/route.ts
// Returns the user's current daily limit status including graduated limits.
// Called by the client hook to get the personalized limit.
//
// Estrategia de cache (2026-05-18): stale-while-error con Redis, mismo
// patrón que /api/medals y /api/notifications/problematic-articles. El
// endpoint se llama en CADA page load del usuario logueado — antes era
// expuesto al cascade del pooler (8 ocurrencias 503 en 24h en logs).
//
// IMPORTANTE: el endpoint que se llama desde /api/v2/answer-and-save usa
// getDailyLimitStatus() DIRECTAMENTE sin pasar por este cache. El anti-
// fraud se mantiene estricto en el path de escritura (insert real). Aquí
// solo cacheamos el GET informativo que muestra "te quedan X preguntas".
//
// Trade-off: usuario free con 24/25 preguntas que recarga puede ver "24"
// durante 30s aunque haya respondido 1 más en otra pestaña. Aceptable —
// el contador real lo decide BD al hacer answer-and-save.
import { NextRequest, NextResponse } from 'next/server'
import { getUserIdFromToken, getDailyLimitStatus } from '@/lib/api/dailyLimit'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'
import { getCached, setCached } from '@/lib/cache/redis'

interface DailyLimitResponse {
  questionsToday: number
  questionsRemaining: number
  dailyLimit: number
  isLimitReached: boolean
  isPremium: boolean
  isGraduated: boolean
  tierLabel: string | null
}

interface CachedDailyLimit {
  data: DailyLimitResponse
  ts: number // ms epoch — usado para freshness check, NO Redis TTL
}

// Fresh: 30s. El daily count cambia con cada answer del user, así que
// preferimos refrescar a menudo. Suficiente para reducir queries en 90%+
// (un user que carga 3 páginas en 30s = 1 query BD en lugar de 3).
const FRESH_WINDOW_MS = 30 * 1000

// Stale: 24h. Suficiente para sobrevivir blips largos del pooler.
const STALE_TTL_S = 24 * 60 * 60

// Timeout BD bajado de 8s → 5s. Con cache stale como red de seguridad
// no necesitamos esperar tanto; el quick-fail más temprano libera la
// lambda y devuelve stale (mejor UX que 503).
const DAILY_LIMIT_TIMEOUT_MS = 5000

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromToken(request)

    if (!userId) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const cacheKey = `daily_limit:${userId}`
    const cached = await getCached<CachedDailyLimit>(cacheKey)

    // Fast path: cache fresco (<30s) → devolver sin tocar BD
    if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'x-daily-limit-cache': 'hit',
        },
      })
    }

    // Cache miss/stale → consultar BD con quick-fail
    try {
      const status = await withDbTimeout(
        () => getDailyLimitStatus(userId),
        DAILY_LIMIT_TIMEOUT_MS,
      )

      const response: DailyLimitResponse = {
        questionsToday: status.questionsToday,
        questionsRemaining: status.questionsRemaining,
        dailyLimit: status.dailyLimit,
        isLimitReached: !status.allowed,
        isPremium: status.isPremium,
        isGraduated: status.isGraduated,
        tierLabel: status.tierLabel,
      }

      // Fire-and-forget cache write — no bloquea respuesta.
      setCached(cacheKey, { data: response, ts: Date.now() }, STALE_TTL_S).catch(() => {})

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'x-daily-limit-cache': cached ? 'refresh' : 'miss',
        },
      })
    } catch (err) {
      // Si BD timeout y tenemos stale → devolver stale (200) en lugar de 503.
      // Mejor mostrar contador algo desactualizado que pantalla vacía.
      if (isDbTimeoutError(err) && cached) {
        console.warn(
          `⏱️ [API/daily-limit] BD timeout — sirviendo stale (${Math.round((Date.now() - cached.ts) / 1000)}s old)`,
        )
        return NextResponse.json(cached.data, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'x-daily-limit-cache': 'stale',
          },
        })
      }
      // Sin stale → propagar para el handler 503 de abajo
      throw err
    }
  } catch (err) {
    if (isDbTimeoutError(err)) {
      console.warn('⏱️ [API/daily-limit] Timeout (quick-fail) sin cache:', err.timeoutMs, 'ms')
      return NextResponse.json(
        { error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
        { status: 503, headers: { 'Retry-After': '300' } },
      )
    }
    console.error('❌ [API/daily-limit] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
