// __tests__/lib/api/v2/complete-test/schemas.test.ts
// Tests exhaustivos para los schemas de complete-test

import {
  completeTestRequestSchema,
  completeTestResponseSchema,
  safeParseCompleteTestRequest,
} from '@/lib/api/v2/complete-test/schemas'

// ============================================
// HELPERS
// ============================================

const VALID_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const VALID_UUID_2 = '11111111-2222-3333-4444-555555555555'

function validDetailedAnswer(overrides?: Record<string, unknown>) {
  return {
    questionIndex: 0,
    selectedAnswer: 2,
    isCorrect: true,
    timeSpent: 5.3,
    confidence: 'sure' as const,
    interactions: 1,
    questionData: {
      id: VALID_UUID,
      metadata: { difficulty: 'medium' as const },
      article: {
        id: VALID_UUID,
        number: '14',
        law_short_name: 'CE',
      },
    },
    ...overrides,
  }
}

function validRequest(overrides?: Record<string, unknown>) {
  return {
    sessionId: VALID_UUID,
    finalScore: 8,
    totalQuestions: 10,
    detailedAnswers: [validDetailedAnswer()],
    startTime: Date.now(),
    interactionEvents: [],
    userSessionId: VALID_UUID_2,
    tema: 5,
    ...overrides,
  }
}

// ============================================
// 1. Request valido con todos los campos
// ============================================

describe('completeTestRequestSchema - request valido completo', () => {
  it('acepta request con todos los campos', () => {
    const result = completeTestRequestSchema.safeParse(validRequest())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sessionId).toBe(VALID_UUID)
      expect(result.data.finalScore).toBe(8)
      expect(result.data.totalQuestions).toBe(10)
      expect(result.data.detailedAnswers).toHaveLength(1)
      expect(result.data.interactionEvents).toEqual([])
      expect(result.data.userSessionId).toBe(VALID_UUID_2)
      expect(result.data.tema).toBe(5)
    }
  })

  it('acepta detailedAnswer con todos los campos de questionData', () => {
    const result = completeTestRequestSchema.safeParse(validRequest())
    expect(result.success).toBe(true)
    if (result.success) {
      const answer = result.data.detailedAnswers[0]
      expect(answer.questionData?.id).toBe(VALID_UUID)
      expect(answer.questionData?.metadata?.difficulty).toBe('medium')
      expect(answer.questionData?.article?.number).toBe('14')
      expect(answer.questionData?.article?.law_short_name).toBe('CE')
    }
  })
})

// ============================================
// 2. Request valido con campos opcionales omitidos
// ============================================

describe('completeTestRequestSchema - campos opcionales omitidos', () => {
  it('acepta request sin userSessionId, tema ni interactionEvents', () => {
    const result = completeTestRequestSchema.safeParse({
      sessionId: VALID_UUID,
      finalScore: 5,
      totalQuestions: 10,
      detailedAnswers: [
        {
          questionIndex: 0,
          selectedAnswer: 1,
          isCorrect: false,
        },
      ],
      startTime: 1000,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userSessionId).toBeUndefined()
      expect(result.data.tema).toBeUndefined()
      // defaults aplicados
      expect(result.data.interactionEvents).toEqual([])
    }
  })

  it('acepta detailedAnswer con solo campos requeridos (defaults aplicados)', () => {
    const result = completeTestRequestSchema.safeParse({
      sessionId: VALID_UUID,
      finalScore: 1,
      totalQuestions: 1,
      detailedAnswers: [
        {
          questionIndex: 0,
          selectedAnswer: 0,
          isCorrect: true,
        },
      ],
      startTime: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const answer = result.data.detailedAnswers[0]
      expect(answer.timeSpent).toBe(0)
      expect(answer.confidence).toBe('unknown')
      expect(answer.interactions).toBe(1)
      expect(answer.questionData).toBeUndefined()
    }
  })

  it('acepta userSessionId y tema como null', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ userSessionId: null, tema: null })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userSessionId).toBeNull()
      expect(result.data.tema).toBeNull()
    }
  })
})

// ============================================
// 3. Request invalido: sessionId no UUID
// ============================================

describe('completeTestRequestSchema - sessionId invalido', () => {
  it('rechaza sessionId que no es UUID', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ sessionId: 'not-a-uuid' })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const sessionIdError = result.error.issues.find(
        (i) => i.path.includes('sessionId')
      )
      expect(sessionIdError).toBeDefined()
      expect(sessionIdError!.message).toContain('inválido')
    }
  })

  it('rechaza sessionId vacio', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ sessionId: '' })
    )
    expect(result.success).toBe(false)
  })

  it('rechaza sessionId numerico', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ sessionId: 12345 })
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// 4. Request invalido: finalScore negativo
// ============================================

