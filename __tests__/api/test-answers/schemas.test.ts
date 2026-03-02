/**
 * Tests para schemas de test-answers
 * Verifica validacion Zod de todos los sub-schemas y request/response
 */
import {
  deviceInfoSchema,
  questionDataSchema,
  answerDataSchema,
  saveAnswerRequestSchema,
  saveAnswerResponseSchema,
  safeParseSaveAnswerRequest,
} from '@/lib/api/test-answers/schemas'

// ============================================
// FIXTURES
// ============================================

const validQuestionData = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  question: 'Cual es la capital de Espana?',
  options: ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'],
  questionType: 'legislative' as const,
}

const validAnswerData = {
  questionIndex: 0,
  selectedAnswer: 0,
  correctAnswer: 0,
  isCorrect: true,
  timeSpent: 15,
}

const validSessionId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

const minimalValidRequest = {
  sessionId: validSessionId,
  questionData: validQuestionData,
  answerData: validAnswerData,
}

// ============================================
// saveAnswerRequestSchema - Required fields
// ============================================

describe('saveAnswerRequestSchema - required fields', () => {
  it('debe aceptar request minimo valido', () => {
    const result = saveAnswerRequestSchema.safeParse(minimalValidRequest)
    expect(result.success).toBe(true)
  })

  it('debe rechazar sessionId faltante', () => {
    const { sessionId, ...rest } = minimalValidRequest
    const result = saveAnswerRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('debe rechazar sessionId invalido (no UUID)', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...minimalValidRequest,
      sessionId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar questionData faltante', () => {
    const { questionData, ...rest } = minimalValidRequest
    const result = saveAnswerRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('debe rechazar answerData faltante', () => {
    const { answerData, ...rest } = minimalValidRequest
    const result = saveAnswerRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('debe aplicar defaults para campos opcionales', () => {
    const result = saveAnswerRequestSchema.parse(minimalValidRequest)
    expect(result.tema).toBe(0)
    expect(result.confidenceLevel).toBe('unknown')
    expect(result.interactionCount).toBe(1)
    expect(result.interactionEvents).toEqual([])
    expect(result.mouseEvents).toEqual([])
    expect(result.scrollEvents).toEqual([])
  })

  it('debe aceptar sessionId UUID valido', () => {
    const result = saveAnswerRequestSchema.safeParse(minimalValidRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe(validSessionId)
    }
  })

  it('debe aceptar oposicionId opcional', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...minimalValidRequest,
      oposicionId: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// deviceInfoSchema
// ============================================

describe('deviceInfoSchema', () => {
  it('debe aceptar deviceType mobile', () => {
    const result = deviceInfoSchema.safeParse({ deviceType: 'mobile' })
    expect(result.success).toBe(true)
  })

  it('debe aceptar deviceType tablet', () => {
    const result = deviceInfoSchema.safeParse({ deviceType: 'tablet' })
    expect(result.success).toBe(true)
  })

  it('debe aceptar deviceType desktop', () => {
    const result = deviceInfoSchema.safeParse({ deviceType: 'desktop' })
    expect(result.success).toBe(true)
  })

  it('debe aceptar deviceType unknown', () => {
    const result = deviceInfoSchema.safeParse({ deviceType: 'unknown' })
    expect(result.success).toBe(true)
  })

  it('debe rechazar deviceType invalido', () => {
    const result = deviceInfoSchema.safeParse({ deviceType: 'smartwatch' })
    expect(result.success).toBe(false)
  })

  it('debe aplicar defaults a objeto vacio', () => {
    const result = deviceInfoSchema.parse({})
    expect(result.userAgent).toBe('unknown')
    expect(result.screenResolution).toBe('unknown')
    expect(result.deviceType).toBe('unknown')
    expect(result.browserLanguage).toBe('es')
    expect(result.timezone).toBe('Europe/Madrid')
  })

  it('debe rechazar userAgent mayor a 1000 chars', () => {
    const result = deviceInfoSchema.safeParse({
      userAgent: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// questionDataSchema
// ============================================

describe('questionDataSchema', () => {
  it('debe aceptar pregunta con article', () => {
    const result = questionDataSchema.safeParse({
      ...validQuestionData,
      article: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        number: '14',
        law_id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
        law_short_name: 'CE',
      },
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar pregunta sin article', () => {
    const result = questionDataSchema.safeParse(validQuestionData)
    expect(result.success).toBe(true)
  })

  it('debe aceptar pregunta con metadata', () => {
    const result = questionDataSchema.safeParse({
      ...validQuestionData,
      metadata: {
        difficulty: 'hard',
        question_type: 'single',
        tags: ['derecho', 'constitucion'],
      },
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar pregunta sin metadata', () => {
    const result = questionDataSchema.safeParse(validQuestionData)
    expect(result.success).toBe(true)
  })

  it('debe rechazar question vacio', () => {
    const result = questionDataSchema.safeParse({
      ...validQuestionData,
      question: '',
    })
    expect(result.success).toBe(false)
  })

  it('debe aceptar questionType legislative', () => {
    const result = questionDataSchema.safeParse({
      ...validQuestionData,
      questionType: 'legislative',
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar questionType psychometric', () => {
    const result = questionDataSchema.safeParse({
      ...validQuestionData,
      questionType: 'psychometric',
    })
    expect(result.success).toBe(true)
  })

  it('debe aplicar default legislative para questionType', () => {
    const { questionType, ...rest } = validQuestionData
    const result = questionDataSchema.parse(rest)
    expect(result.questionType).toBe('legislative')
  })
})

// ============================================
// answerDataSchema
// ============================================

describe('answerDataSchema', () => {
  it('debe aceptar selectedAnswer -1 (sin respuesta)', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: -1,
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar selectedAnswer 0 (A)', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: 0,
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar selectedAnswer 3 (D)', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: 3,
    })
    expect(result.success).toBe(true)
  })

  it('debe rechazar selectedAnswer -2', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: -2,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar selectedAnswer 4', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: 4,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar selectedAnswer no entero', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      selectedAnswer: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('debe aplicar default 0 para timeSpent', () => {
    const { timeSpent, ...rest } = validAnswerData
    const result = answerDataSchema.parse(rest)
    expect(result.timeSpent).toBe(0)
  })

  it('debe rechazar timeSpent negativo', () => {
    const result = answerDataSchema.safeParse({
      ...validAnswerData,
      timeSpent: -5,
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// confidenceLevel
// ============================================

describe('confidenceLevel', () => {
  const levels = ['very_sure', 'sure', 'unsure', 'guessing', 'unknown'] as const

  for (const level of levels) {
    it(`debe aceptar "${level}"`, () => {
      const result = saveAnswerRequestSchema.safeParse({
        ...minimalValidRequest,
        confidenceLevel: level,
      })
      expect(result.success).toBe(true)
    })
  }

  it('debe aplicar default "unknown"', () => {
    const result = saveAnswerRequestSchema.parse(minimalValidRequest)
    expect(result.confidenceLevel).toBe('unknown')
  })

  it('debe rechazar valor invalido', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...minimalValidRequest,
      confidenceLevel: 'maybe',
    })
    expect(result.success).toBe(false)
  })
})

// ============================================
// saveAnswerResponseSchema
// ============================================

describe('saveAnswerResponseSchema', () => {
  it('debe aceptar response saved_new', () => {
    const result = saveAnswerResponseSchema.safeParse({
      success: true,
      question_id: 'q123',
      action: 'saved_new',
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar response already_saved', () => {
    const result = saveAnswerResponseSchema.safeParse({
      success: true,
      question_id: 'q123',
      action: 'already_saved',
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar response error', () => {
    const result = saveAnswerResponseSchema.safeParse({
      success: false,
      action: 'error',
      error: 'Something went wrong',
    })
    expect(result.success).toBe(true)
  })

  it('debe rechazar action invalido', () => {
    const result = saveAnswerResponseSchema.safeParse({
      success: true,
      action: 'deleted',
    })
    expect(result.success).toBe(false)
  })

  it('debe aceptar response sin question_id', () => {
    const result = saveAnswerResponseSchema.safeParse({
      success: false,
      action: 'error',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// Edge cases
// ============================================

describe('edge cases', () => {
  it('debe aceptar request completo con todos los campos', () => {
    const result = saveAnswerRequestSchema.safeParse({
      sessionId: validSessionId,
      questionData: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        question: 'Pregunta completa',
        options: ['A', 'B', 'C', 'D'],
        tema: 5,
        questionType: 'legislative',
        article: {
          id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
          number: '14',
          law_id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
          law_short_name: 'CE',
        },
        metadata: {
          difficulty: 'hard',
          question_type: 'single',
          tags: ['derecho'],
        },
        explanation: 'Porque si',
      },
      answerData: {
        questionIndex: 3,
        selectedAnswer: 2,
        correctAnswer: 2,
        isCorrect: true,
        timeSpent: 25.5,
      },
      tema: 5,
      confidenceLevel: 'sure',
      interactionCount: 2,
      questionStartTime: 1000,
      firstInteractionTime: 3000,
      interactionEvents: [{ type: 'click' }],
      mouseEvents: [{ x: 10, y: 20 }],
      scrollEvents: [{ y: 100 }],
      deviceInfo: {
        userAgent: 'Mozilla/5.0',
        screenResolution: '1920x1080',
        deviceType: 'desktop',
        browserLanguage: 'es-ES',
        timezone: 'Europe/Madrid',
      },
      oposicionId: 'auxiliar_administrativo_estado',
    })
    expect(result.success).toBe(true)
  })

  it('debe aceptar request minimo con solo campos requeridos', () => {
    const result = saveAnswerRequestSchema.safeParse({
      sessionId: validSessionId,
      questionData: {
        question: 'Pregunta minima',
        options: ['A', 'B'],
      },
      answerData: {
        questionIndex: 0,
        selectedAnswer: 0,
        correctAnswer: 1,
        isCorrect: false,
      },
    })
    expect(result.success).toBe(true)
  })

  it('debe truncar interactionEvents a max 10', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({ idx: i }))
    const result = saveAnswerRequestSchema.safeParse({
      ...minimalValidRequest,
      interactionEvents: events,
    })
    // Zod .max(10) rejects arrays larger than 10
    expect(result.success).toBe(false)
  })

  it('debe aceptar arrays vacios', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...minimalValidRequest,
      interactionEvents: [],
      mouseEvents: [],
      scrollEvents: [],
    })
    expect(result.success).toBe(true)
  })

  it('safeParseSaveAnswerRequest debe devolver success shape', () => {
    const result = safeParseSaveAnswerRequest(minimalValidRequest)
    expect(result).toHaveProperty('success')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toHaveProperty('sessionId')
      expect(result.data).toHaveProperty('questionData')
      expect(result.data).toHaveProperty('answerData')
    }
  })

  it('safeParseSaveAnswerRequest debe devolver error shape para input invalido', () => {
    const result = safeParseSaveAnswerRequest({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0)
    }
  })
})
