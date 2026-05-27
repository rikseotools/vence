// lib/api/admin-delete-user/email.ts
//
// Envío del email de confirmación de eliminación de cuenta.
//
// RGPD Art. 12.3: el responsable del tratamiento debe informar al
// interesado del resultado de su solicitud en el plazo de un mes.
// Para eliminaciones este email es OBLIGATORIO con independencia de
// las preferencias de soporte del usuario — es una notificación legal.
//
// Usa Resend API directamente (no sendEmailV2) porque el usuario ya no
// existe en user_profiles en el momento del envío — sendEmailV2 requiere
// userId y verifica email_preferences que ya han sido borradas.

import { Resend } from 'resend'

export interface SendDeletionEmailParams {
  email: string
  fullName?: string | null
}

export interface SendDeletionEmailResult {
  sent: boolean
  emailId?: string
  error?: string
}

/**
 * Envía el email de confirmación de eliminación de cuenta.
 *
 * - NO lanza excepciones: devuelve { sent, error } para que el caller
 *   pueda loguear y seguir sin romper el flujo de eliminación.
 * - El contenido es deliberadamente breve y sin detalles técnicos.
 *   Para ampliar el contenido (información legal sobre retención,
 *   derecho de reclamación, etc.), modificar la plantilla HTML.
 */
export async function sendDeletionConfirmationEmail(
  params: SendDeletionEmailParams
): Promise<SendDeletionEmailResult> {
  const { email, fullName } = params

  if (!email || !email.includes('@')) {
    return { sent: false, error: 'email inválido' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('❌ [DeletionEmail] RESEND_API_KEY no configurada')
    return { sent: false, error: 'RESEND_API_KEY no configurada' }
  }

  const resend = new Resend(apiKey)
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'
  const fromName = process.env.EMAIL_FROM_NAME || 'Vence.es'

  // Nombre para saludo: usa firstName si viene, o "Hola" genérico
  const firstName = fullName?.trim().split(/\s+/)[0] || null
  const greeting = firstName ? `Hola ${firstName},` : 'Hola,'

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Vence.es</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">${greeting}</p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          Confirmamos que hemos procesado tu solicitud y tu cuenta ha sido eliminada de Vence.
        </p>
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-top: 24px;">
          Un saludo,<br/>El equipo de Vence
        </p>
      </div>
    </div>
  `

  try {
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [email],
      subject: 'Confirmación de eliminación de cuenta — Vence',
      replyTo: fromAddress,
      html,
    })

    if (error) {
      console.error('❌ [DeletionEmail] Error Resend:', error)
      return { sent: false, error: error.message }
    }

    console.log(`✅ [DeletionEmail] Enviado a ${email} — emailId: ${data?.id}`)
    return { sent: true, emailId: data?.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('❌ [DeletionEmail] Excepción:', err)
    return { sent: false, error: msg }
  }
}