describe('completeTestRequestSchema - finalScore negativo', () => {
  it('rechaza finalScore negativo', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ finalScore: -1 })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const scoreError = result.error.issues.find(
        (i) => i.path.includes('finalScore')
      )
      expect(scoreError).toBeDefined()
    }
  })

  it('acepta finalScore = 0', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ finalScore: 0 })
    )
    expect(result.success).toBe(true)
  })

  it('rechaza finalScore decimal', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ finalScore: 5.5 })
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// 5. Request invalido: detailedAnswers vacio
// ============================================

describe('completeTestRequestSchema - detailedAnswers vacio', () => {
  it('rechaza array vacio de detailedAnswers', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ detailedAnswers: [] })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const answersError = result.error.issues.find(
        (i) => i.path.includes('detailedAnswers')
      )
      expect(answersError).toBeDefined()
    }
  })

  it('rechaza detailedAnswers ausente', () => {
    const req = validRequest()
    delete (req as Record<string, unknown>).detailedAnswers
    const result = completeTestRequestSchema.safeParse(req)
    expect(result.success).toBe(false)
  })
})

// ============================================
// 6. Request invalido: confidence con valor no permitido
// ============================================

describe('completeTestRequestSchema - confidence invalido', () => {
  it('rechaza confidence con valor no permitido', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ confidence: 'very_unsure' })],
      })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const confError = result.error.issues.find(
        (i) => i.path.includes('confidence')
      )
      expect(confError).toBeDefined()
    }
  })

  it('acepta todos los valores validos de confidence', () => {
    const validValues = ['very_sure', 'sure', 'unsure', 'guessing', 'unknown'] as const
    for (const val of validValues) {
      const result = completeTestRequestSchema.safeParse(
        validRequest({
          detailedAnswers: [validDetailedAnswer({ confidence: val })],
        })
      )
      expect(result.success).toBe(true)
    }
  })
})

// ============================================
// 7. Request invalido: totalQuestions = 0
// ============================================

describe('completeTestRequestSchema - totalQuestions = 0', () => {
  it('rechaza totalQuestions = 0', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ totalQuestions: 0 })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const tqError = result.error.issues.find(
        (i) => i.path.includes('totalQuestions')
      )
      expect(tqError).toBeDefined()
    }
  })

  it('rechaza totalQuestions negativo', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ totalQuestions: -5 })
    )
    expect(result.success).toBe(false)
  })

  it('acepta totalQuestions = 1', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({ totalQuestions: 1 })
    )
    expect(result.success).toBe(true)
  })
})

// ============================================
// 8. Response valida
// ============================================

describe('completeTestResponseSchema - response valida', () => {
  it('acepta response con status saved', () => {
    const result = completeTestResponseSchema.safeParse({
      success: true,
      status: 'saved',
      savedQuestionsCount: 10,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.success).toBe(true)
      expect(result.data.status).toBe('saved')
      expect(result.data.savedQuestionsCount).toBe(10)
    }
  })

  it('acepta response con status error', () => {
    const result = completeTestResponseSchema.safeParse({
      success: false,
      status: 'error',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.success).toBe(false)
      expect(result.data.status).toBe('error')
      expect(result.data.savedQuestionsCount).toBeUndefined()
    }
  })

  it('acepta response sin savedQuestionsCount (opcional)', () => {
    const result = completeTestResponseSchema.safeParse({
      success: true,
      status: 'saved',
    })
    expect(result.success).toBe(true)
  })
})

// ============================================
// 9. Response invalida
// ============================================

