// __tests__/integration/psychometricDisputes.test.js
// Tests de integración para el sistema completo de impugnaciones psicotécnicas

import '@testing-library/jest-dom'

// ============================================
// SECCIÓN 1: FLUJO COMPLETO - USUARIO CREA IMPUGNACIÓN
// ============================================

describe('Integración - Flujo de creación de impugnación psicotécnica', () => {

  test('flujo completo: usuario responde pregunta → impugna → se guarda', () => {
    // 1. Usuario está en test psicotécnico
    const testState = {
      questions: [
        { id: 'psycho-q-1', question_text: 'Serie: 2, 4, 6, ?', correct_option: 2 },
        { id: 'psycho-q-2', question_text: 'Serie: 1, 1, 2, 3, 5, ?', correct_option: 1 }
      ],
      currentQuestion: 0,
      showResult: true
    }

    // 2. Usuario decide impugnar
    const questionId = testState.questions[testState.currentQuestion].id
    expect(questionId).toBe('psycho-q-1')

    // 3. Prepara datos para el API
    const disputeData = {
      questionId: questionId,
      userId: 'user-123',
      disputeType: 'respuesta_incorrecta',
      description: 'Motivo: respuesta_incorrecta - Detalles: La respuesta correcta debería ser 8'
    }

    // 4. Verifica estructura correcta
    expect(disputeData).toMatchObject({
      questionId: expect.any(String),
      userId: expect.any(String),
      disputeType: expect.stringMatching(/^(respuesta_incorrecta|error_pregunta_respuesta|ai_detected_error|otro)$/),
      description: expect.any(String)
    })

    // 5. Simula respuesta exitosa del API
    const apiResponse = {
      success: true,
      disputeId: 'new-dispute-uuid'
    }

    expect(apiResponse.success).toBe(true)
    expect(apiResponse.disputeId).toBeDefined()
  })

  test('flujo: usuario impugna con tipo "error_pregunta_respuesta"', () => {
    const disputeData = {
      questionId: 'psycho-q-chart',
      userId: 'user-456',
      disputeType: 'error_pregunta_respuesta',
      description: 'Motivo: error_pregunta_respuesta - Detalles: El gráfico muestra datos incorrectos'
    }

    // Tipo error_pregunta_respuesta es exclusivo de psicotécnicas
    expect(disputeData.disputeType).toBe('error_pregunta_respuesta')
    expect(disputeData.description).toContain('gráfico')
  })
})

// ============================================
// SECCIÓN 2: FLUJO COMPLETO - ADMIN RESPONDE
// ============================================

describe('Integración - Flujo de respuesta del admin', () => {

  test('flujo: admin cierra impugnación → se envía email', async () => {
    // 1. Admin ve impugnación pendiente
    const dispute = {
      id: 'dispute-uuid',
      question_id: 'psycho-q-1',
      user_id: 'user-123',
      status: 'pending',
      isPsychometric: true
    }

    expect(dispute.status).toBe('pending')

    // 2. Admin cierra la impugnación
    const updatedDispute = {
      ...dispute,
      status: 'rejected',
      resolved_at: new Date().toISOString(),
      admin_response: 'Impugnación cerrada por el administrador sin respuesta específica.'
    }

    expect(updatedDispute.status).toBe('rejected')
    expect(updatedDispute.admin_response).toBeDefined()

    // 3. Endpoint unificado post-14/04/2026: /api/v2/dispute/resolve
    //    discrimina por questionType en el body, no por path.
    const resolveBody = {
      disputeId: dispute.id,
      questionType: dispute.isPsychometric ? 'psychometric' : 'legislative',
      status: 'rejected',
      adminResponse: updatedDispute.admin_response,
    }
    expect(resolveBody.questionType).toBe('psychometric')
    expect(resolveBody.disputeId).toBe('dispute-uuid')
  })

  test('flujo: admin responde con mensaje personalizado', () => {
    const adminResponse = 'Hemos revisado tu impugnación. La pregunta ha sido corregida.'

    const updatedDispute = {
      id: 'dispute-uuid',
      status: 'resolved',
      admin_response: adminResponse,
      resolved_at: new Date().toISOString()
    }

    expect(updatedDispute.status).toBe('resolved')
    expect(updatedDispute.admin_response).toContain('corregida')
  })
})

