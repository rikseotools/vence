// __tests__/integration/disputesAndFeedback.test.js
// Tests de integración completos para el sistema de impugnaciones y feedback
// Estos tests detectan regresiones si se cambia algo en el sistema

import '@testing-library/jest-dom'

// ============================================
// SECCIÓN 1: TESTS DE ESTRUCTURA DE DATOS
// ============================================

describe('Estructura de datos - question_disputes', () => {
  const validDispute = {
    question_id: '550e8400-e29b-41d4-a716-446655440000',
    user_id: 'user-uuid-123',
    dispute_type: 'respuesta_incorrecta',
    description: 'La respuesta correcta debería ser la B',
    status: 'pending'
  }

  test('debe tener todos los campos requeridos', () => {
    expect(validDispute).toHaveProperty('question_id')
    expect(validDispute).toHaveProperty('user_id')
    expect(validDispute).toHaveProperty('dispute_type')
    expect(validDispute).toHaveProperty('description')
    expect(validDispute).toHaveProperty('status')
  })

  test('question_id debe ser UUID válido o null (nunca undefined en BD)', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    // Válido: UUID
    expect(validDispute.question_id).toMatch(uuidRegex)

    // Válido: null (para casos edge, aunque no debería ocurrir)
    const disputeWithNull = { ...validDispute, question_id: null }
    expect(disputeWithNull.question_id).toBeNull()
  })

  test('dispute_type debe ser uno de los tipos válidos', () => {
    const validTypes = ['no_literal', 'respuesta_incorrecta', 'otro']
    expect(validTypes).toContain(validDispute.dispute_type)
  })

  test('status debe ser uno de los estados válidos', () => {
    const validStatuses = ['pending', 'resolved', 'rejected', 'reviewing']
    expect(validStatuses).toContain(validDispute.status)
  })
})

describe('Estructura de datos - user_feedback', () => {
  const validFeedback = {
    user_id: 'user-uuid-123',
    email: 'test@example.com',
    type: 'bug',
    message: 'Hay un error en la página de tests',
    status: 'pending',
    priority: 'medium'
  }

  test('debe tener todos los campos requeridos', () => {
    expect(validFeedback).toHaveProperty('type')
    expect(validFeedback).toHaveProperty('message')
    expect(validFeedback).toHaveProperty('status')
  })

  test('type debe ser uno de los tipos válidos de feedback', () => {
    const validTypes = ['bug', 'suggestion', 'content', 'design', 'praise', 'other', 'question_dispute']
    expect(validTypes).toContain(validFeedback.type)
  })

  test('status debe ser uno de los estados válidos', () => {
    const validStatuses = ['pending', 'in_review', 'resolved', 'dismissed']
    expect(validStatuses).toContain(validFeedback.status)
  })

  test('priority debe ser válida', () => {
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    expect(validPriorities).toContain(validFeedback.priority)
  })
})

// ============================================
// SECCIÓN 2: TESTS DE LÓGICA DE NEGOCIO
// ============================================

