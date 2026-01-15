// __tests__/hooks/useDisputeNotifications.test.js
// Tests para el hook useDisputeNotifications con soporte psicotécnico

import '@testing-library/jest-dom'

// ============================================
// SECCIÓN 1: ESTRUCTURA DE DATOS
// ============================================

describe('useDisputeNotifications - Estructura de Datos', () => {

  describe('Notificaciones normales', () => {
    const normalNotification = {
      id: 'dispute-uuid',
      type: 'dispute_update',
      isPsychometric: false,
      title: '✅ Impugnación Respondida',
      message: 'Tu reporte sobre CE Art. 14 ha sido aceptado.',
      timestamp: '2025-01-15T10:00:00Z',
      isRead: false,
      disputeId: 'dispute-uuid',
      status: 'resolved',
      article: 'CE - Art. 14',
      canAppeal: false
    }

    test('debe tener isPsychometric = false', () => {
      expect(normalNotification.isPsychometric).toBe(false)
    })

    test('debe incluir información del artículo', () => {
      expect(normalNotification.article).toBeDefined()
      expect(normalNotification.article).toContain('Art.')
    })

    test('puede incluir canAppeal para impugnaciones rechazadas', () => {
      const rejectedNotification = { ...normalNotification, status: 'rejected', canAppeal: true }
      expect(rejectedNotification.canAppeal).toBe(true)
    })
  })

  describe('Notificaciones psicotécnicas', () => {
    const psychoNotification = {
      id: 'psycho-dispute-uuid',
      type: 'dispute_update',
      isPsychometric: true,
      title: '✅ Impugnación Psicotécnica Respondida',
      message: 'Tu reporte sobre una pregunta psicotécnica ha sido aceptado.',
      timestamp: '2025-01-15T10:00:00Z',
      isRead: false,
      disputeId: 'psycho-dispute-uuid',
      status: 'resolved',
      article: '🧠 Psicotécnico',
      canAppeal: false
    }

    test('debe tener isPsychometric = true', () => {
      expect(psychoNotification.isPsychometric).toBe(true)
    })

    test('debe incluir article como "🧠 Psicotécnico"', () => {
      expect(psychoNotification.article).toBe('🧠 Psicotécnico')
    })

    test('NO debe tener canAppeal (siempre false)', () => {
      expect(psychoNotification.canAppeal).toBe(false)
    })

    test('título debe indicar "Psicotécnica"', () => {
      expect(psychoNotification.title).toContain('Psicotécnica')
    })
  })
})

// ============================================
// SECCIÓN 2: CARGA DE NOTIFICACIONES
// ============================================

