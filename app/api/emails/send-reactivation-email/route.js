// app/api/emails/send-reactivation-email/route.js - Email de reactivación para usuarios inactivos
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateUnsubscribeUrl } from '../../email-unsubscribe/route.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, testEmail } = body

    // Si es un email de prueba, usar el email especificado
    let targetUserId = userId
    let targetEmail = null

    if (testEmail) {
      // Para emails de prueba, usar los datos del admin
      targetEmail = testEmail
      console.log('📧 Enviando email de prueba a:', testEmail)
    } else {
      // Para usuarios reales, obtener datos de la BD
      const { data: user, error: userError } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, nickname')
        .eq('id', userId)
        .single()

      if (userError || !user) {
        return NextResponse.json({
          success: false,
          error: 'Usuario no encontrado'
        }, { status: 404 })
      }

      targetEmail = user.email
      targetUserId = user.id
    }

    // Verificar preferencias de email
    const { data: emailPreferences } = await supabase
      .from('email_preferences')
      .select('unsubscribed_all, email_reactivacion')
      .eq('user_id', targetUserId)
      .single()

    if (emailPreferences?.unsubscribed_all === true) {
      console.log('❌ Usuario desactivó todos los emails')
      return NextResponse.json({ 
        success: false, 
        reason: 'Usuario desactivó todos los emails' 
      }, { status: 200 })
    }

    if (emailPreferences?.email_reactivacion === false) {
      console.log('❌ Usuario desactivó emails de reactivación')
      return NextResponse.json({ 
        success: false, 
        reason: 'Usuario desactivó emails de reactivación' 
      }, { status: 200 })
    }

    // Obtener estadísticas del usuario
    const { data: userStats } = await supabase
      .from('admin_users_with_roles')
      .select('*')
      .eq('user_id', targetUserId)
      .single()

    const testsCompleted = userStats?.stats?.totalTests || 0
    const averageAccuracy = userStats?.stats?.averageAccuracy || 0
    const daysSinceLastActivity = userStats?.stats?.daysSinceLastActivity || 0

    // Obtener estadísticas globales
    const { data: globalStats } = await supabase
      .from('admin_users_with_roles')
      .select('stats')

    const activeUsersCount = globalStats?.filter(u => u.stats?.daysSinceLastActivity <= 7).length || 0
    const totalUsers = globalStats?.length || 0
    
    // Solo mostrar stats de usuarios activos si hay una cantidad significativa
    const showActiveUsersStats = activeUsersCount >= 5

    // Generar URL de unsubscribe
    const unsubscribeUrl = generateUnsubscribeUrl(targetEmail)

    // Crear el email
    const emailSubject = `🚀 ¡Hemos mejorado mucho! Nuevos 16 temas completos - Vence`
    
    // Generar URLs de tracking
    const trackingParams = new URLSearchParams({
      user_id: targetUserId,
      email_type: 'reactivation',
      template_id: 'reactivation_v1',
      timestamp: Date.now()
    }).toString()
    
    const trackingPixelUrl = `https://vence.es/api/email/track-open?${trackingParams}`
    const trackedMainUrl = `https://vence.es/api/email/track-click?${trackingParams}&url=${encodeURIComponent('https://vence.es/auxiliar-administrativo-estado')}&redirect=${encodeURIComponent('https://vence.es/auxiliar-administrativo-estado')}`
    
    const emailHtml = generateReactivationEmailHTML({
      userEmail: targetEmail,
      testsCompleted,
      averageAccuracy,
      daysSinceLastActivity,
      activeUsersCount,
      totalUsers,
      showActiveUsersStats,
      trackingPixelUrl,
      trackedMainUrl,
      unsubscribeUrl
    })

    // Enviar email usando Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Vence <noreply@vence.es>',
        to: [targetEmail],
        subject: emailSubject,
        html: emailHtml
      })
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(`Resend error: ${resendData.message}`)
    }

    // Registrar evento en la BD
    try {
      await supabase.from('email_events').insert({
        user_id: targetUserId,
        event_type: 'sent',
        email_type: 'reactivation',
        email_address: targetEmail,
        subject: emailSubject,
        template_id: 'reactivation_v1',
        email_content_preview: 'Email de reactivación con nuevas funcionalidades',
        external_id: resendData.id,
        created_at: new Date().toISOString()
      })
    } catch (err) {
      console.warn('⚠️ Error logging email event:', err)
    }

    console.log('✅ Email de reactivación enviado exitosamente')

    return NextResponse.json({
      success: true,
      message: 'Email de reactivación enviado',
      emailId: resendData.id,
      recipient: targetEmail
    })

  } catch (error) {
    console.error('❌ Error enviando email de reactivación:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

function generateReactivationEmailHTML({ 
  userEmail, 
  testsCompleted, 
  averageAccuracy, 
  daysSinceLastActivity,
  activeUsersCount,
  totalUsers,
  showActiveUsersStats,
  trackingPixelUrl,
  trackedMainUrl,
  unsubscribeUrl 
}) {
  const userName = userEmail.split('@')[0]
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>¡Vuelve a Vence! Muchas novedades te esperan</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          margin: 0; 
          padding: 0; 
          background-color: #f8fafc; 
          line-height: 1.6;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background-color: #ffffff; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
          color: white; 
          padding: 40px 30px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 28px; 
          font-weight: bold; 
        }
        .content { 
          padding: 40px 30px; 
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .stat-card {
          background: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
          display: block;
        }
        .stat-label {
          font-size: 14px;
          color: #64748b;
          margin-top: 5px;
        }
        .highlight-box {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border-left: 4px solid #0ea5e9;
          padding: 20px;
          margin: 25px 0;
          border-radius: 8px;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 32px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 18px;
          margin: 20px 0;
          transition: transform 0.2s;
        }
        .cta-button:hover {
          transform: translateY(-2px);
        }
        .features-list {
          background: #f9fafb;
          border-radius: 8px;
          padding: 25px;
          margin: 25px 0;
        }
        .feature-item {
          display: flex;
          align-items: center;
          margin: 12px 0;
          font-size: 16px;
        }
        .feature-icon {
          font-size: 20px;
          margin-right: 12px;
          width: 30px;
          text-align: center;
        }
        .footer {
          background: #f9fafb;
          padding: 30px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .unsubscribe {
          color: #9ca3af;
          font-size: 12px;
          margin-top: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚀 ¡Hola ${userName}!</h1>
          <p>Hemos estado trabajando duro y tenemos grandes novedades para ti</p>
        </div>
        
        <div class="content">
          <h2 style="color: #1f2937; margin-top: 0;">¿Sabías que hemos añadido muchas mejoras?</h2>
          
          <div class="highlight-box">
            <strong style="color: #0ea5e9;">🎉 ¡16 Temas Completos!</strong><br>
            Ahora tenemos todos los temas de Auxiliar Administrativo del Estado listos para que practiques.
          </div>

          <div class="highlight-box">
            <strong style="color: #dc2626; font-size: 18px;">🚨 ¿Sigues esperando el momento perfecto?</strong><br>
            Mientras esperas, otros ya están avanzando hacia SU plaza fija.
          </div>


          <div class="features-list">
            <h3 style="margin-top: 0; color: #374151;">✨ Nuevas funcionalidades:</h3>
            
            <div class="feature-item">
              <span class="feature-icon">📚</span>
              <span><strong>16 Temas Completos</strong> - Toda la materia de Auxiliar Administrativo</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-icon">🤖</span>
              <span><strong>Respuestas personalizadas</strong> - Para ser más productivo sin perder tiempo</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-icon">📊</span>
              <span><strong>Estadísticas Avanzadas</strong> - Analiza tu progreso en detalle</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-icon">🏆</span>
              <span><strong>Sistema de Rankings</strong> - Compite con otros opositores</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-icon">⚡</span>
              <span><strong>Interfaz Mejorada</strong> - Más rápida y fácil de usar</span>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackedMainUrl}" class="cta-button">
              🎯 Continuar mi preparación
            </a>
          </div>

          <div class="highlight-box" style="background: linear-gradient(135deg, #fef3c7 0%, #fcd34d 100%); border-left: 4px solid #f59e0b;">
            <strong style="color: #92400e; font-size: 18px;">⏰ El tiempo no espera</strong><br>
            <span style="color: #92400e;">Cada mes que pasa es una oportunidad menos. Tu futuro profesional está en juego.</span>
          </div>

          <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #047857; margin-top: 0; font-size: 20px;">🎯 Imagina tu vida en 1 año:</h3>
            <ul style="color: #047857; font-size: 16px; line-height: 1.8;">
              <li><strong>Estabilidad económica:</strong> Ingresos fijos todos los meses</li>
              <li><strong>Tranquilidad familiar:</strong> Sin miedo a perder el trabajo</li>
              <li><strong>Tiempo libre:</strong> 35 horas semanales, no más</li>
              <li><strong>Vacaciones reales:</strong> 30 días para disfrutar</li>
              <li><strong>Pensión asegurada:</strong> Tu futuro garantizado</li>
            </ul>
          </div>

          <div style="text-align: center; background: #fee2e2; border: 2px solid #dc2626; border-radius: 12px; padding: 20px; margin: 25px 0;">
            <strong style="color: #dc2626; font-size: 18px;">🔥 No dejes que otro año pase en vano</strong><br>
            <span style="color: #dc2626;">Tu plaza te está esperando. Solo tienes que ir a por ella.</span>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackedMainUrl}" class="cta-button">
              🚀 ¡Empezar ahora mismo!
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #374151; font-weight: bold;">
            Vence - Te ayudamos a conseguir tu plaza
          </p>
          <div class="unsubscribe">
            Si no quieres recibir más emails como este, 
            <a href="${unsubscribeUrl}" style="color: #9ca3af;">cancela tu suscripción aquí</a>
          </div>
        </div>
      </div>
      
      <!-- Pixel de tracking para apertura -->
      <img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
    </body>
    </html>
  `
}