// app/api/referrals/vouchers/route.ts
// Vales (gift cards) del usuario para "Mis vales" en su panel. SOLO LECTURA.
// Identidad SIEMPRE del TOKEN (getAuthenticatedUser), NUNCA del cliente → sin IDOR: cada usuario ve
// solo SUS vales. Se excluyen los de prueba (purchased_via='bitrefill_dryrun') para no mostrar
// códigos simulados como si fueran reales.
//
// Cómo se lee la fila (parseo del `giftcard_ref` + MARCA del vale) vive en
// `lib/referrals/voucherView`, COMPARTIDO con el panel de admin: son la misma tarjeta, y tener dos
// copias del mapeo es exactamente lo que ya divergió una vez (guardarraíl `voucherCard`).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { toVoucherDTO } from '@/lib/referrals/voucherView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const db = getReadDb()
  const res = await db.execute(sql`
    SELECT amount, giftcard_ref, purchased_via, method, paid_at
    FROM reward_payouts
    WHERE beneficiary_user_id = ${auth.user.id}
      AND status = 'paid'
      AND giftcard_ref IS NOT NULL
      AND coalesce(purchased_via, '') <> 'bitrefill_dryrun'
    ORDER BY paid_at DESC`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(res) ? res : ((res as any)?.rows ?? [])
  // `method` viaja porque es el respaldo del que se deduce la MARCA cuando la fila es antigua y no
  // guarda `_product` (ver `brandForVoucher`). Sin él, todo vale sin `_product` se pintaría como
  // «Tarjeta regalo» genérica… incluidos los de Amazon, que son casi todos.
  const vouchers = rows.map(toVoucherDTO)
  return NextResponse.json({ vouchers })
}

export const GET = withErrorLogging('/api/referrals/vouchers', _GET)
export { _GET }
