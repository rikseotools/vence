// lib/notifications/adminEmailNotifications.ts
// Sistema de notificaciones automáticas por email para admin

const ADMIN_EMAIL = 'manueltrader@gmail.com'

interface NotificationResult {
  success: boolean
  error?: string
  message?: string
  emailId?: string
  type?: string
}

interface FeedbackData {
  id: string
  user_id: string
  user_email?: string
  user_name?: string
  feedback_type: string
  message: string
  rating?: number | null
  created_at?: string
}

interface DisputeData {
  id: string
  question_id: string
  user_id: string
  user_email?: string
  user_name?: string
  dispute_type: string
  description: string
  question_text?: string
  created_at?: string
}

interface UserData {
  id: string
  email: string
  user_metadata?: { full_name?: string }
  app_metadata?: { provider?: string }
  created_at?: string
}

interface ChatData {
  conversation_id: string
  user_id: string
  user_email?: string
  user_name?: string
  message: string
  feedback_id?: string
  created_at?: string
}

interface PurchaseData {
  userId: string
  userEmail: string
  userName?: string
  amount: number
  currency?: string
  plan?: string
  stripeCustomerId: string
  createdAt?: string
}

interface ApiErrorData {
  questionId: string
  userAnswer: number
  errorType: string
  errorMessage: string
  userId: string
  timestamp?: string
}

export async function sendAdminFeedbackNotification(feedbackData: FeedbackData): Promise<NotificationResult> {
  try {
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
    return { success: false, error: (error as Error).message }
  }
}

export async function sendAdminDisputeNotification(disputeData: DisputeData): Promise<NotificationResult> {
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
    return { success: false, error: (error as Error).message }
  }
}

export async function sendAdminNewUserNotification(userData: UserData): Promise<NotificationResult> {
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
          adminUrl: `https://www.vence.es/admin`
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
    return { success: false, error: (error as Error).message }
  }
}

export async function sendAdminChatResponseNotification(chatData: ChatData): Promise<NotificationResult> {
  try {
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'chat_response',
        adminEmail: ADMIN_EMAIL,
        data: {
          conversationId: chatData.conversation_id,
          userId: chatData.user_id,
          userEmail: chatData.user_email || 'Usuario anónimo',
          userName: chatData.user_name || 'Sin nombre',
          message: chatData.message,
          feedbackId: chatData.feedback_id,
          createdAt: chatData.created_at || new Date().toISOString(),
          adminUrl: `https://www.vence.es/admin/feedback#conversation-${chatData.conversation_id}`
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin respuesta chat enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin respuesta chat:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function sendAdminNewPurchaseNotification(purchaseData: PurchaseData): Promise<NotificationResult> {
  try {
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'new_purchase',
        adminEmail: ADMIN_EMAIL,
        data: {
          userId: purchaseData.userId,
          userEmail: purchaseData.userEmail,
          userName: purchaseData.userName || 'Sin nombre',
          amount: purchaseData.amount,
          currency: purchaseData.currency || 'EUR',
          plan: purchaseData.plan || 'premium',
          stripeCustomerId: purchaseData.stripeCustomerId,
          createdAt: purchaseData.createdAt || new Date().toISOString(),
          adminUrl: `https://www.vence.es/admin/conversiones`
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin nueva compra enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin nueva compra:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function sendAdminApiErrorNotification(errorData: ApiErrorData): Promise<NotificationResult> {
  try {
    const response = await fetch('/api/emails/send-admin-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'api_error',
        adminEmail: ADMIN_EMAIL,
        data: {
          questionId: errorData.questionId,
          userAnswer: errorData.userAnswer,
          errorType: errorData.errorType,
          errorMessage: errorData.errorMessage,
          userId: errorData.userId,
          timestamp: errorData.timestamp || new Date().toISOString()
        }
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Email admin API error enviado:', result)
    return result

  } catch (error) {
    console.error('❌ Error enviando email admin API error:', error)
    return { success: false, error: (error as Error).message }
  }
}

type NotificationType = 'feedback' | 'dispute' | 'new_user' | 'chat_response' | 'new_purchase' | 'api_error'

export async function sendAdminNotification(type: NotificationType, data: unknown): Promise<NotificationResult> {
  switch (type) {
    case 'feedback':
      return await sendAdminFeedbackNotification(data as FeedbackData)
    case 'dispute':
      return await sendAdminDisputeNotification(data as DisputeData)
    case 'new_user':
      return await sendAdminNewUserNotification(data as UserData)
    case 'chat_response':
      return await sendAdminChatResponseNotification(data as ChatData)
    case 'new_purchase':
      return await sendAdminNewPurchaseNotification(data as PurchaseData)
    case 'api_error':
      return await sendAdminApiErrorNotification(data as ApiErrorData)
    default:
      console.error('❌ Tipo de notificación admin no reconocido:', type)
      return { success: false, error: 'Tipo de notificación no válido' }
  }
}
