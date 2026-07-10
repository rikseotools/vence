// app/api/referrals/attribute/route.ts — POST: atribuye al usuario autenticado a un embajador.
//
// Lee el código de la cookie `vence_ref` (httpOnly, server-side) puesta por /r/[code]. Sirve para
// AMBOS casos del roadmap: el registro nuevo (se llama tras autenticarse) y el free existente (clic
// logueado). Identidad SIEMPRE del token. Idempotente (first-touch): si ya estaba, no duplica.
// La elegibilidad (embajador premium + referido nunca-pagó + no self) la aplica attributeReferral.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import {
  resolveActiveReferralCode,
  attributeReferral,
  getUserPlanType,
  hasUserEverPaid,
} from '@/lib/referrals/queries'

const REF_COOKIE = 'vence_ref'

async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const referredUserId = auth.user.id

  const code = request.cookies.get(REF_COOKIE)?.value
  if (!code) return NextResponse.json({ attributed: false, reason: 'no_ref' })

  const resolved = await resolveActiveReferralCode(code)
  if (!resolved) return NextResponse.json({ attributed: false, reason: 'code_invalid' })

  const [referrerPlan, referredPaid] = await Promise.all([
    getUserPlanType(resolved.ownerUserId),
    hasUserEverPaid(referredUserId),
  ])

  const result = await attributeReferral({
    code,
    referredUserId,
    referrerIsActivePremium: referrerPlan === 'premium',
    referredHasEverPaid: referredPaid,
  })

  return NextResponse.json(
    result.ok
      ? { attributed: true, alreadyAttributed: !!result.alreadyAttributed }
      : { attributed: false, reason: result.reason },
  )
}

export const POST = withErrorLogging('/api/referrals/attribute', _POST)
export { _POST }
