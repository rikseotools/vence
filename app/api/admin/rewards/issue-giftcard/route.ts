// app/api/admin/rewards/issue-giftcard/route.ts
// ADMIN — emite un VALE (gift card Amazon.es) contra el saldo del usuario, comprándolo en Bitrefill.
//
// CAPAS DE SEGURIDAD (dinero real):
//  1. requireAdmin — solo Manuel (gate de autorización).
//  2. Compra REAL detrás de BITREFILL_LIVE=1 (dry-run por defecto → NO gasta). Ver lib/referrals/bitrefill.
//  3. Orden seguro anti-descuadre: valida denominación + saldo ANTES de comprar; si la compra FALLA
//     NO registra el payout (no baja saldo sin vale).
//  4. Registro atómico del payout (payAccumulated re-valida denominación + saldo dentro de la TX).
//  5. Trazabilidad: emite reward_paid (éxito) o referral_error (fallo) a observable_events.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getUserOwedBalance, payAccumulated } from '@/lib/referrals/queries'
import { isValidDenomination } from '@/lib/referrals/logic'
import { purchaseAmazonGiftCard } from '@/lib/referrals/bitrefill'
import { emitReferralEvent } from '@/lib/referrals/observability'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}) as Record<string, unknown>)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  const amount = Number(body?.amount)
  if (!UUID_RE.test(userId)) return NextResponse.json({ ok: false, error: 'userId inválido' }, { status: 400 })
  if (!isValidDenomination(amount)) return NextResponse.json({ ok: false, error: 'denominación inválida (5/10/20…)' }, { status: 400 })

  // 1. Pre-check de saldo ANTES de gastar.
  const balance = await getUserOwedBalance(userId)
  if (amount > balance) return NextResponse.json({ ok: false, error: `saldo insuficiente (${balance}€)` }, { status: 409 })

  // 2. Comprar la gift card (dry-run salvo BITREFILL_LIVE=1). Si falla → NO se registra nada.
  const buy = await purchaseAmazonGiftCard(amount)
  if (!buy.ok || !buy.code) {
    emitReferralEvent('referral_error', {
      userId, endpoint: '/api/admin/rewards/issue-giftcard', severity: 'warn',
      metadata: { step: 'bitrefill', error: buy.error, dryRun: buy.dryRun },
    })
    return NextResponse.json({ ok: false, error: `compra falló: ${buy.error || 'sin código'}` }, { status: 502 })
  }

  // 3. Registrar el payout contra el saldo (re-valida saldo + denominación en la TX).
  const pay = await payAccumulated({
    userId, adminUserId: auth.user.id, amount,
    giftcardRef: JSON.stringify({ code: buy.code, pin: buy.pin, serial: buy.serial }), purchasedVia: buy.dryRun ? 'bitrefill_dryrun' : 'bitrefill',
  })
  if (!pay.ok) {
    // Solo relevante en LIVE: dinero gastado pero no registrado → alerta para reconciliar a mano.
    emitReferralEvent('referral_error', {
      userId, endpoint: '/api/admin/rewards/issue-giftcard', severity: 'warn',
      metadata: { step: 'record', reason: pay.reason, code: buy.code, dryRun: buy.dryRun },
    })
    return NextResponse.json({ ok: false, error: `no se pudo registrar (${pay.reason})`, code: buy.code, dryRun: buy.dryRun }, { status: 500 })
  }

  emitReferralEvent('reward_paid', {
    userId, endpoint: '/api/admin/rewards/issue-giftcard',
    metadata: { amount, dryRun: buy.dryRun, payoutId: pay.payoutId },
  })
  return NextResponse.json({ ok: true, dryRun: buy.dryRun, code: buy.code, payoutId: pay.payoutId, amount })
}

export const POST = withErrorLogging('/api/admin/rewards/issue-giftcard', _POST)
export { _POST }