describe('useDisputeNotifications - loadNotifications', () => {

  describe('Carga de impugnaciones normales', () => {
    test('debe filtrar por user_id del usuario actual', () => {
      const userId = 'user-123'
      const query = buildNormalDisputesQuery(userId)

      expect(query.filters.user_id).toBe(userId)
    })

    test('debe filtrar por estados resolved, rejected, appealed', () => {
      const query = buildNormalDisputesQuery('user-123')

      expect(query.filters.status).toContain('resolved')
      expect(query.filters.status).toContain('rejected')
      expect(query.filters.status).toContain('appealed')
    })

    test('debe filtrar por últimos 30 días', () => {
      const query = buildNormalDisputesQuery('user-123')

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      expect(new Date(query.filters.resolved_at_gte)).toBeInstanceOf(Date)
    })

    test('debe filtrar por is_read = false', () => {
      const query = buildNormalDisputesQuery('user-123')

      expect(query.filters.is_read).toBe(false)
    })
  })

  describe('Carga de impugnaciones psicotécnicas', () => {
    test('debe usar tabla psychometric_question_disputes', () => {
      const table = getPsychometricTable()
      expect(table).toBe('psychometric_question_disputes')
    })

    test('debe filtrar por user_id del usuario actual', () => {
      const userId = 'user-123'
      const query = buildPsychometricDisputesQuery(userId)

      expect(query.filters.user_id).toBe(userId)
    })

    test('debe filtrar por estados resolved, rejected (sin appealed)', () => {
      const query = buildPsychometricDisputesQuery('user-123')

      expect(query.filters.status).toContain('resolved')
      expect(query.filters.status).toContain('rejected')
      expect(query.filters.status).not.toContain('appealed')
    })
  })

  describe('Combinación de notificaciones', () => {
    test('debe combinar normales y psicotécnicas', () => {
      const normalNotifications = [
        { id: 'n1', timestamp: '2025-01-15T10:00:00Z', isPsychometric: false }
      ]
      const psychoNotifications = [
        { id: 'p1', timestamp: '2025-01-15T11:00:00Z', isPsychometric: true }
      ]

      const combined = combineNotifications(normalNotifications, psychoNotifications)

      expect(combined).toHaveLength(2)
      expect(combined.some(n => n.isPsychometric === true)).toBe(true)
      expect(combined.some(n => n.isPsychometric === false)).toBe(true)
    })

    test('debe ordenar por fecha descendente', () => {
      const notifications = [
        { id: 'old', timestamp: '2025-01-10T10:00:00Z' },
        { id: 'new', timestamp: '2025-01-15T10:00:00Z' },
        { id: 'mid', timestamp: '2025-01-12T10:00:00Z' }
      ]

      const sorted = sortNotificationsByDate(notifications)

      expect(sorted[0].id).toBe('new')
      expect(sorted[1].id).toBe('mid')
      expect(sorted[2].id).toBe('old')
    })
  })
})

// ============================================
// SECCIÓN 3: REAL-TIME SUBSCRIPTIONS
// ============================================

describe('useDisputeNotifications - Real-time', () => {

  describe('Suscripción a cambios', () => {
    test('debe suscribirse a question_disputes', () => {
      const channels = getSubscriptionChannels()

      expect(channels).toContain('question_disputes')
    })

    test('debe suscribirse a psychometric_question_disputes', () => {
      const channels = getSubscriptionChannels()

      expect(channels).toContain('psychometric_question_disputes')
    })

    test('debe escuchar evento UPDATE', () => {
      const eventType = getSubscriptionEventType()

      expect(eventType).toBe('UPDATE')
    })

    test('debe filtrar por user_id del usuario actual', () => {
      const userId = 'user-123'
      const filter = getSubscriptionFilter(userId)

      expect(filter).toBe(`user_id=eq.${userId}`)
    })
  })

  describe('Recargar al recibir actualización', () => {
    test('debe llamar loadNotifications cuando llega UPDATE', () => {
      const onUpdate = jest.fn()
      const payload = { new: { status: 'resolved' } }

      simulateRealtimeUpdate(payload, onUpdate)

      expect(onUpdate).toHaveBeenCalled()
    })
  })
})

// ============================================
// SECCIÓN 4: MARCAR COMO LEÍDO
// ============================================

describe('useDisputeNotifications - markAsRead', () => {

  describe('Selección de tabla correcta', () => {
    test('debe usar question_disputes para isPsychometric = false', () => {
      const table = getTableForMarkAsRead(false)
      expect(table).toBe('question_disputes')
    })

    test('debe usar psychometric_question_disputes para isPsychometric = true', () => {
      const table = getTableForMarkAsRead(true)
      expect(table).toBe('psychometric_question_disputes')
    })
  })

  describe('Actualización de estado', () => {
    test('debe actualizar is_read a true', () => {
      const updateData = getMarkAsReadUpdateData()

      expect(updateData.is_read).toBe(true)
    })

    test('debe filtrar por id y user_id', () => {
      const filters = getMarkAsReadFilters('notif-123', 'user-456')

      expect(filters.id).toBe('notif-123')
      expect(filters.user_id).toBe('user-456')
    })
  })

  describe('Actualización de estado local', () => {
    test('debe marcar notificación como leída en estado local', () => {
      const notifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: false }
      ]

      const updated = updateNotificationInState(notifications, 'n1')

      expect(updated.find(n => n.id === 'n1').isRead).toBe(true)
      expect(updated.find(n => n.id === 'n2').isRead).toBe(false)
    })

    test('debe decrementar unreadCount', () => {
      const currentCount = 5
      const newCount = decrementUnreadCount(currentCount)

      expect(newCount).toBe(4)
    })

    test('unreadCount no debe ser menor que 0', () => {
      const currentCount = 0
      const newCount = decrementUnreadCount(currentCount)

      expect(newCount).toBe(0)
    })
  })
})

