// app/api/admin/referrals/payouts-pending/route.ts
// LISTA de solicitudes de cobro pendientes (embajador que HA PEDIDO el vale:
// reward_payouts status='pending'). Alimenta la sección "Solicitudes de cobro"
// del panel admin → se ve QUIÉN lo solicitó (no solo el conteo del badge).
// Read-only, requiere admin.
import { NextRequest, NextResponse } from 'next/server'
import { getPendingPayoutRequests } from '@/lib/referrals/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const maxDuration = 10

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const requests = await getPendingPayoutRequests()
  const total = requests.reduce((s, r) => s + (r.amount ?? 0), 0)
  return NextResponse.json({ success: true, count: requests.length, total, requests })
}

export const GET = withErrorLogging('/api/admin/referrals/payouts-pending', _GET)
export { _GET }
