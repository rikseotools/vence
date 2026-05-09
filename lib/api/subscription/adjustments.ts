// lib/api/subscription/adjustments.ts
// Helper centralizado para aplicar ajustes admin sobre suscripciones (compensaciones,
// créditos, reembolsos, descuentos). Coordina Stripe (source of truth) + audit trail
// en BD (subscription_adjustments).
//
// Uso típico:
//   await applySubscriptionAdjustment({
//     userId, stripeSubscriptionId,
//     adjustmentType: 'time_extension', amountValue: 7, amountUnit: 'days',
//     reasonCode: 'incident_compensation',
//     reasonDetail: 'Cascade pool 9 may',
//     relatedFeedbackId: '...',
//     appliedByUserId: '...adminUserId',
//   })
//
// Garantías:
//   - Si Stripe falla → NO se inserta en BD (rollback transparente)
//   - Si Stripe OK pero BD INSERT falla → log warning + return success con audit_failed=true
//     (el cambio en Stripe ya se aplicó, no podemos revertirlo silenciosamente, pero
//     el caller tiene la info para registrar manualmente)

import Stripe from 'stripe'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type AdjustmentType = 'time_extension' | 'credit' | 'refund' | 'discount'
export type AmountUnit = 'days' | 'eur' | 'percent'
export type ReasonCode =
  | 'incident_compensation'
  | 'goodwill'
  | 'churn_prevention'
  | 'support_resolution'
  | 'manual_admin'

export interface ApplyAdjustmentParams {
  userId: string
  stripeSubscriptionId: string
  adjustmentType: AdjustmentType
  amountValue: number
  amountUnit: AmountUnit
  reasonCode: ReasonCode
  reasonDetail?: string
  relatedFeedbackId?: string | null
  appliedByUserId: string
}

export interface ApplyAdjustmentResult {
  success: boolean
  adjustmentId: string | null
  stripeEventId: string | null
  /** Stripe se aplicó pero el INSERT en audit table falló — caller debe registrar manualmente */
  auditFailed?: boolean
  error?: string
}

let _stripeInstance: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY no configurada')
    }
    _stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripeInstance
}

/**
 * Aplica un ajuste a una suscripción (Stripe + audit trail).
 * Devuelve siempre — nunca lanza para que el caller pueda manejar el resultado.
 */