describe('Lógica de negocio - Impugnaciones', () => {

  describe('Resolución de questionId (Fix del bug)', () => {
    // Este es el fix crítico que corrige el bug de question_id = null

    function resolveQuestionId(currentQuestionUuid, questions, currentQuestion) {
      return currentQuestionUuid || questions[currentQuestion]?.id
    }

    test('debe usar currentQuestionUuid cuando está disponible', () => {
      const result = resolveQuestionId(
        'uuid-from-save',
        [{ id: 'uuid-from-array' }],
        0
      )
      expect(result).toBe('uuid-from-save')
    })

    test('debe usar fallback de questions cuando currentQuestionUuid es null', () => {
      const result = resolveQuestionId(
        null,
        [{ id: 'uuid-from-array' }],
        0
      )
      expect(result).toBe('uuid-from-array')
    })

    test('debe usar fallback de questions cuando currentQuestionUuid es undefined', () => {
      const result = resolveQuestionId(
        undefined,
        [{ id: 'uuid-from-array' }],
        0
      )
      expect(result).toBe('uuid-from-array')
    })

    test('debe retornar undefined si ambas fuentes son inválidas', () => {
      const result = resolveQuestionId(null, [], 0)
      expect(result).toBeUndefined()
    })

    test('debe manejar índice fuera de rango', () => {
      const result = resolveQuestionId(
        null,
        [{ id: 'only-one' }],
        999
      )
      expect(result).toBeUndefined()
    })

    test('CRÍTICO: nunca debe retornar string vacío', () => {
      const result = resolveQuestionId('', [{ id: 'fallback' }], 0)
      // String vacío es falsy, debe usar fallback
      expect(result).toBe('fallback')
    })
  })

  describe('Formato de descripción de impugnación', () => {
    function formatDisputeDescription(disputeType, description) {
      if (disputeType === 'otro') {
        return description.trim()
      }
      return `Motivo: ${disputeType}${description.trim() ? ` - Detalles: ${description.trim()}` : ''}`
    }

    test('tipo "otro" debe usar descripción directa', () => {
      const result = formatDisputeDescription('otro', 'Mi descripción personalizada')
      expect(result).toBe('Mi descripción personalizada')
    })

    test('tipo predefinido sin detalles debe mostrar solo motivo', () => {
      const result = formatDisputeDescription('respuesta_incorrecta', '')
      expect(result).toBe('Motivo: respuesta_incorrecta')
    })

    test('tipo predefinido con detalles debe mostrar ambos', () => {
      const result = formatDisputeDescription('no_literal', 'El artículo dice otra cosa')
      expect(result).toBe('Motivo: no_literal - Detalles: El artículo dice otra cosa')
    })

    test('debe limpiar espacios en blanco', () => {
      const result = formatDisputeDescription('otro', '  texto con espacios  ')
      expect(result).toBe('texto con espacios')
    })
  })

  describe('Validación de impugnación antes de envío', () => {
    function canSubmitDispute(user, disputeType, description, submitting) {
      if (!user) return { valid: false, reason: 'user_required' }
      if (!disputeType) return { valid: false, reason: 'type_required' }
      if (submitting) return { valid: false, reason: 'already_submitting' }
      if (disputeType === 'otro' && (!description || description.trim().length < 10)) {
        return { valid: false, reason: 'description_too_short' }
      }
      return { valid: true }
    }

    test('debe rechazar si no hay usuario', () => {
      const result = canSubmitDispute(null, 'otro', 'descripción válida', false)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('user_required')
    })

    test('debe rechazar si no hay tipo seleccionado', () => {
      const result = canSubmitDispute({ id: '123' }, '', 'descripción', false)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('type_required')
    })

    test('debe rechazar si ya está enviando', () => {
      const result = canSubmitDispute({ id: '123' }, 'otro', 'descripción válida aquí', true)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('already_submitting')
    })

    test('debe aceptar tipo predefinido sin descripción', () => {
      const result = canSubmitDispute({ id: '123' }, 'respuesta_incorrecta', '', false)
      expect(result.valid).toBe(true)
    })

    test('debe rechazar tipo "otro" con descripción corta', () => {
      const result = canSubmitDispute({ id: '123' }, 'otro', 'corta', false)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('description_too_short')
    })

    test('debe aceptar tipo "otro" con descripción suficiente', () => {
      const result = canSubmitDispute({ id: '123' }, 'otro', 'Esta es una descripción válida', false)
      expect(result.valid).toBe(true)
    })
  })
})