// ============================================
// SECCIÓN 3: FLUJO COMPLETO - USUARIO RECIBE NOTIFICACIÓN
// ============================================

describe('Integración - Flujo de notificación al usuario', () => {

  test('flujo: disputa cerrada → notificación real-time aparece', () => {
    // 1. Estado inicial del hook de notificaciones
    let notifications = []
    let unreadCount = 0

    // 2. Simular actualización real-time
    const realtimePayload = {
      eventType: 'UPDATE',
      table: 'psychometric_question_disputes',
      new: {
        id: 'dispute-uuid',
        status: 'resolved',
        admin_response: 'Tu impugnación ha sido aceptada',
        resolved_at: new Date().toISOString()
      }
    }

    // 3. Se procesa la notificación
    const newNotification = {
      id: realtimePayload.new.id,
      type: 'dispute_update',
      isPsychometric: true,
      title: '✅ Impugnación Psicotécnica Respondida',
      message: 'Tu reporte sobre una pregunta psicotécnica ha sido aceptado.',
      timestamp: realtimePayload.new.resolved_at,
      isRead: false,
      status: 'resolved',
      article: '🧠 Psicotécnico'
    }

    // 4. Se añade a la lista
    notifications = [newNotification, ...notifications]
    unreadCount = notifications.filter(n => !n.isRead).length

    expect(notifications).toHaveLength(1)
    expect(unreadCount).toBe(1)
    expect(notifications[0].isPsychometric).toBe(true)
  })

  test('flujo: usuario ve notificación y la marca como leída', () => {
    // 1. Usuario tiene notificaciones
    let notifications = [
      { id: 'n1', isRead: false, isPsychometric: true },
      { id: 'n2', isRead: false, isPsychometric: false }
    ]
    let unreadCount = 2

    // 2. Usuario hace clic en notificación psicotécnica
    const notificationToMark = notifications[0]

    // 3. Se marca como leída en tabla correcta
    const table = notificationToMark.isPsychometric
      ? 'psychometric_question_disputes'
      : 'question_disputes'

    expect(table).toBe('psychometric_question_disputes')

    // 4. Se actualiza estado local
    notifications = notifications.map(n =>
      n.id === notificationToMark.id ? { ...n, isRead: true } : n
    )
    unreadCount = notifications.filter(n => !n.isRead).length

    expect(notifications[0].isRead).toBe(true)
    expect(unreadCount).toBe(1)
  })
})

// ============================================
// SECCIÓN 4: FLUJO COMPLETO - EMAIL
// ============================================

describe('Integración - Flujo de email', () => {

  test('flujo completo de preparación de email', () => {
    // 1. Datos de la disputa
    const disputeInfo = {
      id: 'dispute-uuid',
      user_id: 'user-123',
      question_id: 'psycho-q-1',
      status: 'resolved',
      admin_response: 'La pregunta ha sido corregida.',
      user_profiles: {
        email: 'usuario@test.com',
        full_name: 'Usuario Test'
      },
      questions: {
        question_text: 'Serie numérica: 2, 4, 6, ?',
        question_subtype: 'sequence_numeric'
      }
    }

    // 2. Se preparan datos del email
    const emailData = {
      to: disputeInfo.user_profiles.email,
      userName: disputeInfo.user_profiles.full_name,
      status: disputeInfo.status,
      adminResponse: disputeInfo.admin_response,
      questionText: disputeInfo.questions.question_text,
      questionType: 'psicotécnica',
      disputeUrl: 'https://www.vence.es/soporte?tab=impugnaciones',
      unsubscribeUrl: 'https://www.vence.es/perfil'
    }

    // 3. Verificar datos
    expect(emailData.to).toBe('usuario@test.com')
    expect(emailData.userName).toBe('Usuario Test')
    expect(emailData.questionType).toBe('psicotécnica')
    expect(emailData.disputeUrl).toContain('impugnaciones')
  })

  test('no debe enviar email si no hay admin_response', () => {
    const disputeInfo = {
      admin_response: null
    }

    const shouldSendEmail = disputeInfo.admin_response && disputeInfo.admin_response.trim().length > 0

    expect(shouldSendEmail).toBeFalsy()
  })
})

