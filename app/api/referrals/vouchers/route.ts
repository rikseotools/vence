// app/api/referrals/vouchers/route.ts
// Vales (gift cards Amazon.es) del usuario para "Mis vales" en su panel. SOLO LECTURA.
// Identidad SIEMPRE del TOKEN (getAuthenticatedUser), NUNCA del cliente → sin IDOR: cada usuario ve
// solo SUS vales. Se excluyen los de prueba (purchased_via='bitrefill_dryrun') para no mostrar
// códigos simulados como si fueran reales.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const db = getReadDb()
  const res = await db.execute(sql`
    SELECT amount, giftcard_ref, purchased_via, paid_at
    FROM reward_payouts
    WHERE beneficiary_user_id = ${auth.user.id}
      AND status = 'paid'
      AND giftcard_ref IS NOT NULL
      AND coalesce(purchased_via, '') <> 'bitrefill_dryrun'
    ORDER BY paid_at DESC`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  const vouchers = rows.map((r) => ({
    amount: Number(r.amount),
    code: String(r.giftcard_ref),
    via: r.purchased_via || null,
    date: r.paid_at ? new Date(r.paid_at).toISOString() : null,
  }))
  return NextResponse.json({ vouchers })
}

export const GET = withErrorLogging('/api/referrals/vouchers', _GET)
export { _GET }
