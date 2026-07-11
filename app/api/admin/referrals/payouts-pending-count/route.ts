// app/api/admin/referrals/payouts-pending-count/route.ts
// Conteo de embajadores con saldo PAGABLE AHORA (>= mínimo, hold ya vencido) → alimenta el
// badge parpadeante "toca pagar" en el nav admin (icono 🎁 Embajadores). Solo cuenta lo que
// getUserOwedBalance considera disponible (referrals 'payable' + submissions approved tras
// hold − ya pagado), así que NO avisa por dinero aún retenido. Read-only, requiere admin.
import { NextRequest, NextResponse } from 'next/server'
import { getEmbajadoresWithBalance } from '@/lib/referrals/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const embajadores = await getEmbajadoresWithBalance()
  const total = embajadores.reduce((s, e) => s + (e.balance ?? 0), 0)
  return NextResponse.json({ success: true, count: embajadores.length, total })
}

export const GET = withErrorLogging('/api/admin/referrals/payouts-pending-count', _GET)
export { _GET }
