// app/api/admin/referrals/stats/route.ts — Escaparate de estadísticas del programa de embajadores.
//   GET → stats globales read-only: ingresos totales/pagados/pendientes, desglose por fuente,
//         estado de referidos, embudo (vistas→copias→clicks→registros→compradores), top embajadores.
// Requiere admin. Las OPERACIONES (crear recompensa, pagar) viven en otros endpoints (los ejecuta
// Claude Code vía API guiado por docs/runbooks/embajadores-recompensas.md).

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getReferralAdminStats } from '@/lib/referrals/queries'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const stats = await getReferralAdminStats()
  return NextResponse.json({ stats })
}

export const GET = withErrorLogging('/api/admin/referrals/stats', _GET)
export { _GET }