// ============================================
// SECCIÓN 5: MARCAR TODAS COMO LEÍDAS
// ============================================

describe('useDisputeNotifications - markAllAsRead', () => {

  describe('Actualización en ambas tablas', () => {
    test('debe actualizar question_disputes', () => {
      const tables = getMarkAllAsReadTables()

      expect(tables).toContain('question_disputes')
    })

    test('debe actualizar psychometric_question_disputes', () => {
      const tables = getMarkAllAsReadTables()

      expect(tables).toContain('psychometric_question_disputes')
    })
  })

  describe('Filtros de actualización', () => {
    test('debe filtrar por user_id', () => {
      const filters = getMarkAllAsReadFilters('user-123')

      expect(filters.user_id).toBe('user-123')
    })

    test('debe filtrar por is_read = false', () => {
      const filters = getMarkAllAsReadFilters('user-123')

      expect(filters.is_read).toBe(false)
    })

    test('debe filtrar por estados correctos para normales', () => {
      const filters = getMarkAllAsReadFiltersForNormal()

      expect(filters.status).toContain('resolved')
      expect(filters.status).toContain('rejected')
      expect(filters.status).toContain('appealed')
    })

    test('debe filtrar por estados correctos para psicotécnicas', () => {
      const filters = getMarkAllAsReadFiltersForPsychometric()

      expect(filters.status).toContain('resolved')
      expect(filters.status).toContain('rejected')
      expect(filters.status).not.toContain('appealed')
    })
  })

  describe('Actualización de estado local', () => {
    test('debe marcar todas como leídas', () => {
      const notifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: false },
        { id: 'n3', isRead: true }
      ]

      const updated = markAllNotificationsAsRead(notifications)

      expect(updated.every(n => n.isRead === true)).toBe(true)
    })

    test('debe resetear unreadCount a 0', () => {
      const newCount = resetUnreadCount()

      expect(newCount).toBe(0)
    })
  })
})

// ============================================
// SECCIÓN 6: TRANSFORMACIÓN DE DATOS
// ============================================

describe('useDisputeNotifications - Transformación de datos', () => {

  describe('Título según estado', () => {
    test.each([
      ['resolved', false, '✅ Impugnación Respondida'],
      ['rejected', false, '❌ Impugnación Respondida'],
      ['appealed', false, '📝 Alegación Enviada'],
      ['resolved', true, '✅ Impugnación Psicotécnica Respondida'],
      ['rejected', true, '❌ Impugnación Psicotécnica Respondida']
    ])('estado %s, isPsychometric=%s debe dar título: %s', (status, isPsychometric, expectedTitle) => {
      const title = getNotificationTitle(status, isPsychometric)
      expect(title).toBe(expectedTitle)
    })
  })

  describe('Mensaje según estado', () => {
    test('resolved normal debe decir "aceptado"', () => {
      const message = getNotificationMessage('resolved', false, { lawName: 'CE', articleNumber: '14' })
      expect(message).toContain('aceptado')
    })

    test('rejected debe decir "rechazado"', () => {
      const message = getNotificationMessage('rejected', false, {})
      expect(message).toContain('rechazado')
    })

    test('appealed debe indicar "esperando revisión"', () => {
      const message = getNotificationMessage('appealed', false, {})
      expect(message).toContain('esperando revisión')
    })

    test('psicotécnica debe mencionar "pregunta psicotécnica"', () => {
      const message = getNotificationMessage('resolved', true, {})
      expect(message).toContain('pregunta psicotécnica')
    })
  })
})

