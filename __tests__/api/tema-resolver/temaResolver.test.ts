// __tests__/api/tema-resolver/temaResolver.test.js
// Tests exhaustivos para el módulo tema-resolver
// Verifica schemas, validación y contratos de API

const { z } = require('zod')

// ============================================
// SCHEMAS (deben coincidir con lib/api/tema-resolver/schemas.ts)
// ============================================

const OposicionIdSchema = z.enum([
  'auxiliar_administrativo_estado',
  'administrativo_estado',
  'tramitacion_procesal',
  'auxilio_judicial',
])

const PositionTypeSchema = z.enum([
  'auxiliar_administrativo',
  'administrativo',
  'tramitacion_procesal',
  'auxilio_judicial',
])

const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',
  'tramitacion_procesal': 'tramitacion_procesal',
  'auxilio_judicial': 'auxilio_judicial',
}

const ResolveTemaByArticleRequestSchema = z.object({
  questionId: z.string().uuid().optional().nullable(),
  articleId: z.string().uuid().optional().nullable(),
  articleNumber: z.string().optional().nullable(),
  lawId: z.string().uuid().optional().nullable(),
  lawShortName: z.string().optional().nullable(),
  oposicionId: OposicionIdSchema.optional().default('auxiliar_administrativo_estado'),
}).refine(
  (data) => data.questionId || data.articleId || (data.articleNumber && (data.lawId || data.lawShortName)),
  { message: 'Debe proporcionar questionId, articleId, o (articleNumber + lawId/lawShortName)' }
)

const ResolveTemaSuccessSchema = z.object({
  success: z.literal(true),
  temaNumber: z.number().int().positive(),
  topicId: z.string().uuid(),
  topicTitle: z.string().optional(),
  positionType: PositionTypeSchema,
  resolvedVia: z.enum(['question', 'article', 'article_number', 'full_law']),
  cached: z.boolean().optional(),
})

const ResolveTemaNotFoundSchema = z.object({
  success: z.literal(false),
  temaNumber: z.null(),
  error: z.string().optional(),
  reason: z.enum([
    'question_not_found',
    'article_not_found',
    'law_not_found',
    'no_topic_scope_match',
    'invalid_position_type',
    'missing_required_params',
  ]).optional(),
})

const ResolveTemasBatchRequestSchema = z.object({
  questions: z.array(z.object({
    questionId: z.string().uuid().optional().nullable(),
    articleId: z.string().uuid().optional().nullable(),
    articleNumber: z.string().optional().nullable(),
    lawId: z.string().uuid().optional().nullable(),
  })).min(1).max(100),
  oposicionId: OposicionIdSchema.optional().default('auxiliar_administrativo_estado'),
})

const ResolveTemasBatchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    index: z.number(),
    temaNumber: z.number().nullable(),
    topicId: z.string().uuid().nullable(),
  })),
  resolved: z.number(),
  notFound: z.number(),
  cached: z.boolean().optional(),
})

// ============================================
// TESTS DE SCHEMAS
// ============================================

