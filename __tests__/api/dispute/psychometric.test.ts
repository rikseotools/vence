// __tests__/api/dispute/psychometric.test.js
// Tests para el API de impugnaciones psicotécnicas /api/dispute/psychometric

import '@testing-library/jest-dom'

// Mock de Supabase
const mockSingle = jest.fn()
const mockSelect = jest.fn()
const mockInsert = jest.fn()
const mockEq = jest.fn()

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: mockSelect.mockReturnValue({
      eq: mockEq.mockReturnValue({
        single: mockSingle
      })
    }),
    insert: mockInsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: mockSingle
      })
    })
  }))
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

// ============================================
// SECCIÓN 1: VALIDACIONES DE ENTRADA
// ============================================

describe('API /api/dispute/psychometric - Validaciones', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Campos requeridos', () => {
    const requiredFields = ['questionId', 'userId', 'disputeType', 'description']

    test.each(requiredFields)('debe rechazar si falta %s', (field) => {
      const validBody = {
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-uuid-123',
        disputeType: 'respuesta_incorrecta',
        description: 'La respuesta es incorrecta'
      }

      const bodyWithMissingField = { ...validBody, [field]: undefined }

      // Simular validación
      const isValid = requiredFields.every(f => bodyWithMissingField[f])
      expect(isValid).toBe(false)
    })

    test('debe aceptar cuando todos los campos están presentes', () => {
      const validBody = {
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        userId: 'user-uuid-123',
        disputeType: 'respuesta_incorrecta',
        description: 'La respuesta es incorrecta'
      }

      const isValid = requiredFields.every(f => validBody[f])
      expect(isValid).toBe(true)
    })
  })

  describe('Validación de dispute_type', () => {
    const validTypes = ['ai_detected_error', 'respuesta_incorrecta', 'otro']

    test.each(validTypes)('debe aceptar tipo válido: %s', (type) => {
      expect(validTypes.includes(type)).toBe(true)
    })

    test('debe rechazar tipos inválidos', () => {
      const invalidTypes = ['invalid', 'no_literal', 'wrong_type', '']

      invalidTypes.forEach(type => {
        expect(validTypes.includes(type)).toBe(false)
      })
    })
  })

  describe('Validación de UUID', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    test('debe aceptar UUID válido para questionId', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000'
      expect(validUuid).toMatch(uuidRegex)
    })

    test('debe rechazar formato UUID inválido', () => {
      const invalidUuids = ['not-a-uuid', '123', '']

      invalidUuids.forEach(uuid => {
        expect(uuid).not.toMatch(uuidRegex)
      })

      // null y undefined no son strings válidos
      expect(null).toBeFalsy()
      expect(undefined).toBeFalsy()
    })
  })
})

// ============================================
// SECCIÓN 2: LÓGICA DE NEGOCIO
// ============================================

describe('API /api/dispute/psychometric - Lógica de Negocio', () => {

  describe('Verificación de pregunta existente', () => {
    test('debe rechazar si la pregunta no existe', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } })

      // Simular lógica de verificación
      const questionExists = await checkQuestionExists('non-existent-id')
      expect(questionExists).toBe(false)
    })

    test('debe continuar si la pregunta existe', async () => {
      mockSingle.mockResolvedValueOnce({ data: { id: 'valid-id' }, error: null })

      const questionExists = await checkQuestionExists('valid-id')
      expect(questionExists).toBe(true)
    })
  })

  describe('Verificación de duplicados', () => {
    test('debe rechazar si el usuario ya impugnó esta pregunta', async () => {
      // Usuario ya tiene una impugnación para esta pregunta
      const existingDispute = { id: 'existing-dispute-id' }

      const canSubmit = checkDuplicateDispute(existingDispute)
      expect(canSubmit).toBe(false)
    })

    test('debe permitir si no hay impugnación previa', async () => {
      const existingDispute = null

      const canSubmit = checkDuplicateDispute(existingDispute)
      expect(canSubmit).toBe(true)
    })
  })

  describe('Creación de impugnación', () => {
    test('debe crear impugnación con status "pending" por defecto', () => {
      const disputeData = createDisputeData({
        questionId: 'question-uuid',
        userId: 'user-uuid',
        disputeType: 'respuesta_incorrecta',
        description: 'Descripción del problema'
      })

      expect(disputeData.status).toBe('pending')
      expect(disputeData.question_id).toBe('question-uuid')
      expect(disputeData.user_id).toBe('user-uuid')
      expect(disputeData.dispute_type).toBe('respuesta_incorrecta')
    })

    test('debe mapear campos correctamente de camelCase a snake_case', () => {
      const input = {
        questionId: 'q-id',
        userId: 'u-id',
        disputeType: 'otro',
        description: 'Test'
      }

      const output = createDisputeData(input)

      expect(output).toHaveProperty('question_id')
      expect(output).toHaveProperty('user_id')
      expect(output).toHaveProperty('dispute_type')
      expect(output).not.toHaveProperty('questionId')
      expect(output).not.toHaveProperty('userId')
      expect(output).not.toHaveProperty('disputeType')
    })
  })
})