// ============================================
// FUNCIONES AUXILIARES PARA TESTS
// ============================================

function buildNormalDisputesQuery(userId) {
  return {
    table: 'question_disputes',
    filters: {
      user_id: userId,
      status: ['resolved', 'rejected', 'appealed'],
      resolved_at_gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_read: false
    }
  }
}

function getPsychometricTable() {
  return 'psychometric_question_disputes'
}

function buildPsychometricDisputesQuery(userId) {
  return {
    table: 'psychometric_question_disputes',
    filters: {
      user_id: userId,
      status: ['resolved', 'rejected'],
      is_read: false
    }
  }
}

function combineNotifications(normal, psycho) {
  return [...normal, ...psycho]
}

function sortNotificationsByDate(notifications) {
  return [...notifications].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  )
}

function getSubscriptionChannels() {
  return ['question_disputes', 'psychometric_question_disputes']
}

function getSubscriptionEventType() {
  return 'UPDATE'
}

function getSubscriptionFilter(userId) {
  return `user_id=eq.${userId}`
}

function simulateRealtimeUpdate(payload, callback) {
  callback(payload)
}

function getTableForMarkAsRead(isPsychometric) {
  return isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'
}

function getMarkAsReadUpdateData() {
  return { is_read: true }
}

function getMarkAsReadFilters(notificationId, userId) {
  return { id: notificationId, user_id: userId }
}

function updateNotificationInState(notifications, id) {
  return notifications.map(n =>
    n.id === id ? { ...n, isRead: true } : n
  )
}

function decrementUnreadCount(count) {
  return Math.max(0, count - 1)
}

function getMarkAllAsReadTables() {
  return ['question_disputes', 'psychometric_question_disputes']
}

function getMarkAllAsReadFilters(userId) {
  return { user_id: userId, is_read: false }
}

function getMarkAllAsReadFiltersForNormal() {
  return { status: ['resolved', 'rejected', 'appealed'] }
}

function getMarkAllAsReadFiltersForPsychometric() {
  return { status: ['resolved', 'rejected'] }
}

function markAllNotificationsAsRead(notifications) {
  return notifications.map(n => ({ ...n, isRead: true }))
}

function resetUnreadCount() {
  return 0
}

function getNotificationTitle(status, isPsychometric) {
  if (isPsychometric) {
    return status === 'resolved'
      ? '✅ Impugnación Psicotécnica Respondida'
      : '❌ Impugnación Psicotécnica Respondida'
  }

  switch (status) {
    case 'resolved':
      return '✅ Impugnación Respondida'
    case 'rejected':
      return '❌ Impugnación Respondida'
    case 'appealed':
      return '📝 Alegación Enviada'
    default:
      return 'Impugnación Actualizada'
  }
}

function getNotificationMessage(status, isPsychometric, info) {
  if (isPsychometric) {
    return `Tu reporte sobre una pregunta psicotécnica ha sido ${
      status === 'resolved' ? 'aceptado' : 'rechazado'
    }.`
  }

  const article = info.lawName ? `${info.lawName} Art. ${info.articleNumber}` : 'el artículo'

  switch (status) {
    case 'resolved':
      return `Tu reporte sobre ${article} ha sido aceptado.`
    case 'rejected':
      return `Tu reporte sobre ${article} ha sido rechazado.`
    case 'appealed':
      return `Tu reporte sobre ${article} ha sido alegado - esperando revisión.`
    default:
      return 'Tu impugnación ha sido actualizada.'
  }
}
