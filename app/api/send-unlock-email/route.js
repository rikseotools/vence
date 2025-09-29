// app/api/send-unlock-email/route.js - API para enviar emails de desbloqueo de temas
import { NextResponse } from 'next/server'
import { getSupabaseClient } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
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
      userId 
    } = body

    // Validar datos requeridos
    if (!userEmail || !userName || !completedTopic || !unlockedTopic || !accuracy) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar preferencias de email del usuario antes de enviar
    if (userId) {
      const { data: emailPreferences } = await supabase
        .from('email_preferences')
        .select('unsubscribed_all, email_urgente')
        .eq('user_id', userId)
        .single()

      if (emailPreferences?.unsubscribed_all === true) {
        console.log('❌ Usuario desactivó todos los emails, saltando envío de desbloqueo')
        return NextResponse.json({ 
          success: false, 
          reason: 'Usuario desactivó todos los emails' 
        }, { status: 200 })
      }

      if (emailPreferences?.email_urgente === false) {
        console.log('❌ Usuario desactivó emails urgentes, saltando envío de desbloqueo')
        return NextResponse.json({ 
          success: false, 
          reason: 'Usuario desactivó emails urgentes' 
        }, { status: 200 })
      }

      console.log('✅ Usuario tiene emails activados, procediendo con envío de desbloqueo')
    }

    console.log('📧 Enviando email de desbloqueo:', {
      email: userEmail,
      name: userName,
      completed: completedTopic,
      unlocked: unlockedTopic,
      accuracy
    })

    // Crear contenido del email personalizado
    const emailSubject = `🎉 ¡Tema ${unlockedTopic} Desbloqueado! - ilovetest.pro`
    
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Nuevo Tema Desbloqueado!</title>
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
                <h1>¡Felicidades, ${userName}!</h1>
                <p>Has desbloqueado un nuevo tema</p>
            </div>
            
            <div class="content">
                <div class="celebration">
                    <span class="emoji">🎉</span>
                    <h2 style="color: #2d3748; margin: 0 0 10px 0;">¡Tema ${unlockedTopic} Desbloqueado!</h2>
                    <p style="color: #718096; margin: 0;">Tu dedicación y esfuerzo han dado sus frutos</p>
                </div>
                
                <div class="stats">
                    <div class="stat-row">
                        <span class="stat-label">✅ Tema Completado:</span>
                        <span class="stat-value">Tema ${completedTopic}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">📚 Nombre del Tema:</span>
                        <span class="stat-value">${completedTopicName}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">🎯 Tu Precisión:</span>
                        <span class="stat-value accuracy">${accuracy}%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">🔓 Nuevo Tema Disponible:</span>
                        <span class="stat-value">Tema ${unlockedTopic}: ${unlockedTopicName}</span>
                    </div>
                </div>
                
                <p style="color: #4a5568; line-height: 1.6; margin: 25px 0;">
                    <strong>¡Excelente trabajo!</strong> Has demostrado un dominio sólido del material con una precisión del <strong>${accuracy}%</strong>. 
                    Esto significa que estás listo para avanzar al siguiente nivel de tu preparación.
                </p>
                
                <div class="cta">
                    <a href="https://ilovetest.pro/auxiliar-administrativo-estado/temario" class="cta-button">
                        📖 Ver Nuevo Tema Desbloqueado
                    </a>
                </div>
                
                <p style="color: #718096; font-size: 14px; line-height: 1.5; margin: 25px 0 0 0;">
                    <strong>💡 Consejo:</strong> Cada tema se basa en el anterior. Tu progreso secuencial te está dando 
                    una base sólida para el examen de Auxiliar Administrativo del Estado.
                </p>
            </div>
            
            <div class="footer">
                <p>
                    <strong>ilovetest.pro</strong> - Preparación Inteligente para Oposiciones<br>
                    <a href="https://ilovetest.pro">Visitar sitio web</a> | 
                    <a href="https://ilovetest.pro/auxiliar-administrativo-estado/temario">Ver todos los temas</a>
                </p>
                <p style="margin-top: 15px; font-size: 12px; color: #a0aec0;">
                    Este email se envió porque completaste un tema con éxito. Si no deseas recibir estos emails, 
                    puedes desactivar las notificaciones en tu perfil.
                </p>
            </div>
        </div>
    </body>
    </html>
    `

    const emailText = `
¡Felicidades, ${userName}!

🎉 Has desbloqueado el Tema ${unlockedTopic}: ${unlockedTopicName}

Detalles de tu progreso:
✅ Tema Completado: Tema ${completedTopic} - ${completedTopicName}
🎯 Tu Precisión: ${accuracy}%
🔓 Nuevo Tema Disponible: Tema ${unlockedTopic}

¡Excelente trabajo! Has demostrado un dominio sólido del material con una precisión del ${accuracy}%.

Continúa tu preparación en: https://ilovetest.pro/auxiliar-administrativo-estado/temario

¡Sigue así y dominarás todos los temas!

---
ilovetest.pro - Preparación Inteligente para Oposiciones
    `

    // Enviar email usando Resend (asumiendo que ya está configurado)
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ilovetest.pro <noticias@ilovetest.pro>',
        to: [userEmail],
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
        tags: [
          { name: 'category', value: 'topic-unlock' },
          { name: 'topic', value: `tema-${unlockedTopic}` }
        ]
      }),
    })

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text()
      console.error('❌ Error enviando email con Resend:', errorText)
      return NextResponse.json(
        { error: 'Error enviando email' }, 
        { status: 500 }
      )
    }

    const resendData = await resendResponse.json()
    console.log('✅ Email de desbloqueo enviado:', resendData.id)

    // Opcional: Registrar el evento en la base de datos para analytics
    if (userId) {
      try {
        const supabase = getSupabaseClient()
        await supabase
          .from('email_events')
          .insert({
            user_id: userId,
            email_type: 'topic_unlock',
            recipient_email: userEmail,
            subject: emailSubject,
            status: 'sent',
            provider_id: resendData.id,
            metadata: {
              completed_topic: completedTopic,
              unlocked_topic: unlockedTopic,
              accuracy: accuracy,
              topic_names: {
                completed: completedTopicName,
                unlocked: unlockedTopicName
              }
            }
          })
        console.log('📊 Evento de email registrado en analytics')
      } catch (dbError) {
        console.error('⚠️ Error registrando email en analytics:', dbError)
        // No fallar por esto
      }
    }

    return NextResponse.json({ 
      success: true, 
      emailId: resendData.id,
      message: 'Email de desbloqueo enviado correctamente'
    })

  } catch (error) {
    console.error('❌ Error en send-unlock-email API:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}