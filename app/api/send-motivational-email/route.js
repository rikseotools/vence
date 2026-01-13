// app/api/send-motivational-email/route.js - API para enviar emails motivacionales
import { NextResponse } from 'next/server'
import { generateUnsubscribeUrl } from '../email-unsubscribe/route.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    // 🚫 DESACTIVADO PERMANENTEMENTE: Emails motivacionales ahora SOLO aparecen en campana
    console.log('🚫 API send-motivational-email DESACTIVADA - sin emails automáticos')
    return NextResponse.json({
      success: false,
      disabled: true,
      message: '🚫 Sistema de emails motivacionales desactivado. Solo notificaciones en campana.'
    }, { status: 200 })

    // 🚨 CÓDIGO ANTIGUO DESACTIVADO - TODO EL RESTO INACCESIBLE
    /*
    console.log('🎯 API send-motivational-email iniciada')

    const body = await request.json()
    console.log('📧 Datos recibidos:', JSON.stringify(body, null, 2))
    
    const { 
      userEmail, 
      userName, 
      messageType,
      title,
      body: messageBody,
      primaryAction,
      secondaryAction,
      userId 
    } = body

    // Validar datos requeridos con logs detallados
    const missingFields = []
    if (!userEmail) missingFields.push('userEmail')
    if (!userName) missingFields.push('userName')
    if (!messageType) missingFields.push('messageType')
    if (!title) missingFields.push('title')
    if (!messageBody) missingFields.push('body')

    if (missingFields.length > 0) {
      console.log('❌ Faltan datos requeridos:', missingFields)
      console.log('📋 Valores reales recibidos:', {
        userEmail: userEmail || 'UNDEFINED',
        userName: userName || 'UNDEFINED',
        messageType: messageType || 'UNDEFINED',
        title: title || 'UNDEFINED',
        body: messageBody || 'UNDEFINED',
        primaryAction: primaryAction || 'UNDEFINED',
        secondaryAction: secondaryAction || 'UNDEFINED',
        userId: userId || 'UNDEFINED'
      })
      return NextResponse.json(
        { 
          error: 'Faltan datos requeridos para email motivacional',
          missingFields,
          receivedFields: Object.keys(body)
        }, 
        { status: 400 }
      )
    }

    console.log('🎯 Enviando email motivacional:', {
      email: userEmail,
      name: userName,
      type: messageType,
      title
    })

    // Verificar RESEND_API_KEY
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY no configurada')
      return NextResponse.json(
        { error: 'RESEND_API_KEY no configurada' }, 
        { status: 500 }
      )
    }

    // Verificar preferencias de email del usuario antes de enviar
    if (userId) {
      const { data: emailPreferences } = await supabase
        .from('email_preferences')
        .select('unsubscribed_all, email_reactivacion')
        .eq('user_id', userId)
        .single()

      if (emailPreferences?.unsubscribed_all === true) {
        console.log('❌ Usuario desactivó todos los emails, saltando envío')
        return NextResponse.json({ 
          success: false, 
          reason: 'Usuario desactivó todos los emails' 
        }, { status: 200 })
      }

      if (emailPreferences?.email_reactivacion === false) {
        console.log('❌ Usuario desactivó emails motivacionales, saltando envío')
        return NextResponse.json({ 
          success: false, 
          reason: 'Usuario desactivó emails motivacionales' 
        }, { status: 200 })
      }

      console.log('✅ Usuario tiene emails activados, procediendo con envío')
    }

    // Generar ID temporal para tracking
    const temporaryEmailId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`
    
    // Preparar el HTML del email con tracking
    const htmlContent = generateMotivationalEmailHTML({
      userName,
      messageType,
      title,
      body: messageBody,
      primaryAction,
      secondaryAction,
      userId,
      emailId: temporaryEmailId,
      userEmail
    })

    console.log('📤 Enviando con Resend...')

    // Enviar con Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Vence <info@vence.es>',
        to: [userEmail],
        subject: `🎯 ${title}`,
        html: htmlContent
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('❌ Error enviando email motivacional:', result)
      return NextResponse.json(
        { error: 'Error enviando email motivacional', details: result }, 
        { status: 500 }
      )
    }

    console.log('✅ Email motivacional enviado correctamente:', result.id)

    // Registrar evento en analytics si userId está disponible
    if (userId) {
      try {
        const { getSupabaseClient } = await import('../../../lib/supabase')
        const supabase = getSupabaseClient()
        
        await supabase.from('email_events').insert({
          user_id: userId,
          event_type: 'sent',
          email_type: 'motivational',
          email_address: email, 
          subject: `🎯 ${title}`,
          template_id: messageType,
          email_content_preview: body?.substring(0, 200) || title
        })
        console.log('📊 Analytics registrado correctamente')
      } catch (analyticsError) {
        console.warn('⚠️ Error registrando analytics de email motivacional:', analyticsError)
      }
    }

    return NextResponse.json({ 
      success: true, 
      emailId: result.id,
      message: 'Email motivacional enviado correctamente'
    })

  } catch (error) {
    console.error('❌ Error en API de email motivacional:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error.message }, 
      { status: 500 }
    )
  }
}

function generateMotivationalEmailHTML({ userName, messageType, title, body, primaryAction, secondaryAction, userId, emailId, userEmail }) {
  // Obtener colores según el tipo de mensaje
  const getTypeStyles = (type) => {
    const typeMap = {
      'urgent_support': { bg: '#fef3c7', border: '#f59e0b', button: '#f59e0b' }, // Amarillo
      'achievement': { bg: '#fef3c7', border: '#f59e0b', button: '#f59e0b' }, // Amarillo  
      'study_streak': { bg: '#fef3c7', border: '#f59e0b', button: '#f59e0b' }, // Amarillo
      'improvement': { bg: '#fef3c7', border: '#f59e0b', button: '#f59e0b' }, // Amarillo
      'weakness': { bg: '#fee2e2', border: '#ef4444', button: '#ef4444' }, // Rojo
      'practice_reminder': { bg: '#dcfce7', border: '#22c55e', button: '#22c55e' }, // Verde
      'celebration': { bg: '#f0f9ff', border: '#3b82f6', button: '#3b82f6' } // Azul
    }
    return typeMap[type] || typeMap['achievement']
  }

  const styles = getTypeStyles(messageType)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, ${styles.button} 0%, ${styles.border} 100%); padding: 30px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: bold;">
            🎯 ¡Hola ${userName}!
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            Mensaje motivacional de Vence
          </p>
        </div>

        <!-- Content -->
        <div style="padding: 30px;">
          <div style="background-color: ${styles.bg}; border-left: 4px solid ${styles.border}; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; font-weight: bold;">
              ${title}
            </h2>
            <div style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              ${body.replace(/\n/g, '<br>')}
            </div>
          </div>

          <!-- Action Buttons con tracking -->
          <div style="text-align: center; margin: 30px 0;">
            ${primaryAction ? `
              <a href="${generateTrackedUrl(primaryAction.type, messageType, userId, emailId, 'primary')}" 
                 style="display: inline-block; background-color: ${styles.button}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px 10px 0; transition: all 0.3s;">
                ${primaryAction.label}
              </a>
            ` : ''}
            
            ${secondaryAction ? `
              <a href="${generateTrackedUrl(secondaryAction.type, messageType, userId, emailId, 'secondary')}" 
                 style="display: inline-block; background-color: transparent; color: ${styles.button}; padding: 15px 30px; text-decoration: none; border: 2px solid ${styles.button}; border-radius: 6px; font-weight: bold; margin: 0 10px 10px 0;">
                ${secondaryAction.label}
              </a>
            ` : ''}
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding-top: 30px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Sigue preparándote para tu oposición con <strong>Vence</strong>
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">
              <a href="https://www.vence.es/perfil?tab=notificaciones" style="color: #6b7280; text-decoration: underline;">
                Gestionar preferencias
              </a>
              •
              <a href="${generateUnsubscribeUrl(userEmail)}" style="color: #ef4444; text-decoration: underline;">
                Cancelar suscripción
              </a>
            </p>
          </div>
        </div>
      </div>

      <!-- Analytics pixel para tracking de apertura -->
      <img src="https://www.vence.es/api/email-tracking/open?email_id=${emailId}&user_id=${userId}&type=motivation" 
           width="1" height="1" style="display: none;" alt="">
    </body>
    </html>
  `
}

// Función para generar URLs con tracking
function generateTrackedUrl(actionType, messageType, userId, emailId, buttonType) {
  const baseUrl = generateActionUrl(actionType, messageType, userId)
  const trackingUrl = `https://www.vence.es/api/email-tracking/click?email_id=${emailId}&user_id=${userId}&action=${buttonType}_${actionType}&type=motivation&redirect=${encodeURIComponent(baseUrl)}`
  return trackingUrl
}

function generateActionUrl(actionType, messageType, userId = null) {
  // Para simplicidad, por ahora usamos las URLs normales
  // En el futuro se puede implementar autenticación automática
  
  // URLs específicas según el tipo de acción
  switch (actionType) {
    // Acciones de logros
    case 'next_challenge':
    case 'maintain_streak':
    case 'quick_test':
      return 'https://www.vence.es/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=motivational'
    
    // Acciones de estadísticas y progreso
    case 'view_achievements':
    case 'view_progress':
    case 'view_streak_stats':
    case 'view_details':
      return 'https://www.vence.es/mis-estadisticas?utm_source=email&utm_campaign=motivational'
    
    // Acciones de teoría y repaso
    case 'view_theory':
    case 'directed_review':
    case 'view_weak_areas':
      return 'https://www.vence.es/auxiliar-administrativo-estado/temario?utm_source=email&utm_campaign=motivational'
    
    // Acciones de mejora y consolidación
    case 'consolidate_improvement':
    case 'advanced_test':
      return 'https://www.vence.es/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=motivational&mode=advanced'
    
    // Test de acciones por defecto
    case 'test_action':
      return 'https://www.vence.es/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=test'
    
    // Por defecto
    default:
      return 'https://www.vence.es/auxiliar-administrativo-estado/test?utm_source=email&utm_campaign=motivational'
  }
}
*/
  } catch (error) {
    console.error('❌ Error en endpoint desactivado:', error)
    return NextResponse.json({
      success: false,
      disabled: true,
      message: '🚫 Endpoint desactivado',
      error: error.message
    }, { status: 200 })
  }
}