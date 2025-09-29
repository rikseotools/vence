// lib/notifications/adminEmailNotifications.js
// Sistema de notificaciones automáticas por email para admin

const ADMIN_EMAIL = 'ilovetestpro@gmail.com'

/**
 * Envía email al admin cuando hay nuevo feedback
 */
export async function sendAdminFeedbackNotification(feedbackData) {
  try {
    const { supabase } = await import('../supabase')
    
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'feedback',
        adminEmail: ADMIN_EMAIL,
        data: {
          userId: feedbackData.user_id,
          userEmail: feedbackData.user_email || 'Usuario anónimo',
          userName: feedbackData.user_name || 'Sin nombre',
          feedbackType: feedbackData.feedback_type,
          message: feedbackData.message,
          rating: feedbackData.rating,
          createdAt: feedbackData.created_at || new Date().toISOString(),
          // URL directa al feedback en admin
          adminUrl: `https://www.vence.es/admin#feedback-${feedbackData.id}`
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin feedback enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin feedback:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envía email al admin cuando hay nueva impugnación
 */
export async function sendAdminDisputeNotification(disputeData) {
  try {
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'dispute',
        adminEmail: ADMIN_EMAIL,
        data: {
          disputeId: disputeData.id,
          questionId: disputeData.question_id,
          userId: disputeData.user_id,
          userEmail: disputeData.user_email || 'Usuario anónimo',
          userName: disputeData.user_name || 'Sin nombre',
          disputeType: disputeData.dispute_type,
          description: disputeData.description,
          questionText: disputeData.question_text || 'Texto no disponible',
          createdAt: disputeData.created_at || new Date().toISOString(),
          // URL directa a la impugnación en admin
          adminUrl: `https://www.vence.es/admin/impugnaciones#dispute-${disputeData.id}`
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin impugnación enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin impugnación:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Envía email al admin cuando se registra nuevo usuario
 */
export async function sendAdminNewUserNotification(userData) {
  try {
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'new_user',
        adminEmail: ADMIN_EMAIL,
        data: {
          userId: userData.id,
          userEmail: userData.email,
          userName: userData.user_metadata?.full_name || 'Sin nombre',
          registrationMethod: userData.app_metadata?.provider || 'email',
          createdAt: userData.created_at || new Date().toISOString(),
          // URL directa al usuario en admin
          adminUrl: `https://www.vence.es/admin/usuarios/${userData.id}`
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin nuevo usuario enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin nuevo usuario:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Función genérica para enviar cualquier notificación admin
 */
export async function sendAdminNotification(type, data) {
  switch (type) {
    case 'feedback':
      return await sendAdminFeedbackNotification(data)
    case 'dispute':
      return await sendAdminDisputeNotification(data)
    case 'new_user':
      return await sendAdminNewUserNotification(data)
    default:
      console.error('❌ Tipo de notificación admin no reconocido:', type)
      return { success: false, error: 'Tipo de notificación no válido' }
  }
}