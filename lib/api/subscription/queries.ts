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
  'too_expensive': 'Es muy caro',
  'prefer_other': 'Prefiero estudiar de otra forma',
  'missing_features': 'La app no tiene lo que necesito',
  'no_progress': 'No veo progreso en mi preparación',
  'hard_to_use': 'La app es difícil de usar',
  'other': 'Otro'
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
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'all',
      limit: 1,
      expand: ['data.default_payment_method']
    })

    if (subscriptions.data.length === 0) {
      return {
        hasSubscription: false,
        planType: profile.planType,
        stripeCustomerId: profile.stripeCustomerId
      }
    }

    // Type assertion needed because Stripe SDK types may not expose all properties
    const subscription = subscriptions.data[0] as unknown as {
      id: string
      status: string
      current_period_start: number
      current_period_end: number
      cancel_at_period_end: boolean
      canceled_at: number | null
      created: number
      items: { data: Array<{ price?: { nickname?: string | null; unit_amount?: number | null; currency?: string; recurring?: { interval?: string; interval_count?: number } } }> }
    }

    console.log('💳 [Subscription] Datos obtenidos:', {
      userId: params.userId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    })

    return {
      hasSubscription: true,
      planType: profile.planType,
      stripeCustomerId: profile.stripeCustomerId,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        created: new Date(subscription.created * 1000).toISOString(),
        planName: subscription.items.data[0]?.price?.nickname || 'Premium',
        planAmount: subscription.items.data[0]?.price?.unit_amount ? subscription.items.data[0].price.unit_amount / 100 : null,
        planCurrency: subscription.items.data[0]?.price?.currency || null,
        planInterval: subscription.items.data[0]?.price?.recurring?.interval || null,
        planIntervalCount: subscription.items.data[0]?.price?.recurring?.interval_count || null
      }
    }

  } catch (error) {
    console.error('❌ [Subscription] Error obteniendo suscripción:', error)
    return {
      hasSubscription: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
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
    const portalSession = await stripe.billingPortal.sessions.create({
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
    const subscriptions = await stripe.subscriptions.list({
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
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true
    })

    console.log(`✅ [Cancel] Subscription ${subscription.id} marked for cancellation at period end`)

    // 4. Guardar feedback en la base de datos (usando raw SQL ya que la tabla no está en Drizzle schema)
    try {
      await db.execute(sql`
        INSERT INTO cancellation_feedback (
          user_id, subscription_id, reason, reason_details,
          alternative, contacted_support, plan_type, period_end_at
        ) VALUES (
          ${params.userId}::uuid,
          ${subscription.id},
          ${params.feedback.reason},
          ${params.feedback.reasonDetails || null},
          ${params.feedback.alternative || null},
          ${params.feedback.contactedSupport || false},
          ${profile.planType},
          ${periodEnd.toISOString()}::timestamptz
        )
      `)
      console.log(`✅ [Cancel] Feedback saved for user ${params.userId}`)
    } catch (feedbackError) {
      console.error('Error saving cancellation feedback:', feedbackError)
      // No fallamos si no se guarda el feedback, la cancelación ya se hizo
    }

    // 5. Enviar notificación al admin (opcional)
    try {
      await sendAdminNotification({
        userEmail: profile.email,
        userName: profile.fullName,
        reason: params.feedback.reason,
        reasonDetails: params.feedback.reasonDetails,
        alternative: params.feedback.alternative,
        periodEnd
      })
    } catch (emailError) {
      console.error('Error sending admin notification:', emailError)
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
