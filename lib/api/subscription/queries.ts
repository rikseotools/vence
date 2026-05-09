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

  // 3. Próxima renovación (solo si no está cancelada)
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

    const subscriptions = await stripe().subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
    })

    if (subscriptions.data.length === 0) {
      return { success: false, error: 'Tu suscripción ya ha expirado. Puedes contratar un nuevo plan.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = subscriptions.data[0] as any

    if (!subscription.cancel_at_period_end) {
      return { success: false, error: 'La suscripción ya está activa' }
    }

    // Reactivar en Stripe
    await stripe().subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    })

    console.log(`✅ [Reactivate] Subscription ${subscription.id} reactivated`)

    // Registrar en cancellation_feedback como reactivation
    try {
      await db.execute(sql`
        INSERT INTO cancellation_feedback (
          user_id, subscription_id, reason, cancellation_type, period_end_at
        ) VALUES (
          ${params.userId},
          ${subscription.id},
          ${'reactivated'},
          ${'reactivation'},
          ${new Date(subscription.current_period_end * 1000).toISOString()}
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

    // 2. Obtener suscripción activa de Stripe
    const subscriptions = await stripe().subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1
    })

    if (subscriptions.data.length === 0) {
      return { success: false, error: 'No active subscription found' }
    }

    // Type assertion for subscription
    const subscription = subscriptions.data[0] as unknown as { id: string; current_period_end: number }
    const periodEnd = new Date(subscription.current_period_end * 1000)

    // 3. Cancelar suscripción al final del período
    await stripe().subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    })

    console.log(`✅ [Cancel] Subscription ${subscription.id} marked for cancellation at period end`)

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

    // 6. Confirmación por email al usuario (fire-and-forget, estándar del sector)
    try {
      await sendCancellationConfirmationToUser({
        userEmail: profile.email,
        userName: profile.fullName,
        periodEnd
      })
    } catch (userEmailError) {
      console.error('Error sending cancellation confirmation to user:', userEmailError)
    }

    return {
      success: true,
      periodEnd: periodEnd.toISOString(),
      message: 'Subscription cancelled successfully'
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
}: {
  userEmail: string
  userName: string | null
  periodEnd: Date
}) {
  if (!process.env.RESEND_API_KEY) return

  const firstName = (userName || '').split(' ')[0] || 'hola'
  const formattedDate = periodEnd.toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Suscripción cancelada</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
    <p style="font-size:16px;line-height:1.5;margin:0 0 16px 0;">Hola <strong>${firstName}</strong>,</p>
    <p style="font-size:16px;line-height:1.5;margin:0 0 24px 0;">Te confirmamos que hemos <strong>cancelado tu suscripción Premium</strong>.</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
      <p style="font-size:14px;color:#1d4ed8;margin:0 0 4px 0;">📅 Mantendrás Premium hasta el</p>
      <p style="font-size:20px;font-weight:700;color:#1d4ed8;margin:0;">${formattedDate}</p>
    </div>

    <p style="font-size:15px;line-height:1.55;color:#424248;margin:0 0 24px 0;">A partir de esa fecha pasarás al plan Free.</p>

    <p style="font-size:14px;line-height:1.55;color:#424248;margin:0 0 16px 0;">Si tuviste algún problema o hay algo que podamos mejorar, responde a este email y te leemos. Gracias por usar Vence.</p>

    <p style="font-size:14px;line-height:1.5;margin:20px 0 0 0;">Un saludo,<br><strong>Equipo Vence</strong></p>
  </div>

  <p style="font-size:12px;color:#8e8e93;text-align:center;margin:20px 0 0 0;">Si no reconoces esta acción o fue un error, contáctanos respondiendo a este email.</p>
</div>
</body>
</html>`

  const text = `Hola ${firstName},

Te confirmamos que hemos cancelado tu suscripción Premium.

📅 Mantendrás Premium hasta el ${formattedDate}

A partir de esa fecha pasarás al plan Free.

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
