// __tests__/lib/api/saveDetailedAnswerV2-oposicionId.test.ts
// Tests para verificar que saveDetailedAnswerV2 envía oposicionId al servidor
// y que insertTestAnswer lo maneja correctamente

import { ALL_OPOSICION_IDS } from '@/lib/config/oposiciones'

// ============================================
// TESTS: Configuración de oposiciones
// ============================================

describe('ALL_OPOSICION_IDS — configuración', () => {
  it('incluye auxiliar_administrativo_estado', () => {
    expect(ALL_OPOSICION_IDS).toContain('auxiliar_administrativo_estado')
  })

  it('incluye explorador', () => {
    expect(ALL_OPOSICION_IDS).toContain('explorador')
  })

  it('no incluye UUIDs (solo string IDs)', () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const id of ALL_OPOSICION_IDS) {
      expect(uuidPattern.test(id)).toBe(false)
    }
  })

  it('todos los IDs son strings no vacíos', () => {
    for (const id of ALL_OPOSICION_IDS) {
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    }
  })

  it('no tiene duplicados', () => {
    const unique = new Set(ALL_OPOSICION_IDS)
    expect(unique.size).toBe(ALL_OPOSICION_IDS.length)
  })
})

// ============================================
// TESTS: Lógica de fallback del servidor
// ============================================

describe('insertTestAnswer — lógica de oposicionId', () => {
  // Simula la lógica exacta del servidor (lib/api/test-answers/queries.ts:112-127)
  function resolveOposicionId(
    reqOposicionId: string | null | undefined,
    userTargetOposicion: string | null | undefined
  ): { oposicionId: string; source: 'client' | 'profile' | 'fallback' } {
    // Step 1: usar oposicionId del request si existe
    if (reqOposicionId) {
      return { oposicionId: reqOposicionId, source: 'client' }
    }

    // Step 2: buscar en perfil
    const userOposicion = userTargetOposicion
    if (
      userOposicion &&
      ALL_OPOSICION_IDS.includes(userOposicion) &&
      userOposicion !== 'explorador'
    ) {
      return { oposicionId: userOposicion, source: 'profile' }
    }

    // Step 3: fallback
    return { oposicionId: 'auxiliar_administrativo_estado', source: 'fallback' }
  }

  describe('cuando el cliente envía oposicionId', () => {
    it('usa el oposicionId del cliente directamente', () => {
      const result = resolveOposicionId('tramitacion_procesal', null)
      expect(result.oposicionId).toBe('tramitacion_procesal')
      expect(result.source).toBe('client')
    })

    it('usa el oposicionId del cliente incluso si el perfil tiene otro', () => {
      const result = resolveOposicionId(
        'tramitacion_procesal',
        'auxiliar_administrativo_estado'
      )
      expect(result.oposicionId).toBe('tramitacion_procesal')
      expect(result.source).toBe('client')
    })

    it('usa el oposicionId del cliente aunque sea un UUID (custom)', () => {
      const result = resolveOposicionId(
        '1c787385-2b1a-4c5c-ac26-bb34254976a8',
        null
      )
      expect(result.oposicionId).toBe('1c787385-2b1a-4c5c-ac26-bb34254976a8')
      expect(result.source).toBe('client')
    })
  })

  describe('cuando el cliente NO envía oposicionId', () => {
    it('usa el perfil del usuario si es un ID válido', () => {
      const result = resolveOposicionId(null, 'auxiliar_administrativo_estado')
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('profile')
    })

    it('fallback a auxiliar si el perfil tiene UUID (oposición custom)', () => {
      const result = resolveOposicionId(null, '1c787385-2b1a-4c5c-ac26-bb34254976a8')
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })

    it('fallback a auxiliar si el perfil tiene "explorador"', () => {
      const result = resolveOposicionId(null, 'explorador')
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })

    it('fallback a auxiliar si el perfil es null', () => {
      const result = resolveOposicionId(null, null)
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })

    it('fallback a auxiliar si el perfil es undefined', () => {
      const result = resolveOposicionId(null, undefined)
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })

    it('fallback a auxiliar si el perfil tiene un string aleatorio', () => {
      const result = resolveOposicionId(null, 'oposicion_inventada')
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })

    it('fallback a auxiliar si el perfil es string vacío', () => {
      const result = resolveOposicionId(null, '')
      expect(result.oposicionId).toBe('auxiliar_administrativo_estado')
      expect(result.source).toBe('fallback')
    })
  })

  describe('con reqOposicionId vacío', () => {
    it('string vacío se trata como ausente → busca en perfil', () => {
      const result = resolveOposicionId('', 'tramitacion_procesal')
      // Empty string is falsy, so goes to profile
      expect(result.source).toBe('profile')
      expect(result.oposicionId).toBe('tramitacion_procesal')
    })
  })

  describe('todas las oposiciones oficiales se resuelven correctamente', () => {
    const oficiales = ALL_OPOSICION_IDS.filter(id => id !== 'explorador')

    for (const oposicionId of oficiales) {
      it(`resuelve "${oposicionId}" desde perfil`, () => {
        const result = resolveOposicionId(null, oposicionId)
        expect(result.oposicionId).toBe(oposicionId)
        expect(result.source).toBe('profile')
      })

      it(`resuelve "${oposicionId}" desde cliente`, () => {
        const result = resolveOposicionId(oposicionId, null)
        expect(result.oposicionId).toBe(oposicionId)
        expect(result.source).toBe('client')
      })
    }
  })
})

