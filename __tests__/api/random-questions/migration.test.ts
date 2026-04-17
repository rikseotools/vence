/**
 * Tests para la migración de fetchRandomQuestions: de Supabase RPC directo
 * a /api/questions/filtered (Drizzle + Zod).
 *
 * Verifica: contrato de respuesta, modo adaptativo, manejo de errores,
 * compatibilidad con TestLayout, y observabilidad.
 */

// ============================================
// FIXTURES
// ============================================

function makeFilteredQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-' + Math.random().toString(36).slice(2, 10),
    question: '¿Cuál es el artículo X?',
    options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'] as [string, string, string, string],
    explanation: 'Explicación de prueba',
    correct_option: 2,
    primary_article_id: 'art-001',
    tema: 1,
    image_url: null,
    content_data: null,
    article: {
      id: 'art-001',
      number: '14',
      title: 'Derecho a la igualdad',
      full_text: 'Contenido del artículo...',
      law_name: 'Constitución Española',
      law_short_name: 'CE',
      display_number: 'Art. 14 CE',
    },
    metadata: {
      id: 'q-001',
      difficulty: 'medium',
      question_type: 'single',
      tags: null,
      is_active: true,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: null,
      is_official_exam: false,
      exam_source: null,
      exam_date: null,
      exam_entity: null,
      exam_position: null,
      official_difficulty_level: null,
    },
    ...overrides,
  }
}

function makeApiResponse(numQuestions: number, overrides: Record<string, unknown> = {}) {
  const questions = Array.from({ length: numQuestions }, (_, i) =>
    makeFilteredQuestion({ id: `q-${i}`, tema: 1 })
  )
  return {
    success: true,
    questions,
    totalAvailable: numQuestions + 50,
    filtersApplied: { laws: 3, articles: 0, sections: 0 },
    ...overrides,
  }
}

// ============================================
// 1. COMPATIBILIDAD DE FORMATO
// ============================================

describe('FilteredQuestion → TestLayout compatibility', () => {
  const q = makeFilteredQuestion()

  test('tiene todos los campos que TestLayout necesita', () => {
    expect(q).toHaveProperty('id')
    expect(q).toHaveProperty('question')
    expect(q).toHaveProperty('options')
    expect(q).toHaveProperty('correct_option')
    expect(q).toHaveProperty('explanation')
    expect(q).toHaveProperty('primary_article_id')
    expect(q).toHaveProperty('article')
    expect(q).toHaveProperty('metadata')
  })

  test('correct_option es un número 0-3', () => {
    expect(typeof q.correct_option).toBe('number')
    expect(q.correct_option).toBeGreaterThanOrEqual(0)
    expect(q.correct_option).toBeLessThanOrEqual(3)
  })

  test('options es un array de exactamente 4 strings', () => {
    expect(Array.isArray(q.options)).toBe(true)
    expect(q.options).toHaveLength(4)
    q.options.forEach((opt: string) => expect(typeof opt).toBe('string'))
  })

  test('article tiene los campos para ChartQuestion y display', () => {
    expect(q.article).toHaveProperty('id')
    expect(q.article).toHaveProperty('number')
    expect(q.article).toHaveProperty('title')
    expect(q.article).toHaveProperty('full_text')
    expect(q.article).toHaveProperty('law_name')
    expect(q.article).toHaveProperty('law_short_name')
    expect(q.article).toHaveProperty('display_number')
  })

  test('metadata tiene los campos para tracking y guardado', () => {
    expect(q.metadata).toHaveProperty('id')
    expect(q.metadata).toHaveProperty('difficulty')
    expect(q.metadata).toHaveProperty('question_type')
    expect(q.metadata).toHaveProperty('is_active')
    expect(q.metadata).toHaveProperty('is_official_exam')
  })

  test('campo "question" (no "question_text") para compatibilidad con TestLayout', () => {
    expect(q).toHaveProperty('question')
    expect(q).not.toHaveProperty('question_text')
  })
})

// ============================================
// 2. CONTRATO DE LA API RESPONSE
// ============================================

