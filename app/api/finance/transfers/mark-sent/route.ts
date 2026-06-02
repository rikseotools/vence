// app/api/finance/transfers/mark-sent/route.ts
// POST → upsert de un payout marcando sent_to_manuel=true.
// Acceso: armando cookie OR admin Supabase auth.

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
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

  // expected_usd NO está en el schema Drizzle (BD más nueva que el introspect)
  // → raw SQL. upsert onConflict 'stripe_payout_id' (unique) → ON CONFLICT DO UPDATE.
  let error: unknown = null
  try {
    await getAdminDb().execute(sql`
      INSERT INTO payout_transfers
        (stripe_payout_id, payout_date, payout_amount, payout_fee, manuel_amount,
         armando_amount, sent_to_manuel, sent_date, expected_usd)
      VALUES (
        ${body.stripe_payout_id}, ${body.payout_date}, ${body.payout_amount},
        ${body.payout_fee}, ${body.manuel_amount}, ${body.armando_amount},
        true, ${new Date().toISOString()}, ${expectedUsd}
      )
      ON CONFLICT (stripe_payout_id) DO UPDATE SET
        payout_date = EXCLUDED.payout_date,
        payout_amount = EXCLUDED.payout_amount,
        payout_fee = EXCLUDED.payout_fee,
        manuel_amount = EXCLUDED.manuel_amount,
        armando_amount = EXCLUDED.armando_amount,
        sent_to_manuel = EXCLUDED.sent_to_manuel,
        sent_date = EXCLUDED.sent_date,
        expected_usd = EXCLUDED.expected_usd
    `)
  } catch (e) {
    error = e
  }

  if (error) {
    console.error('[finance/transfers/mark-sent] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/finance/transfers/mark-sent', _POST)
