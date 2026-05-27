// lib/api/subscription/queries.ts - Queries tipadas para suscripciones
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { stripe } from '@/lib/stripe'
import type {
  GetSubscriptionRequest,
  GetSubscriptionResponse,
  CreatePortalSessionRequest,
  CreatePortalSessionResponse,
  CancelSubscriptionRequest,
  CancelSubscriptionResponse,
  CancellationFeedback
} from './schemas'

// Labels para notificaciones admin
const reasonLabels: Record<string, string> = {
  'approved': 'He aprobado la oposición',
  'not_presenting': 'Ya no me voy a presentar',
  'exam_done': 'Ya hice el examen y no lo necesito',
  'too_expensive': 'Es muy caro',
  'prefer_other': 'Prefiero estudiar de otra forma',
  'missing_features': 'La app no tiene lo que necesito',
  'no_progress': 'No veo progreso en mi preparación',
  'hard_to_use': 'La app es difícil de usar',
  'other': 'Otro',
  'pending_feedback': '(sin feedback enviado todavía)'
}

const alternativeLabels: Record<string, string> = {
  'academy_presential': 'Academia presencial',
  'academy_online': 'Academia online',
  'books': 'Libros y temarios',
  'other_app': 'Otra app de oposiciones',
  'self_study': 'Por mi cuenta (sin recursos de pago)',
  'stop_preparing': 'No voy a seguir preparándome',
  'other': 'Otro'
}

// ============================================
// OBTENER DATOS DE SUSCRIPCIÓN
// ============================================

