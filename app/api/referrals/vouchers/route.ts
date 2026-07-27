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
  // El giftcard_ref puede ser JSON {code,pin,serial} (compras nuevas) o texto plano (código, legacy).
  // El `_fallback_link` (revealyourgift.com) SÍ se expone: es un dato que el usuario necesita para
  // canjear, no trazabilidad interna. El resto de claves `_*` (`_invoice_id`, `_order_id`,
  // `_price_sats`…) siguen sin salir de aquí — son para soporte.
  //
  // Y llega SOLO EN ALGUNOS VALES: Bitrefill es un agregador y sirve las tarjetas de Amazon.es
  // desde lotes de distintos distribuidores, cada uno con su formato. Medido sobre los 5 vales
  // comprados hasta el 27/07: uno trajo `Fallback link`, otro `pin`+`serial`, y tres solo el código
  // — mismo producto, misma denominación, cuatro días de diferencia. La API no dice de qué lote
  // viene, así que esto NO se puede predecir ni exigir: lo único constante es el `code` (5 de 5).
  const parse = (raw: string): { code: string; pin: string | null; serial: string | null; fallbackLink: string | null } => {
    try {
      const j = JSON.parse(raw)
      if (j && typeof j === 'object' && j.code) {
        const fb = typeof j._fallback_link === 'string' && j._fallback_link.startsWith('http') ? j._fallback_link : null
        return { code: String(j.code), pin: j.pin ?? null, serial: j.serial ?? null, fallbackLink: fb }
      }
    } catch { /* plano */ }
    return { code: raw, pin: null, serial: null, fallbackLink: null }
  }
  const vouchers = rows.map((r) => {
    const p = parse(String(r.giftcard_ref))
    return { amount: Number(r.amount), code: p.code, pin: p.pin, serial: p.serial, fallbackLink: p.fallbackLink, via: r.purchased_via || null, date: r.paid_at ? new Date(r.paid_at).toISOString() : null }
  })
  return NextResponse.json({ vouchers })
}

export const GET = withErrorLogging('/api/referrals/vouchers', _GET)
export { _GET }
