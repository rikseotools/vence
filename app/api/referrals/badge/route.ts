// app/api/referrals/badge/route.ts — Badge de "ganancias sin ver" del embajador.
//   GET  → { unseen, balance }  (ingresos nuevos sin ver + saldo €). Ligero, lo llama el Header.
//          El saldo va aquí porque desde el 29/07 el icono tiene TRES estados (apagado / con saldo /
//          con cifra cobrable) y necesita el número, no solo el contador de novedades.
//   POST → marca las ganancias como vistas (apaga el badge). Lo llama /embajadores al abrirse.
// Solo premium es embajador; para el resto unseen=0. Identidad SIEMPRE del token.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getUserPlanType, getUnseenEarningsCount, markEarningsSeen, getUserOwedBalance } from '@/lib/referrals/queries'

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  if ((await getUserPlanType(userId)) !== 'premium') return NextResponse.json({ unseen: 0, balance: 0 })
  const [unseen, balance] = await Promise.all([getUnseenEarningsCount(userId), getUserOwedBalance(userId)])
  return NextResponse.json({ unseen, balance })
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
