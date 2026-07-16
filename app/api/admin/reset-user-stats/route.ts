// app/api/admin/reset-user-stats/route.ts
//
// Resetea las métricas de estudio de un usuario CONSERVANDO su cuenta.
//
// Caso de origen (Ja Fe, feedback 046fe384, 16/07/2026): usuario cuyo mapa de
// debilidades era ruido de una tarde de tests en modo `avanzado` abandonados el
// primer día (user_article_stats es acumulado de por vida, sin decay) y que pidió
// "empezar de 0 sin eliminar la cuenta". No había forma de hacerlo.
//
// NO confundir con /api/admin/delete-user (borrado RGPD de la cuenta entera).
// Aquí sobreviven: cuenta, feedback, atribución, preferencias y pagos.

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { resetUserStatsRequestSchema } from '@/lib/api/admin-reset-user-stats/schemas'
import { resetUserStats } from '@/lib/api/admin-reset-user-stats'
import { emit } from '@/lib/observability/emit'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/admin/reset-user-stats'

async function _POST(request: NextRequest) {
  // 🔒 Endpoint destructivo (borra métricas de CUALQUIER usuario por userId) y
  // sin middleware para /api/admin/* → el guard va aquí, como en delete-user.
  // Requiere Bearer token de un email admin (whitelist en requireAdmin).
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = resetUserStatsRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Body inválido' },
      { status: 400 }
    )
  }

  const { userId, reason, includeAnalytics } = parsed.data
  const requestedBy = auth.user.email ?? auth.user.id
  const startedAt = Date.now()

  try {
    const result = await resetUserStats({ userId, requestedBy, reason, includeAnalytics })

    // await (no fire-and-forget): el evento debe persistir antes de responder.
    // Un reset es irreversible-en-la-práctica y poco frecuente → perderlo por el
    // race de la lambda (incidente 26/05, 47% de pérdida) no es aceptable.
    await emit({
      source: 'vercel',
      severity: 'info',
      eventType: 'user_stats_reset',
      endpoint: ENDPOINT,
      userId,
      durationMs: Date.now() - startedAt,
      httpStatus: 200,
      metadata: {
        requestedBy,
        reason,
        includeAnalytics,
        resetId: result.resetId,
        deletedCounts: result.deletedCounts,
        totalRowsDeleted: result.totalRowsDeleted,
      },
    })

    return NextResponse.json({
      success: true,
      userId,
      resetId: result.resetId,
      deletedCounts: result.deletedCounts,
      totalRowsDeleted: result.totalRowsDeleted,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // Usuario inexistente → 404 (la función SQL hace RAISE no_data_found).
    const notFound = /no existe user_profiles/i.test(message)

    await emit({
      source: 'vercel',
      severity: notFound ? 'warn' : 'error',
      eventType: 'user_stats_reset_failed',
      endpoint: ENDPOINT,
      userId,
      durationMs: Date.now() - startedAt,
      httpStatus: notFound ? 404 : 500,
      errorMessage: message,
      metadata: { requestedBy, reason, includeAnalytics },
    })

    return NextResponse.json(
      { success: false, error: notFound ? 'Usuario no encontrado' : 'Error reseteando estadísticas' },
      { status: notFound ? 404 : 500 }
    )
  }
}

export const POST = withErrorLogging(ENDPOINT, _POST)
