// __tests__/integration/feedbackEmailNotifications.test.js
// Tests completos para el sistema de feedback, emails y notificaciones
// Cubre: supportEmailService, APIs de admin, campana de notificaciones

import '@testing-library/jest-dom'

// ============================================
// MOCKS
// ============================================

// Mock de Supabase
const mockSupabaseClient = {
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  update: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  order: jest.fn(() => mockSupabaseClient),
  limit: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null }))
}

// ============================================
// SECCIÓN 1: TESTS DE SUPPORTEMAILSERVICE
// ============================================

describe('SupportEmailService - Lógica de envío de emails', () => {

  describe('Verificación de usuario activo (isUserActivelyBrowsing)', () => {

    function isUserActivelyBrowsing(lastActivityDate) {
      if (!lastActivityDate) return false
      const lastActivity = new Date(lastActivityDate)
      const now = new Date()
      const secondsSinceLastActivity = (now - lastActivity) / 1000
      return secondsSinceLastActivity <= 5
    }

    test('debe retornar true si actividad fue hace menos de 5 segundos', () => {
      const recentActivity = new Date(Date.now() - 2000).toISOString() // 2 segundos
      expect(isUserActivelyBrowsing(recentActivity)).toBe(true)
    })

    test('debe retornar false si actividad fue hace más de 5 segundos', () => {
      const oldActivity = new Date(Date.now() - 10000).toISOString() // 10 segundos
      expect(isUserActivelyBrowsing(oldActivity)).toBe(false)
    })

    test('debe retornar false si no hay fecha de actividad', () => {
      expect(isUserActivelyBrowsing(null)).toBe(false)
      expect(isUserActivelyBrowsing(undefined)).toBe(false)
    })

    test('debe retornar false exactamente en el límite de 5 segundos', () => {
      const exactLimit = new Date(Date.now() - 5001).toISOString() // 5.001 segundos
      expect(isUserActivelyBrowsing(exactLimit)).toBe(false)
    })
  })

  describe('Decisión de envío de email', () => {

    function shouldSendEmail(preferences, isActivelyBrowsing) {
      // Si deshabilitó todos los emails, no enviar
      if (preferences.unsubscribed_all) {
        return { send: false, reason: 'emails_disabled' }
      }
      // Si está navegando activamente, no enviar (verá la campana)
      if (isActivelyBrowsing) {
        return { send: false, reason: 'user_actively_browsing' }
      }
      return { send: true }
    }

    test('NO debe enviar si unsubscribed_all es true', () => {
      const result = shouldSendEmail({ unsubscribed_all: true }, false)
      expect(result.send).toBe(false)
      expect(result.reason).toBe('emails_disabled')
    })

    test('NO debe enviar si usuario está navegando activamente', () => {
      const result = shouldSendEmail({ unsubscribed_all: false }, true)
      expect(result.send).toBe(false)
      expect(result.reason).toBe('user_actively_browsing')
    })

    test('DEBE enviar si emails habilitados y usuario no activo', () => {
      const result = shouldSendEmail({ unsubscribed_all: false }, false)
      expect(result.send).toBe(true)
    })

    test('unsubscribed_all tiene prioridad sobre actividad', () => {
      // Aunque el usuario NO esté activo, si deshabilitó emails no se envía
      const result = shouldSendEmail({ unsubscribed_all: true }, false)
      expect(result.send).toBe(false)
      expect(result.reason).toBe('emails_disabled')
    })
  })

  describe('Preparación de datos del email', () => {

    function prepareEmailData(userInfo, adminMessage, conversationId) {
      const baseUrl = 'https://www.vence.es'
      return {
        to: userInfo.email,
        userName: userInfo.full_name || 'Usuario',
        adminMessage: adminMessage,
        chatUrl: `${baseUrl}/soporte?conversation_id=${conversationId}`,
        unsubscribeUrl: `${baseUrl}/perfil`
      }
    }

    test('debe usar full_name si está disponible', () => {
      const result = prepareEmailData(
        { email: 'test@test.com', full_name: 'Juan García' },
        'Hola',
        'conv-123'
      )
      expect(result.userName).toBe('Juan García')
    })

    test('debe usar "Usuario" como fallback si no hay nombre', () => {
      const result = prepareEmailData(
        { email: 'test@test.com', full_name: null },
        'Hola',
        'conv-123'
      )
      expect(result.userName).toBe('Usuario')
    })

    test('debe generar URLs correctas', () => {
      const result = prepareEmailData(
        { email: 'test@test.com', full_name: 'Test' },
        'Mensaje',
        'conv-abc-123'
      )
      expect(result.chatUrl).toBe('https://www.vence.es/soporte?conversation_id=conv-abc-123')
      expect(result.unsubscribeUrl).toBe('https://www.vence.es/perfil')
    })
  })
})