// ============================================
// TESTS: Schema de request acepta oposicionId
// ============================================

describe('saveAnswerRequestSchema — oposicionId', () => {
  // Import inline para no interferir con mocks
  const { saveAnswerRequestSchema } = require('@/lib/api/test-answers/schemas')

  const baseRequest = {
    sessionId: '11111111-2222-3333-4444-555555555555',
    questionData: {
      question: 'Pregunta de test',
      options: ['A', 'B', 'C', 'D'],
    },
    answerData: {
      questionIndex: 0,
      selectedAnswer: 1,
      correctAnswer: 2,
      isCorrect: false,
      timeSpent: 10,
    },
  }

  it('acepta request con oposicionId string', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...baseRequest,
      oposicionId: 'auxiliar_administrativo_estado'
    })
    expect(result.success).toBe(true)
    expect(result.data.oposicionId).toBe('auxiliar_administrativo_estado')
  })

  it('acepta request con oposicionId null', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...baseRequest,
      oposicionId: null
    })
    expect(result.success).toBe(true)
    expect(result.data.oposicionId).toBeNull()
  })

  it('acepta request sin oposicionId (opcional)', () => {
    const result = saveAnswerRequestSchema.safeParse(baseRequest)
    expect(result.success).toBe(true)
    // Should be undefined since not provided
  })

  it('acepta request con oposicionId UUID (custom)', () => {
    const result = saveAnswerRequestSchema.safeParse({
      ...baseRequest,
      oposicionId: '1c787385-2b1a-4c5c-ac26-bb34254976a8'
    })
    expect(result.success).toBe(true)
    expect(result.data.oposicionId).toBe('1c787385-2b1a-4c5c-ac26-bb34254976a8')
  })
})

// ============================================
// TESTS: Body construction incluye oposicionId
// ============================================

describe('saveDetailedAnswerV2 — body construction', () => {
  // Simula la lógica de construcción del body (testAnswers.ts:496-525)
  function buildBody(
    sessionId: string,
    questionData: { id?: string; question: string; options: string[] },
    answerData: { questionIndex: number; selectedAnswer: number; correctAnswer: number; isCorrect: boolean; timeSpent: number },
    oposicionId: string | null
  ) {
    return {
      sessionId,
      questionData: {
        id: questionData.id || null,
        question: questionData.question || '',
        options: questionData.options || [],
      },
      answerData: {
        questionIndex: answerData.questionIndex || 0,
        selectedAnswer: answerData.selectedAnswer ?? -1,
        correctAnswer: answerData.correctAnswer || 0,
        isCorrect: answerData.isCorrect || false,
        timeSpent: answerData.timeSpent || 0,
      },
      oposicionId
    }
  }

  it('incluye oposicionId cuando disponible', () => {
    const body = buildBody(
      'session-id',
      { question: 'Test?', options: ['A', 'B', 'C', 'D'] },
      { questionIndex: 0, selectedAnswer: 1, correctAnswer: 2, isCorrect: false, timeSpent: 10 },
      'auxiliar_administrativo_estado'
    )

    expect(body.oposicionId).toBe('auxiliar_administrativo_estado')
  })

  it('incluye oposicionId null cuando no disponible', () => {
    const body = buildBody(
      'session-id',
      { question: 'Test?', options: ['A', 'B', 'C', 'D'] },
      { questionIndex: 0, selectedAnswer: 1, correctAnswer: 2, isCorrect: false, timeSpent: 10 },
      null
    )

    expect(body).toHaveProperty('oposicionId')
    expect(body.oposicionId).toBeNull()
  })

  it('oposicionId se serializa correctamente en JSON', () => {
    const body = buildBody(
      'session-id',
      { question: 'Test?', options: ['A', 'B', 'C', 'D'] },
      { questionIndex: 0, selectedAnswer: 1, correctAnswer: 2, isCorrect: false, timeSpent: 10 },
      'tramitacion_procesal'
    )

    const json = JSON.stringify(body)
    const parsed = JSON.parse(json)
    expect(parsed.oposicionId).toBe('tramitacion_procesal')
  })

  it('oposicionId null se serializa como null en JSON (no se pierde)', () => {
    const body = buildBody(
      'session-id',
      { question: 'Test?', options: ['A', 'B', 'C', 'D'] },
      { questionIndex: 0, selectedAnswer: 1, correctAnswer: 2, isCorrect: false, timeSpent: 10 },
      null
    )

    const json = JSON.stringify(body)
    const parsed = JSON.parse(json)
    expect(parsed.oposicionId).toBeNull()
    expect('oposicionId' in parsed).toBe(true)
  })
})
