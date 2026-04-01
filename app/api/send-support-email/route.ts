import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmailV2 } from '@/lib/api/emails'
import { Resend } from 'resend'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables de entorno de Supabase no configuradas')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Verificar si un usuario está activamente navegando (últimos 5 segundos)
async function isUserActivelyBrowsing(userId: string): Promise<boolean> {
  try {
    const supabase = getSupabase()

    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error && error.code !== 'PGRST116') return false
    if (!sessions || sessions.length === 0) return false

    const lastActivity = new Date(sessions[0].updated_at)
    const secondsSinceLastActivity = (Date.now() - lastActivity.getTime()) / 1000
    return secondsSinceLastActivity <= 5
  } catch {
    return false
  }
}

/**
 * Enviar respuesta directamente por email a un contacto externo (no registrado).
 * Usa Resend API directamente, sin pasar por sendEmailV2 (que requiere userId).
 */
async function sendDirectEmail(toEmail: string, adminMessage: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'
    const fromName = process.env.EMAIL_FROM_NAME || 'Vence.es'

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [toEmail],
      subject: 'Respuesta del equipo de Vence',
      replyTo: fromAddress,
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

async function _POST(request: Request) {
  try {
    const { userId, adminMessage, conversationId, email } = await request.json()

    if (!adminMessage || !conversationId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
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
    // Buscar email en el feedback asociado a la conversación
    let toEmail = email
    if (!toEmail) {
      const supabase = getSupabase()
      const { data: conv } = await supabase
        .from('feedback_conversations')
        .select('feedback_id')
        .eq('id', conversationId)
        .single()

      if (conv?.feedback_id) {
        const { data: feedback } = await supabase
          .from('user_feedback')
          .select('email')
          .eq('id', conv.feedback_id)
          .single()
        toEmail = feedback?.email
      }
    }

    if (!toEmail) {
      return NextResponse.json({ sent: false, reason: 'no_email_found' })
    }

    const result = await sendDirectEmail(toEmail, adminMessage)
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
