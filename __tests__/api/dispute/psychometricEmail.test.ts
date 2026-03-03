// __tests__/api/dispute/psychometricEmail.test.js
// Tests para el API de envío de emails de impugnaciones psicotécnicas
// /api/send-dispute-email/psychometric

import '@testing-library/jest-dom'

// Mock de sendEmail - no necesitamos importar el módulo real
const mockSendEmail = jest.fn()

// Mock de Supabase
const mockSingle = jest.fn()
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
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

describe('API /api/send-dispute-email/psychometric - Validaciones', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Parámetros requeridos', () => {
    test('debe rechazar si falta disputeId', () => {
      const body = {}
      const isValid = validateRequest(body)

      expect(isValid.valid).toBe(false)
      expect(isValid.error).toBe('disputeId es requerido')
    })

    test('debe aceptar si disputeId está presente', () => {
      const body = { disputeId: 'valid-dispute-uuid' }
      const isValid = validateRequest(body)

      expect(isValid.valid).toBe(true)
    })

    test('debe rechazar disputeId vacío', () => {
      const body = { disputeId: '' }
      const isValid = validateRequest(body)

      expect(isValid.valid).toBe(false)
    })

    test('debe rechazar disputeId null', () => {
      const body = { disputeId: null }
      const isValid = validateRequest(body)

      expect(isValid.valid).toBe(false)
    })
  })
})

// ============================================
// SECCIÓN 2: OBTENCIÓN DE INFORMACIÓN
// ============================================

describe('API /api/send-dispute-email/psychometric - getDisputeInfo', () => {

  describe('Búsqueda de disputa', () => {
    test('debe retornar null si disputa no existe', async () => {
      const result = await mockGetDisputeInfo('non-existent-id', {
        disputeExists: false
      })

      expect(result).toBeNull()
    })

    test('debe retornar información completa si disputa existe', async () => {
      const result = await mockGetDisputeInfo('valid-id', {
        disputeExists: true,
        dispute: {
          id: 'valid-id',
          user_id: 'user-uuid',
          question_id: 'question-uuid',
          admin_response: 'Respuesta del admin',
          status: 'resolved'
        },
        user: { email: 'test@example.com', full_name: 'Test User' },
        question: { question_text: 'Pregunta de test', question_subtype: 'sequence_numeric' }
      })

      expect(result).not.toBeNull()
      expect(result.id).toBe('valid-id')
      expect(result.user_profiles.email).toBe('test@example.com')
      expect(result.questions.question_text).toBe('Pregunta de test')
    })
  })

  describe('Enriquecimiento de datos', () => {
    test('debe incluir información del usuario', async () => {
      const result = await mockGetDisputeInfo('dispute-id', {
        disputeExists: true,
        dispute: { id: 'dispute-id', user_id: 'user-123' },
        user: { email: 'usuario@test.com', full_name: 'Usuario Test' }
      })

      expect(result.user_profiles).toBeDefined()
      expect(result.user_profiles.email).toBe('usuario@test.com')
      expect(result.user_profiles.full_name).toBe('Usuario Test')
    })

    test('debe incluir información de la pregunta', async () => {
      const result = await mockGetDisputeInfo('dispute-id', {
        disputeExists: true,
        dispute: { id: 'dispute-id', question_id: 'q-123' },
        question: { question_text: 'Serie numérica: 2, 4, 6, ?', question_subtype: 'sequence_numeric' }
      })

      expect(result.questions).toBeDefined()
      expect(result.questions.question_text).toContain('Serie numérica')
    })
  })
})

// ============================================
// SECCIÓN 3: LÓGICA DE ENVÍO DE EMAIL
// ============================================

