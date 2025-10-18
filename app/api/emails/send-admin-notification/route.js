// app/api/emails/send-admin-notification/route.js
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@vence.es'

export async function POST(request) {
  try {
    const { type, adminEmail, data } = await request.json()

    if (!adminEmail || !type || !data) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    let emailContent = {}

    switch (type) {
      case 'feedback':
        emailContent = {
          subject: `🔔 Nuevo Feedback - ${data.feedbackType}`,
          html: generateFeedbackEmailHTML(data)
        }
        break

      case 'dispute':
        emailContent = {
          subject: `⚠️ Nueva Impugnación - ${data.disputeType}`,
          html: generateDisputeEmailHTML(data)
        }
        break

      case 'new_user':
        emailContent = {
          subject: `👋 Nuevo Usuario Registrado - ${data.userName}`,
          html: generateNewUserEmailHTML(data)
        }
        break

      case 'chat_response':
        emailContent = {
          subject: `💬 Nueva Respuesta en Chat - ${data.userName}`,
          html: generateChatResponseEmailHTML(data)
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de notificación no válido' },
          { status: 400 }
        )
    }

    const emailResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: emailContent.subject,
      html: emailContent.html
    })

    return NextResponse.json({
      success: true,
      message: 'Email de notificación admin enviado',
      emailId: emailResult.data?.id,
      type
    })

  } catch (error) {
    console.error('❌ Error enviando email admin:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

function generateFeedbackEmailHTML(data) {
  const ratingStars = '⭐'.repeat(data.rating || 0)
  const feedbackTypeEmoji = {
    'bug': '🐛',
    'suggestion': '💡',
    'complaint': '😞',
    'praise': '🎉',
    'other': '💬'
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevo Feedback</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #3b82f6; margin: 0;">🔔 Nuevo Feedback Recibido</h1>
          </div>

          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0 0 10px 0;">
              ${feedbackTypeEmoji[data.feedbackType] || '💬'} ${data.feedbackType?.toUpperCase() || 'FEEDBACK'}
            </h2>
            ${data.rating ? `<p style="margin: 5px 0;"><strong>Valoración:</strong> ${ratingStars} (${data.rating}/5)</p>` : ''}
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">📝 Mensaje:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${data.message}</p>
            </div>
          </div>

          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 10px 0;">👤 Datos del Usuario:</h3>
            <p style="margin: 5px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(data.createdAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              🔍 Ver en Panel Admin
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>

        </div>
      </body>
    </html>
  `
}

function generateDisputeEmailHTML(data) {
  const disputeTypeEmoji = {
    'no_literal': '📖',
    'wrong_answer': '❌',
    'other': '❓'
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Nueva Impugnación</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #dc2626; margin: 0;">⚠️ Nueva Impugnación de Pregunta</h1>
          </div>

          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #991b1b; margin: 0 0 10px 0;">
              ${disputeTypeEmoji[data.disputeType] || '❓'} ${data.disputeType?.replace('_', ' ').toUpperCase() || 'IMPUGNACIÓN'}
            </h2>
            <p style="margin: 5px 0;"><strong>ID Pregunta:</strong> ${data.questionId}</p>
            <p style="margin: 5px 0;"><strong>ID Impugnación:</strong> ${data.disputeId}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">❓ Pregunta Impugnada:</h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; font-style: italic;">${data.questionText}</p>
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">📝 Descripción del Problema:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #dc2626; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${data.description}</p>
            </div>
          </div>

          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 10px 0;">👤 Usuario que Impugna:</h3>
            <p style="margin: 5px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(data.createdAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              ⚖️ Revisar Impugnación
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>

        </div>
      </body>
    </html>
  `
}

function generateNewUserEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Nuevo Usuario Registrado</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #059669; margin: 0;">👋 Nuevo Usuario Registrado</h1>
          </div>

          <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #059669;">
            <h2 style="color: #065f46; margin: 0 0 10px 0;">🎉 ¡Tenemos un nuevo estudiante!</h2>
          </div>

          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">👤 Datos del Nuevo Usuario:</h3>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Método de registro:</strong> ${data.registrationMethod === 'google' ? '🔍 Google' : '📧 Email'}</p>
            <p style="margin: 8px 0;"><strong>Fecha de registro:</strong> ${new Date(data.createdAt).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p style="margin: 8px 0;"><strong>ID de usuario:</strong> <code style="background: #e0e7ff; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${data.userId}</code></p>
          </div>

          <div style="background: #fefce8; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #a16207; margin: 0 0 10px 0;">📊 Próximos Pasos Recomendados:</h3>
            <ul style="margin: 10px 0; padding-left: 20px; color: #92400e;">
              <li>Verificar que el usuario complete su primer test</li>
              <li>Monitorear actividad en las primeras 48 horas</li>
              <li>Enviar email de bienvenida personalizado si no está activo</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" 
               style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              👁️ Ver Perfil de Usuario
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>

        </div>
      </body>
    </html>
  `
}

function generateChatResponseEmailHTML(data) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Nueva Respuesta en Chat</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #3b82f6; margin: 0;">💬 Nueva Respuesta en Chat de Soporte</h1>
          </div>

          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
            <h2 style="color: #1e40af; margin: 0 0 10px 0;">🔔 Nuevo mensaje recibido</h2>
            <p style="margin: 5px 0; color: #1e40af;">Un usuario ha enviado una nueva respuesta en el chat de soporte.</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">💭 Mensaje del Usuario:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap; font-size: 16px;">${data.message}</p>
            </div>
          </div>

          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">⚡ Acción Requerida:</h3>
            <p style="margin: 5px 0; color: #78350f;">El usuario está esperando una respuesta del equipo de soporte. Se recomienda responder lo antes posible para mantener una buena experiencia de usuario.</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              💬 Responder en Chat
            </a>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence - info@vence.es</p>
          </div>

        </div>
      </body>
    </html>
  `
}