// __tests__/api/topic-data/topicData.test.js
// Tests unitarios para el API layer de topic-data (Drizzle + Zod)
// Estos tests definen el COMPORTAMIENTO ESPERADO antes del refactoring

import {
  getTopicDataRequestSchema,
  topicInfoSchema,
  difficultyStatsSchema,
  articlesByLawItemSchema,
  articlesByLawSchema,
  userProgressSchema,
  getTopicDataResponseSchema,
  validateGetTopicDataRequest,
  safeParseGetTopicDataRequest,
  isValidTopicNumber,
  OPOSICION_TO_POSITION_TYPE,
  VALID_TOPIC_RANGES
} from '../../../lib/api/topic-data/schemas'

// ============================================
// TESTS DE REQUEST SCHEMA
// ============================================

describe('Topic Data - Request Schema', () => {
  describe('getTopicDataRequestSchema', () => {
    test('debe aceptar request válido para auxiliar', () => {
      const validRequest = {
        topicNumber: 5,
        oposicion: 'auxiliar-administrativo-estado',
        userId: '550e8400-e29b-41d4-a716-446655440000'
      }
      const result = getTopicDataRequestSchema.safeParse(validRequest)

      expect(result.success).toBe(true)
      expect(result.data.topicNumber).toBe(5)
      expect(result.data.oposicion).toBe('auxiliar-administrativo-estado')
    })

    test('debe aceptar request válido para administrativo', () => {
      const validRequest = {
        topicNumber: 301,
        oposicion: 'administrativo-estado',
        userId: null
      }
      const result = getTopicDataRequestSchema.safeParse(validRequest)

      expect(result.success).toBe(true)
      expect(result.data.oposicion).toBe('administrativo-estado')
    })

    test('debe aceptar request sin userId (usuario anónimo)', () => {
      const validRequest = {
        topicNumber: 1,
        oposicion: 'auxiliar-administrativo-estado'
      }
      const result = getTopicDataRequestSchema.safeParse(validRequest)

      expect(result.success).toBe(true)
    })

    test('debe rechazar topicNumber negativo', () => {
      const invalidRequest = {
        topicNumber: -1,
        oposicion: 'auxiliar-administrativo-estado'
      }
      const result = getTopicDataRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
    })

    test('debe rechazar topicNumber decimal', () => {
      const invalidRequest = {
        topicNumber: 5.5,
        oposicion: 'auxiliar-administrativo-estado'
      }
      const result = getTopicDataRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
    })

    test('debe rechazar oposición inválida', () => {
      const invalidRequest = {
        topicNumber: 1,
        oposicion: 'oposicion-inexistente'
      }
      const result = getTopicDataRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
    })

    test('debe rechazar userId inválido (no UUID)', () => {
      const invalidRequest = {
        topicNumber: 1,
        oposicion: 'auxiliar-administrativo-estado',
        userId: 'not-a-uuid'
      }
      const result = getTopicDataRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// TESTS DE TOPIC INFO SCHEMA
// ============================================

describe('Topic Data - Topic Info Schema', () => {
  describe('topicInfoSchema', () => {
    test('debe validar topic info completo', () => {
      const validTopic = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        topicNumber: 5,
        title: 'El Gobierno y la Administración',
        description: 'Composición, organización y funciones del Gobierno.',
        difficulty: 'medium',
        estimatedHours: 4
      }
      const result = topicInfoSchema.safeParse(validTopic)

      expect(result.success).toBe(true)
      expect(result.data.title).toBe('El Gobierno y la Administración')
    })

    test('debe aceptar description null', () => {
      const validTopic = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        topicNumber: 5,
        title: 'El Gobierno y la Administración',
        description: null,
        difficulty: null,
        estimatedHours: null
      }
      const result = topicInfoSchema.safeParse(validTopic)

      expect(result.success).toBe(true)
    })

    test('debe rechazar title vacío', () => {
      const invalidTopic = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        topicNumber: 5,
        title: '',
        description: null,
        difficulty: null,
        estimatedHours: null
      }
      const result = topicInfoSchema.safeParse(invalidTopic)

      expect(result.success).toBe(false)
    })

    test('debe rechazar id no UUID', () => {
      const invalidTopic = {
        id: 'not-a-uuid',
        topicNumber: 5,
        title: 'Título',
        description: null,
        difficulty: null,
        estimatedHours: null
      }
      const result = topicInfoSchema.safeParse(invalidTopic)

      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// TESTS DE DIFFICULTY STATS SCHEMA
// ============================================

describe('Topic Data - Difficulty Stats Schema', () => {
  describe('difficultyStatsSchema', () => {
    test('debe validar stats de dificultad completas', () => {
      const validStats = {
        easy: 25,
        medium: 45,
        hard: 20,
        extreme: 5,
        auto: 33
      }
      const result = difficultyStatsSchema.safeParse(validStats)

      expect(result.success).toBe(true)
      expect(result.data.easy).toBe(25)
      expect(result.data.medium).toBe(45)
    })

    test('debe aplicar defaults para campos faltantes', () => {
      const partialStats = {
        easy: 10,
        medium: 20
      }
      const result = difficultyStatsSchema.safeParse(partialStats)

      expect(result.success).toBe(true)
      expect(result.data.hard).toBe(0)
      expect(result.data.extreme).toBe(0)
      expect(result.data.auto).toBe(0)
    })

    test('debe rechazar valores negativos', () => {
      const invalidStats = {
        easy: -5,
        medium: 20,
        hard: 10,
        extreme: 5,
        auto: 0
      }
      const result = difficultyStatsSchema.safeParse(invalidStats)

      expect(result.success).toBe(false)
    })

    test('debe rechazar valores decimales', () => {
      const invalidStats = {
        easy: 10.5,
        medium: 20,
        hard: 10,
        extreme: 5,
        auto: 0
      }
      const result = difficultyStatsSchema.safeParse(invalidStats)

      expect(result.success).toBe(false)
    })

    test('debe aceptar stats vacías (todas en 0)', () => {
      const emptyStats = {
        easy: 0,
        medium: 0,
        hard: 0,
        extreme: 0,
        auto: 0
      }
      const result = difficultyStatsSchema.safeParse(emptyStats)

      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// TESTS DE ARTICLES BY LAW SCHEMA
// ============================================

describe('Topic Data - Articles By Law Schema', () => {
  describe('articlesByLawItemSchema', () => {
    test('debe validar item de artículos por ley', () => {
      const validItem = {
        lawShortName: 'CE',
        lawName: 'Constitución Española',
        articlesWithQuestions: 45
      }
      const result = articlesByLawItemSchema.safeParse(validItem)

      expect(result.success).toBe(true)
      expect(result.data.lawShortName).toBe('CE')
    })

    test('debe rechazar articlesWithQuestions negativo', () => {
      const invalidItem = {
        lawShortName: 'CE',
        lawName: 'Constitución Española',
        articlesWithQuestions: -1
      }
      const result = articlesByLawItemSchema.safeParse(invalidItem)

      expect(result.success).toBe(false)
    })
  })

  describe('articlesByLawSchema', () => {
    test('debe validar array de artículos por ley', () => {
      const validArray = [
        { lawShortName: 'CE', lawName: 'Constitución Española', articlesWithQuestions: 45 },
        { lawShortName: 'Ley 39/2015', lawName: 'Procedimiento Administrativo', articlesWithQuestions: 30 },
        { lawShortName: 'Ley 40/2015', lawName: 'Régimen Jurídico', articlesWithQuestions: 25 }
      ]
      const result = articlesByLawSchema.safeParse(validArray)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
    })

    test('debe aceptar array vacío', () => {
      const emptyArray = []
      const result = articlesByLawSchema.safeParse(emptyArray)

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(0)
    })
  })
})

// ============================================
// TESTS DE USER PROGRESS SCHEMA
// ============================================

describe('Topic Data - User Progress Schema', () => {
  describe('userProgressSchema', () => {
    test('debe validar progreso de usuario completo', () => {
      const validProgress = {
        totalAnswers: 150,
        overallAccuracy: 78.5,
        uniqueQuestionsAnswered: 85,
        totalQuestionsAvailable: 128,
        neverSeen: 43,
        performanceByDifficulty: {
          easy: { total: 50, correct: 45, accuracy: 90 },
          medium: { total: 60, correct: 42, accuracy: 70 },
          hard: { total: 40, correct: 24, accuracy: 60 }
        },
        recentStats: {
          last7Days: 25,
          last15Days: 50,
          last30Days: 100
        }
      }
      const result = userProgressSchema.safeParse(validProgress)

      expect(result.success).toBe(true)
      expect(result.data.overallAccuracy).toBe(78.5)
    })

    test('debe aceptar usuario sin recentStats', () => {
      const validProgress = {
        totalAnswers: 50,
        overallAccuracy: 70,
        uniqueQuestionsAnswered: 30,
        totalQuestionsAvailable: 100,
        neverSeen: 70,
        performanceByDifficulty: {}
      }
      const result = userProgressSchema.safeParse(validProgress)

      expect(result.success).toBe(true)
    })

    test('debe aceptar usuario sin respuestas (nuevo)', () => {
      const newUserProgress = {
        totalAnswers: 0,
        overallAccuracy: 0,
        uniqueQuestionsAnswered: 0,
        totalQuestionsAvailable: 128,
        neverSeen: 128,
        performanceByDifficulty: {}
      }
      const result = userProgressSchema.safeParse(newUserProgress)

      expect(result.success).toBe(true)
    })

    test('debe rechazar accuracy mayor a 100', () => {
      const invalidProgress = {
        totalAnswers: 50,
        overallAccuracy: 105,
        uniqueQuestionsAnswered: 30,
        totalQuestionsAvailable: 100,
        neverSeen: 70,
        performanceByDifficulty: {}
      }
      const result = userProgressSchema.safeParse(invalidProgress)

      expect(result.success).toBe(false)
    })

    test('debe rechazar accuracy negativo', () => {
      const invalidProgress = {
        totalAnswers: 50,
        overallAccuracy: -10,
        uniqueQuestionsAnswered: 30,
        totalQuestionsAvailable: 100,
        neverSeen: 70,
        performanceByDifficulty: {}
      }
      const result = userProgressSchema.safeParse(invalidProgress)

      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// TESTS DE FULL RESPONSE SCHEMA
// ============================================

describe('Topic Data - Full Response Schema', () => {
  describe('getTopicDataResponseSchema', () => {
    test('debe validar respuesta exitosa completa', () => {
      const validResponse = {
        success: true,
        topic: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          topicNumber: 5,
          title: 'El Gobierno y la Administración',
          description: 'Composición y funciones.',
          difficulty: 'medium',
          estimatedHours: 4
        },
        difficultyStats: {
          easy: 25,
          medium: 45,
          hard: 20,
          extreme: 5,
          auto: 33
        },
        totalQuestions: 128,
        officialQuestionsCount: 15,
        articlesByLaw: [
          { lawShortName: 'CE', lawName: 'Constitución', articlesWithQuestions: 20 }
        ],
        userProgress: {
          totalAnswers: 50,
          overallAccuracy: 75,
          uniqueQuestionsAnswered: 40,
          totalQuestionsAvailable: 128,
          neverSeen: 88,
          performanceByDifficulty: {}
        },
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getTopicDataResponseSchema.safeParse(validResponse)

      expect(result.success).toBe(true)
    })

    test('debe validar respuesta para usuario anónimo (sin userProgress)', () => {
      const anonymousResponse = {
        success: true,
        topic: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          topicNumber: 5,
          title: 'El Gobierno',
          description: null,
          difficulty: null,
          estimatedHours: null
        },
        difficultyStats: {
          easy: 25,
          medium: 45,
          hard: 20,
          extreme: 5,
          auto: 33
        },
        totalQuestions: 128,
        officialQuestionsCount: 15,
        articlesByLaw: [],
        userProgress: null,
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getTopicDataResponseSchema.safeParse(anonymousResponse)

      expect(result.success).toBe(true)
      expect(result.data.userProgress).toBeNull()
    })

    test('debe validar respuesta de error', () => {
      const errorResponse = {
        success: false,
        error: 'Tema no encontrado'
      }
      const result = getTopicDataResponseSchema.safeParse(errorResponse)

      expect(result.success).toBe(true)
      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('Tema no encontrado')
    })

    test('debe validar respuesta con flag cached', () => {
      const cachedResponse = {
        success: true,
        topic: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          topicNumber: 1,
          title: 'La Constitución',
          description: null,
          difficulty: null,
          estimatedHours: null
        },
        cached: true,
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getTopicDataResponseSchema.safeParse(cachedResponse)

      expect(result.success).toBe(true)
      expect(result.data.cached).toBe(true)
    })
  })
})

// ============================================
// TESTS DE VALIDADORES
// ============================================

describe('Topic Data - Validadores', () => {
  describe('validateGetTopicDataRequest', () => {
    test('debe lanzar error con request inválido', () => {
      expect(() => {
        validateGetTopicDataRequest({ topicNumber: -1, oposicion: 'invalid' })
      }).toThrow()
    })

    test('debe retornar datos validados', () => {
      const result = validateGetTopicDataRequest({
        topicNumber: 5,
        oposicion: 'auxiliar-administrativo-estado'
      })

      expect(result.topicNumber).toBe(5)
    })
  })

  describe('safeParseGetTopicDataRequest', () => {
    test('no debe lanzar errores', () => {
      const result = safeParseGetTopicDataRequest({ topicNumber: -1, oposicion: 'invalid' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})

// ============================================
// TESTS DE HELPERS
// ============================================

describe('Topic Data - Helpers', () => {
  describe('OPOSICION_TO_POSITION_TYPE', () => {
    test('debe mapear auxiliar correctamente', () => {
      expect(OPOSICION_TO_POSITION_TYPE['auxiliar-administrativo-estado']).toBe('auxiliar_administrativo')
    })

    test('debe mapear administrativo correctamente', () => {
      expect(OPOSICION_TO_POSITION_TYPE['administrativo-estado']).toBe('administrativo_estado')
    })
  })

  describe('isValidTopicNumber', () => {
    // Auxiliar Administrativo del Estado
    describe('auxiliar-administrativo-estado', () => {
      test('Tema 1 (Bloque I) debe ser válido', () => {
        expect(isValidTopicNumber(1, 'auxiliar-administrativo-estado')).toBe(true)
      })

      test('Tema 16 (Bloque I) debe ser válido', () => {
        expect(isValidTopicNumber(16, 'auxiliar-administrativo-estado')).toBe(true)
      })

      test('Tema 101 (Bloque II) debe ser válido', () => {
        expect(isValidTopicNumber(101, 'auxiliar-administrativo-estado')).toBe(true)
      })

      test('Tema 112 (Bloque II) debe ser válido', () => {
        expect(isValidTopicNumber(112, 'auxiliar-administrativo-estado')).toBe(true)
      })

      test('Tema 17 (entre bloques) NO debe ser válido', () => {
        expect(isValidTopicNumber(17, 'auxiliar-administrativo-estado')).toBe(false)
      })

      test('Tema 100 (entre bloques) NO debe ser válido', () => {
        expect(isValidTopicNumber(100, 'auxiliar-administrativo-estado')).toBe(false)
      })

      test('Tema 113 (fuera de rango) NO debe ser válido', () => {
        expect(isValidTopicNumber(113, 'auxiliar-administrativo-estado')).toBe(false)
      })

      test('Tema 0 NO debe ser válido', () => {
        expect(isValidTopicNumber(0, 'auxiliar-administrativo-estado')).toBe(false)
      })

      test('Tema 201 (de administrativo) NO debe ser válido para auxiliar', () => {
        expect(isValidTopicNumber(201, 'auxiliar-administrativo-estado')).toBe(false)
      })
    })

    // Administrativo del Estado
    describe('administrativo-estado', () => {
      test('Tema 1 (Bloque I) debe ser válido', () => {
        expect(isValidTopicNumber(1, 'administrativo-estado')).toBe(true)
      })

      test('Tema 11 (Bloque I) debe ser válido', () => {
        expect(isValidTopicNumber(11, 'administrativo-estado')).toBe(true)
      })

      test('Tema 201 (Bloque II) debe ser válido', () => {
        expect(isValidTopicNumber(201, 'administrativo-estado')).toBe(true)
      })

      test('Tema 301 (Bloque III) debe ser válido', () => {
        expect(isValidTopicNumber(301, 'administrativo-estado')).toBe(true)
      })

      test('Tema 401 (Bloque IV) debe ser válido', () => {
        expect(isValidTopicNumber(401, 'administrativo-estado')).toBe(true)
      })

      test('Tema 501 (Bloque V) debe ser válido', () => {
        expect(isValidTopicNumber(501, 'administrativo-estado')).toBe(true)
      })

      test('Tema 608 (Bloque VI) debe ser válido', () => {
        expect(isValidTopicNumber(608, 'administrativo-estado')).toBe(true)
      })

      test('Tema 12 (fuera de Bloque I) NO debe ser válido', () => {
        expect(isValidTopicNumber(12, 'administrativo-estado')).toBe(false)
      })

      test('Tema 101 (de auxiliar) NO debe ser válido para administrativo', () => {
        expect(isValidTopicNumber(101, 'administrativo-estado')).toBe(false)
      })

      test('Tema 609 (fuera de Bloque VI) NO debe ser válido', () => {
        expect(isValidTopicNumber(609, 'administrativo-estado')).toBe(false)
      })
    })
  })

  describe('VALID_TOPIC_RANGES', () => {
    test('auxiliar debe tener 2 bloques', () => {
      const ranges = VALID_TOPIC_RANGES['auxiliar-administrativo-estado']
      expect(Object.keys(ranges)).toHaveLength(2)
      expect(ranges.bloque1).toBeDefined()
      expect(ranges.bloque2).toBeDefined()
    })

    test('administrativo debe tener 6 bloques', () => {
      const ranges = VALID_TOPIC_RANGES['administrativo-estado']
      expect(Object.keys(ranges)).toHaveLength(6)
    })

    test('Bloque I de auxiliar debe ser 1-16', () => {
      const bloque1 = VALID_TOPIC_RANGES['auxiliar-administrativo-estado'].bloque1
      expect(bloque1.min).toBe(1)
      expect(bloque1.max).toBe(16)
    })

    test('Bloque II de auxiliar debe ser 101-112', () => {
      const bloque2 = VALID_TOPIC_RANGES['auxiliar-administrativo-estado'].bloque2
      expect(bloque2.min).toBe(101)
      expect(bloque2.max).toBe(112)
    })
  })
})

// ============================================
// TESTS DE REGRESIÓN (Comportamiento esperado)
// ============================================

describe('Topic Data - Tests de Regresión', () => {
  test('CRÍTICO: El formato de topic debe incluir todos los campos necesarios', () => {
    const requiredFields = ['id', 'topicNumber', 'title', 'description', 'difficulty', 'estimatedHours']

    const validTopic = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      topicNumber: 5,
      title: 'Test',
      description: null,
      difficulty: null,
      estimatedHours: null
    }

    const result = topicInfoSchema.safeParse(validTopic)
    expect(result.success).toBe(true)

    requiredFields.forEach(field => {
      expect(result.data).toHaveProperty(field)
    })
  })

  test('CRÍTICO: DifficultyStats debe tener las 5 categorías', () => {
    const categories = ['easy', 'medium', 'hard', 'extreme', 'auto']

    const stats = difficultyStatsSchema.parse({})

    categories.forEach(cat => {
      expect(stats).toHaveProperty(cat)
      expect(typeof stats[cat]).toBe('number')
    })
  })

  test('CRÍTICO: La respuesta debe poder incluir generatedAt para caché', () => {
    const response = {
      success: true,
      generatedAt: new Date().toISOString()
    }

    const result = getTopicDataResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
    expect(result.data.generatedAt).toBeDefined()
  })

  test('CRÍTICO: UserProgress neverSeen debe calcularse correctamente', () => {
    // neverSeen = totalQuestionsAvailable - uniqueQuestionsAnswered
    const progress = {
      totalAnswers: 100,
      overallAccuracy: 75,
      uniqueQuestionsAnswered: 60,
      totalQuestionsAvailable: 128,
      neverSeen: 68, // 128 - 60 = 68
      performanceByDifficulty: {}
    }

    const result = userProgressSchema.safeParse(progress)
    expect(result.success).toBe(true)
    expect(result.data.neverSeen).toBe(result.data.totalQuestionsAvailable - result.data.uniqueQuestionsAnswered)
  })
})

// ============================================
// TESTS DE COMPATIBILIDAD CON FRONTEND
// ============================================

describe('Topic Data - Compatibilidad con Frontend', () => {
  test('el formato de respuesta debe ser compatible con la página actual', () => {
    // Este test verifica que el formato de la API coincide con lo que espera el frontend

    const expectedFrontendFormat = {
      // Lo que el frontend espera para mostrar el tema
      topic: {
        id: expect.any(String),
        topicNumber: expect.any(Number),
        title: expect.any(String),
        description: expect.anything(), // puede ser null
        difficulty: expect.anything(),
        estimatedHours: expect.anything()
      },
      // Stats por dificultad
      difficultyStats: {
        easy: expect.any(Number),
        medium: expect.any(Number),
        hard: expect.any(Number),
        extreme: expect.any(Number),
        auto: expect.any(Number)
      },
      // Totales
      totalQuestions: expect.any(Number),
      officialQuestionsCount: expect.any(Number),
      // Artículos
      articlesByLaw: expect.any(Array),
      // Progreso (puede ser null para anónimos)
      userProgress: expect.anything()
    }

    const apiResponse = {
      success: true,
      topic: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        topicNumber: 5,
        title: 'El Gobierno',
        description: 'Desc',
        difficulty: 'medium',
        estimatedHours: 4
      },
      difficultyStats: { easy: 10, medium: 20, hard: 15, extreme: 5, auto: 0 },
      totalQuestions: 50,
      officialQuestionsCount: 10,
      articlesByLaw: [{ lawShortName: 'CE', lawName: 'Constitución', articlesWithQuestions: 20 }],
      userProgress: null
    }

    // Verificar que el schema valida
    const result = getTopicDataResponseSchema.safeParse(apiResponse)
    expect(result.success).toBe(true)

    // Verificar formato esperado
    expect(result.data).toMatchObject({
      success: true,
      topic: expectedFrontendFormat.topic,
      difficultyStats: expectedFrontendFormat.difficultyStats
    })
  })

  test('los temas de Bloque II de auxiliar (101-112) deben ser válidos', () => {
    const bloqueIITopics = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]

    bloqueIITopics.forEach(topicNum => {
      expect(isValidTopicNumber(topicNum, 'auxiliar-administrativo-estado')).toBe(true)
    })
  })

  test('los temas de todos los bloques de administrativo deben ser válidos', () => {
    const allAdminTopics = [
      // Bloque I
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
      // Bloque II
      201, 202, 203, 204,
      // Bloque III
      301, 302, 303, 304, 305, 306, 307,
      // Bloque IV
      401, 402, 403, 404, 405, 406, 407, 408, 409,
      // Bloque V
      501, 502, 503, 504, 505, 506,
      // Bloque VI
      601, 602, 603, 604, 605, 606, 607, 608
    ]

    allAdminTopics.forEach(topicNum => {
      expect(isValidTopicNumber(topicNum, 'administrativo-estado')).toBe(true)
    })
  })
})
