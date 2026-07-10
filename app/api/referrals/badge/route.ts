// app/api/referrals/badge/route.ts — Badge de "ganancias sin ver" del embajador.
//   GET  → { unseen }  (nº de ingresos nuevos sin ver, cualquier fuente). Ligero, lo llama el Header.
//   POST → marca las ganancias como vistas (apaga el badge). Lo llama /embajadores al abrirse.
// Solo premium es embajador; para el resto unseen=0. Identidad SIEMPRE del token.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserPlanType, getUnseenEarningsCount, markEarningsSeen } from '@/lib/referrals/queries'

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  if ((await getUserPlanType(userId)) !== 'premium') return NextResponse.json({ unseen: 0 })
  const unseen = await getUnseenEarningsCount(userId)
  return NextResponse.json({ unseen })
}

async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  await markEarningsSeen(auth.user.id)
  return NextResponse.json({ ok: true })
}

export const GET = withErrorLogging('/api/referrals/badge', _GET)
export const POST = withErrorLogging('/api/referrals/badge', _POST)
export { _GET, _POST }