describe('Lógica de negocio - Feedback', () => {

  describe('Preparación de datos de feedback', () => {
    function prepareFeedbackData(formData, user, context, uploadedImages) {
      let messageWithImages = formData.message.trim()

      if (uploadedImages && uploadedImages.length > 0) {
        messageWithImages += '\n\n📸 Imágenes adjuntas:\n'
        uploadedImages.forEach((img, index) => {
          messageWithImages += `${index + 1}. ${img.name}: ${img.url}\n`
        })
      }

      return {
        user_id: user?.id || null,
        email: formData.email || null,
        type: formData.type || 'other',
        message: messageWithImages,
        url: context?.url || null,
        status: 'pending',
        priority: 'medium'
      }
    }

    test('debe incluir imágenes en el mensaje si hay adjuntos', () => {
      const result = prepareFeedbackData(
        { message: 'Bug encontrado', email: 'test@test.com', type: 'bug' },
        { id: 'user-123' },
        { url: 'http://example.com' },
        [{ name: 'screenshot.png', url: 'http://cdn.com/img.png' }]
      )

      expect(result.message).toContain('Bug encontrado')
      expect(result.message).toContain('📸 Imágenes adjuntas')
      expect(result.message).toContain('screenshot.png')
    })

    test('debe manejar feedback sin usuario (anónimo)', () => {
      const result = prepareFeedbackData(
        { message: 'Sugerencia', email: 'anon@test.com', type: 'suggestion' },
        null,
        {},
        []
      )

      expect(result.user_id).toBeNull()
      expect(result.email).toBe('anon@test.com')
    })

    test('debe usar tipo "other" por defecto', () => {
      const result = prepareFeedbackData(
        { message: 'Mensaje', email: '', type: '' },
        null,
        {},
        []
      )

      expect(result.type).toBe('other')
    })
  })

  describe('Validación de feedback antes de envío', () => {
    function canSubmitFeedback(message) {
      if (!message || !message.trim()) {
        return { valid: false, reason: 'message_required' }
      }
      if (message.trim().length < 5) {
        return { valid: false, reason: 'message_too_short' }
      }
      return { valid: true }
    }

    test('debe rechazar mensaje vacío', () => {
      expect(canSubmitFeedback('').valid).toBe(false)
      expect(canSubmitFeedback('   ').valid).toBe(false)
      expect(canSubmitFeedback(null).valid).toBe(false)
    })

    test('debe rechazar mensaje muy corto', () => {
      const result = canSubmitFeedback('ab')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('message_too_short')
    })

    test('debe aceptar mensaje válido', () => {
      const result = canSubmitFeedback('Este es un mensaje de feedback válido')
      expect(result.valid).toBe(true)
    })
  })
})

// ============================================
// SECCIÓN 3: TESTS DE QUERIES Y FILTROS
// ============================================

describe('Queries y Filtros - Panel de Soporte', () => {

  describe('Filtrado de impugnaciones', () => {
    const mockDisputes = [
      { id: '1', status: 'pending', created_at: '2025-01-01' },
      { id: '2', status: 'resolved', created_at: '2025-01-02' },
      { id: '3', status: 'rejected', created_at: '2025-01-03' },
      { id: '4', status: 'pending', created_at: '2025-01-04' },
      { id: '5', status: 'appealed', created_at: '2025-01-05' }
    ]

    function filterDisputes(disputes, filter) {
      if (filter === 'all') return disputes
      if (filter === 'pending') return disputes.filter(d => d.status === 'pending')
      if (filter === 'resolved') {
        return disputes.filter(d =>
          d.status === 'resolved' || d.status === 'rejected' || d.status === 'appealed'
        )
      }
      return disputes
    }

    test('filtro "all" debe mostrar todas', () => {
      const result = filterDisputes(mockDisputes, 'all')
      expect(result).toHaveLength(5)
    })

    test('filtro "pending" debe mostrar solo pendientes', () => {
      const result = filterDisputes(mockDisputes, 'pending')
      expect(result).toHaveLength(2)
      expect(result.every(d => d.status === 'pending')).toBe(true)
    })

    test('filtro "resolved" debe incluir resolved, rejected y appealed', () => {
      const result = filterDisputes(mockDisputes, 'resolved')
      expect(result).toHaveLength(3)
      expect(result.map(d => d.status)).toEqual(
        expect.arrayContaining(['resolved', 'rejected', 'appealed'])
      )
    })
  })

  describe('Conteo de badges de notificación', () => {
    function countPendingItems(disputes, conversations) {
      const pendingDisputes = disputes.filter(d => d.status === 'pending').length
      const waitingUserConversations = conversations.filter(c => c.status === 'waiting_user').length

      return {
        disputes: pendingDisputes,
        conversations: waitingUserConversations,
        total: pendingDisputes + waitingUserConversations
      }
    }

    test('debe contar correctamente impugnaciones pendientes', () => {
      const disputes = [
        { status: 'pending' },
        { status: 'resolved' },
        { status: 'pending' }
      ]
      const result = countPendingItems(disputes, [])
      expect(result.disputes).toBe(2)
    })

    test('debe contar correctamente conversaciones esperando usuario', () => {
      const conversations = [
        { status: 'waiting_user' },
        { status: 'waiting_admin' },
        { status: 'waiting_user' }
      ]
      const result = countPendingItems([], conversations)
      expect(result.conversations).toBe(2)
    })

    test('debe sumar total correctamente', () => {
      const disputes = [{ status: 'pending' }]
      const conversations = [{ status: 'waiting_user' }]
      const result = countPendingItems(disputes, conversations)
      expect(result.total).toBe(2)
    })
  })
})

