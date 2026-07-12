// app/api/admin/referrals/payout-requests/route.ts
// Modelo PULL — lado admin.
//   GET  → lista las solicitudes de vale PENDIENTES (quién, cuánto, desde cuándo).
//   POST → CUMPLE una solicitud: pending → paid (emite el vale). Body: { requestId, giftcardRef?, purchasedVia? }.
// Requiere admin. La identidad (approved_by) sale del token.
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getPendingPayoutRequests, fulfillPayoutRequest } from '@/lib/referrals/queries'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const requests = await getPendingPayoutRequests()
  return NextResponse.json({ requests })
}

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const requestId = body?.requestId
  if (!requestId || typeof requestId !== 'string') {
    return NextResponse.json({ ok: false, error: 'requestId requerido' }, { status: 400 })
  }

  const result = await fulfillPayoutRequest({
    requestId,
    adminUserId: auth.user.id,
    giftcardRef: typeof body?.giftcardRef === 'string' ? body.giftcardRef : undefined,
    purchasedVia: typeof body?.purchasedVia === 'string' ? body.purchasedVia : undefined,
  })
  if (result.ok) {
    emitReferralEvent('payout_fulfilled', {
      userId: auth.user.id, endpoint: '/api/admin/referrals/payout-requests', metadata: { requestId },
    })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const GET = withErrorLogging('/api/admin/referrals/payout-requests', _GET)
export const POST = withErrorLogging('/api/admin/referrals/payout-requests', _POST)
export { _GET, _POST }
