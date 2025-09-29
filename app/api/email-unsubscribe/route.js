// app/api/email-unsubscribe/route.js - Unsubscribe sin login
import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Configuración de Supabase directa para mayor robustez
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    const action = searchParams.get('action') || 'unsubscribe'
    
    console.log('📧 Unsubscribe request:', { 
      token: token ? token.substring(0, 8) + '***' : 'null', 
      email: email ? email.substring(0, 5) + '***' : 'null', 
      action,
      url: request.url
    })

    // Validar parámetros
    if (!token || !email) {
      return new NextResponse(generateUnsubscribeHTML({
        success: false,
        message: 'Enlace de cancelación inválido. Por favor, contacta con soporte.',
        email: email
      }), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Verificar token de seguridad
    console.log('🔍 Verificando token...')
    const expectedToken = generateUnsubscribeToken(email)
    console.log('🔍 Token esperado:', expectedToken.substring(0, 8) + '***')
    console.log('🔍 Token recibido:', token.substring(0, 8) + '***')
    
    if (token !== expectedToken) {
      console.error('❌ Token inválido para:', email.substring(0, 5) + '***')
      console.error('❌ Expected:', expectedToken)
      console.error('❌ Received:', token)
      return new NextResponse(generateUnsubscribeHTML({
        success: false,
        message: 'Enlace de cancelación inválido o expirado.',
        email: email
      }), {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    console.log('✅ Token válido')

    // Buscar usuario por email usando fetch directo
    console.log('🔍 Buscando usuario por email...')
    const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=id,email`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    })
    
    const users = await userResponse.json()
    const user = users?.[0]

    if (!userResponse.ok || !user) {
      console.error('❌ Usuario no encontrado:', email, 'Status:', userResponse.status)
      return new NextResponse(generateUnsubscribeHTML({
        success: false,
        message: 'No encontramos tu cuenta. Puede que ya estés dado de baja.',
        email: email
      }), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    console.log('✅ Usuario encontrado:', user.id)

    if (action === 'unsubscribe') {
      // Dar de baja de todos los emails usando PATCH directo al registro existente
      console.log('📧 Dando de baja usuario...')
      const unsubResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          unsubscribed_all: true,
          email_reactivacion: false,
          email_urgente: false,
          email_bienvenida_motivacional: false,
          email_bienvenida_inmediato: false,
          email_resumen_semanal: false,
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      })

      if (!unsubResponse.ok) {
        const errorText = await unsubResponse.text()
        console.error('❌ Error dando de baja:', unsubResponse.status, errorText)
        return new NextResponse(generateUnsubscribeHTML({
          success: false,
          message: 'Error procesando tu solicitud. Inténtalo de nuevo.',
          email: email
        }), {
          headers: { 'Content-Type': 'text/html' }
        })
      }

      // Registrar evento de unsubscribe
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/email_events`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: user.id,
            event_type: 'unsubscribed',
            email_type: 'motivation',
            email_address: email,
            subject: 'Unsubscribe - All Emails',
            template_id: 'unsubscribe_all',
            email_content_preview: 'User unsubscribed from all emails',
            created_at: new Date().toISOString()
          })
        })
      } catch (err) {
        console.warn('⚠️ Error logging unsubscribe event:', err)
      }

      console.log('✅ Usuario dado de baja exitosamente:', email)

      return new NextResponse(generateUnsubscribeHTML({
        success: true,
        message: '¡Listo! Te hemos dado de baja de todos los emails.',
        details: 'Ya no recibirás más notificaciones por email. Puedes volver a suscribirte desde tu perfil cuando quieras.',
        email: email
      }), {
        headers: { 'Content-Type': 'text/html' }
      })

    } else if (action === 'resubscribe') {
      // Reactivar suscripciones usando PATCH directo al registro existente
      console.log('🔔 Reactivando suscripciones...')
      const resubResponse = await fetch(`${SUPABASE_URL}/rest/v1/email_preferences?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          unsubscribed_all: false,
          email_reactivacion: true,
          email_urgente: true,
          email_bienvenida_motivacional: true,
          email_bienvenida_inmediato: true,
          email_resumen_semanal: true,
          unsubscribed_at: null,
          updated_at: new Date().toISOString()
        })
      })

      if (!resubResponse.ok) {
        const errorText = await resubResponse.text()
        console.error('❌ Error reactivando suscripción:', resubResponse.status, errorText)
        return new NextResponse(generateUnsubscribeHTML({
          success: false,
          message: 'Error procesando tu solicitud. Inténtalo de nuevo.',
          email: email
        }), {
          headers: { 'Content-Type': 'text/html' }
        })
      }

      console.log('✅ Usuario reactivado exitosamente:', email)

      return new NextResponse(generateUnsubscribeHTML({
        success: true,
        message: '¡Perfecto! Has reactivado las notificaciones por email.',
        details: 'Volverás a recibir emails motivacionales y de logros para ayudarte en tu preparación.',
        email: email
      }), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

  } catch (error) {
    console.error('❌ Error en unsubscribe:', error)
    return new NextResponse(generateUnsubscribeHTML({
      success: false,
      message: 'Error interno. Por favor, contacta con soporte.',
      email: 'desconocido'
    }), {
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// Función para generar token seguro basado en email
function generateUnsubscribeToken(email) {
  // Usar secret fijo si no hay variable de entorno (para development)
  const secret = process.env.UNSUBSCRIBE_SECRET || 'ilovetest-unsubscribe-2025'
  console.log('🔐 Generando token para email:', email.substring(0, 5) + '***')
  
  try {
    const token = crypto
      .createHmac('sha256', secret)
      .update(email)
      .digest('hex')
      .substring(0, 16)
    
    console.log('✅ Token generado exitosamente')
    return token
  } catch (error) {
    console.error('❌ Error generando token:', error)
    throw error
  }
}

// Función para generar URL de unsubscribe
export function generateUnsubscribeUrl(email, action = 'unsubscribe') {
  const token = generateUnsubscribeToken(email)
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://ilovetest.pro' 
    : 'http://localhost:3002'
  
  return `${baseUrl}/api/email-unsubscribe?token=${token}&email=${encodeURIComponent(email)}&action=${action}`
}

// HTML para la página de unsubscribe
function generateUnsubscribeHTML({ success, message, details, email }) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${success ? '✅' : '❌'} ${success ? 'Dado de baja correctamente' : 'Error al procesar solicitud'} - ILoveTest</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          overflow: hidden;
        }
        .header {
          background: ${success ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'};
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .icon {
          font-size: 48px;
          margin-bottom: 10px;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .message {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 15px;
        }
        .details {
          color: #6b7280;
          font-size: 16px;
          margin-bottom: 30px;
        }
        .email {
          background: #f3f4f6;
          padding: 10px 15px;
          border-radius: 6px;
          font-family: monospace;
          color: #374151;
          margin: 20px 0;
        }
        .actions {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .btn {
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s;
          display: inline-block;
        }
        .btn-primary {
          background: #667eea;
          color: white;
        }
        .btn-primary:hover {
          background: #5a67d8;
          transform: translateY(-1px);
        }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .btn-secondary:hover {
          background: #e5e7eb;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          border-top: 1px solid #e5e7eb;
        }
        .footer p {
          margin: 0;
          font-size: 14px;
          color: #6b7280;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="icon">${success ? '✅' : '❌'}</div>
          <h1 style="margin: 0; font-size: 24px;">
            ${success ? 'Proceso Completado' : 'Error al Procesar'}
          </h1>
        </div>
        
        <div class="content">
          <div class="message">${message}</div>
          
          ${details ? `<div class="details">${details}</div>` : ''}
          
          <div class="email">📧 ${email}</div>
          
          <div class="actions">
            <a href="https://ilovetest.pro/auxiliar-administrativo-estado" class="btn btn-primary">
              🎯 Ir a ILoveTest
            </a>
            
            ${success && email !== 'desconocido' ? `
              <a href="${generateUnsubscribeUrl(email, 'resubscribe')}" class="btn btn-secondary">
                🔔 Reactivar Emails
              </a>
            ` : ''}
          </div>
        </div>
        
        <div class="footer">
          <p>
            <strong>ILoveTest</strong> - Te ayudamos a conseguir tu plaza
          </p>
          <p style="margin-top: 5px;">
            Si tienes dudas, contacta con nosotros en 
            <a href="mailto:soporte@ilovetest.pro" style="color: #667eea;">soporte@ilovetest.pro</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `
}