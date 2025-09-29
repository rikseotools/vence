// app/api/emails/send-medal-congratulation/route.js
// API endpoint para enviar emails de felicitación por medallas conseguidas

import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { userId, userName, medal, timestamp } = await request.json()

    if (!userId || !medal) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing required fields' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Crear cliente de Supabase con service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Obtener email del usuario
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !user?.user?.email) {
      console.error('Error getting user email:', userError)
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'User email not found' 
      }), { 
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const userEmail = user.user.email

    // Verificar preferencias de email del usuario
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    // Si el usuario ha desactivado todos los emails, no enviar
    if (preferences?.unsubscribed_all) {
      console.log('User has unsubscribed from all emails, skipping medal email')
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'User unsubscribed from emails' 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Generar contenido del email según la medalla
    const emailContent = generateMedalEmailContent(medal, userName)

    // Enviar email con Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Vence <noreply@ilovetest.com>',
      to: userEmail,
      subject: emailContent.subject,
      html: emailContent.html
    })

    if (emailError) {
      console.error('Error sending medal email:', emailError)
      throw emailError
    }

    // Registrar el envío en la tabla de eventos de email
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
      // No fallar el envío por error de logging
    } else {
      console.log('✅ Evento de medalla guardado en email_events')
    }

    console.log(`✅ Medal congratulation email sent successfully to ${userEmail}`)

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResult.id 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in medal email API:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Función para generar contenido del email según la medalla
function generateMedalEmailContent(medal, userName) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ilovetest.com'
  
  // Contenido específico según el tipo de medalla
  let congratsText = ''
  let achievementText = ''
  let motivationText = ''

  switch (medal.id) {
    case 'first_place_today':
      congratsText = '¡Eres el campeón del día! 🥇'
      achievementText = `Has conseguido el primer lugar en el ranking diario con un ${medal.stats?.accuracy}% de aciertos.`
      motivationText = '¡Increíble! Mantén este ritmo y dominarás la oposición.'
      break
    
    case 'first_place_week':
      congratsText = '¡Campeón de la semana! 🥇'
      achievementText = `Has dominado el ranking semanal con ${medal.stats?.totalQuestions} preguntas y ${medal.stats?.accuracy}% de precisión.`
      motivationText = 'Tu constancia y dedicación son ejemplares. ¡Sigue así!'
      break
    
    case 'first_place_month':
      congratsText = '¡Campeón del mes! 🥇'
      achievementText = `Has alcanzado la cima del ranking mensual. Tu esfuerzo ha sido extraordinario.`
      motivationText = 'Eres un ejemplo para todos los opositores. ¡El éxito está cada vez más cerca!'
      break
    
    case 'top_3_today':
    case 'top_3_week':
    case 'top_3_month':
      const period = medal.period === 'today' ? 'día' : medal.period === 'week' ? 'semana' : 'mes'
      congratsText = `¡En el podio del ${period}! 🏅`
      achievementText = `Has conseguido la posición #${medal.rank} en el ranking del ${period}.`
      motivationText = 'Estás entre los mejores. ¡El primer puesto está al alcance!'
      break
    
    case 'high_accuracy':
      congratsText = '¡Precisión extrema! 🎯'
      achievementText = `Has conseguido más del 90% de aciertos esta semana. Tu precisión es excepcional.`
      motivationText = 'Tu comprensión del temario es excelente. ¡Sigue perfeccionando!'
      break
    
    case 'volume_leader':
      congratsText = '¡Máquina de preguntas! 📚'
      achievementText = `Has respondido más de 100 preguntas esta semana. Tu dedicación es admirable.`
      motivationText = 'La práctica hace al maestro. ¡Tu esfuerzo dará sus frutos!'
      break
    
    default:
      congratsText = '¡Nueva medalla conseguida! 🏆'
      achievementText = medal.description
      motivationText = '¡Sigue esforzándote, vas por el buen camino!'
  }

  const subject = `🏆 ${congratsText} - Vence`

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
            <h1>¡Felicidades, ${userName}!</h1>
            <div class="medal">${medal.title.split(' ')[0]}</div>
            <p style="color: #e2e8f0; margin: 0; font-size: 18px;">${congratsText}</p>
        </div>
        
        <div class="content">
            <div class="achievement-box">
                <h2 style="margin: 0 0 10px 0; color: #92400e;">🏆 ${medal.title}</h2>
                <p style="margin: 0; color: #92400e; font-weight: 500;">${achievementText}</p>
            </div>
            
            ${medal.stats ? `
            <div class="stats">
                <h3 style="margin: 0 0 10px 0; color: #1e40af;">📊 Tus estadísticas:</h3>
                <p style="margin: 5px 0;"><strong>Preguntas respondidas:</strong> ${medal.stats.totalQuestions}</p>
                <p style="margin: 5px 0;"><strong>Porcentaje de aciertos:</strong> ${medal.stats.accuracy}%</p>
                <p style="margin: 5px 0;"><strong>Posición en el ranking:</strong> #${medal.rank}</p>
            </div>
            ` : ''}
            
            <p>${motivationText}</p>
            
            <p>¡Sigue practicando y conseguirás más medallas! Cada pregunta que respondes te acerca más al éxito en tu oposición.</p>
            
            <div style="text-align: center;">
                <a href="${baseUrl}/auxiliar-administrativo-estado/test" class="button">
                    🎯 Seguir Practicando
                </a>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <a href="${baseUrl}/mis-estadisticas" style="color: #667eea; text-decoration: none;">
                    📊 Ver todas mis medallas
                </a>
            </div>
        </div>
        
        <div class="footer">
            <p>Este email se envió porque conseguiste una nueva medalla en Vence.</p>
            <p>
                <a href="${baseUrl}/perfil?tab=emails" style="color: #64748b;">Gestionar preferencias de email</a>
            </p>
            <p>© ${new Date().getFullYear()} Vence - Tu plataforma de preparación de oposiciones</p>
        </div>
    </div>
</body>
</html>`

  return { subject, html }
}