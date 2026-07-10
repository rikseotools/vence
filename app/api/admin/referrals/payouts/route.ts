// app/api/admin/referrals/payouts/route.ts
// Panel admin de payout de embajadores.
//   GET  → lista los referidos `payable` (listos para pagar la gift card).
//   POST → marca uno como pagado (crea reward_payout + referido → paid). Body: { referralId, giftcardRef?, purchasedVia? }.
// Requiere admin. La identidad (approved_by) sale del token.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getPayableReferrals, payReferral } from '@/lib/referrals/queries'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const payables = await getPayableReferrals()
  return NextResponse.json({ payables })
}

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const referralId = body?.referralId
  if (!referralId || typeof referralId !== 'string') {
    return NextResponse.json({ ok: false, error: 'referralId requerido' }, { status: 400 })
  }

  const result = await payReferral({
    referralId,
    adminUserId: auth.user.id,
    giftcardRef: typeof body?.giftcardRef === 'string' ? body.giftcardRef : undefined,
    purchasedVia: typeof body?.purchasedVia === 'string' ? body.purchasedVia : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const GET = withErrorLogging('/api/admin/referrals/payouts', _GET)
export const POST = withErrorLogging('/api/admin/referrals/payouts', _POST)
export { _GET, _POST }
