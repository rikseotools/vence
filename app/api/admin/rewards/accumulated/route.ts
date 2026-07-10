// app/api/admin/rewards/accumulated/route.ts — pago ACUMULADO por embajador.
//   GET  → embajadores con saldo >= mínimo, con la denominación sugerida (mayor <= saldo).
//   POST → paga una gift card de denominación fija contra el saldo. Body: { userId, amount, giftcardRef?, purchasedVia? }.
// Requiere admin. El saldo = referidos payable + bug/ugc approved(tras hold) − ya pagado.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getEmbajadoresWithBalance, payAccumulated } from '@/lib/referrals/queries'
import { payoutDenomination } from '@/lib/referrals/logic'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const rows = await getEmbajadoresWithBalance()
  const balances = rows.map((r) => ({ ...r, suggested: payoutDenomination(r.balance) }))
  return NextResponse.json({ balances })
}

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const userId = body?.userId
  const amount = Number(body?.amount)
  if (!userId || typeof userId !== 'string' || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, error: 'userId y amount requeridos' }, { status: 400 })
  }

  const result = await payAccumulated({
    userId,
    adminUserId: auth.user.id,
    amount,
    giftcardRef: typeof body?.giftcardRef === 'string' ? body.giftcardRef : undefined,
    purchasedVia: typeof body?.purchasedVia === 'string' ? body.purchasedVia : undefined,
  })
  if (result.ok) {
    emitReferralEvent('reward_paid', { userId, endpoint: '/api/admin/rewards/accumulated', metadata: { amount, payoutId: result.payoutId, accumulated: true } })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const GET = withErrorLogging('/api/admin/rewards/accumulated', _GET)
export const POST = withErrorLogging('/api/admin/rewards/accumulated', _POST)
export { _GET, _POST }