export async function getSubscription(
  params: GetSubscriptionRequest
): Promise<GetSubscriptionResponse> {
  try {
    const db = getDb()

    // Obtener datos del perfil
    const [profile] = await db
      .select({
        stripeCustomerId: userProfiles.stripeCustomerId,
        planType: userProfiles.planType
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile) {
      return { hasSubscription: false, error: 'User not found' }
    }

    // Si no tiene stripe_customer_id, no tiene suscripción
    if (!profile.stripeCustomerId) {
      return {
        hasSubscription: false,
        planType: profile.planType
      }
    }

    // Obtener suscripciones activas de Stripe
    const subscriptions = await stripe().subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'all',
      limit: 1,
      expand: ['data.default_payment_method', 'data.discounts']
    })

    if (subscriptions.data.length === 0) {
      return {
        hasSubscription: false,
        planType: profile.planType,
        stripeCustomerId: profile.stripeCustomerId
      }
    }

    // Type assertion needed because Stripe SDK types may not expose all properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = subscriptions.data[0] as any

    console.log('💳 [Subscription] Datos obtenidos:', {
      userId: params.userId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    })

    // Extraer period_end (SDK v18 puede no tener current_period_end)
    const periodStart = subscription.current_period_start
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : subscription.start_date
        ? new Date(subscription.start_date * 1000).toISOString()
        : new Date(subscription.created * 1000).toISOString()

    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null

    // Extraer descuento de fidelidad
    const discountCoupon = subscription.discounts?.[0]
      ? (typeof subscription.discounts[0] === 'string' ? null : subscription.discounts[0]?.coupon)
      : subscription.discount?.coupon || null

    return {
      hasSubscription: true,
      planType: profile.planType,
      stripeCustomerId: profile.stripeCustomerId,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd || new Date(subscription.created * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        created: new Date(subscription.created * 1000).toISOString(),
        planName: subscription.items.data[0]?.price?.nickname || 'Premium',
        planAmount: subscription.items.data[0]?.price?.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : null,
        planCurrency: subscription.items.data[0]?.price?.currency || null,
        planInterval: subscription.items.data[0]?.price?.recurring?.interval || null,
        planIntervalCount: subscription.items.data[0]?.price?.recurring?.interval_count || null,
        loyaltyDiscount: discountCoupon ? {
          id: discountCoupon.id,
          percentOff: discountCoupon.percent_off,
          name: discountCoupon.name
        } : null
      },
      timeline: await buildTimeline(db, params.userId, subscription, periodEnd),
    }

  } catch (error) {
    console.error('❌ [Subscription] Error obteniendo suscripción:', error)
    return {
      hasSubscription: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Construye timeline de la suscripción a partir de cancellation_feedback + Stripe data.
 */
async function buildTimeline(
  db: ReturnType<typeof getDb>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscription: any,
  periodEnd: string | null,
): Promise<Array<{ type: string; date: string }>> {
  const timeline: Array<{ type: string; date: string }> = []

  // 1. Activación
  timeline.push({
    type: 'activated',
    date: new Date(subscription.created * 1000).toISOString().substring(0, 10),
  })

  // 2. Cancelaciones y reactivaciones de cancellation_feedback
  try {
    const rows = await db.execute(sql`
      SELECT created_at, cancellation_type
      FROM cancellation_feedback
      WHERE user_id = ${userId}
      ORDER BY created_at ASC
    `)
    const feedbacks = (rows as any).rows ?? rows ?? []
    for (const fb of feedbacks) {
      if (fb.cancellation_type === 'reactivation') {
        timeline.push({ type: 'reactivated', date: new Date(fb.created_at).toISOString().substring(0, 10) })
      } else if (fb.cancellation_type === 'manual_refund') {
        timeline.push({ type: 'refunded', date: new Date(fb.created_at).toISOString().substring(0, 10) })
      } else {
        timeline.push({ type: 'cancelled', date: new Date(fb.created_at).toISOString().substring(0, 10) })
      }
    }
  } catch {
    // No bloquear si falla
  }

  // 3. Adjustments admin (compensaciones, créditos, descuentos, reembolsos)
  // Source: tabla subscription_adjustments (audit trail). Stripe = source of
  // truth para el estado, esta tabla = contexto admin (quién, por qué).
  try {
    const adjRows = await db.execute(sql`
      SELECT created_at, adjustment_type, amount_value, amount_unit, reason_detail
      FROM public.subscription_adjustments
      WHERE user_id = ${userId}::uuid
        AND stripe_subscription_id = ${subscription.id}
      ORDER BY created_at ASC
    `)
    const adjustments = (adjRows as { rows?: Array<Record<string, unknown>> }).rows
      ?? (adjRows as unknown as Array<Record<string, unknown>>)
      ?? []
    for (const a of adjustments) {
      // Mapeo a tipo timeline para que el front (que ya tiene icons hardcoded)
      // pueda mostrar el evento. 'time_extension' y 'credit'/'discount' van como
      // 'compensation' (icon 🎁) — el front maneja el detalle del amount/unit.
      const evtType = a.adjustment_type === 'refund' ? 'refunded' : 'compensation'
      timeline.push({
        type: evtType,
        date: new Date(a.created_at as string).toISOString().substring(0, 10),
        amountValue: typeof a.amount_value === 'number' ? a.amount_value : Number(a.amount_value),
        amountUnit: a.amount_unit as 'days' | 'eur' | 'percent',
        reasonDetail: a.reason_detail as string | null,
      } as { type: string; date: string; amountValue?: number; amountUnit?: string; reasonDetail?: string | null })
    }
  } catch {
    // No bloquear si falla — timeline sin adjustments es degradación aceptable
  }

  // 4. Próxima renovación (solo si no está cancelada)
  if (!subscription.cancel_at_period_end && periodEnd) {
    timeline.push({ type: 'renewal', date: periodEnd.substring(0, 10) })
  }

  return timeline
}

// ============================================
// CREAR SESIÓN DEL PORTAL DE STRIPE
// ============================================

export async function createPortalSession(
  params: CreatePortalSessionRequest
): Promise<CreatePortalSessionResponse> {
  try {
    const db = getDb()

    // Obtener stripe_customer_id
    const [profile] = await db
      .select({
        stripeCustomerId: userProfiles.stripeCustomerId
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile?.stripeCustomerId) {
      return { error: 'No subscription found' }
    }

    // Crear sesión del portal de Stripe
    const portalSession = await stripe().billingPortal.sessions.create({
      customer: profile.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/perfil?tab=suscripcion`
    })

    console.log('🔗 [Subscription] Portal session creada:', {
      userId: params.userId
    })

    return { url: portalSession.url }

  } catch (error) {
    console.error('❌ [Subscription] Error creando portal session:', error)
    return { error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ============================================
// HELPER: Buscar suscripción cancelable
// ============================================

/**
 * Estados de Stripe en los que una suscripción puede ser cancelada.
 *
 * - `active`/`trialing`: cancelación al final del período (mantienen acceso pagado)
 * - `past_due`/`unpaid`/`incomplete`: cancelación inmediata (acceso ya no garantizado;
 *   además paramos los smart retries de Stripe voideando invoices abiertas)
 *
 * Excluye `canceled` (ya no se puede cancelar de nuevo, manejado como idempotente)
 * y `incomplete_expired` (terminal, requiere nueva suscripción).
 */
const CANCELLABLE_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
])

/**
 * Estados en los que el usuario aún tiene (o se considera que tiene) acceso premium,
 * por lo que la cancelación debe respetar el periodo pagado.
 */
const KEEP_ACCESS_UNTIL_PERIOD_END = new Set(['active', 'trialing'])

/**
 * Devuelve la suscripción candidata a cancelar de un customer, o null si no hay.
 *
 * La API de Stripe `subscriptions.list({ status })` solo acepta UN estado por
 * llamada. Para soportar past_due/unpaid/incomplete, listamos con 'all' y
 * filtramos en código.
 *
 * Prioridad: si hay varias (raro), preferimos active/trialing > past_due/unpaid/incomplete.
 */
async function findCancellableSubscription(
  customerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const list = await stripe().subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  })
  const candidates = list.data.filter((s) => CANCELLABLE_STATUSES.has(s.status))
  if (candidates.length === 0) return null
  // Priorizar active/trialing sobre past_due/unpaid/incomplete
  const preferred = candidates.find((s) => KEEP_ACCESS_UNTIL_PERIOD_END.has(s.status))
  return preferred ?? candidates[0]
}

/**
 * Extrae current_period_end de forma defensiva (SDK v18+ puede no exponerlo
 * directamente — usa items[0].current_period_end como fallback, igual que
 * getSubscription y stripe-webhook-handlers).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractCurrentPeriodEnd(subscription: any): Date | null {
  const ts =
    subscription.current_period_end ??
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.cancel_at ??
    null
  return ts ? new Date(ts * 1000) : null
}

/**
 * Void de todas las invoices abiertas (open/draft) de una suscripción.
 * Devuelve el número de invoices voideadas.
 *
 * Best-effort: si una falla, se sigue con las demás. Las invoices ya pagadas
 * o ya voideadas no se tocan.
 */
async function voidOpenInvoicesForSubscription(subscriptionId: string): Promise<number> {
  let voided = 0
  try {
    const invoices = await stripe().invoices.list({
      subscription: subscriptionId,
      status: 'open',
      limit: 50,
    })
    for (const inv of invoices.data) {
      if (!inv.id) continue
      try {
        await stripe().invoices.voidInvoice(inv.id)
        voided++
      } catch (err) {
        console.error(`⚠️ [Cancel] Error voiding invoice ${inv.id}:`, err)
      }
    }
  } catch (err) {
    console.error('⚠️ [Cancel] Error listando invoices open:', err)
  }
  // Stripe no permite void de draft directamente — hay que finalizar primero.
  // No lo hacemos: las draft no generan reintentos hasta que se finalizan,
  // así que dejarlas pasa el ciclo natural sin riesgo de cobro.
  return voided
}

// ============================================
// REACTIVAR SUSCRIPCIÓN
// ============================================

export async function reactivateSubscription(
  params: { userId: string }
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const db = getDb()

    const [profile] = await db
      .select({ stripeCustomerId: userProfiles.stripeCustomerId })
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile?.stripeCustomerId) {
      return { success: false, error: 'No se encontró suscripción' }
    }

    // Buscar suscripción reactivable (debe estar cancel_at_period_end=true y
    // todavía en active/trialing — no se puede "reactivar" una past_due/unpaid).
    const list = await stripe().subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'all',
      limit: 20,
    })
    const subscription = list.data.find(
      (s) => KEEP_ACCESS_UNTIL_PERIOD_END.has(s.status) && s.cancel_at_period_end === true,
    )

    if (!subscription) {
      // Discriminar: ¿hay activa sin cancelar (idempotente OK) o no hay ninguna?
      const anyActive = list.data.find((s) => KEEP_ACCESS_UNTIL_PERIOD_END.has(s.status))
      if (anyActive) {
        return { success: true, message: 'La suscripción ya está activa' }
      }
      return { success: false, error: 'Tu suscripción ya ha expirado. Puedes contratar un nuevo plan.' }
    }

    // Reactivar en Stripe
    await stripe().subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    })

    console.log(`✅ [Reactivate] Subscription ${subscription.id} reactivated`)

    // Registrar en cancellation_feedback como reactivation
    try {
      const reactivatePeriodEnd = extractCurrentPeriodEnd(subscription)
      await db.execute(sql`
        INSERT INTO cancellation_feedback (
          user_id, subscription_id, reason, cancellation_type, period_end_at
        ) VALUES (
          ${params.userId},
          ${subscription.id},
          ${'reactivated'},
          ${'reactivation'},
          ${reactivatePeriodEnd ? reactivatePeriodEnd.toISOString() : null}
        )
      `)
    } catch (fbErr) {
      console.warn('⚠️ [Reactivate] Error guardando feedback:', fbErr)
    }

    return { success: true, message: 'Suscripción reactivada' }
  } catch (error) {
    console.error('❌ [Reactivate] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ============================================
// CANCELAR SUSCRIPCIÓN
// ============================================

export async function cancelSubscription(
  params: CancelSubscriptionRequest
): Promise<CancelSubscriptionResponse> {
  try {
    const db = getDb()

    // 1. Obtener datos del usuario y suscripción
    const [profile] = await db
      .select({
        stripeCustomerId: userProfiles.stripeCustomerId,
        planType: userProfiles.planType,
        email: userProfiles.email,
        fullName: userProfiles.fullName
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile?.stripeCustomerId) {
      return { success: false, error: 'No subscription found' }
    }

    // 2. Buscar suscripción cancelable (extiende a past_due/unpaid/incomplete,
    //    no solo 'active' — antes el filtro 'active' provocaba 404 silencioso
    //    en customers con pago fallido; ver memoria
    //    project_pending_stripe_cancel_bug.md, caso Mariangeles 21/05/2026,
    //    7 errores 404 al intentar cancelar).
    const subscription = await findCancellableSubscription(profile.stripeCustomerId)

    if (!subscription) {
      // Idempotencia: si todas las subs están canceled (no hay cancelable),
      // tratamos como éxito silencioso. El usuario ya consiguió su objetivo.
      const all = await stripe().subscriptions.list({
        customer: profile.stripeCustomerId,
        status: 'all',
        limit: 5,
      })
      const lastCanceled = all.data.find((s) => s.status === 'canceled')
      if (lastCanceled) {
        const endDate = extractCurrentPeriodEnd(lastCanceled)
        return {
          success: true,
          alreadyCanceled: true,
          message: 'La suscripción ya estaba cancelada',
          periodEnd: endDate ? endDate.toISOString() : undefined,
        }
      }
      return { success: false, error: 'No active subscription found' }
    }

    const periodEnd = extractCurrentPeriodEnd(subscription) ?? new Date()
    const originalStatus = subscription.status as string
    const cancelMode: 'at_period_end' | 'immediate' = KEEP_ACCESS_UNTIL_PERIOD_END.has(originalStatus)
      ? 'at_period_end'
      : 'immediate'
    const alreadyScheduled = subscription.cancel_at_period_end === true
    let voidedCount = 0

    // 3. Ejecutar la cancelación según estado.
    if (alreadyScheduled) {
      // Idempotencia: ya estaba cancel_at_period_end=true. No re-llamamos a Stripe
      // (segunda pulsación del botón, race con webhook, retry de cliente).
      // El flujo de feedback + emails sigue ejecutándose por si el usuario
      // proporciona feedback ahora; no rompemos la trazabilidad.
      console.log(`✅ [Cancel] Subscription ${subscription.id} ya estaba cancel_at_period_end (idempotent)`)
    } else if (cancelMode === 'at_period_end') {
      // 3a. active/trialing → cancelación programada al final del período
      //     (mantiene acceso pagado).
      await stripe().subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      })
      console.log(`✅ [Cancel] Subscription ${subscription.id} (${originalStatus}) marked for cancellation at period end`)
    } else {
      // 3b. past_due/unpaid/incomplete → cancelación INMEDIATA + void de
      //     invoices abiertas. Por qué inmediata: el acceso premium ya no
      //     estaba realmente garantizado (Stripe podría revocarlo al expirar
      //     smart retries) y el usuario quiere parar los cobros AHORA. Por
      //     qué void invoices: si las dejamos abiertas, Stripe sigue
      //     reintentando charge_automatically en background (caso Mariangeles
      //     21/05/2026, ver project_pending_stripe_cancel_bug.md).
      await stripe().subscriptions.cancel(subscription.id)
      voidedCount = await voidOpenInvoicesForSubscription(subscription.id)
      console.log(`✅ [Cancel] Subscription ${subscription.id} (${originalStatus}) canceled INMEDIATELY + ${voidedCount} invoices voided`)
    }

    // 4. Guardar feedback en la base de datos (usando raw SQL ya que la tabla no está en Drizzle schema)
    // Si no viene feedback (flujo 1-clic post-15/04/2026), se inserta con
    // reason='pending_feedback' y puede actualizarse después vía submitCancellationFeedback.
    const fb = params.feedback
    try {
      await db.execute(sql`
        INSERT INTO cancellation_feedback (
          user_id, subscription_id, reason, reason_details,
          alternative, contacted_support, plan_type, period_end_at
        ) VALUES (
          ${params.userId}::uuid,
          ${subscription.id},
          ${fb?.reason ?? 'pending_feedback'},
          ${fb?.reasonDetails || null},
          ${fb?.alternative || null},
          ${fb?.contactedSupport || false},
          ${profile.planType},
          ${periodEnd.toISOString()}::timestamptz
        )
      `)
      console.log(`✅ [Cancel] Feedback saved for user ${params.userId} (reason=${fb?.reason ?? 'pending_feedback'})`)
    } catch (feedbackError) {
      console.error('Error saving cancellation feedback:', feedbackError)
      // No fallamos si no se guarda el feedback, la cancelación ya se hizo
    }

    // 5. Enviar notificación al admin (opcional; solo si hay feedback real)
    if (fb) {
      try {
        await sendAdminNotification({
          userEmail: profile.email,
          userName: profile.fullName,
          reason: fb.reason,
          reasonDetails: fb.reasonDetails,
          alternative: fb.alternative,
          periodEnd
        })
      } catch (emailError) {
        console.error('Error sending admin notification:', emailError)
      }
    }

    // 6. Confirmación por email al usuario (fire-and-forget, estándar del sector).
    //    En modo 'immediate' avisamos de que el acceso se ha cortado ya.
    try {
      await sendCancellationConfirmationToUser({
        userEmail: profile.email,
        userName: profile.fullName,
        periodEnd,
        immediate: cancelMode === 'immediate',
      })
    } catch (userEmailError) {
      console.error('Error sending cancellation confirmation to user:', userEmailError)
    }

    return {
      success: true,
      periodEnd: periodEnd.toISOString(),
      message: alreadyScheduled
        ? 'Subscription already scheduled for cancellation'
        : cancelMode === 'immediate'
          ? 'Subscription cancelled immediately and pending invoices voided'
          : 'Subscription cancelled successfully',
      mode: cancelMode,
      voidedInvoices: voidedCount,
      alreadyCanceled: alreadyScheduled,
    }

  } catch (error) {
    console.error('❌ [Subscription] Error cancelando suscripción:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// FEEDBACK POST-CANCELACIÓN
// ============================================

/**
 * Actualiza el registro de cancellation_feedback más reciente del usuario
 * con el feedback enviado desde la pantalla de éxito post-cancelación.
 * Solo actualiza registros con reason='pending_feedback' (los creados por
 * el flujo 1-clic). Idempotente.
 */
export async function submitCancellationFeedback(params: {
  userId: string
  feedback: {
    reason: string
    reasonDetails?: string | null
    alternative?: string | null
    contactedSupport?: boolean
  }
}): Promise<{ success: boolean; error?: string }> {
  try {
    const db = getDb()

    // Buscar el registro pending más reciente del usuario
    const result = await db.execute(sql`
      UPDATE cancellation_feedback
      SET reason = ${params.feedback.reason},
          reason_details = ${params.feedback.reasonDetails || null},
          alternative = ${params.feedback.alternative || null},
          contacted_support = ${params.feedback.contactedSupport || false}
      WHERE id = (
        SELECT id FROM cancellation_feedback
        WHERE user_id = ${params.userId}::uuid
          AND reason = 'pending_feedback'
          AND cancellation_type IS DISTINCT FROM 'reactivation'
        ORDER BY created_at DESC
        LIMIT 1
      )
      RETURNING id
    `)

    const rowCount = Array.isArray(result) ? result.length : (result as { rowCount?: number })?.rowCount ?? 0
    if (!rowCount) {
      return { success: false, error: 'No hay cancelación pendiente de feedback para este usuario' }
    }

    // Intentar enviar notificación al admin (best-effort)
    try {
      const [profile] = await db
        .select({ email: userProfiles.email, fullName: userProfiles.fullName })
        .from(userProfiles)
        .where(eq(userProfiles.id, params.userId))
        .limit(1)

      if (profile) {
        await sendAdminNotification({
          userEmail: profile.email,
          userName: profile.fullName,
          reason: params.feedback.reason,
          reasonDetails: params.feedback.reasonDetails,
          alternative: params.feedback.alternative,
          periodEnd: new Date(),
        })
      }
    } catch (emailError) {
      console.error('Error sending admin notification (post-feedback):', emailError)
    }

    return { success: true }
  } catch (error) {
    console.error('❌ [Subscription] Error submitting cancellation feedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// ENVIAR NOTIFICACIÓN AL ADMIN
// ============================================

async function sendAdminNotification({
  userEmail,
  userName,
  reason,
  reasonDetails,
  alternative,
  periodEnd
}: {
  userEmail: string
  userName: string | null
  reason: string
  reasonDetails?: string | null
  alternative?: string | null
  periodEnd: Date
}) {
  const formattedDate = periodEnd.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const subject = `👋 Cancelación - ${userEmail} (${reasonLabels[reason] || reason})`

  const body = `
    <h2>Nueva cancelación de suscripción</h2>
    <p><strong>Usuario:</strong> ${userName || 'Sin nombre'} (${userEmail})</p>
    <p><strong>Motivo:</strong> ${reasonLabels[reason] || reason}</p>
    ${reasonDetails ? `<p><strong>Comentario:</strong> ${reasonDetails}</p>` : ''}
    ${alternative ? `<p><strong>Alternativa:</strong> ${alternativeLabels[alternative] || alternative}</p>` : ''}
    <p><strong>Premium hasta:</strong> ${formattedDate}</p>
  `

  // Usar Resend si está configurado
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: 'Vence <notificaciones@vence.es>',
      to: ['manuelrivas@hey.com'],
      subject,
      html: body
    })
  }
}

// ============================================
// EMAIL DE CONFIRMACIÓN AL USUARIO
// ============================================

async function sendCancellationConfirmationToUser({
  userEmail,
  userName,
  periodEnd,
  immediate = false,
}: {
  userEmail: string
  userName: string | null
  periodEnd: Date
  // Si true: cancelación inmediata (past_due/unpaid). Si false: al final del periodo (active/trialing).
  immediate?: boolean
}) {
  if (!process.env.RESEND_API_KEY) return

  const firstName = (userName || '').split(' ')[0] || 'hola'
  const formattedDate = periodEnd.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  // Bloque variable según el modo: al final del periodo vs inmediato.
  const accessBlockHtml = immediate
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:14px;color:#92400e;margin:0 0 4px 0;">✅ Suscripción cancelada</p>
      <p style="font-size:16px;font-weight:600;color:#92400e;margin:0;">Hemos detenido los intentos de cobro pendientes. No se te realizará ningún cargo adicional.</p>
    </div>
    <p style="font-size:15px;line-height:1.55;color:#424248;margin:0 0 24px 0;">Tu cuenta sigue activa en plan Free, puedes seguir usando Vence con las funciones gratuitas.</p>`
    : `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:14px;color:#1d4ed8;margin:0 0 4px 0;">📅 Mantendrás Premium hasta el</p>
      <p style="font-size:20px;font-weight:700;color:#1d4ed8;margin:0;">${formattedDate}</p>
    </div>
    <p style="font-size:15px;line-height:1.55;color:#424248;margin:0 0 24px 0;">A partir de esa fecha pasarás al plan Free.</p>`

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Suscripción cancelada</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px 0;">Hola <strong>${firstName}</strong>,</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px 0;">Te confirmamos que hemos <strong>cancelado tu suscripción Premium</strong>.</p>

    ${accessBlockHtml}

    <p style="font-size:14px;line-height:1.55;color:#424248;margin:0 0 16px 0;">Si tuviste algún problema o hay algo que podamos mejorar, responde a este email y te leemos. Gracias por usar Vence.</p>

    <p style="font-size:14px;line-height:1.5;margin:20px 0 0 0;">Un saludo,<br><strong>Equipo Vence</strong></p>
  </div>

  <p style="font-size:12px;color:#8e8e93;text-align:center;margin:20px 0 0 0;">Si no reconoces esta acción o fue un error, contáctanos respondiendo a este email.</p>
</div>
</body>
</html>`

  const accessBlockText = immediate
    ? `✅ Suscripción cancelada. Hemos detenido los intentos de cobro pendientes. No se te realizará ningún cargo adicional.

Tu cuenta sigue activa en plan Free, puedes seguir usando Vence con las funciones gratuitas.`
    : `📅 Mantendrás Premium hasta el ${formattedDate}

A partir de esa fecha pasarás al plan Free.`

  const text = `Hola ${firstName},

Te confirmamos que hemos cancelado tu suscripción Premium.

${accessBlockText}

Si tuviste algún problema o hay algo que podamos mejorar, responde a este email y te leemos. Gracias por usar Vence.

Un saludo,
Equipo Vence

---
Si no reconoces esta acción o fue un error, contáctanos respondiendo a este email.`

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Vence <info@vence.es>',
    to: [userEmail],
    subject: 'Tu suscripción Premium ha sido cancelada',
    html,
    text,
  })
}