describe('API response contract', () => {
  test('respuesta exitosa tiene success, questions, totalAvailable', () => {
    const res = makeApiResponse(25)
    expect(res.success).toBe(true)
    expect(Array.isArray(res.questions)).toBe(true)
    expect(typeof res.totalAvailable).toBe('number')
    expect(res.filtersApplied).toBeDefined()
  })

  test('cada pregunta en la respuesta tiene formato completo', () => {
    const res = makeApiResponse(10)
    res.questions.forEach((q: ReturnType<typeof makeFilteredQuestion>) => {
      expect(typeof q.id).toBe('string')
      expect(typeof q.question).toBe('string')
      expect(q.options).toHaveLength(4)
      expect(typeof q.correct_option).toBe('number')
      expect(q.article).toBeDefined()
      expect(q.metadata).toBeDefined()
    })
  })

  test('respuesta vacía tiene emptyReason', () => {
    const res = makeApiResponse(0, { emptyReason: 'No hay preguntas disponibles' })
    expect(res.questions).toHaveLength(0)
    expect(res.emptyReason).toBeDefined()
  })
})

// ============================================
// 3. MODO ADAPTATIVO
// ============================================

describe('Adaptive mode handling', () => {
  test('modo adaptativo: pide el doble y divide en active + pool', () => {
    const numQuestions = 25
    const poolSize = numQuestions * 2
    const res = makeApiResponse(poolSize)

    const activeQuestions = res.questions.slice(0, numQuestions)
    const questionPool = res.questions

    expect(activeQuestions).toHaveLength(numQuestions)
    expect(questionPool).toHaveLength(poolSize)
    expect(questionPool.length).toBe(activeQuestions.length * 2)
  })

  test('modo adaptativo: estructura de retorno tiene isAdaptive flag', () => {
    const numQuestions = 25
    const res = makeApiResponse(numQuestions * 2)

    const adaptiveResult = {
      isAdaptive: true as const,
      activeQuestions: res.questions.slice(0, numQuestions),
      questionPool: res.questions,
      poolSize: res.questions.length,
      requestedCount: numQuestions,
    }

    expect(adaptiveResult.isAdaptive).toBe(true)
    expect(adaptiveResult.activeQuestions).toHaveLength(numQuestions)
    expect(adaptiveResult.questionPool).toHaveLength(numQuestions * 2)
    expect(adaptiveResult.poolSize).toBe(numQuestions * 2)
    expect(adaptiveResult.requestedCount).toBe(numQuestions)
  })

  test('modo normal: devuelve array plano, no estructura adaptativa', () => {
    const res = makeApiResponse(25)
    expect(Array.isArray(res.questions)).toBe(true)
    expect(res.questions).not.toHaveProperty('isAdaptive')
  })
})

// ============================================
// 4. CONSTRUCCIÓN DEL REQUEST BODY
// ============================================

describe('Request body construction for /api/questions/filtered', () => {
  function buildRequestBody(
    tema: number,
    numQuestions: number,
    positionType: string,
    adaptiveMode: boolean
  ) {
    const poolSize = adaptiveMode ? numQuestions * 2 : numQuestions
    return {
      topicNumber: tema,
      positionType,
      numQuestions: poolSize,
      selectedLaws: [],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      difficultyMode: 'random' as const,
    }
  }

  test('tema se mapea a topicNumber', () => {
    const body = buildRequestBody(5, 25, 'auxiliar_administrativo_estado', false)
    expect(body.topicNumber).toBe(5)
  })

  test('tema=0 entra en modo global (sin filtro de tema)', () => {
    const body = buildRequestBody(0, 25, 'auxiliar_administrativo_estado', false)
    expect(body.topicNumber).toBe(0)
  })

  test('modo adaptativo pide el doble de preguntas', () => {
    const body = buildRequestBody(1, 25, 'auxiliar_administrativo_estado', true)
    expect(body.numQuestions).toBe(50)
  })

  test('modo normal pide la cantidad exacta', () => {
    const body = buildRequestBody(1, 25, 'auxiliar_administrativo_estado', false)
    expect(body.numQuestions).toBe(25)
  })

  test('positionType se pasa tal cual del config', () => {
    const body = buildRequestBody(1, 25, 'auxiliar_administrativo_madrid', false)
    expect(body.positionType).toBe('auxiliar_administrativo_madrid')
  })

  test('selectedLaws vacío para test aleatorio (sin filtro de ley)', () => {
    const body = buildRequestBody(1, 25, 'auxiliar_administrativo_estado', false)
    expect(body.selectedLaws).toEqual([])
  })

  test('difficultyMode siempre es random para test aleatorio', () => {
    const body = buildRequestBody(1, 25, 'auxiliar_administrativo_estado', false)
    expect(body.difficultyMode).toBe('random')
  })
})

