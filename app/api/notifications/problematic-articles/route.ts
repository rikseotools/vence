// app/api/notifications/problematic-articles/route.ts
// Endpoint tipado que reemplaza la llamada a la RPC
// get_user_problematic_articles_weekly (ver FASE 4 del refactor oposicion-scope).
//
// userId SIEMPRE deriva de la sesión autenticada — nunca del cliente —
// para impedir cross-oposición leakage.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserProblematicArticlesWeeklyCached } from '@/lib/api/notifications/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { logRolloutEvent } from '@/lib/api/rollout/problematic-articles-logs'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

// Cache server-side per-userId (TTL 5min) introducido 2026-05-07.
// Cache key incluye userId automáticamente vía args de la función — sin
// cross-oposición leakage porque userId viene del Bearer token (auth, no
// body). Bajo blip del pooler, el cache responde sin tocar BD.
// force-dynamic en route es correcto: auth check ocurre en cada request,
// el cache aplica sólo a la query de BD.
export const dynamic = 'force-dynamic'

// Timeout 10s — la query es analítica (computa weekly performance) y más
// pesada que profile/daily-limit. 10s da margen suficiente para casos
// normales y aún corta antes del statement_timeout=30s del DSN.
// Solo aplica en cache miss; en hit el response es instantáneo.
const PROBLEMATIC_TIMEOUT_MS = 10000

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const startedAt = Date.now()
  try {
    const articles = await withDbTimeout(
      () => getUserProblematicArticlesWeeklyCached({ userId: auth.user.id }),
      PROBLEMATIC_TIMEOUT_MS,
    )

    // Log fire-and-forget para el panel admin de rollout.
    const scope = await getAllowedLawIds({ userId: auth.user.id }).catch(() => null)
    logRolloutEvent({
      userId: auth.user.id,
      positionType: scope?.positionType ?? null,
      path: 'new',
      articlesCount: articles.length,
      lawNames: articles.map((a) => a.law_name),
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      success: true,
      articles,
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [problematic-articles] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    console.error('❌ [problematic-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/notifications/problematic-articles', _GET)