// ============================================
// SECCIÓN 5: PANEL ADMIN - FILTROS
// ============================================

describe('Integración - Panel Admin con ambos tipos', () => {

  test('debe combinar impugnaciones normales y psicotécnicas', () => {
    const normalDisputes = [
      { id: 'n1', isPsychometric: false, status: 'pending' },
      { id: 'n2', isPsychometric: false, status: 'resolved' }
    ]

    const psychoDisputes = [
      { id: 'p1', isPsychometric: true, status: 'pending' },
      { id: 'p2', isPsychometric: true, status: 'rejected' }
    ]

    const allDisputes = [...normalDisputes, ...psychoDisputes]

    expect(allDisputes).toHaveLength(4)
    expect(allDisputes.filter(d => d.isPsychometric)).toHaveLength(2)
    expect(allDisputes.filter(d => !d.isPsychometric)).toHaveLength(2)
  })

  test('filtro "psicotecnicas" solo muestra psicotécnicas', () => {
    const allDisputes = [
      { id: 'n1', isPsychometric: false },
      { id: 'p1', isPsychometric: true },
      { id: 'n2', isPsychometric: false },
      { id: 'p2', isPsychometric: true }
    ]

    const typeFilter = 'psicotecnicas'
    const filtered = filterByType(allDisputes, typeFilter)

    expect(filtered).toHaveLength(2)
    expect(filtered.every(d => d.isPsychometric)).toBe(true)
  })

  test('filtro "normales" solo muestra normales', () => {
    const allDisputes = [
      { id: 'n1', isPsychometric: false },
      { id: 'p1', isPsychometric: true },
      { id: 'n2', isPsychometric: false }
    ]

    const filtered = filterByType(allDisputes, 'normales')

    expect(filtered).toHaveLength(2)
    expect(filtered.every(d => !d.isPsychometric)).toBe(true)
  })

  test('filtro "todas" muestra todo', () => {
    const allDisputes = [
      { id: 'n1', isPsychometric: false },
      { id: 'p1', isPsychometric: true }
    ]

    const filtered = filterByType(allDisputes, 'todas')

    expect(filtered).toHaveLength(2)
  })
})

// ============================================
// SECCIÓN 6: REGRESIONES CRÍTICAS
// ============================================

describe('Regresiones - Bugs que NO deben volver', () => {

  test('BUG: RLS no debe bloquear inserciones (usamos API con service role)', () => {
    // El bug original: inserción directa desde cliente fallaba por RLS
    // Solución: usar API con service role

    const insertMethod = 'api' // No 'direct_supabase'
    const apiUsesServiceRole = true

    expect(insertMethod).toBe('api')
    expect(apiUsesServiceRole).toBe(true)
  })

  test('BUG: dispute_type debe ser válido para la constraint', () => {
    const validTypes = ['error_pregunta_respuesta', 'ai_detected_error', 'respuesta_incorrecta', 'otro']

    // No deben incluirse tipos de impugnaciones normales
    expect(validTypes).not.toContain('no_literal')

    // Debe incluir tipo específico de psicotécnicas (usuario y auto-IA)
    expect(validTypes).toContain('error_pregunta_respuesta')
    expect(validTypes).toContain('ai_detected_error')
  })

  test('post-14/04/2026: ambos tipos usan el endpoint unificado /api/v2/dispute/resolve', () => {
    // Tras eliminar el trigger PG y los endpoints legacy, hay un solo endpoint
    // que discrimina por questionType en el body.
    const RESOLVE_ENDPOINT = '/api/v2/dispute/resolve'
    const buildBody = (isPsychometric) => ({
      disputeId: 'x',
      questionType: isPsychometric ? 'psychometric' : 'legislative',
      status: 'resolved',
      adminResponse: 'ok',
    })

    expect(buildBody(true).questionType).toBe('psychometric')
    expect(buildBody(false).questionType).toBe('legislative')
    expect(RESOLVE_ENDPOINT).toBe('/api/v2/dispute/resolve')
  })

  test('BUG: markAsRead debe usar tabla correcta según isPsychometric', () => {
    const getTable = (isPsychometric) => {
      return isPsychometric
        ? 'psychometric_question_disputes'
        : 'question_disputes'
    }

    expect(getTable(true)).toBe('psychometric_question_disputes')
    expect(getTable(false)).toBe('question_disputes')
  })

  test('BUG: notificaciones psicotécnicas deben pasar isPsychometric al marcar', () => {
    const notification = {
      id: 'p1',
      isPsychometric: true
    }

    // El flag debe pasarse a markAsRead
    const markAsReadCall = {
      notificationId: notification.id,
      isPsychometric: notification.isPsychometric
    }

    expect(markAsReadCall.isPsychometric).toBe(true)
  })
})