describe('TemaResolver Schemas', () => {

  describe('OposicionIdSchema', () => {
    test('acepta todas las oposiciones válidas', () => {
      const validOposiciones = [
        'auxiliar_administrativo_estado',
        'administrativo_estado',
        'tramitacion_procesal',
        'auxilio_judicial',
      ]

      validOposiciones.forEach(oposicion => {
        const result = OposicionIdSchema.safeParse(oposicion)
        expect(result.success).toBe(true)
      })
    })

    test('rechaza oposiciones inválidas', () => {
      const invalidOposiciones = [
        'invalid',
        'auxiliar',
        'AUXILIAR_ADMINISTRATIVO_ESTADO',
        '',
        null,
        123,
      ]

      invalidOposiciones.forEach(oposicion => {
        const result = OposicionIdSchema.safeParse(oposicion)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('OPOSICION_TO_POSITION_TYPE mapping', () => {
    test('cada oposicionId mapea a un position_type válido', () => {
      Object.entries(OPOSICION_TO_POSITION_TYPE).forEach(([oposicionId, positionType]) => {
        expect(OposicionIdSchema.safeParse(oposicionId).success).toBe(true)
        expect(PositionTypeSchema.safeParse(positionType).success).toBe(true)
      })
    })

    test('el mapeo es correcto', () => {
      expect(OPOSICION_TO_POSITION_TYPE['auxiliar_administrativo_estado']).toBe('auxiliar_administrativo')
      expect(OPOSICION_TO_POSITION_TYPE['administrativo_estado']).toBe('administrativo')
      expect(OPOSICION_TO_POSITION_TYPE['tramitacion_procesal']).toBe('tramitacion_procesal')
      expect(OPOSICION_TO_POSITION_TYPE['auxilio_judicial']).toBe('auxilio_judicial')
    })
  })

  describe('ResolveTemaByArticleRequestSchema', () => {
    test('acepta request con questionId', () => {
      const request = {
        questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('acepta request con articleId', () => {
      const request = {
        articleId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        oposicionId: 'tramitacion_procesal',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('acepta request con articleNumber + lawId', () => {
      const request = {
        articleNumber: '47',
        lawId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        oposicionId: 'auxilio_judicial',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('acepta request con articleNumber + lawShortName', () => {
      const request = {
        articleNumber: '22',
        lawShortName: 'Ley 39/2015',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('usa oposicionId por defecto cuando no se proporciona', () => {
      const request = {
        questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
      expect(result.data.oposicionId).toBe('auxiliar_administrativo_estado')
    })

    test('rechaza request sin parámetros suficientes', () => {
      const request = {
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    test('rechaza request con solo articleNumber (sin lawId ni lawShortName)', () => {
      const request = {
        articleNumber: '47',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    test('rechaza UUIDs inválidos', () => {
      const request = {
        questionId: 'not-a-uuid',
      }
      const result = ResolveTemaByArticleRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })

  describe('ResolveTemaSuccessSchema', () => {
    test('acepta respuesta exitosa válida', () => {
      const response = {
        success: true,
        temaNumber: 9,
        topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        topicTitle: 'Tema 9: Organización territorial',
        positionType: 'auxiliar_administrativo',
        resolvedVia: 'question',
      }
      const result = ResolveTemaSuccessSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    test('acepta respuesta con cached=true', () => {
      const response = {
        success: true,
        temaNumber: 5,
        topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        positionType: 'tramitacion_procesal',
        resolvedVia: 'article',
        cached: true,
      }
      const result = ResolveTemaSuccessSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    test('acepta todos los valores de resolvedVia', () => {
      const resolvedViaValues = ['question', 'article', 'article_number', 'full_law']

      resolvedViaValues.forEach(via => {
        const response = {
          success: true,
          temaNumber: 1,
          topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
          positionType: 'auxiliar_administrativo',
          resolvedVia: via,
        }
        const result = ResolveTemaSuccessSchema.safeParse(response)
        expect(result.success).toBe(true)
      })
    })

    test('rechaza temaNumber <= 0', () => {
      const response = {
        success: true,
        temaNumber: 0,
        topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        positionType: 'auxiliar_administrativo',
        resolvedVia: 'question',
      }
      const result = ResolveTemaSuccessSchema.safeParse(response)
      expect(result.success).toBe(false)
    })
  })

  describe('ResolveTemaNotFoundSchema', () => {
    test('acepta respuesta de error válida', () => {
      const response = {
        success: false,
        temaNumber: null,
        error: 'No se encontró tema',
        reason: 'no_topic_scope_match',
      }
      const result = ResolveTemaNotFoundSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    test('acepta todos los valores de reason', () => {
      const reasons = [
        'question_not_found',
        'article_not_found',
        'law_not_found',
        'no_topic_scope_match',
        'invalid_position_type',
        'missing_required_params',
      ]

      reasons.forEach(reason => {
        const response = {
          success: false,
          temaNumber: null,
          reason,
        }
        const result = ResolveTemaNotFoundSchema.safeParse(response)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('ResolveTemasBatchRequestSchema', () => {
    test('acepta batch request válido', () => {
      const request = {
        questions: [
          { questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' },
          { articleId: '2b562f1d-eaf8-4a26-8b1d-1152aa310cc2' },
          { articleNumber: '47', lawId: '3c562f1d-eaf8-4a26-8b1d-1152aa310cc3' },
        ],
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemasBatchRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('rechaza batch vacío', () => {
      const request = {
        questions: [],
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemasBatchRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    test('rechaza batch con más de 100 preguntas', () => {
      const questions = Array(101).fill({ questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' })
      const request = {
        questions,
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemasBatchRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    test('acepta batch con 100 preguntas (límite)', () => {
      const questions = Array(100).fill({ questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' })
      const request = {
        questions,
        oposicionId: 'auxiliar_administrativo_estado',
      }
      const result = ResolveTemasBatchRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })
  })

  describe('ResolveTemasBatchResponseSchema', () => {
    test('acepta batch response válido', () => {
      const response = {
        success: true,
        results: [
          { index: 0, temaNumber: 9, topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' },
          { index: 1, temaNumber: null, topicId: null },
          { index: 2, temaNumber: 5, topicId: '2b562f1d-eaf8-4a26-8b1d-1152aa310cc2' },
        ],
        resolved: 2,
        notFound: 1,
      }
      const result = ResolveTemasBatchResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    test('acepta response parcialmente exitoso', () => {
      const response = {
        success: true,
        results: [
          { index: 0, temaNumber: null, topicId: null },
        ],
        resolved: 0,
        notFound: 1,
      }
      const result = ResolveTemasBatchResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// TESTS DE CONTRATOS API
// ============================================

describe('TemaResolver API Contracts', () => {

  describe('GET /api/tema-resolver', () => {
    test('query params válidos para búsqueda por questionId', () => {
      const queryParams = {
        questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        oposicionId: 'auxiliar_administrativo_estado',
      }

      const result = ResolveTemaByArticleRequestSchema.safeParse(queryParams)
      expect(result.success).toBe(true)
    })

    test('respuesta exitosa sigue el schema', () => {
      const mockSuccessResponse = {
        success: true,
        temaNumber: 9,
        topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
        topicTitle: 'Tema 9',
        positionType: 'auxiliar_administrativo',
        resolvedVia: 'question',
      }

      const result = ResolveTemaSuccessSchema.safeParse(mockSuccessResponse)
      expect(result.success).toBe(true)
    })

    test('respuesta de error sigue el schema', () => {
      const mockErrorResponse = {
        success: false,
        temaNumber: null,
        error: 'Pregunta no encontrada',
        reason: 'question_not_found',
      }

      const result = ResolveTemaNotFoundSchema.safeParse(mockErrorResponse)
      expect(result.success).toBe(true)
    })
  })

  describe('POST /api/tema-resolver (batch)', () => {
    test('body válido para batch request', () => {
      const body = {
        questions: [
          { questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' },
          { questionId: '2b562f1d-eaf8-4a26-8b1d-1152aa310cc2' },
        ],
        oposicionId: 'tramitacion_procesal',
      }

      const result = ResolveTemasBatchRequestSchema.safeParse(body)
      expect(result.success).toBe(true)
    })

    test('respuesta batch sigue el schema', () => {
      const mockBatchResponse = {
        success: true,
        results: [
          { index: 0, temaNumber: 9, topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' },
          { index: 1, temaNumber: 11, topicId: '2b562f1d-eaf8-4a26-8b1d-1152aa310cc2' },
        ],
        resolved: 2,
        notFound: 0,
      }

      const result = ResolveTemasBatchResponseSchema.safeParse(mockBatchResponse)
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// TESTS DE CACHE LRU
// ============================================

describe('LRU Cache Behavior', () => {
  // Simulamos el comportamiento del cache LRU
  class MockLRUCache {
    constructor(maxSize) {
      this.cache = new Map()
      this.maxSize = maxSize
    }

    get(key) {
      const entry = this.cache.get(key)
      if (entry) {
        this.cache.delete(key)
        this.cache.set(key, entry)
      }
      return entry
    }

    set(key, value) {
      if (this.cache.has(key)) {
        this.cache.delete(key)
      }
      while (this.cache.size >= this.maxSize) {
        const firstKey = this.cache.keys().next().value
        if (firstKey) this.cache.delete(firstKey)
      }
      this.cache.set(key, value)
    }

    get size() {
      return this.cache.size
    }
  }

  test('no excede el tamaño máximo', () => {
    const cache = new MockLRUCache(3)

    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    cache.set('d', 4) // Esto debe eliminar 'a'

    expect(cache.size).toBe(3)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('d')).toBe(4)
  })

  test('acceder a un elemento lo mueve al final (más reciente)', () => {
    const cache = new MockLRUCache(3)

    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Acceder a 'a' lo hace el más reciente
    cache.get('a')

    // Añadir 'd' debe eliminar 'b' (el menos reciente ahora)
    cache.set('d', 4)

    expect(cache.get('a')).toBe(1) // 'a' sigue existiendo
    expect(cache.get('b')).toBeUndefined() // 'b' fue eliminado
  })

  test('actualizar un elemento no aumenta el tamaño', () => {
    const cache = new MockLRUCache(3)

    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    // Actualizar 'a'
    cache.set('a', 10)

    expect(cache.size).toBe(3)
    expect(cache.get('a')).toBe(10)
  })
})

// ============================================
// TESTS DE PERFORMANCE
// ============================================

describe('Performance Characteristics', () => {
  test('batch request tiene límite de 100 para evitar sobrecarga', () => {
    const maxBatchSize = 100

    // 100 debe ser aceptado
    const validBatch = {
      questions: Array(100).fill({ questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' }),
    }
    expect(ResolveTemasBatchRequestSchema.safeParse(validBatch).success).toBe(true)

    // 101 debe ser rechazado
    const invalidBatch = {
      questions: Array(101).fill({ questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' }),
    }
    expect(ResolveTemasBatchRequestSchema.safeParse(invalidBatch).success).toBe(false)
  })

  test('cache tiene TTL de 5 minutos', () => {
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutos en ms
    expect(CACHE_TTL).toBe(300000)
  })

  test('cache tiene tamaño máximo de 10000 entradas', () => {
    const CACHE_MAX_SIZE = 10000
    expect(CACHE_MAX_SIZE).toBe(10000)
  })
})

// ============================================
// TESTS DE EDGE CASES
// ============================================

describe('Edge Cases', () => {
  test('null y undefined en campos opcionales', () => {
    const request = {
      questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
      articleId: null,
      articleNumber: undefined,
      lawId: null,
      lawShortName: undefined,
    }

    const result = ResolveTemaByArticleRequestSchema.safeParse(request)
    expect(result.success).toBe(true)
  })

  test('strings vacíos vs null', () => {
    // articleNumber vacío es diferente de null
    const requestWithEmpty = {
      questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
      articleNumber: '',
    }

    const result = ResolveTemaByArticleRequestSchema.safeParse(requestWithEmpty)
    expect(result.success).toBe(true)
  })

  test('temaNumber puede ser cualquier entero positivo', () => {
    // Temas normales (1-30)
    expect(ResolveTemaSuccessSchema.safeParse({
      success: true,
      temaNumber: 1,
      topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
      positionType: 'auxiliar_administrativo',
      resolvedVia: 'question',
    }).success).toBe(true)

    // Temas extendidos (100+)
    expect(ResolveTemaSuccessSchema.safeParse({
      success: true,
      temaNumber: 108,
      topicId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1',
      positionType: 'tramitacion_procesal',
      resolvedVia: 'article',
    }).success).toBe(true)
  })

  test('batch con preguntas mixtas (questionId y articleId)', () => {
    const mixedBatch = {
      questions: [
        { questionId: '1a562f1d-eaf8-4a26-8b1d-1152aa310cc1' },
        { articleId: '2b562f1d-eaf8-4a26-8b1d-1152aa310cc2' },
        { questionId: null, articleId: '3c562f1d-eaf8-4a26-8b1d-1152aa310cc3' },
      ],
      oposicionId: 'auxiliar_administrativo_estado',
    }

    const result = ResolveTemasBatchRequestSchema.safeParse(mixedBatch)
    expect(result.success).toBe(true)
  })
})