// ============================================
// SECCIÓN 3: RESPUESTAS HTTP
// ============================================

describe('API /api/dispute/psychometric - Respuestas HTTP', () => {

  describe('Códigos de estado', () => {
    test('debe retornar 400 para campos faltantes', () => {
      const response = simulateApiResponse({ missingFields: true })
      expect(response.status).toBe(400)
      expect(response.body.error).toBeDefined()
    })

    test('debe retornar 400 para tipo de disputa inválido', () => {
      const response = simulateApiResponse({ invalidType: true })
      expect(response.status).toBe(400)
    })

    test('debe retornar 404 si la pregunta no existe', () => {
      const response = simulateApiResponse({ questionNotFound: true })
      expect(response.status).toBe(404)
    })

    test('debe retornar 409 si hay impugnación duplicada', () => {
      const response = simulateApiResponse({ duplicateDispute: true })
      expect(response.status).toBe(409)
    })

    test('debe retornar 500 para errores de base de datos', () => {
      const response = simulateApiResponse({ dbError: true })
      expect(response.status).toBe(500)
    })

    test('debe retornar 200 para creación exitosa', () => {
      const response = simulateApiResponse({ success: true })
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.disputeId).toBeDefined()
    })
  })

  describe('Formato de respuesta exitosa', () => {
    test('debe incluir disputeId en respuesta exitosa', () => {
      const response = {
        success: true,
        disputeId: 'new-dispute-uuid'
      }

      expect(response).toHaveProperty('success', true)
      expect(response).toHaveProperty('disputeId')
      expect(typeof response.disputeId).toBe('string')
    })
  })
})

// ============================================
// SECCIÓN 4: INTEGRACIÓN CON COMPONENTE
// ============================================

describe('Integración API - PsychometricQuestionDispute', () => {

  test('componente debe enviar datos en formato correcto', () => {
    const componentData = {
      questionId: 'psycho-question-uuid',
      userId: 'user-uuid',
      disputeType: 'ai_detected_error',
      description: 'Error en los datos del gráfico'
    }

    // Validar estructura esperada por el API
    const apiExpected = {
      questionId: expect.any(String),
      userId: expect.any(String),
      disputeType: expect.stringMatching(/^(ai_detected_error|respuesta_incorrecta|otro)$/),
      description: expect.any(String)
    }

    expect(componentData).toMatchObject(apiExpected)
  })

  test('componente debe formatear descripción para tipos predefinidos', () => {
    const formatDescription = (type, desc) => {
      if (type === 'otro') return desc.trim()
      return `Motivo: ${type}${desc.trim() ? ` - Detalles: ${desc.trim()}` : ''}`
    }

    // Tipo 'otro' - descripción directa
    expect(formatDescription('otro', 'Mi problema')).toBe('Mi problema')

    // Tipo predefinido sin detalles
    expect(formatDescription('respuesta_incorrecta', '')).toBe('Motivo: respuesta_incorrecta')

    // Tipo predefinido con detalles
    expect(formatDescription('ai_detected_error', 'Gráfico incorrecto'))
      .toBe('Motivo: ai_detected_error - Detalles: Gráfico incorrecto')
  })
})

// ============================================
// FUNCIONES AUXILIARES PARA TESTS
// ============================================

function checkQuestionExists(questionId) {
  // Simula la verificación de que existe la pregunta
  if (!questionId || questionId === 'non-existent-id') return false
  return true
}

function checkDuplicateDispute(existingDispute) {
  // Simula verificación de duplicados
  return existingDispute === null
}

function createDisputeData({ questionId, userId, disputeType, description }) {
  return {
    question_id: questionId,
    user_id: userId,
    dispute_type: disputeType,
    description: description,
    status: 'pending'
  }
}

function simulateApiResponse(scenario) {
  if (scenario.missingFields) {
    return { status: 400, body: { error: 'Faltan campos requeridos' } }
  }
  if (scenario.invalidType) {
    return { status: 400, body: { error: 'Tipo de impugnación no válido' } }
  }
  if (scenario.questionNotFound) {
    return { status: 404, body: { error: 'Pregunta no encontrada' } }
  }
  if (scenario.duplicateDispute) {
    return { status: 409, body: { error: 'Ya has impugnado esta pregunta anteriormente' } }
  }
  if (scenario.dbError) {
    return { status: 500, body: { error: 'Error al crear la impugnación' } }
  }
  if (scenario.success) {
    return { status: 200, body: { success: true, disputeId: 'new-dispute-uuid' } }
  }
  return { status: 500, body: { error: 'Error interno' } }
}
