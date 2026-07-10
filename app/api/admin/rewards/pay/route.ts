// app/api/admin/rewards/pay/route.ts — marca una recompensa bug/UGC como pagada (crea reward_payout).
// Body: { submissionId, giftcardRef?, purchasedVia? }. Requiere admin. Rechaza si sigue en hold (UGC).

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { payRewardSubmission } from '@/lib/referrals/queries'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const submissionId = body?.submissionId
  if (!submissionId || typeof submissionId !== 'string') {
    return NextResponse.json({ ok: false, error: 'submissionId requerido' }, { status: 400 })
  }

  const result = await payRewardSubmission({
    submissionId,
    adminUserId: auth.user.id,
    giftcardRef: typeof body?.giftcardRef === 'string' ? body.giftcardRef : undefined,
    purchasedVia: typeof body?.purchasedVia === 'string' ? body.purchasedVia : undefined,
  })
  if (result.ok) {
    emitReferralEvent('reward_paid', { userId: auth.user.id, endpoint: '/api/admin/rewards/pay', metadata: { submissionId, payoutId: result.payoutId } })
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const POST = withErrorLogging('/api/admin/rewards/pay', _POST)
export { _POST }