describe('completeTestResponseSchema - response invalida', () => {
  it('rechaza response sin success', () => {
    const result = completeTestResponseSchema.safeParse({
      status: 'saved',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza response sin status', () => {
    const result = completeTestResponseSchema.safeParse({
      success: true,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza status no valido', () => {
    const result = completeTestResponseSchema.safeParse({
      success: true,
      status: 'pending',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza savedQuestionsCount negativo', () => {
    const result = completeTestResponseSchema.safeParse({
      success: true,
      status: 'saved',
      savedQuestionsCount: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rechaza response completamente vacia', () => {
    const result = completeTestResponseSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

// ============================================
// 10. detailedAnswers con 500 elementos (limite maximo)
// ============================================

describe('completeTestRequestSchema - limite de 500 detailedAnswers', () => {
  it('acepta exactamente 500 detailedAnswers', () => {
    const answers = Array.from({ length: 500 }, (_, i) =>
      validDetailedAnswer({ questionIndex: i })
    )
    const result = completeTestRequestSchema.safeParse(
      validRequest({ detailedAnswers: answers, totalQuestions: 500, finalScore: 250 })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.detailedAnswers).toHaveLength(500)
    }
  })

  it('rechaza 501 detailedAnswers', () => {
    const answers = Array.from({ length: 501 }, (_, i) =>
      validDetailedAnswer({ questionIndex: i })
    )
    const result = completeTestRequestSchema.safeParse(
      validRequest({ detailedAnswers: answers, totalQuestions: 501, finalScore: 250 })
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const answersError = result.error.issues.find(
        (i) => i.path.includes('detailedAnswers')
      )
      expect(answersError).toBeDefined()
    }
  })
})

// ============================================
// 11. detailedAnswers con questionData null
// ============================================

describe('completeTestRequestSchema - questionData null', () => {
  it('acepta questionData como null', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ questionData: null })],
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.detailedAnswers[0].questionData).toBeNull()
    }
  })

  it('acepta questionData con campos internos null', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [
          validDetailedAnswer({
            questionData: {
              id: null,
              metadata: null,
              article: null,
            },
          }),
        ],
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      const qd = result.data.detailedAnswers[0].questionData
      expect(qd?.id).toBeNull()
      expect(qd?.metadata).toBeNull()
      expect(qd?.article).toBeNull()
    }
  })

  it('acepta questionData omitido (undefined)', () => {
    const answer = validDetailedAnswer()
    delete (answer as Record<string, unknown>).questionData
    const result = completeTestRequestSchema.safeParse(
      validRequest({ detailedAnswers: [answer] })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.detailedAnswers[0].questionData).toBeUndefined()
    }
  })
})

// ============================================
// 12. interactionEvents por defecto es []
// ============================================

describe('completeTestRequestSchema - interactionEvents default', () => {
  it('aplica default [] cuando interactionEvents no se envia', () => {
    const req = validRequest()
    delete (req as Record<string, unknown>).interactionEvents
    const result = completeTestRequestSchema.safeParse(req)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.interactionEvents).toEqual([])
    }
  })

  it('acepta interactionEvents con datos arbitrarios', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        interactionEvents: [
          { type: 'click', timestamp: 123 },
          { type: 'scroll', offset: 50 },
          'string_event',
          42,
        ],
      })
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.interactionEvents).toHaveLength(4)
    }
  })

  it('rechaza interactionEvents con mas de 500 elementos', () => {
    const events = Array.from({ length: 501 }, (_, i) => ({ idx: i }))
    const result = completeTestRequestSchema.safeParse(
      validRequest({ interactionEvents: events })
    )
    expect(result.success).toBe(false)
  })
})

// ============================================
// HELPER: safeParseCompleteTestRequest
// ============================================

describe('safeParseCompleteTestRequest', () => {
  it('devuelve success: true para request valido', () => {
    const result = safeParseCompleteTestRequest(validRequest())
    expect(result.success).toBe(true)
  })

  it('devuelve success: false para request invalido', () => {
    const result = safeParseCompleteTestRequest({ sessionId: 'bad' })
    expect(result.success).toBe(false)
  })
})

// ============================================
// EDGE CASES adicionales en detailedAnswer
// ============================================

describe('detailedAnswerSchema - edge cases', () => {
  it('acepta selectedAnswer = -1 (sin respuesta)', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ selectedAnswer: -1 })],
      })
    )
    expect(result.success).toBe(true)
  })

  it('rechaza selectedAnswer = 4 (fuera de rango)', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ selectedAnswer: 4 })],
      })
    )
    expect(result.success).toBe(false)
  })

  it('rechaza selectedAnswer = -2 (fuera de rango)', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ selectedAnswer: -2 })],
      })
    )
    expect(result.success).toBe(false)
  })

  it('rechaza questionIndex negativo', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ questionIndex: -1 })],
      })
    )
    expect(result.success).toBe(false)
  })

  it('rechaza timeSpent negativo', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [validDetailedAnswer({ timeSpent: -0.5 })],
      })
    )
    expect(result.success).toBe(false)
  })

  it('rechaza difficulty no valida en metadata', () => {
    const result = completeTestRequestSchema.safeParse(
      validRequest({
        detailedAnswers: [
          validDetailedAnswer({
            questionData: {
              id: VALID_UUID,
              metadata: { difficulty: 'impossible' },
              article: null,
            },
          }),
        ],
      })
    )
    expect(result.success).toBe(false)
  })
})
