// app/api/referrals/track-copy/route.ts — registra que el embajador copió su enlace (top del embudo).
// Autenticado; identidad del token. Emite referral_link_copy a observable_events (fire-and-forget).

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { emitReferralEvent } from '@/lib/referrals/observability'

async function _POST(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response
  emitReferralEvent('referral_link_copy', { userId: auth.user.id, endpoint: '/api/referrals/track-copy' })
  return NextResponse.json({ ok: true })
}

export const POST = withErrorLogging('/api/referrals/track-copy', _POST)
export { _POST }
