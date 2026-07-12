// lib/referrals/observability.ts
// Observabilidad del programa de embajadores — TODOS los pasos emiten a observable_events, sin gaps.
// Fire-and-forget (best-effort): la observabilidad NUNCA rompe el flujo real.
// Embudo consultable: link_copy → link_click → attributed → coupon_applied → qualified → paid.

import { emitFireAndForget } from '@/lib/observability/emit'

export type ReferralEventType =
  // top de embudo
  | 'referral_page_view'           // carga de /embajadores (visita, logueado o no)
  | 'referral_link_click'          // /r/<code> visitado
  | 'referral_link_copy'           // botón Copiar en /embajadores
  // atribución
  | 'referral_attributed'          // referido creado (pending)
  | 'referral_attribute_rejected'  // atribución rechazada (self/ya-pagó/no-premium/código inválido)
  // conversión
  | 'referral_coupon_applied'      // cupón 5 € aplicado en checkout
  | 'referral_qualified'           // pago dentro de ventana → qualified
  | 'referral_expired'             // pago FUERA de la ventana (10d) → expired
  | 'referral_refund_clawback'     // reembolso → rechazado
  | 'referral_promoted_payable'    // cron: qualified → payable
  | 'referral_paid'                // admin pagó la gift card
  | 'payout_requested'             // el usuario SOLICITÓ cobrar su saldo (modelo pull)
  | 'payout_fulfilled'             // admin cumplió la solicitud (pending → paid)
  | 'referral_error'              // FALLO capturado en el flujo (metadata.step: qualify|clawback|coupon)
  // recompensas bug/ugc
  | 'reward_created'
  | 'reward_cap_hit'
  | 'reward_duplicate'
  | 'reward_paid'

export interface ReferralEmitOpts {
  userId?: string | null
  endpoint?: string
  severity?: 'info' | 'warn'
  metadata?: Record<string, unknown>
}

/** Emite un evento del programa (no bloquea, no lanza). `userId` = protagonista del evento
 *  (embajador en click/copy, referido en atribución/qualify, beneficiario en paid). */
export function emitReferralEvent(eventType: ReferralEventType, opts: ReferralEmitOpts = {}): void {
  emitFireAndForget({
    source: 'fargate',
    severity: opts.severity ?? 'info',
    eventType,
    endpoint: opts.endpoint ?? '/referrals',
    userId: opts.userId ?? null,
    metadata: opts.metadata ?? {},
  })
}
