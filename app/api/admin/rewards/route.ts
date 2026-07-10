// app/api/admin/rewards/route.ts — recompensas bug/UGC (admin).
//   GET  → lista las recompensas `approved` (bug/ugc) pendientes de pagar.
//   POST → crea una recompensa para un usuario (por email). Body: { email, type: 'bug'|'ugc', url?, screenshotUrl?, feedbackId? }.
// Requiere admin. El admin la crea porque ya la validó en el chat de soporte.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getPendingRewardSubmissions, createRewardSubmission, findUserIdByEmail } from '@/lib/referrals/queries'
import type { RewardType } from '@/lib/referrals/logic'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const rewards = await getPendingRewardSubmissions()
  return NextResponse.json({ rewards })
}

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const email = typeof body?.email === 'string' ? body.email : ''
  const type = body?.type
  if (!email || (type !== 'bug' && type !== 'ugc')) {
    return NextResponse.json({ ok: false, error: 'email y type (bug|ugc) requeridos' }, { status: 400 })
  }

  const userId = await findUserIdByEmail(email)
  if (!userId) return NextResponse.json({ ok: false, error: 'usuario no encontrado' }, { status: 404 })

  const result = await createRewardSubmission({
    userId,
    type: type as RewardType,
    url: typeof body?.url === 'string' ? body.url : undefined,
    screenshotUrl: typeof body?.screenshotUrl === 'string' ? body.screenshotUrl : undefined,
    feedbackId: typeof body?.feedbackId === 'string' ? body.feedbackId : undefined,
  })
  return NextResponse.json(result, { status: result.ok ? 200 : 409 })
}

export const GET = withErrorLogging('/api/admin/rewards', _GET)
export const POST = withErrorLogging('/api/admin/rewards', _POST)
export { _GET, _POST }