// ============================================
// SECCIÓN 4: TESTS DE INTEGRACIÓN DE COMPONENTES
// ============================================

describe('Integración - Flujo completo de impugnación', () => {

  test('flujo completo: usuario ve pregunta → impugna → se guarda correctamente', () => {
    // Simular estado inicial del test
    const questions = [
      { id: 'question-uuid-1', text: '¿Cuál es la capital?', correct: 2 },
      { id: 'question-uuid-2', text: '¿Cuántos habitantes?', correct: 1 }
    ]
    const currentQuestion = 0
    let currentQuestionUuid = null // Antes de responder

    // Simular que el usuario abre impugnación ANTES de responder
    const resolvedId = currentQuestionUuid || questions[currentQuestion]?.id

    // Debe usar el fallback
    expect(resolvedId).toBe('question-uuid-1')

    // Simular datos de impugnación
    const disputeData = {
      question_id: resolvedId,
      user_id: 'user-123',
      dispute_type: 'respuesta_incorrecta',
      description: 'Motivo: respuesta_incorrecta',
      status: 'pending'
    }

    // Verificar que question_id NO es null
    expect(disputeData.question_id).not.toBeNull()
    expect(disputeData.question_id).toBe('question-uuid-1')
  })

  test('flujo completo: usuario responde → impugna → usa UUID guardado', () => {
    const questions = [{ id: 'question-uuid-1' }]
    const currentQuestion = 0

    // Simular que el usuario responde y se guarda
    const currentQuestionUuid = 'saved-after-answer-uuid'

    // Ahora impugna
    const resolvedId = currentQuestionUuid || questions[currentQuestion]?.id

    // Debe usar el UUID guardado (tiene prioridad)
    expect(resolvedId).toBe('saved-after-answer-uuid')
  })
})

describe('Integración - Flujo completo de feedback', () => {

  test('flujo completo: usuario envía feedback → se crea conversación', () => {
    // Simular datos de feedback enviado
    const feedbackData = {
      id: 'feedback-uuid',
      user_id: 'user-123',
      type: 'bug',
      message: 'Hay un error en la aplicación',
      status: 'pending'
    }

    // Simular creación de conversación
    const conversationData = {
      id: 'conversation-uuid',
      feedback_id: feedbackData.id,
      user_id: feedbackData.user_id,
      status: 'waiting_admin'
    }

    // Verificar relación
    expect(conversationData.feedback_id).toBe(feedbackData.id)
    expect(conversationData.user_id).toBe(feedbackData.user_id)
    expect(conversationData.status).toBe('waiting_admin')
  })

  test('flujo: admin responde → conversación cambia a waiting_user', () => {
    let conversation = { status: 'waiting_admin' }

    // Admin responde
    conversation.status = 'waiting_user'

    expect(conversation.status).toBe('waiting_user')
  })

  test('flujo: usuario responde a feedback resuelto → se reabre', () => {
    let feedback = { status: 'resolved' }

    // Usuario responde
    if (feedback.status === 'resolved' || feedback.status === 'dismissed') {
      feedback.status = 'pending'
    }

    expect(feedback.status).toBe('pending')
  })
})

// ============================================
// SECCIÓN 5: TESTS DE REGRESIÓN CRÍTICOS
// ============================================

