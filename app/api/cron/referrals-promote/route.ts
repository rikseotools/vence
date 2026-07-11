// app/api/cron/referrals-promote/route.ts
// Promueve los referidos `qualified` → `payable` cuando su hold (pago + 5 días) ya venció.
// Lo dispara GHA cada día con Bearer CRON_SECRET. Idempotente: solo toca los que ya vencieron.
// Diseño: docs/roadmap/programa-referidos-embajadores.md (Anexo A.4).

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { promoteEligibleToPayable } from '@/lib/referrals/queries'
import { grantActiveSignupRewards } from '@/lib/referrals/activeSignup'
import { emitReferralEvent } from '@/lib/referrals/observability'

export const maxDuration = 60

async function _GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const promoted = await promoteEligibleToPayable(new Date().toISOString())
  console.log(`🏅 [Cron/referrals] Promovidos qualified→payable: ${promoted}`)
  emitReferralEvent('referral_promoted_payable', { endpoint: '/api/cron/referrals-promote', metadata: { promoted } })

  // Bonus de REGISTRO ACTIVO (2€ por referido con >=5 tests). No-op salvo ACTIVE_SIGNUP_REWARD=1.
  const active = await grantActiveSignupRewards()
  console.log(`🏅 [Cron/referrals] Registro activo: concedidos=${active.granted} enabled=${active.enabled}`)
  if (active.granted > 0) {
    emitReferralEvent('reward_created', { endpoint: '/api/cron/referrals-promote', metadata: { source: 'registro_activo', granted: active.granted, amount: active.amount } })
  }
  return NextResponse.json({ success: true, promoted, activeSignup: active })
}

export const GET = withErrorLogging('/api/cron/referrals-promote', _GET)
export { _GET }
