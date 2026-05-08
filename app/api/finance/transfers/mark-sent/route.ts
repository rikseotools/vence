// app/api/finance/transfers/mark-sent/route.ts
// POST → upsert de un payout marcando sent_to_manuel=true.
// Acceso: armando cookie OR admin Supabase auth.

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { getArmandoSupabaseAdmin } from '@/lib/armando/supabaseAdmin'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

interface MarkSentBody {
  stripe_payout_id?: unknown
  payout_date?: unknown
  payout_amount?: unknown
  payout_fee?: unknown
  manuel_amount?: unknown
  armando_amount?: unknown
  expected_usd?: unknown
}

function isPositiveInt(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0
}

async function _POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateFinanceRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  let body: MarkSentBody
  try {
    body = (await req.json()) as MarkSentBody
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.stripe_payout_id !== 'string' || body.stripe_payout_id.length === 0) {
    return NextResponse.json({ success: false, error: 'stripe_payout_id requerido' }, { status: 400 })
  }
  if (typeof body.payout_date !== 'string') {
    return NextResponse.json({ success: false, error: 'payout_date requerido' }, { status: 400 })
  }
  if (!isPositiveInt(body.payout_amount) || !isPositiveInt(body.payout_fee) ||
      !isPositiveInt(body.manuel_amount) || !isPositiveInt(body.armando_amount)) {
    return NextResponse.json({ success: false, error: 'amounts deben ser enteros positivos' }, { status: 400 })
  }
  const expectedUsd = body.expected_usd === null || body.expected_usd === undefined
    ? null
    : (typeof body.expected_usd === 'number' ? body.expected_usd : null)

  const supabase = getArmandoSupabaseAdmin()
  const { error } = await supabase
    .from('payout_transfers')
    .upsert({
      stripe_payout_id: body.stripe_payout_id,
      payout_date: body.payout_date,
      payout_amount: body.payout_amount,
      payout_fee: body.payout_fee,
      manuel_amount: body.manuel_amount,
      armando_amount: body.armando_amount,
      sent_to_manuel: true,
      sent_date: new Date().toISOString(),
      expected_usd: expectedUsd,
    }, { onConflict: 'stripe_payout_id' })

  if (error) {
    console.error('[finance/transfers/mark-sent] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/finance/transfers/mark-sent', _POST)
