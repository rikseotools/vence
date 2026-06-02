import { NextRequest, NextResponse } from 'next/server'
import { sendEmailV2 } from '@/lib/api/emails'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { userSessions, feedbackConversations, userFeedback } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

// Verificar si un usuario está activamente navegando (últimos 5 segundos)
async function isUserActivelyBrowsing(userId: string): Promise<boolean> {
  try {
    const db = getReadDb()

    const sessions = await db
      .select({ updated_at: userSessions.updatedAt })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.updatedAt))
      .limit(1)

    if (sessions.length === 0 || !sessions[0].updated_at) return false

    const lastActivity = new Date(sessions[0].updated_at)
    const secondsSinceLastActivity = (Date.now() - lastActivity.getTime()) / 1000
    return secondsSinceLastActivity <= 5
  } catch {
    return false
  }
}

/**
 * Construye el subject de respuesta. Si tenemos el original, prefijamos con
 * "Re: " (sin duplicar si ya empieza por Re:/RE:/Fwd:). Si no, usamos genérico.
 */
function buildReplySubject(originalSubject: string | null | undefined): string {
  if (!originalSubject || !originalSubject.trim()) return 'Respuesta del equipo de Vence'
  const trimmed = originalSubject.trim()
  if (/^(Re|RE|Fwd|FW|RV):\s/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

/**
 * Enviar respuesta directamente por email a un contacto externo (no registrado).
 * Usa Resend API directamente, sin pasar por sendEmailV2 (que requiere userId).
 *
 * Si se proporcionan `originalMessageId` y `originalSubject`, hace email
 * threading correcto: añade In-Reply-To/References y prefija Subject con "Re:".
 * Esto hace que en Gmail/Outlook el reply aparezca en la misma conversación.
 */
async function sendDirectEmail(
  toEmail: string,
  adminMessage: string,
  threadInfo?: { originalMessageId?: string | null; originalSubject?: string | null }
): Promise<{ sent: boolean; error?: string }> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'
    const fromName = process.env.EMAIL_FROM_NAME || 'Vence.es'
    const subject = buildReplySubject(threadInfo?.originalSubject)
    const headers: Record<string, string> = {}
    if (threadInfo?.originalMessageId) {
      headers['In-Reply-To'] = threadInfo.originalMessageId
      headers['References'] = threadInfo.originalMessageId
    }

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [toEmail],
      subject,
      replyTo: fromAddress,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Vence.es</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Equipo de Soporte</p>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-line;">${adminMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              Este mensaje es una respuesta a tu consulta enviada a info@vence.es
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('📧 [DirectEmail] Error:', error)
      return { sent: false, error: error.message }
    }

    console.log(`📧 [DirectEmail] Enviado a ${toEmail}`)
    return { sent: true }
  } catch (err) {
    console.error('📧 [DirectEmail] Error:', err)
    return { sent: false, error: err instanceof Error ? err.message : 'Unknown' }
  }
}

async function _POST(request: NextRequest) {
  // Auth admin (post-14/04/2026). Antes el endpoint era público → cualquiera
  // podía disparar emails en nombre de Vence. Ahora requiere Bearer token de admin.
  // El admin UI lo pasa desde supabase.auth.getSession().access_token;
  // los scripts de Claude usan el patrón generateLink + verifyOtp.
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  try {
    const { userId, adminMessage, conversationId, email } = await request.json()

    if (!adminMessage || !conversationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    // Buscar info de threading: si la conversación viene de un feedback type='email'
    // (Resend Inbound), recuperar el Message-ID original (guardado en referrer)
    // y el Subject original (guardado en message) para hacer reply en mismo hilo.
    const db = getReadDb()
    let originalMessageId: string | null = null
    let originalSubject: string | null = null
    try {
      const conv = (await db
        .select({ feedback_id: feedbackConversations.feedbackId })
        .from(feedbackConversations)
        .where(eq(feedbackConversations.id, conversationId))
        .limit(1))[0]
      if (conv?.feedback_id) {
        const fb = (await db
          .select({ type: userFeedback.type, message: userFeedback.message, referrer: userFeedback.referrer, email: userFeedback.email })
          .from(userFeedback)
          .where(eq(userFeedback.id, conv.feedback_id))
          .limit(1))[0]
        if (fb?.type === 'email') {
          originalMessageId = fb.referrer || null
          originalSubject = fb.message || null
        }
      }
    } catch (err) {
      console.warn('⚠️ [send-support-email] No se pudo leer threading info:', err)
    }

    // --- Ruta 1: Usuario registrado (flujo existente) ---
    if (userId) {
      // Skip email if user is actively browsing (they'll see it in the chat)
      if (await isUserActivelyBrowsing(userId)) {
        return NextResponse.json({ sent: false, reason: 'user_actively_browsing' })
      }

      const baseUrl = 'https://www.vence.es'
      const chatUrl = `${baseUrl}/soporte?conversation_id=${conversationId}`

      const result = await sendEmailV2({
        userId,
        emailType: 'soporte_respuesta',
        customData: {
          adminMessage,
          chatUrl,
          // Email threading: si el feedback original vino por email, sendEmailV2
          // usará estos para hacer reply en el mismo hilo.
          replyToMessageId: originalMessageId,
          originalSubject,
        },
      })

      if (result.success) {
        return NextResponse.json({ sent: true, emailId: result.emailId })
      }

      if ('cancelled' in result && result.cancelled) {
        return NextResponse.json({ sent: false, reason: 'emails_disabled' })
      }

      return NextResponse.json({
        sent: false,
        reason: 'send_error',
        error: 'error' in result ? result.error : 'Unknown error',
      })
    }

    // --- Ruta 2: Contacto externo (email inbound, no registrado) ---
    let toEmail = email
    if (!toEmail) {
      const conv = (await db
        .select({ feedback_id: feedbackConversations.feedbackId })
        .from(feedbackConversations)
        .where(eq(feedbackConversations.id, conversationId))
        .limit(1))[0]
      if (conv?.feedback_id) {
        const feedback = (await db
          .select({ email: userFeedback.email })
          .from(userFeedback)
          .where(eq(userFeedback.id, conv.feedback_id))
          .limit(1))[0]
        toEmail = feedback?.email
      }
    }

    if (!toEmail) {
      return NextResponse.json({ sent: false, reason: 'no_email_found' })
    }

    const result = await sendDirectEmail(toEmail, adminMessage, {
      originalMessageId,
      originalSubject,
    })
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en API send-support-email:', error)
    return NextResponse.json(
      { sent: false, reason: 'api_error', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/send-support-email', _POST)
