// app/api/notifications/problematic-articles/route.ts
// Endpoint tipado que reemplaza la llamada a la RPC
// get_user_problematic_articles_weekly (ver FASE 4 del refactor oposicion-scope).
//
// userId SIEMPRE deriva de la sesión autenticada — nunca del cliente —
// para impedir cross-oposición leakage.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserProblematicArticlesWeekly } from '@/lib/api/notifications/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { logRolloutEvent } from '@/lib/api/rollout/problematic-articles-logs'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'

// Nunca cachear — la respuesta depende del userId de la sesión.
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const startedAt = Date.now()
  try {
    const articles = await getUserProblematicArticlesWeekly({
      userId: auth.user.id,
    })

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
    console.error('❌ [problematic-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/notifications/problematic-articles', _GET)
