// app/api/emails/send-admin-notification/route.ts
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  try {
    const { type, adminEmail, data } = await request.json() as {
      type: string
      adminEmail: string
      data: Record<string, unknown>
    }

    if (!adminEmail || !type || !data) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos' },
        { status: 400 }
      )
    }

    let emailContent: { subject: string; html: string }

    switch (type) {
      case 'feedback':
        emailContent = generateFeedbackEmailHTML(data)
        break
      case 'dispute':
        emailContent = generateDisputeEmailHTML(data)
        break
      case 'new_user':
        emailContent = generateNewUserEmailHTML(data)
        break
      case 'chat_response':
        emailContent = generateChatResponseEmailHTML(data)
        break
      case 'new_purchase':
        emailContent = generateNewPurchaseEmailHTML(data)
        break
      case 'boe_change':
        emailContent = generateBOEChangeEmailHTML(data)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de notificación no válido' },
          { status: 400 }
        )
    }

    const resend = new Resend(process.env.RESEND_API_KEY)
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es'

    const emailResult = await resend.emails.send({
      from: fromAddress,
      to: adminEmail,
      subject: emailContent.subject,
      html: emailContent.html,
    })

    return NextResponse.json({
      success: true,
      message: 'Email de notificación admin enviado',
      emailId: emailResult.data?.id,
      type,
    })

  } catch (error) {
    console.error('❌ Error enviando email admin:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateFeedbackEmailHTML(data: Record<string, unknown>) {
  const ratingStars = '⭐'.repeat((data.rating as number) || 0)
  const feedbackTypeEmoji: Record<string, string> = {
    'bug': '🐛',
    'suggestion': '💡',
    'complaint': '😞',
    'praise': '🎉',
    'other': '💬',
  }

  const feedbackType = data.feedbackType as string || 'FEEDBACK'
  const createdAt = data.createdAt ? new Date(data.createdAt as string).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return {
    subject: `Nuevo Feedback - ${feedbackType}`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nuevo Feedback</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #3b82f6; margin: 0;">Nuevo Feedback Recibido</h1>
          </div>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #1e40af; margin: 0 0 10px 0;">
              ${feedbackTypeEmoji[feedbackType] || '💬'} ${feedbackType.toUpperCase()}
            </h2>
            ${data.rating ? `<p style="margin: 5px 0;"><strong>Valoración:</strong> ${ratingStars} (${data.rating}/5)</p>` : ''}
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Mensaje:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${data.message}</p>
            </div>
          </div>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 10px 0;">Datos del Usuario:</h3>
            <p style="margin: 5px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${createdAt}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Ver en Panel Admin
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}

function generateDisputeEmailHTML(data: Record<string, unknown>) {
  const disputeTypeEmoji: Record<string, string> = {
    'no_literal': '📖',
    'wrong_answer': '❌',
    'other': '❓',
  }

  const disputeType = data.disputeType as string || ''
  const createdAt = data.createdAt ? new Date(data.createdAt as string).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return {
    subject: `Nueva Impugnación - ${disputeType}`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nueva Impugnación</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #dc2626; margin: 0;">Nueva Impugnación de Pregunta</h1>
          </div>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc2626;">
            <h2 style="color: #991b1b; margin: 0 0 10px 0;">
              ${disputeTypeEmoji[disputeType] || '❓'} ${disputeType.replace('_', ' ').toUpperCase()}
            </h2>
            <p style="margin: 5px 0;"><strong>ID Pregunta:</strong> ${data.questionId}</p>
            <p style="margin: 5px 0;"><strong>ID Impugnación:</strong> ${data.disputeId}</p>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Pregunta Impugnada:</h3>
            <div style="background: #f9fafb; padding: 15px; border-radius: 4px; border: 1px solid #e5e7eb;">
              <p style="margin: 0; font-style: italic;">${data.questionText}</p>
            </div>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Descripción del Problema:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #dc2626; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap;">${data.description}</p>
            </div>
          </div>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 10px 0;">Usuario que Impugna:</h3>
            <p style="margin: 5px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${createdAt}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Revisar Impugnación
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}

function generateNewUserEmailHTML(data: Record<string, unknown>) {
  const createdAt = data.createdAt ? new Date(data.createdAt as string).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return {
    subject: `Nuevo Usuario Registrado - ${data.userName}`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nuevo Usuario Registrado</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #059669; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #059669; margin: 0;">Nuevo Usuario Registrado</h1>
          </div>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">Datos del Nuevo Usuario:</h3>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Método de registro:</strong> ${(data.registrationMethod as string) === 'google' ? 'Google' : 'Email'}</p>
            <p style="margin: 8px 0;"><strong>Fecha de registro:</strong> ${createdAt}</p>
            <p style="margin: 8px 0;"><strong>ID de usuario:</strong> <code style="background: #e0e7ff; padding: 2px 6px; border-radius: 3px; font-size: 12px;">${data.userId}</code></p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Ver Perfil de Usuario
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}

function generateChatResponseEmailHTML(data: Record<string, unknown>) {
  return {
    subject: `Nueva Respuesta en Chat - ${data.userName}`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nueva Respuesta en Chat</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="color: #3b82f6; margin: 0;">Nueva Respuesta en Chat de Soporte</h1>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Mensaje del Usuario:</h3>
            <div style="background: #f9fafb; padding: 15px; border-left: 4px solid #3b82f6; border-radius: 4px;">
              <p style="margin: 0; white-space: pre-wrap; font-size: 16px;">${data.message}</p>
            </div>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">Acción Requerida:</h3>
            <p style="margin: 5px 0; color: #78350f;">El usuario esta esperando una respuesta del equipo de soporte.</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Responder en Chat
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence - info@vence.es</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}

function generateNewPurchaseEmailHTML(data: Record<string, unknown>) {
  const currencySymbol = (data.currency as string)?.toUpperCase() === 'EUR' ? '€' : (data.currency as string) || '€'
  const createdAt = data.createdAt ? new Date(data.createdAt as string).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  return {
    subject: `Nueva Compra Premium! - ${data.userEmail}`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Nueva Compra Premium</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #92400e; margin: 0;">NUEVA VENTA!</h1>
          </div>
          <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; border: 2px solid #10b981;">
            <div style="font-size: 48px; font-weight: bold; color: #059669;">${data.amount}${currencySymbol}</div>
            <div style="color: #065f46; font-size: 14px; margin-top: 5px;">Plan: ${data.plan || 'Premium'}</div>
          </div>
          <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #0c4a6e; margin: 0 0 15px 0;">Datos del Cliente:</h3>
            <p style="margin: 8px 0;"><strong>Email:</strong> ${data.userEmail}</p>
            <p style="margin: 8px 0;"><strong>Nombre:</strong> ${data.userName}</p>
            <p style="margin: 8px 0;"><strong>Fecha:</strong> ${createdAt}</p>
            <p style="margin: 8px 0;"><strong>Stripe Customer:</strong> <code style="background: #e0e7ff; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${data.stripeCustomerId}</code></p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Ver Panel de Conversiones
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Notificaciones Admin</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}

function generateBOEChangeEmailHTML(data: Record<string, unknown>) {
  const changes = data.changes as Array<{ law: string; name: string; oldDate: string; newDate: string }> | undefined
  const stats = data.stats as { checked?: number; duration?: string; totalBytesFormatted?: string } | undefined
  const timestamp = data.timestamp ? new Date(data.timestamp as string).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) : ''

  const changesHtml = changes?.map(change => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <strong style="color: #1e40af;">${change.law}</strong><br>
        <span style="font-size: 13px; color: #6b7280;">${change.name}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="background: #fef2f2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${change.oldDate}</span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">→</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
        <span style="background: #ecfdf5; color: #065f46; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${change.newDate}</span>
      </td>
    </tr>
  `).join('') || ''

  return {
    subject: `Cambio detectado en BOE! - ${data.changesCount} ley(es) modificada(s)`,
    html: `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><title>Cambio detectado en BOE</title></head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 700px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #dc2626; padding-bottom: 20px; margin-bottom: 20px; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); margin: -20px -20px 20px -20px; padding: 30px 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: #991b1b; margin: 0;">Cambio Detectado en BOE!</h1>
            <p style="color: #b91c1c; margin: 10px 0 0 0; font-size: 18px;">${data.changesCount} ley(es) han sido actualizadas</p>
          </div>
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin: 0 0 10px 0;">Acción Requerida</h3>
            <p style="margin: 0; color: #78350f;">Las siguientes leyes han sido modificadas en el BOE. Es necesario revisar los cambios y actualizar las preguntas afectadas.</p>
          </div>
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 15px;">Leyes Modificadas:</h3>
            <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: #e5e7eb;">
                  <th style="padding: 12px; text-align: left; color: #374151;">Ley</th>
                  <th style="padding: 12px; text-align: center; color: #374151;">Fecha Anterior</th>
                  <th style="padding: 12px; text-align: center; color: #374151;"></th>
                  <th style="padding: 12px; text-align: center; color: #374151;">Nueva Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${changesHtml}
              </tbody>
            </table>
          </div>
          <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin: 0 0 10px 0;">Estadísticas de Verificación:</h3>
            <p style="margin: 5px 0;"><strong>Leyes verificadas:</strong> ${stats?.checked || 0}</p>
            <p style="margin: 5px 0;"><strong>Duración:</strong> ${stats?.duration || '?'}</p>
            <p style="margin: 5px 0;"><strong>Datos descargados:</strong> ${stats?.totalBytesFormatted || '?'}</p>
            <p style="margin: 5px 0;"><strong>Fecha:</strong> ${timestamp}</p>
          </div>
          <div style="text-align: center; margin-top: 30px;">
            <a href="${data.adminUrl || 'https://www.vence.es/admin/monitoreo'}" style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Revisar en Panel de Monitoreo
            </a>
          </div>
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
            <p style="margin: 0;">Vence Pro - Sistema de Monitorización BOE</p>
          </div>
        </div>
      </body>
    </html>`,
  }
}