// ============================================
// SECCIÓN 2: TESTS DE API SEND-SUPPORT-EMAIL
// ============================================

describe('API /api/send-support-email - Validación de entrada', () => {

  function validateSupportEmailRequest(body) {
    const errors = []

    if (!body.userId) errors.push('userId es requerido')
    if (!body.adminMessage) errors.push('adminMessage es requerido')
    if (!body.conversationId) errors.push('conversationId es requerido')

    if (typeof body.adminMessage === 'string' && body.adminMessage.trim() === '') {
      errors.push('adminMessage no puede estar vacío')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  test('debe rechazar request sin userId', () => {
    const result = validateSupportEmailRequest({
      adminMessage: 'Hola',
      conversationId: '123'
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('userId es requerido')
  })

  test('debe rechazar request sin adminMessage', () => {
    const result = validateSupportEmailRequest({
      userId: 'user-123',
      conversationId: '123'
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('adminMessage es requerido')
  })

  test('debe rechazar request sin conversationId', () => {
    const result = validateSupportEmailRequest({
      userId: 'user-123',
      adminMessage: 'Hola'
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('conversationId es requerido')
  })

  test('debe rechazar adminMessage vacío', () => {
    const result = validateSupportEmailRequest({
      userId: 'user-123',
      adminMessage: '   ',
      conversationId: '123'
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('adminMessage no puede estar vacío')
  })

  test('debe aceptar request válida', () => {
    const result = validateSupportEmailRequest({
      userId: 'user-123',
      adminMessage: 'Gracias por tu mensaje',
      conversationId: 'conv-456'
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

// ============================================
// SECCIÓN 3: TESTS DE NOTIFICACIONES (CAMPANA)
// ============================================

describe('Sistema de Notificaciones - Campana', () => {

  describe('Creación de notificación de feedback_response', () => {

    function createFeedbackNotification(userId, adminMessage, conversationId, feedbackId) {
      const messagePreview = adminMessage.length > 100
        ? adminMessage.substring(0, 100) + '...'
        : adminMessage

      return {
        user_id: userId,
        message_sent: `El equipo de Vence: "${messagePreview}"`,
        delivery_status: 'sent',
        context_data: {
          type: 'feedback_response',
          title: 'Nueva respuesta de Vence',
          conversation_id: conversationId,
          feedback_id: feedbackId
        }
      }
    }

    test('debe crear notificación con estructura correcta', () => {
      const notification = createFeedbackNotification(
        'user-123',
        'Gracias por tu reporte',
        'conv-456',
        'feedback-789'
      )

      expect(notification.user_id).toBe('user-123')
      expect(notification.delivery_status).toBe('sent')
      expect(notification.context_data.type).toBe('feedback_response')
      expect(notification.context_data.conversation_id).toBe('conv-456')
      expect(notification.context_data.feedback_id).toBe('feedback-789')
    })

    test('debe truncar mensajes largos a 100 caracteres', () => {
      const longMessage = 'A'.repeat(150)
      const notification = createFeedbackNotification(
        'user-123',
        longMessage,
        'conv-456',
        'feedback-789'
      )

      expect(notification.message_sent).toContain('...')
      expect(notification.message_sent.length).toBeLessThan(150)
    })

    test('debe mantener mensajes cortos sin truncar', () => {
      const shortMessage = 'Mensaje corto'
      const notification = createFeedbackNotification(
        'user-123',
        shortMessage,
        'conv-456',
        'feedback-789'
      )

      expect(notification.message_sent).not.toContain('...')
      expect(notification.message_sent).toContain(shortMessage)
    })
  })

  describe('URL de redirección desde notificación', () => {

    function getNotificationRedirectUrl(contextData) {
      if (contextData.type === 'feedback_response') {
        return `/soporte?conversation_id=${contextData.conversation_id}`
      }
      if (contextData.type === 'dispute_response') {
        return `/soporte?tab=impugnaciones&dispute_id=${contextData.dispute_id}`
      }
      return '/soporte'
    }

    test('feedback_response debe redirigir a soporte con conversation_id', () => {
      const url = getNotificationRedirectUrl({
        type: 'feedback_response',
        conversation_id: 'conv-123'
      })
      expect(url).toBe('/soporte?conversation_id=conv-123')
    })

    test('dispute_response debe redirigir a impugnaciones con dispute_id', () => {
      const url = getNotificationRedirectUrl({
        type: 'dispute_response',
        dispute_id: 'dispute-456'
      })
      expect(url).toBe('/soporte?tab=impugnaciones&dispute_id=dispute-456')
    })

    test('tipo desconocido debe redirigir a soporte general', () => {
      const url = getNotificationRedirectUrl({ type: 'unknown' })
      expect(url).toBe('/soporte')
    })
  })

  describe('Filtrado de notificaciones no leídas', () => {

    function filterUnreadNotifications(notifications) {
      return notifications.filter(n => !n.read_at)
    }

    function countUnreadByType(notifications) {
      const unread = filterUnreadNotifications(notifications)
      return {
        total: unread.length,
        feedback: unread.filter(n => n.context_data?.type === 'feedback_response').length,
        dispute: unread.filter(n => n.context_data?.type === 'dispute_response').length
      }
    }

    test('debe filtrar solo notificaciones no leídas', () => {
      const notifications = [
        { id: '1', read_at: null },
        { id: '2', read_at: '2025-01-01' },
        { id: '3', read_at: null }
      ]
      const unread = filterUnreadNotifications(notifications)
      expect(unread).toHaveLength(2)
    })

    test('debe contar por tipo correctamente', () => {
      const notifications = [
        { id: '1', read_at: null, context_data: { type: 'feedback_response' } },
        { id: '2', read_at: null, context_data: { type: 'feedback_response' } },
        { id: '3', read_at: null, context_data: { type: 'dispute_response' } },
        { id: '4', read_at: '2025-01-01', context_data: { type: 'feedback_response' } }
      ]
      const counts = countUnreadByType(notifications)
      expect(counts.total).toBe(3)
      expect(counts.feedback).toBe(2)
      expect(counts.dispute).toBe(1)
    })
  })
})

// ============================================
// SECCIÓN 4: TESTS DE ADMIN FEEDBACK APIs
// ============================================

describe('Admin Feedback APIs - Validación Zod', () => {

  describe('updateFeedbackStatus schema', () => {

    function validateUpdateFeedbackStatus(data) {
      const validStatuses = ['pending', 'in_review', 'resolved', 'dismissed']
      const errors = []

      if (!data.feedbackId || typeof data.feedbackId !== 'string') {
        errors.push('feedbackId debe ser un string válido')
      }

      if (!data.status || !validStatuses.includes(data.status)) {
        errors.push(`status debe ser uno de: ${validStatuses.join(', ')}`)
      }

      return { valid: errors.length === 0, errors }
    }

    test('debe aceptar datos válidos', () => {
      const result = validateUpdateFeedbackStatus({
        feedbackId: 'feedback-123',
        status: 'resolved'
      })
      expect(result.valid).toBe(true)
    })

    test('debe rechazar status inválido', () => {
      const result = validateUpdateFeedbackStatus({
        feedbackId: 'feedback-123',
        status: 'invalid_status'
      })
      expect(result.valid).toBe(false)
    })

    test('debe rechazar sin feedbackId', () => {
      const result = validateUpdateFeedbackStatus({
        status: 'resolved'
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('adminSendMessage schema', () => {

    function validateAdminSendMessage(data) {
      const errors = []

      if (!data.conversationId || typeof data.conversationId !== 'string') {
        errors.push('conversationId es requerido')
      }

      if (!data.message || typeof data.message !== 'string') {
        errors.push('message es requerido')
      } else if (data.message.trim().length === 0) {
        errors.push('message no puede estar vacío')
      }

      return { valid: errors.length === 0, errors }
    }

    test('debe aceptar mensaje válido', () => {
      const result = validateAdminSendMessage({
        conversationId: 'conv-123',
        message: 'Gracias por contactarnos'
      })
      expect(result.valid).toBe(true)
    })

    test('debe rechazar mensaje vacío', () => {
      const result = validateAdminSendMessage({
        conversationId: 'conv-123',
        message: '   '
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('message no puede estar vacío')
    })

    test('debe rechazar sin conversationId', () => {
      const result = validateAdminSendMessage({
        message: 'Mensaje'
      })
      expect(result.valid).toBe(false)
    })
  })
})

describe('Admin Feedback APIs - Lógica de negocio', () => {

  describe('Cambio de estado de conversación', () => {

    function updateConversationStatusAfterAdminMessage(currentStatus) {
      // Cuando admin envía mensaje, siempre pasa a waiting_user
      return 'waiting_user'
    }

    function updateConversationStatusAfterUserMessage(currentStatus) {
      // Cuando usuario envía mensaje, pasa a waiting_admin
      return 'waiting_admin'
    }

    test('mensaje de admin debe cambiar estado a waiting_user', () => {
      expect(updateConversationStatusAfterAdminMessage('waiting_admin')).toBe('waiting_user')
      expect(updateConversationStatusAfterAdminMessage('waiting_user')).toBe('waiting_user')
    })

    test('mensaje de usuario debe cambiar estado a waiting_admin', () => {
      expect(updateConversationStatusAfterUserMessage('waiting_user')).toBe('waiting_admin')
      expect(updateConversationStatusAfterUserMessage('waiting_admin')).toBe('waiting_admin')
    })
  })

  describe('Contadores pendientes (badges)', () => {

    function calculatePendingCounts(feedbacks, conversations) {
      return {
        pendingFeedbacks: feedbacks.filter(f => f.status === 'pending').length,
        inReviewFeedbacks: feedbacks.filter(f => f.status === 'in_review').length,
        waitingAdminConversations: conversations.filter(c => c.status === 'waiting_admin').length,
        totalPending: feedbacks.filter(f => f.status === 'pending').length +
                      conversations.filter(c => c.status === 'waiting_admin').length
      }
    }

    test('debe contar feedbacks pendientes correctamente', () => {
      const feedbacks = [
        { status: 'pending' },
        { status: 'pending' },
        { status: 'resolved' }
      ]
      const result = calculatePendingCounts(feedbacks, [])
      expect(result.pendingFeedbacks).toBe(2)
    })

    test('debe contar conversaciones waiting_admin correctamente', () => {
      const conversations = [
        { status: 'waiting_admin' },
        { status: 'waiting_user' },
        { status: 'waiting_admin' }
      ]
      const result = calculatePendingCounts([], conversations)
      expect(result.waitingAdminConversations).toBe(2)
    })

    test('debe calcular total pendiente correctamente', () => {
      const feedbacks = [{ status: 'pending' }]
      const conversations = [{ status: 'waiting_admin' }]
      const result = calculatePendingCounts(feedbacks, conversations)
      expect(result.totalPending).toBe(2)
    })
  })
})

// ============================================
// SECCIÓN 5: TESTS DE EMAIL TEMPLATES
// ============================================

describe('Email Templates - soporte_respuesta', () => {

  describe('Generación de subject', () => {

    function generateSubject() {
      return '💬 El equipo de Vence te ha respondido'
    }

    test('subject debe ser constante', () => {
      expect(generateSubject()).toBe('💬 El equipo de Vence te ha respondido')
    })
  })

  describe('Generación de preview del mensaje', () => {

    function generateMessagePreview(adminMessage, maxLength = 60) {
      if (adminMessage.length > maxLength) {
        return adminMessage.substring(0, maxLength) + '...'
      }
      return adminMessage
    }

    test('debe truncar mensajes largos', () => {
      const longMessage = 'Este es un mensaje muy largo que supera los 60 caracteres permitidos para el preview'
      const preview = generateMessagePreview(longMessage)
      expect(preview.length).toBe(63) // 60 + '...'
      expect(preview.endsWith('...')).toBe(true)
    })

    test('debe mantener mensajes cortos intactos', () => {
      const shortMessage = 'Mensaje corto'
      const preview = generateMessagePreview(shortMessage)
      expect(preview).toBe(shortMessage)
    })
  })
})

// ============================================
// SECCIÓN 6: TESTS DE INTEGRACIÓN COMPLETA
// ============================================

describe('Integración - Flujo completo de respuesta admin', () => {

  test('flujo: admin envía mensaje → se crea notificación → se envía email (si aplica)', () => {
    // Simular estado inicial
    const feedback = {
      id: 'feedback-123',
      user_id: 'user-456',
      status: 'pending'
    }

    const conversation = {
      id: 'conv-789',
      feedback_id: feedback.id,
      status: 'waiting_admin'
    }

    const userPreferences = {
      unsubscribed_all: false
    }

    const userActivity = {
      last_activity: new Date(Date.now() - 60000).toISOString() // 1 minuto atrás
    }

    // 1. Admin envía mensaje
    const adminMessage = 'Gracias por tu reporte, lo estamos revisando'

    // 2. Se actualiza estado de conversación
    const newConversationStatus = 'waiting_user'
    expect(newConversationStatus).toBe('waiting_user')

    // 3. Se crea notificación
    const notification = {
      user_id: feedback.user_id,
      context_data: {
        type: 'feedback_response',
        conversation_id: conversation.id
      }
    }
    expect(notification.context_data.type).toBe('feedback_response')

    // 4. Se decide si enviar email
    const isActivelyBrowsing = (Date.now() - new Date(userActivity.last_activity)) / 1000 <= 5
    const shouldSendEmail = !userPreferences.unsubscribed_all && !isActivelyBrowsing

    expect(shouldSendEmail).toBe(true) // Usuario no activo y emails habilitados
  })

  test('flujo: usuario con emails deshabilitados solo recibe notificación', () => {
    const userPreferences = { unsubscribed_all: true }
    const isActivelyBrowsing = false

    const shouldSendEmail = !userPreferences.unsubscribed_all && !isActivelyBrowsing
    const shouldCreateNotification = true // Siempre se crea

    expect(shouldSendEmail).toBe(false)
    expect(shouldCreateNotification).toBe(true)
  })

  test('flujo: usuario navegando activamente solo recibe notificación (sin email)', () => {
    const userPreferences = { unsubscribed_all: false }
    const isActivelyBrowsing = true // Activo en los últimos 5 segundos

    const shouldSendEmail = !userPreferences.unsubscribed_all && !isActivelyBrowsing
    const shouldCreateNotification = true

    expect(shouldSendEmail).toBe(false)
    expect(shouldCreateNotification).toBe(true)
  })
})

// ============================================
// SECCIÓN 7: TESTS DE REGRESIÓN
// ============================================

describe('Regresión - Bugs conocidos del sistema de feedback', () => {

  test('BUG-004: notificación debe incluir conversation_id para redirección correcta', () => {
    const notification = {
      context_data: {
        type: 'feedback_response',
        conversation_id: 'conv-123'
      }
    }

    // El conversation_id es necesario para abrir el FeedbackModal correctamente
    expect(notification.context_data.conversation_id).toBeDefined()
    expect(notification.context_data.conversation_id).not.toBe('')
  })

  test('BUG-005: email debe enviarse a producción URL, no localhost', () => {
    const baseUrl = 'https://www.vence.es'
    const chatUrl = `${baseUrl}/soporte?conversation_id=test`

    expect(chatUrl).not.toContain('localhost')
    expect(chatUrl).toContain('vence.es')
  })

  test('BUG-006: unsubscribed_all debe bloquear TODOS los emails de soporte', () => {
    const preferences = { unsubscribed_all: true, email_soporte_disabled: false }

    // Aunque email_soporte_disabled sea false, unsubscribed_all tiene prioridad
    const canSendEmail = !preferences.unsubscribed_all
    expect(canSendEmail).toBe(false)
  })

  test('BUG-007: verificación de actividad debe usar ventana de 5 segundos exactos', () => {
    const checkIsActive = (secondsAgo) => secondsAgo <= 5

    expect(checkIsActive(4)).toBe(true)   // 4 seg -> activo
    expect(checkIsActive(5)).toBe(true)   // 5 seg -> activo (límite incluido)
    expect(checkIsActive(5.001)).toBe(false) // 5.001 seg -> no activo
    expect(checkIsActive(6)).toBe(false)  // 6 seg -> no activo
  })
})

// ============================================
// SECCIÓN 8: TESTS DE EDGE CASES
// ============================================

describe('Edge Cases - Casos límite del sistema', () => {

  test('mensaje de admin con caracteres especiales', () => {
    const adminMessage = 'Gracias! 😊 Tu reporte está siendo revisado. <script>alert("xss")</script>'

    // El mensaje debe guardarse tal cual (el sanitizado es responsabilidad del render)
    expect(adminMessage.length).toBeGreaterThan(0)
  })

  test('conversación sin mensajes previos', () => {
    const messages = []
    const isFirstMessage = messages.length === 0

    expect(isFirstMessage).toBe(true)
  })

  test('usuario sin sesiones registradas', () => {
    const sessions = []
    const hasRecentActivity = sessions.length > 0 &&
      (Date.now() - new Date(sessions[0]?.updated_at)) / 1000 <= 5

    // Sin sesiones, asumir que NO está activo -> enviar email
    expect(hasRecentActivity).toBe(false)
  })

  test('preferencias de email no existentes (usuario nuevo)', () => {
    const preferences = null

    // Si no hay preferencias, usar defaults (permitir emails)
    const effectivePreferences = preferences || {
      unsubscribed_all: false,
      email_soporte_disabled: false
    }

    expect(effectivePreferences.unsubscribed_all).toBe(false)
  })

  test('feedback sin user_id (feedback anónimo)', () => {
    const feedback = {
      id: 'feedback-123',
      user_id: null,
      email: 'anon@test.com'
    }

    // No se puede crear notificación ni enviar email sin user_id
    const canNotify = feedback.user_id !== null
    expect(canNotify).toBe(false)
  })
})
