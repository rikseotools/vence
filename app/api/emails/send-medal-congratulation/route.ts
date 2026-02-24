// app/api/emails/send-medal-congratulation/route.ts
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { canSendEmail } from '@/lib/api/emails'

interface MedalStats {
  accuracy?: number
  totalQuestions?: number
}

interface Medal {
  id: string
  title: string
  description?: string
  period?: string
  rank?: number
  stats?: MedalStats
}

export async function POST(request: Request) {
  try {
    const { userId, userName, medal } = await request.json() as {
      userId: string
      userName: string
      medal: Medal
    }

    if (!userId || !medal) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
      }, { status: 400 })
    }

    // Verificar preferencias via v2
    const check = await canSendEmail(userId, 'medal_congratulation')
    if (!check.canSend) {
      console.log(`⏭️ Medal email blocked: ${check.reason}`)
      return NextResponse.json({
        success: false,
        message: `Email blocked: ${check.reason}`,
      })
    }

    // Obtener email del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError || !user?.user?.email) {
      console.error('Error getting user email:', userError)
      return NextResponse.json({
        success: false,
        error: 'User email not found',
      }, { status: 404 })
    }

    const userEmail = user.user.email

    // Generar contenido del email
    const emailContent = generateMedalEmailContent(medal, userName)

    // Enviar email con Resend SDK
    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromName = process.env.EMAIL_FROM_NAME || 'Vence'
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${fromName} <${fromAddress}>`,
      to: userEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    if (emailError) {
      console.error('Error sending medal email:', emailError)
      throw emailError
    }

    // Registrar evento
    const { error: insertError } = await supabase
      .from('email_events')
      .insert({
        user_id: userId,
        email_type: 'medal_congratulation',
        event_type: 'sent',
        email_address: userEmail,
        subject: emailContent.subject,
        template_id: medal.id,
        email_content_preview: `Medalla conseguida: ${medal.title}`,
      })

    if (insertError) {
      console.error('❌ Error guardando evento de medalla en email_events:', insertError)
    }

    return NextResponse.json({
      success: true,
      emailId: emailResult?.id,
    })

  } catch (error) {
    console.error('Error in medal email API:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

function generateMedalEmailContent(medal: Medal, userName: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.vence.es'

  let congratsText = ''
  let achievementText = ''
  let motivationText = ''

  switch (medal.id) {
    case 'first_place_today':
      congratsText = 'Eres el campeon del dia!'
      achievementText = `Has conseguido el primer lugar en el ranking diario con un ${medal.stats?.accuracy}% de aciertos.`
      motivationText = 'Increible! Manten este ritmo y dominaras la oposicion.'
      break
    case 'first_place_week':
      congratsText = 'Campeon de la semana!'
      achievementText = `Has dominado el ranking semanal con ${medal.stats?.totalQuestions} preguntas y ${medal.stats?.accuracy}% de precision.`
      motivationText = 'Tu constancia y dedicacion son ejemplares. Sigue asi!'
      break
    case 'first_place_month':
      congratsText = 'Campeon del mes!'
      achievementText = 'Has alcanzado la cima del ranking mensual. Tu esfuerzo ha sido extraordinario.'
      motivationText = 'Eres un ejemplo para todos los opositores. El exito esta cada vez mas cerca!'
      break
    case 'top_3_today':
    case 'top_3_week':
    case 'top_3_month': {
      const period = medal.period === 'today' ? 'dia' : medal.period === 'week' ? 'semana' : 'mes'
      congratsText = `En el podio del ${period}!`
      achievementText = `Has conseguido la posicion #${medal.rank} en el ranking del ${period}.`
      motivationText = 'Estas entre los mejores. El primer puesto esta al alcance!'
      break
    }
    case 'high_accuracy':
      congratsText = 'Precision extrema!'
      achievementText = 'Has conseguido mas del 90% de aciertos esta semana. Tu precision es excepcional.'
      motivationText = 'Tu comprension del temario es excelente. Sigue perfeccionando!'
      break
    case 'volume_leader':
      congratsText = 'Maquina de preguntas!'
      achievementText = 'Has respondido mas de 100 preguntas esta semana. Tu dedicacion es admirable.'
      motivationText = 'La practica hace al maestro. Tu esfuerzo dara sus frutos!'
      break
    default:
      congratsText = 'Nueva medalla conseguida!'
      achievementText = medal.description || ''
      motivationText = 'Sigue esforzandote, vas por el buen camino!'
  }

  const subject = `${congratsText} - Vence`

  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${subject}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f8fafc; }
        .container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .medal { font-size: 60px; margin: 20px 0; }
        .content { padding: 30px 20px; }
        .achievement-box { background: #fef3cd; border: 2px solid #f6e05e; border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center; }
        .stats { background: #f0f9ff; border-radius: 8px; padding: 15px; margin: 15px 0; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Felicidades, ${userName}!</h1>
            <div class="medal">${medal.title.split(' ')[0]}</div>
            <p style="color: #e2e8f0; margin: 0; font-size: 18px;">${congratsText}</p>
        </div>

        <div class="content">
            <div class="achievement-box">
                <h2 style="margin: 0 0 10px 0; color: #92400e;">${medal.title}</h2>
                <p style="margin: 0; color: #92400e; font-weight: 500;">${achievementText}</p>
            </div>

            ${medal.stats ? `
            <div class="stats">
                <h3 style="margin: 0 0 10px 0; color: #1e40af;">Tus estadisticas:</h3>
                <p style="margin: 5px 0;"><strong>Preguntas respondidas:</strong> ${medal.stats.totalQuestions}</p>
                <p style="margin: 5px 0;"><strong>Porcentaje de aciertos:</strong> ${medal.stats.accuracy}%</p>
                <p style="margin: 5px 0;"><strong>Posicion en el ranking:</strong> #${medal.rank}</p>
            </div>
            ` : ''}

            <p>${motivationText}</p>

            <p>Sigue practicando y conseguiras mas medallas! Cada pregunta que respondes te acerca mas al exito en tu oposicion.</p>

            <div style="text-align: center;">
                <a href="${baseUrl}/auxiliar-administrativo-estado/test" class="button">
                    Seguir Practicando
                </a>
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <a href="${baseUrl}/mis-estadisticas" style="color: #667eea; text-decoration: none;">
                    Ver todas mis medallas
                </a>
            </div>
        </div>

        <div class="footer">
            <p>Este email se envio porque conseguiste una nueva medalla en Vence.</p>
            <p>
                <a href="${baseUrl}/perfil?tab=emails" style="color: #64748b;">Gestionar preferencias de email</a>
            </p>
            <p>&copy; ${new Date().getFullYear()} Vence - Tu plataforma de preparación de oposiciones</p>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}
