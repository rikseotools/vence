// app/api/admin/referrals/payouts-pending-count/route.ts
// Conteo de SOLICITUDES de vale PENDIENTES (modelo pull) → alimenta el badge parpadeante "toca
// pagar" en el nav admin (icono 🎁 Embajadores). Solo parpadea cuando un embajador REALMENTE ha
// solicitado cobrar (reward_payouts status='pending'), no por saldos teóricos → señal acotada y
// accionable, sin naguear. Read-only, requiere admin.
import { NextRequest, NextResponse } from 'next/server'
import { getPendingPayoutRequests } from '@/lib/referrals/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const requests = await getPendingPayoutRequests()
  const total = requests.reduce((s, r) => s + (r.amount ?? 0), 0)
  return NextResponse.json({ success: true, count: requests.length, total })
}

export const GET = withErrorLogging('/api/admin/referrals/payouts-pending-count', _GET)
export { _GET }
