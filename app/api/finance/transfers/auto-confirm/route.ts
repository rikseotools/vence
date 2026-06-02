// app/api/finance/transfers/auto-confirm/route.ts
// POST → marca payout como manuel_confirmed con tx hash y crypto amount
// (disparado tras detectar USDT en blockchain).
// Acceso: armando cookie OR admin Supabase auth.

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

interface AutoConfirmBody {
  stripe_payout_id?: unknown
  crypto_tx_hash?: unknown
  crypto_amount_received?: unknown
}

async function _POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateFinanceRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  let body: AutoConfirmBody
  try {
    body = (await req.json()) as AutoConfirmBody
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (typeof body.stripe_payout_id !== 'string' || body.stripe_payout_id.length === 0) {
    return NextResponse.json({ success: false, error: 'stripe_payout_id requerido' }, { status: 400 })
  }
  if (typeof body.crypto_tx_hash !== 'string' || body.crypto_tx_hash.length === 0) {
    return NextResponse.json({ success: false, error: 'crypto_tx_hash requerido' }, { status: 400 })
  }
  if (typeof body.crypto_amount_received !== 'number' || !Number.isFinite(body.crypto_amount_received)) {
    return NextResponse.json({ success: false, error: 'crypto_amount_received debe ser número' }, { status: 400 })
  }

  // crypto_tx_hash / crypto_amount_received NO están en el schema Drizzle
  // (BD más nueva que el introspect) → raw SQL.
  let error: unknown = null
  try {
    await getAdminDb().execute(sql`
      UPDATE payout_transfers SET
        manuel_confirmed = true,
        manuel_confirmed_date = ${new Date().toISOString()},
        crypto_tx_hash = ${body.crypto_tx_hash},
        crypto_amount_received = ${body.crypto_amount_received}
      WHERE stripe_payout_id = ${body.stripe_payout_id}
    `)
  } catch (e) {
    error = e
  }

  if (error) {
    console.error('[finance/transfers/auto-confirm] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/finance/transfers/auto-confirm', _POST)