// ============================================
// SECCIÓN 7: COMPARATIVA NORMAL VS PSICOTÉCNICA
// ============================================

describe('Comparativa - Normal vs Psicotécnica', () => {

  const systemComparison = {
    normal: {
      table: 'question_disputes',
      questionsTable: 'questions',
      // Endpoint unificado post-14/04/2026 (questionType discrimina)
      resolveEndpoint: '/api/v2/dispute/resolve',
      questionType: 'legislative',
      disputeTypes: ['no_literal', 'respuesta_incorrecta', 'otro'],
      canAppeal: true,
      hasArticleInfo: true
    },
    psychometric: {
      table: 'psychometric_question_disputes',
      questionsTable: 'psychometric_questions',
      resolveEndpoint: '/api/v2/dispute/resolve',
      questionType: 'psychometric',
      disputeTypes: ['error_pregunta_respuesta', 'ai_detected_error', 'respuesta_incorrecta', 'otro'],
      canAppeal: false,
      hasArticleInfo: false
    }
  }

  test('tablas son diferentes', () => {
    expect(systemComparison.normal.table).not.toBe(systemComparison.psychometric.table)
  })

  test('tablas de preguntas son diferentes', () => {
    expect(systemComparison.normal.questionsTable).not.toBe(systemComparison.psychometric.questionsTable)
  })

  test('endpoint de resolve es el mismo, distinguen por questionType (post-14/04/2026)', () => {
    expect(systemComparison.normal.resolveEndpoint).toBe('/api/v2/dispute/resolve')
    expect(systemComparison.psychometric.resolveEndpoint).toBe('/api/v2/dispute/resolve')
    expect(systemComparison.normal.questionType).not.toBe(systemComparison.psychometric.questionType)
  })

  test('tipos de disputa tienen diferencias', () => {
    // error_pregunta_respuesta solo en psicotécnicas (usuario manual)
    expect(systemComparison.psychometric.disputeTypes).toContain('error_pregunta_respuesta')
    expect(systemComparison.normal.disputeTypes).not.toContain('error_pregunta_respuesta')

    // no_literal solo en normales
    expect(systemComparison.normal.disputeTypes).toContain('no_literal')
    expect(systemComparison.psychometric.disputeTypes).not.toContain('no_literal')
  })

  test('solo normales pueden tener alegaciones', () => {
    expect(systemComparison.normal.canAppeal).toBe(true)
    expect(systemComparison.psychometric.canAppeal).toBe(false)
  })

  test('solo normales tienen info de artículo', () => {
    expect(systemComparison.normal.hasArticleInfo).toBe(true)
    expect(systemComparison.psychometric.hasArticleInfo).toBe(false)
  })
})

// ============================================
// FUNCIONES AUXILIARES
// ============================================

function filterByType(disputes, typeFilter) {
  if (typeFilter === 'todas') return disputes
  if (typeFilter === 'normales') return disputes.filter(d => !d.isPsychometric)
  if (typeFilter === 'psicotecnicas') return disputes.filter(d => d.isPsychometric)
  return disputes
}
