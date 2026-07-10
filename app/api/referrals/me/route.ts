// app/api/referrals/me/route.ts
// Datos del embajador para la página /embajadores: su código/enlace + métrica registros vs compradores.
// Solo premium es embajador (Fase 1). Identidad SIEMPRE del token (nunca del cliente).

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserPlanType, getOrCreateReferralCode, getReferralStats, getReferralDetails, getReferralFunnelCounts } from '@/lib/referrals/queries'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id

  const plan = await getUserPlanType(userId)
  const isAmbassador = plan === 'premium'
  if (!isAmbassador) {
    return NextResponse.json({ isAmbassador: false })
  }

  const code = await getOrCreateReferralCode(userId)
  const [stats, details, funnel] = await Promise.all([
    getReferralStats(userId),
    getReferralDetails(userId),
    getReferralFunnelCounts(userId),
  ])
  return NextResponse.json({
    isAmbassador: true,
    code,
    link: `${SITE}/r/${code}`,
    stats,   // { registros, compradores, conversion }
    details, // [{ name, city, oposicion, status, date }]
    funnel,  // { copies, clicks }
  })
}

export const GET = withErrorLogging('/api/referrals/me', _GET)
export { _GET }
