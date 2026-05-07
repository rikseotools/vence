// app/api/notifications/problematic-articles/route.ts
// Endpoint tipado que reemplaza la llamada a la RPC
// get_user_problematic_articles_weekly (ver FASE 4 del refactor oposicion-scope).
//
// userId SIEMPRE deriva de la sesión autenticada — nunca del cliente —
// para impedir cross-oposición leakage.
//
// Estrategia de cache (refactor 2026-05-07): stale-while-error con Redis,
// mismo patrón que /api/v2/topic-progress/theme-stats. Antes usaba
// unstable_cache que en cache miss + BD timeout propagaba error → 503.
// Ahora:
//   - Cache fresco (<5 min) → devolver inmediato sin tocar BD
//   - Cache stale + BD OK → refresh y devolver
//   - Cache stale + BD timeout → devolver stale (200, mejor que pantalla vacía)
//   - Cache vacío + BD timeout → devolver [] (200, no 503)
// Resultado observado en theme-stats: 0 errores 5xx incluso en pool blips.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import {
  getUserProblematicArticlesWeekly,
  type ProblematicArticle,
} from '@/lib/api/notifications/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { logRolloutEvent } from '@/lib/api/rollout/problematic-articles-logs'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'
import { getCached, setCached } from '@/lib/cache/redis'

export const dynamic = 'force-dynamic'

interface CachedProblematic {
  data: ProblematicArticle[]
  ts: number  // ms epoch — usado para freshness check, NO Redis TTL
}

const FRESH_WINDOW_MS = 5 * 60 * 1000   // 5 min: dentro de esta ventana es fresh
const STALE_TTL_S = 24 * 60 * 60        // 24h: cuánto retiene Redis (fallback en timeout)
const BD_TIMEOUT_MS = 10_000            // 10s: tope query BD; si excede, fallback a stale

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const startedAt = Date.now()
  const cacheKey = `problematic_articles:${auth.user.id}`
  const cached = await getCached<CachedProblematic>(cacheKey)

  // Fast path: cache fresco (<5min) → devolver sin tocar BD
  if (cached && Date.now() - cached.ts < FRESH_WINDOW_MS) {
    return NextResponse.json({ success: true, articles: cached.data })
  }

  try {
    const queryPromise = getUserProblematicArticlesWeekly({ userId: auth.user.id })
    const articles = await Promise.race([
      queryPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('problematic-articles timeout')), BD_TIMEOUT_MS)
      ),
    ])

    // Guardar en Redis con TTL 24h y timestamp para freshness check
    setCached(cacheKey, { data: articles, ts: Date.now() }, STALE_TTL_S)

    // Log fire-and-forget para el panel admin de rollout
    const scope = await getAllowedLawIds({ userId: auth.user.id }).catch(() => null)
    logRolloutEvent({
      userId: auth.user.id,
      positionType: scope?.positionType ?? null,
      path: 'new',
      articlesCount: articles.length,
      lawNames: articles.map((a) => a.law_name),
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({ success: true, articles })
  } catch (err) {
    // Timeout o error BD: devolver cache stale si existe (mejor que pantalla vacía).
    if (cached) {
      const ageS = Math.floor((Date.now() - cached.ts) / 1000)
      console.warn(`⏱️ [problematic-articles] timeout for ${auth.user.id.slice(0, 8)}, returning stale cache (${ageS}s old)`)
      return NextResponse.json({ success: true, articles: cached.data })
    }

    console.warn(`⏱️ [problematic-articles] timeout for ${auth.user.id.slice(0, 8)}, returning empty`)
    return NextResponse.json({ success: true, articles: [] })
  }
}

export const GET = withErrorLogging('/api/notifications/problematic-articles', _GET)
