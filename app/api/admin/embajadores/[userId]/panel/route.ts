// app/api/admin/embajadores/[userId]/panel/route.ts
// Vista ADMIN (SOLO LECTURA) del panel de embajador de OTRO usuario — "verlo como lo vería el usuario".
//
// SEGURIDAD (capas):
//  1. requireAdmin (email whitelist) — el gate. Además la PÁGINA vive tras app/admin/layout.tsx.
//  2. userId validado como UUID (no se confía en el param a ciegas).
//  3. READ-ONLY: reusa las MISMAS queries que /api/referrals/me (getReadDb), sin crear código ni mutar.
//  4. NO debilita /api/referrals/me, que sigue resolviendo la identidad SIEMPRE del token (anti-IDOR).
// No expone ningún dato nuevo: exactamente lo que el propio usuario ve en su /embajadores.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  getReferralCode, getReferralStats, getReferralDetails, getReferralFunnelCounts,
  getEmbajadorEarnings, getUnseenEarningsCount, getRecentEarnings,
} from '@/lib/referrals/queries'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const { userId } = await params
  if (!UUID_RE.test(userId || '')) {
    return NextResponse.json({ error: 'userId inválido' }, { status: 400 })
  }

  // Perfil (existencia + nombre + plan) en una sola lectura.
  const db = getReadDb()
  const prof = await db.execute(sql`select full_name, plan_type from user_profiles where id = ${userId} limit 1`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = Array.isArray(prof) ? prof : ((prof as any)?.rows ?? [])
  if (!rows.length) return NextResponse.json({ error: 'usuario no encontrado' }, { status: 404 })
  const firstName = String(rows[0]?.full_name || '').trim().split(' ')[0] || null

  // Solo premium es embajador (Fase 1) — mismo gate que /api/referrals/me.
  if (rows[0]?.plan_type !== 'premium') {
    return NextResponse.json({ isAmbassador: false, firstName })
  }

  const [code, stats, details, funnel, earnings, unseen, recent] = await Promise.all([
    getReferralCode(userId),
    getReferralStats(userId),
    getReferralDetails(userId),
    getReferralFunnelCounts(userId),
    getEmbajadorEarnings(userId),
    getUnseenEarningsCount(userId),
    getRecentEarnings(userId),
  ])

  // Vales (gift cards) emitidos al usuario — mismo criterio que /api/referrals/vouchers (excluye dry-run).
  const vRes = await db.execute(sql`
    SELECT amount, giftcard_ref, purchased_via, paid_at FROM reward_payouts
    WHERE beneficiary_user_id = ${userId} AND status = 'paid' AND giftcard_ref IS NOT NULL
      AND coalesce(purchased_via, '') <> 'bitrefill_dryrun'
    ORDER BY paid_at DESC`)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vRows: any[] = Array.isArray(vRes) ? vRes : ((vRes as any)?.rows ?? [])
  // El giftcard_ref puede ser JSON {code,pin,serial} (compras nuevas) o texto plano (código, legacy).
  const parse = (raw: string): { code: string; pin: string | null; serial: string | null } => {
    try { const j = JSON.parse(raw); if (j && typeof j === 'object' && j.code) return { code: String(j.code), pin: j.pin ?? null, serial: j.serial ?? null } } catch { /* plano */ }
    return { code: raw, pin: null, serial: null }
  }
  const vouchers = vRows.map((r) => {
    const p = parse(String(r.giftcard_ref))
    return { amount: Number(r.amount), code: p.code, pin: p.pin, serial: p.serial, via: r.purchased_via || null, date: r.paid_at ? new Date(r.paid_at).toISOString() : null }
  })

  return NextResponse.json({
    isAmbassador: true,
    firstName,
    code,
    link: code ? `${SITE}/r/${code}` : null,
    stats,
    details,
    funnel,
    earnings,
    unseen,
    recent,
    vouchers,
  })
}

export const GET = withErrorLogging('/api/admin/embajadores/[userId]/panel', _GET)
export { _GET }