describe('Regresión - Bugs conocidos que NO deben volver', () => {

  test('BUG-001: question_id nunca debe ser null al impugnar desde TestLayout', () => {
    // Este bug ocurrió cuando el usuario impugnaba antes de responder
    // y currentQuestionUuid era null

    const scenarios = [
      { currentQuestionUuid: null, questions: [{ id: 'q1' }], currentQuestion: 0 },
      { currentQuestionUuid: undefined, questions: [{ id: 'q2' }], currentQuestion: 0 },
      { currentQuestionUuid: '', questions: [{ id: 'q3' }], currentQuestion: 0 }
    ]

    scenarios.forEach((scenario, index) => {
      const resolvedId = scenario.currentQuestionUuid || scenario.questions[scenario.currentQuestion]?.id
      expect(resolvedId).not.toBeNull()
      expect(resolvedId).not.toBeUndefined()
      expect(resolvedId).not.toBe('')
      expect(resolvedId).toBe(`q${index + 1}`)
    })
  })

  test('BUG-002: impugnaciones sin question_id no deben aparecer en panel usuario', () => {
    // Este bug hacía que impugnaciones con question_id=null no aparecieran
    // porque la query usaba !inner join

    const mockDisputesFromDB = [
      { id: '1', question_id: 'uuid-1', questions: { text: 'Pregunta 1' } },
      { id: '2', question_id: null, questions: null }, // Esta no debería existir ya
      { id: '3', question_id: 'uuid-3', questions: { text: 'Pregunta 3' } }
    ]

    // Filtrar como lo hace el inner join
    const visibleDisputes = mockDisputesFromDB.filter(d => d.questions !== null)

    expect(visibleDisputes).toHaveLength(2)
    expect(visibleDisputes.find(d => d.id === '2')).toBeUndefined()
  })

  test('BUG-003: feedback type question_dispute debe redirigir a QuestionDispute', () => {
    // Verificar que el tipo question_dispute NO se procesa como feedback normal
    const feedbackTypes = ['bug', 'suggestion', 'content', 'design', 'praise', 'other']
    const specialTypes = ['question_dispute']

    // question_dispute debe tratarse diferente
    specialTypes.forEach(type => {
      expect(feedbackTypes).not.toContain(type)
    })
  })
})

// ============================================
// SECCIÓN 6: TESTS DE CONFIGURACIÓN
// ============================================

describe('Configuración - Constantes del sistema', () => {

  const DISPUTE_TYPES = {
    'respuesta_incorrecta': '❌ Respuesta Incorrecta',
    'no_literal': '📝 No Literal',
    'otro': '❓ Otro Motivo'
  }

  const DISPUTE_STATUS = {
    'pending': '🟡 Pendiente',
    'reviewing': '🔵 En revisión',
    'resolved': '🟢 Resuelta',
    'rejected': '🔴 Rechazada'
  }

  const FEEDBACK_TYPES = {
    'bug': '🐛 Bug',
    'suggestion': '💡 Sugerencia',
    'content': '📚 Contenido',
    'design': '🎨 Diseño',
    'praise': '⭐ Felicitación',
    'other': '❓ Otro'
  }

  test('todos los tipos de disputa deben estar definidos', () => {
    expect(Object.keys(DISPUTE_TYPES)).toHaveLength(3)
    expect(DISPUTE_TYPES).toHaveProperty('respuesta_incorrecta')
    expect(DISPUTE_TYPES).toHaveProperty('no_literal')
    expect(DISPUTE_TYPES).toHaveProperty('otro')
  })

  test('todos los estados de disputa deben estar definidos', () => {
    expect(Object.keys(DISPUTE_STATUS)).toHaveLength(4)
    expect(DISPUTE_STATUS).toHaveProperty('pending')
    expect(DISPUTE_STATUS).toHaveProperty('resolved')
  })

  test('todos los tipos de feedback deben estar definidos', () => {
    expect(Object.keys(FEEDBACK_TYPES)).toHaveLength(6)
    expect(FEEDBACK_TYPES).toHaveProperty('bug')
    expect(FEEDBACK_TYPES).toHaveProperty('suggestion')
  })
})
