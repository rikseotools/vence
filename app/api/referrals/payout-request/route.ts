// app/api/referrals/payout-request/route.ts
// Modelo PULL: el USUARIO solicita cobrar su saldo. Identidad SIEMPRE del token (anti-IDOR).
// El importe lo calcula el SERVIDOR (mayor vale Amazon que quepa en el saldo disponible) — el
// cliente NO elige, así que no puede pedir un importe arbitrario. Solo saldo disponible (no
// retenido): getUserOwedBalance solo cuenta lo pagable. Crea un payout 'pending' que reserva el
// saldo; el admin lo cumple luego (badge "toca pagar").
import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserOwedBalance, createPayoutRequest } from '@/lib/referrals/queries'
import { payoutDenomination } from '@/lib/referrals/logic'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id

  const balance = await getUserOwedBalance(userId)
  const amount = payoutDenomination(balance) // mayor denominación válida <= saldo (0 si < mínimo)
  if (amount <= 0) {
    return NextResponse.json({ ok: false, reason: 'below_minimum', balance }, { status: 400 })
  }

  const result = await createPayoutRequest({ userId, amount })
  if (result.ok) {
    emitReferralEvent('payout_requested', {
      userId, endpoint: '/api/referrals/payout-request',
      metadata: { amount, requestId: result.requestId, balance },
    })
  }
  return NextResponse.json(result.ok ? { ...result, amount } : result, { status: result.ok ? 200 : 409 })
}

export const POST = withErrorLogging('/api/referrals/payout-request', _POST)
export { _POST }