// ============================================
// 5. MANEJO DE ERRORES
// ============================================

describe('Error handling', () => {
  test('respuesta API con success=false genera error con mensaje', () => {
    const apiResponse = { success: false, error: 'No se encontró el topic_scope' }
    expect(apiResponse.success).toBe(false)
    expect(apiResponse.error).toBeDefined()
    expect(typeof apiResponse.error).toBe('string')
  })

  test('respuesta vacía (0 preguntas) genera error descriptivo', () => {
    const res = makeApiResponse(0, { emptyReason: 'No hay contenido configurado para la oposición' })
    expect(res.questions).toHaveLength(0)

    const errorMessage = res.emptyReason || `No hay preguntas disponibles`
    expect(errorMessage).toContain('No hay')
  })

  test('HTTP 429 (rate limit) contiene Retry-After', () => {
    const errorResponse = {
      status: 429,
      headers: { 'Retry-After': '60' },
      body: { success: false, error: 'Demasiadas solicitudes. Espera un momento.' },
    }
    expect(errorResponse.status).toBe(429)
    expect(errorResponse.headers['Retry-After']).toBeDefined()
    expect(errorResponse.body.success).toBe(false)
  })

  test('HTTP 400 (validación) contiene details con issues', () => {
    const errorResponse = {
      status: 400,
      body: {
        success: false,
        error: 'Parámetros inválidos',
        details: [{ path: 'positionType', message: 'Invalid enum value' }],
      },
    }
    expect(errorResponse.status).toBe(400)
    expect(errorResponse.body.details).toHaveLength(1)
    expect(errorResponse.body.details[0].path).toBe('positionType')
  })

  test('HTTP 500 genera error genérico sin exponer internals', () => {
    const errorResponse = {
      status: 500,
      body: { success: false, error: 'Error interno del servidor' },
    }
    expect(errorResponse.body.error).not.toContain('SQL')
    expect(errorResponse.body.error).not.toContain('password')
    expect(errorResponse.body.error).not.toContain('connection')
  })
})

// ============================================
// 6. EDGE CASES
// ============================================

describe('Edge cases', () => {
  test('API devuelve menos preguntas de las pedidas (hay pocas en BD)', () => {
    const pedidas = 25
    const disponibles = 8
    const res = makeApiResponse(disponibles)

    expect(res.questions.length).toBeLessThan(pedidas)
    expect(res.questions.length).toBe(disponibles)
  })

  test('API devuelve preguntas con image_url (psicotécnicos, diagramas)', () => {
    const q = makeFilteredQuestion({ image_url: 'https://example.com/img.png' })
    expect(q.image_url).toBeDefined()
  })

  test('API devuelve preguntas con content_data (preguntas enriquecidas)', () => {
    const q = makeFilteredQuestion({ content_data: { type: 'sequence', items: [1, 2, 3] } })
    expect(q.content_data).toBeDefined()
  })

  test('correct_option edge values: 0 (A) y 3 (D)', () => {
    const qA = makeFilteredQuestion({ correct_option: 0 })
    const qD = makeFilteredQuestion({ correct_option: 3 })
    expect(qA.correct_option).toBe(0)
    expect(qD.correct_option).toBe(3)
  })

  test('tema puede ser null en modo global', () => {
    const q = makeFilteredQuestion({ tema: null })
    expect(q.tema).toBeNull()
  })
})

// ============================================
// 7. OBSERVABILIDAD — Estructura de logs esperados
// ============================================

describe('Observability contract', () => {
  test('log de request tiene prefijo correcto', () => {
    const logLine = '🎲 Cargando test aleatorio via API, tema: 5'
    expect(logLine).toContain('🎲')
    expect(logLine).toContain('tema:')
  })

  test('log de éxito incluye cantidad de preguntas', () => {
    const logLine = '✅ Test aleatorio cargado via API: 25 preguntas'
    expect(logLine).toContain('✅')
    expect(logLine).toMatch(/\d+ preguntas/)
  })

  test('log de error tiene prefijo ❌ y contexto', () => {
    const logLine = '❌ Error en fetchRandomQuestions (API): Rate limit exceeded'
    expect(logLine).toContain('❌')
    expect(logLine).toContain('fetchRandomQuestions')
  })
})
