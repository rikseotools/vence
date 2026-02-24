// app/api/send-unlock-email/route.ts - API para enviar emails de desbloqueo de temas
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { canSendEmail, generateUnsubscribeToken, getUnsubscribeUrl } from '@/lib/api/emails'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      userEmail,
      userName,
      completedTopic,
      completedTopicName,
      unlockedTopic,
      unlockedTopicName,
      accuracy,
      userId,
    } = body

    if (!userEmail || !userName || !completedTopic || !unlockedTopic || !accuracy) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    // Verificar preferencias via v2 (topic_unlock es marketing, bloqueado por unsubscribed_all)
    if (userId) {
      const check = await canSendEmail(userId, 'topic_unlock')
      if (!check.canSend) {
        console.log(`⏭️ Email de desbloqueo bloqueado: ${check.reason}`)
        return NextResponse.json({
          success: false,
          reason: check.reason,
        }, { status: 200 })
      }
    }

    // Generar URL de unsubscribe token-based
    let unsubscribeUrl = 'https://www.vence.es/perfil'
    if (userId) {
      try {
        const token = await generateUnsubscribeToken(userId, userEmail, 'topic_unlock')
        unsubscribeUrl = getUnsubscribeUrl(token)
      } catch {
        // Fallback to profile page
      }
    }

    const emailSubject = `¡Tema ${unlockedTopic} Desbloqueado! - vence.es`

    const emailHtml = generateUnlockEmailHTML({
      userName,
      completedTopic,
      completedTopicName,
      unlockedTopic,
      unlockedTopicName,
      accuracy,
      unsubscribeUrl,
    })

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromName = process.env.EMAIL_FROM_NAME || 'Vence'
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: [userEmail],
      subject: emailSubject,
      html: emailHtml,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    if (emailError) {
      console.error('❌ Error enviando email de desbloqueo:', emailError)
      return NextResponse.json(
        { error: 'Error enviando email' },
        { status: 500 }
      )
    }

    // Registrar evento en analytics
    if (userId) {
      try {
        await getSupabase()
          .from('email_events')
          .insert({
            user_id: userId,
            email_type: 'topic_unlock',
            event_type: 'sent',
            email_address: userEmail,
            subject: emailSubject,
            metadata: {
              completed_topic: completedTopic,
              unlocked_topic: unlockedTopic,
              accuracy,
              topic_names: {
                completed: completedTopicName,
                unlocked: unlockedTopicName,
              },
            },
          })
      } catch (dbError) {
        console.error('⚠️ Error registrando email en analytics:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      emailId: emailData?.id,
      message: 'Email de desbloqueo enviado correctamente',
    })

  } catch (error) {
    console.error('❌ Error en send-unlock-email API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

interface UnlockEmailData {
  userName: string
  completedTopic: string
  completedTopicName: string
  unlockedTopic: string
  unlockedTopicName: string
  accuracy: number
  unsubscribeUrl: string
}

function generateUnlockEmailHTML(data: UnlockEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Tema Desbloqueado</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f7fa; }
            .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
            .content { padding: 40px 30px; }
            .celebration { text-align: center; margin-bottom: 30px; }
            .celebration .emoji { font-size: 64px; margin-bottom: 20px; display: block; }
            .stats { background-color: #f8fafc; border-radius: 8px; padding: 25px; margin: 25px 0; }
            .stat-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .stat-row:last-child { margin-bottom: 0; }
            .stat-label { font-weight: 600; color: #4a5568; }
            .stat-value { font-weight: bold; color: #2d3748; }
            .accuracy { color: #38a169; font-size: 18px; }
            .cta { text-align: center; margin: 30px 0; }
            .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; font-weight: bold; font-size: 16px; }
            .footer { background-color: #f7fafc; padding: 20px 30px; text-align: center; color: #718096; font-size: 14px; }
            .footer a { color: #667eea; text-decoration: none; }
            @media (max-width: 600px) {
                .container { margin: 0 10px; }
                .header, .content { padding: 30px 20px; }
                .header h1 { font-size: 24px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Felicidades, ${data.userName}!</h1>
                <p>Has desbloqueado un nuevo tema</p>
            </div>

            <div class="content">
                <div class="celebration">
                    <span class="emoji">🎉</span>
                    <h2 style="color: #2d3748; margin: 0 0 10px 0;">Tema ${data.unlockedTopic} Desbloqueado!</h2>
                    <p style="color: #718096; margin: 0;">Tu dedicación y esfuerzo han dado sus frutos</p>
                </div>

                <div class="stats">
                    <div class="stat-row">
                        <span class="stat-label">Tema Completado:</span>
                        <span class="stat-value">Tema ${data.completedTopic}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Nombre del Tema:</span>
                        <span class="stat-value">${data.completedTopicName}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Tu Precisión:</span>
                        <span class="stat-value accuracy">${data.accuracy}%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Nuevo Tema Disponible:</span>
                        <span class="stat-value">Tema ${data.unlockedTopic}: ${data.unlockedTopicName}</span>
                    </div>
                </div>

                <p style="color: #4a5568; line-height: 1.6; margin: 25px 0;">
                    <strong>Excelente trabajo!</strong> Has demostrado un dominio sólido del material con una precisión del <strong>${data.accuracy}%</strong>.
                    Esto significa que estás listo para avanzar al siguiente nivel de tu preparación.
                </p>

                <div class="cta">
                    <a href="https://www.vence.es/auxiliar-administrativo-estado/temario" class="cta-button">
                        Ver Nuevo Tema Desbloqueado
                    </a>
                </div>

                <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0;">
                    <strong>Consejo:</strong> Cada tema se basa en el anterior. Tu progreso secuencial te está dando
                    una base sólida para el examen de Auxiliar Administrativo del Estado.
                </p>
            </div>

            <div class="footer">
                <p>
                    <strong>vence.es</strong> - Preparación Inteligente para Oposiciones<br>
                    <a href="https://www.vence.es">Visitar sitio web</a> |
                    <a href="https://www.vence.es/auxiliar-administrativo-estado/temario">Ver todos los temas</a>
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
                    Este email se envió porque completaste un tema con éxito.
                    <a href="${data.unsubscribeUrl}" style="color: #a0aec0;">Cancelar suscripción</a>
                </p>
            </div>
        </div>
    </body>
    </html>
  `
}
