// app/api/finance/transfers/route.ts
// GET → lista todos los payouts ordenados por fecha desc.
// Acceso: armando cookie OR admin Supabase auth.

import { NextResponse, type NextRequest } from 'next/server'
import { authenticateFinanceRequest } from '@/lib/finance/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

async function _GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateFinanceRequest(req)
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  // SELECT * pasado tal cual al cliente -> raw SQL para preservar claves snake_case
  // (un db.select() tipado las devolvería en camelCase y rompería el consumidor).
  let data: unknown[]
  try {
    // Columnas numeric (expected_usd, crypto_amount_received) casteadas a float8:
    // postgres-js las devuelve como string, pero supabase REST daba number y el
    // cliente espera number. Los montos *_amount son integer (number nativo).
    data = (await getReadDb().execute(sql`
      SELECT id, stripe_payout_id, payout_date, payout_amount, payout_fee,
             manuel_amount, armando_amount, sent_to_manuel, sent_date,
             manuel_confirmed, manuel_confirmed_date, notes, created_at, updated_at,
             expected_usd::float8 AS expected_usd,
             crypto_tx_hash,
             crypto_amount_received::float8 AS crypto_amount_received
      FROM payout_transfers
      ORDER BY payout_date DESC
    `)) as unknown[]
  } catch (error) {
    console.error('[finance/transfers GET] DB error:', error)
    return NextResponse.json({ success: false, error: 'Error de base de datos' }, { status: 500 })
  }

  return NextResponse.json({ success: true, transfers: data ?? [] })
}

export const GET = withErrorLogging('/api/finance/transfers', _GET)