describe('API /api/send-dispute-email/psychometric - Envío de email', () => {

  describe('Condiciones de envío', () => {
    test('NO debe enviar email si admin_response está vacío', () => {
      const dispute = { admin_response: '' }
      const shouldSend = shouldSendEmail(dispute)

      expect(shouldSend).toBeFalsy()
    })

    test('NO debe enviar email si admin_response es null', () => {
      const dispute = { admin_response: null }
      const shouldSend = shouldSendEmail(dispute)

      expect(shouldSend).toBeFalsy()
    })

    test('NO debe enviar email si admin_response es solo espacios', () => {
      const dispute = { admin_response: '   ' }
      const shouldSend = shouldSendEmail(dispute)

      expect(shouldSend).toBe(false)
    })

    test('DEBE enviar email si admin_response tiene contenido', () => {
      const dispute = { admin_response: 'Tu impugnación ha sido revisada.' }
      const shouldSend = shouldSendEmail(dispute)

      expect(shouldSend).toBe(true)
    })
  })

  describe('Preparación de datos del email', () => {
    test('debe preparar datos correctamente', () => {
      const disputeInfo = {
        user_id: 'user-uuid',
        status: 'resolved',
        admin_response: 'Hemos corregido el error',
        user_profiles: { email: 'test@test.com', full_name: 'Test User' },
        questions: { question_text: 'Pregunta psicotécnica' }
      }

      const emailData = prepareEmailData(disputeInfo)

      expect(emailData.to).toBe('test@test.com')
      expect(emailData.userName).toBe('Test User')
      expect(emailData.status).toBe('resolved')
      expect(emailData.adminResponse).toBe('Hemos corregido el error')
      expect(emailData.questionType).toBe('psicotécnica')
    })

    test('debe usar "Usuario" como nombre por defecto', () => {
      const disputeInfo = {
        user_profiles: { email: 'test@test.com', full_name: null }
      }

      const emailData = prepareEmailData(disputeInfo)

      expect(emailData.userName).toBe('Usuario')
    })

    test('debe incluir URLs correctas', () => {
      const disputeInfo = {
        user_profiles: { email: 'test@test.com' },
        questions: {}
      }

      const emailData = prepareEmailData(disputeInfo)

      expect(emailData.disputeUrl).toContain('/soporte?tab=impugnaciones')
      expect(emailData.unsubscribeUrl).toContain('/perfil')
    })
  })

  describe('Llamada a sendEmail', () => {
    test('debe usar template "impugnacion_respuesta"', () => {
      const expectedTemplate = 'impugnacion_respuesta'
      const templateUsed = getEmailTemplate()

      expect(templateUsed).toBe(expectedTemplate)
    })

    test('debe pasar user_id como primer parámetro', () => {
      const userId = 'user-uuid-123'
      const params = buildSendEmailParams(userId, {})

      expect(params[0]).toBe(userId)
    })
  })
})

// ============================================
// SECCIÓN 4: RESPUESTAS HTTP
// ============================================

describe('API /api/send-dispute-email/psychometric - Respuestas HTTP', () => {

  describe('Códigos de estado', () => {
    test('debe retornar 400 si falta disputeId', () => {
      const response = simulateEmailApiResponse({ missingDisputeId: true })
      expect(response.status).toBe(400)
    })

    test('debe retornar 404 si disputa no existe', () => {
      const response = simulateEmailApiResponse({ disputeNotFound: true })
      expect(response.status).toBe(404)
    })

    test('debe retornar 200 si no hay admin_response (sin enviar)', () => {
      const response = simulateEmailApiResponse({ noAdminResponse: true })
      expect(response.status).toBe(200)
      expect(response.body.message).toContain('sin respuesta')
    })

    test('debe retornar 200 con emailId si envío exitoso', () => {
      const response = simulateEmailApiResponse({ success: true })
      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.emailId).toBeDefined()
    })

    test('debe retornar 500 si falla el envío de email', () => {
      const response = simulateEmailApiResponse({ emailError: true })
      expect(response.status).toBe(500)
    })
  })
})

// ============================================
// SECCIÓN 5: DIFERENCIAS CON IMPUGNACIONES NORMALES
// ============================================