export async function applySubscriptionAdjustment(
  params: ApplyAdjustmentParams,
): Promise<ApplyAdjustmentResult> {
  // Validación defensiva
  const validTypes: AdjustmentType[] = ['time_extension', 'credit', 'refund', 'discount']
  if (!validTypes.includes(params.adjustmentType)) {
    return { success: false, adjustmentId: null, stripeEventId: null, error: `adjustmentType inválido: ${params.adjustmentType}` }
  }
  if (params.amountValue <= 0) {
    return { success: false, adjustmentId: null, stripeEventId: null, error: 'amountValue debe ser > 0' }
  }
  if (params.adjustmentType === 'time_extension' && params.amountUnit !== 'days') {
    return { success: false, adjustmentId: null, stripeEventId: null, error: 'time_extension requiere amountUnit=days' }
  }

  const stripe = getStripe()

  // FASE 1: aplicar en Stripe según tipo
  let stripeEventId: string | null = null
  try {
    if (params.adjustmentType === 'time_extension') {
      // Trial-end push: extiende N días el período actual antes del próximo cobro.
      const sub = await stripe.subscriptions.retrieve(params.stripeSubscriptionId)
      // En API >=2024, current_period_end está en el item, no en el root.
      // Fallback al root para compatibilidad.
      const currentPeriodEnd =
        (sub as unknown as { current_period_end?: number }).current_period_end ??
        sub.items?.data?.[0]?.current_period_end ??
        null
      if (!currentPeriodEnd) {
        return {
          success: false, adjustmentId: null, stripeEventId: null,
          error: 'No se pudo obtener current_period_end de la suscripción',
        }
      }
      const newTrialEnd = currentPeriodEnd + Math.round(params.amountValue) * 24 * 3600

      const updated = await stripe.subscriptions.update(params.stripeSubscriptionId, {
        trial_end: newTrialEnd,
        proration_behavior: 'none',
      })
      stripeEventId = updated.id  // sub.id sirve como referencia (no hay event_id directo en update)
    } else if (params.adjustmentType === 'credit') {
      // Customer balance negativo (en céntimos para EUR).
      if (params.amountUnit !== 'eur') {
        return { success: false, adjustmentId: null, stripeEventId: null, error: 'credit requiere amountUnit=eur' }
      }
      const sub = await stripe.subscriptions.retrieve(params.stripeSubscriptionId)
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
      const customer = await stripe.customers.retrieve(customerId)
      if (customer.deleted) {
        return { success: false, adjustmentId: null, stripeEventId: null, error: 'Customer está eliminado en Stripe' }
      }
      const currentBalance = customer.balance ?? 0
      const newBalance = currentBalance - Math.round(params.amountValue * 100)  // EUR a céntimos, negativo = crédito
      await stripe.customers.update(customerId, { balance: newBalance })
      stripeEventId = customerId
    } else if (params.adjustmentType === 'refund') {
      // Por simplicidad, requiere stripe_charge_id en reasonDetail. No automatizamos
      // refunds masivos sin contexto humano — out of scope por ahora.
      return {
        success: false, adjustmentId: null, stripeEventId: null,
        error: 'refund no implementado en este helper — usar Stripe Dashboard',
      }
    } else if (params.adjustmentType === 'discount') {
      // Aplicar coupon a la sub. Crea un coupon one-time si no existe.
      if (params.amountUnit !== 'percent') {
        return { success: false, adjustmentId: null, stripeEventId: null, error: 'discount requiere amountUnit=percent' }
      }
      const coupon = await stripe.coupons.create({
        percent_off: params.amountValue,
        duration: 'once',
        name: `${params.reasonCode}_${Date.now()}`,
      })
      // En Stripe SDK >=2024, 'coupon' como propiedad directa fue movida a
      // 'discounts: [{ coupon }]'. Usamos cast porque las types pueden variar
      // según versión del SDK; el endpoint REST acepta ambos.
      await stripe.subscriptions.update(params.stripeSubscriptionId, {
        discounts: [{ coupon: coupon.id }],
      } as Stripe.SubscriptionUpdateParams)
      stripeEventId = coupon.id
    }
  } catch (stripeErr) {
    return {
      success: false,
      adjustmentId: null,
      stripeEventId: null,
      error: `Stripe error: ${stripeErr instanceof Error ? stripeErr.message : String(stripeErr)}`,
    }
  }

  // FASE 2: insert audit row en BD (idempotente — pero si falla, el cambio
  // en Stripe ya está aplicado).
  try {
    const db = getDb()
    const row = await db.execute(sql`
      INSERT INTO public.subscription_adjustments (
        user_id, stripe_subscription_id, adjustment_type,
        amount_value, amount_unit,
        reason_code, reason_detail, related_feedback_id,
        applied_by_user_id, stripe_event_id
      ) VALUES (
        ${params.userId}::uuid, ${params.stripeSubscriptionId}, ${params.adjustmentType},
        ${params.amountValue}, ${params.amountUnit},
        ${params.reasonCode}, ${params.reasonDetail ?? null}, ${params.relatedFeedbackId ?? null}::uuid,
        ${params.appliedByUserId}::uuid, ${stripeEventId}
      )
      RETURNING id
    `)
    const inserted = (row as unknown as { rows?: Array<{ id: string }> }).rows
      ?? (row as unknown as Array<{ id: string }>)
    const adjustmentId = inserted?.[0]?.id ?? null

    return {
      success: true,
      adjustmentId,
      stripeEventId,
    }
  } catch (dbErr) {
    console.error('⚠️ [subscription_adjustments] Stripe OK pero BD INSERT falló:', dbErr)
    return {
      success: true,  // el cambio en Stripe sí se aplicó
      adjustmentId: null,
      stripeEventId,
      auditFailed: true,
      error: `BD audit INSERT falló: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
    }
  }
}