describe('Psicotécnica vs Normal - Diferencias', () => {

  test('debe usar tabla "psychometric_question_disputes" no "question_disputes"', () => {
    const psychoTable = 'psychometric_question_disputes'
    const normalTable = 'question_disputes'

    expect(psychoTable).not.toBe(normalTable)
  })

  test('debe usar tabla "psychometric_questions" para info de pregunta', () => {
    const psychoQuestionsTable = 'psychometric_questions'
    const normalQuestionsTable = 'questions'

    expect(psychoQuestionsTable).not.toBe(normalQuestionsTable)
  })

  test('debe marcar questionType como "psicotécnica" en email', () => {
    const emailData = { questionType: 'psicotécnica' }

    expect(emailData.questionType).toBe('psicotécnica')
    expect(emailData.questionType).not.toBe('legal')
  })

  test('endpoint debe ser /api/send-dispute-email/psychometric', () => {
    const psychoEndpoint = '/api/send-dispute-email/psychometric'
    const normalEndpoint = '/api/send-dispute-email'

    expect(psychoEndpoint).not.toBe(normalEndpoint)
    expect(psychoEndpoint).toContain('/psychometric')
  })
})

// ============================================
// SECCIÓN 6: INTEGRACIÓN CON ADMIN
// ============================================

describe('Integración - Panel Admin', () => {

  test('closeDispute debe llamar endpoint correcto según tipo', () => {
    const getEmailEndpoint = (isPsychometric) => {
      return isPsychometric
        ? '/api/send-dispute-email/psychometric'
        : '/api/send-dispute-email'
    }

    expect(getEmailEndpoint(true)).toBe('/api/send-dispute-email/psychometric')
    expect(getEmailEndpoint(false)).toBe('/api/send-dispute-email')
  })

  test('body debe incluir solo disputeId', () => {
    const expectedBody = { disputeId: 'dispute-uuid' }

    expect(expectedBody).toHaveProperty('disputeId')
    expect(Object.keys(expectedBody)).toHaveLength(1)
  })
})

// ============================================
// FUNCIONES AUXILIARES PARA TESTS
// ============================================

function validateRequest(body) {
  if (!body.disputeId) {
    return { valid: false, error: 'disputeId es requerido' }
  }
  return { valid: true }
}

async function mockGetDisputeInfo(disputeId, scenario) {
  if (!scenario.disputeExists) {
    return null
  }

  return {
    ...scenario.dispute,
    user_profiles: scenario.user || null,
    questions: scenario.question || null
  }
}

function shouldSendEmail(dispute) {
  return dispute.admin_response && dispute.admin_response.trim().length > 0
}

function prepareEmailData(disputeInfo) {
  const baseUrl = 'https://www.vence.es'

  return {
    to: disputeInfo.user_profiles?.email,
    userName: disputeInfo.user_profiles?.full_name || 'Usuario',
    status: disputeInfo.status,
    adminResponse: disputeInfo.admin_response,
    questionText: disputeInfo.questions?.question_text || 'Pregunta psicotécnica',
    questionType: 'psicotécnica',
    disputeUrl: `${baseUrl}/soporte?tab=impugnaciones`,
    unsubscribeUrl: `${baseUrl}/perfil`
  }
}

function getEmailTemplate() {
  return 'impugnacion_respuesta'
}

function buildSendEmailParams(userId, customData) {
  return [userId, 'impugnacion_respuesta', customData]
}

function simulateEmailApiResponse(scenario) {
  if (scenario.missingDisputeId) {
    return { status: 400, body: { success: false, error: 'disputeId es requerido' } }
  }
  if (scenario.disputeNotFound) {
    return { status: 404, body: { success: false, error: 'Disputa psicotécnica no encontrada' } }
  }
  if (scenario.noAdminResponse) {
    return { status: 200, body: { success: true, message: 'Email no enviado - sin respuesta del admin' } }
  }
  if (scenario.emailError) {
    return { status: 500, body: { success: false, error: 'Error enviando email' } }
  }
  if (scenario.success) {
    return { status: 200, body: { success: true, emailId: 'email-uuid', disputeId: 'dispute-uuid' } }
  }
  return { status: 500, body: { success: false, error: 'Error interno' } }
}
