// __tests__/api/random-test-data/randomTestData.test.js
// Tests para API de datos de test aleatorio

import {
  // Request schemas
  getRandomTestDataRequestSchema,
  checkAvailableQuestionsRequestSchema,
  getDetailedThemeStatsRequestSchema,
  // Response schemas
  getRandomTestDataResponseSchema,
  checkAvailableQuestionsResponseSchema,
  getDetailedThemeStatsResponseSchema,
  // Data schemas
  themeQuestionCountSchema,
  themeQuestionCountsSchema,
  userThemeStatSchema,
  userThemeStatsSchema,
  detailedThemeStatsSchema,
  // Validators
  validateGetRandomTestDataRequest,
  safeParseGetRandomTestDataRequest,
  validateCheckAvailableQuestionsRequest,
  safeParseCheckAvailableQuestionsRequest,
  validateGetDetailedThemeStatsRequest,
  safeParseGetDetailedThemeStatsRequest,
  validateGetRandomTestDataResponse,
  safeParseGetRandomTestDataResponse,
  // Helpers
  isValidThemeId,
  getTopicNumberFromThemeId,
  getThemeIdFromTopicNumber,
  ADMINISTRATIVO_THEME_TO_TOPIC,
  VALID_THEME_IDS,
  OPOSICION_TO_POSITION_TYPE,
} from '../../../lib/api/random-test-data'

// ============================================
// REQUEST SCHEMA TESTS
// ============================================

describe('Random Test Data - Request Schemas', () => {
  describe('getRandomTestDataRequestSchema', () => {
    it('debe aceptar request válido para administrativo', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar request válido para auxiliar', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'auxiliar-administrativo-estado',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar request sin userId (usuario anónimo)', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar userId null', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        userId: null,
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar oposición inválida', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'oposicion-invalida',
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar userId inválido (no UUID)', () => {
      const result = getRandomTestDataRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        userId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('checkAvailableQuestionsRequestSchema', () => {
    it('debe aceptar request válido con todos los filtros', () => {
      const result = checkAvailableQuestionsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        selectedThemes: [1, 2, 3],
        difficulty: 'hard',
        onlyOfficialQuestions: true,
        focusEssentialArticles: false,
      })
      expect(result.success).toBe(true)
    })

    it('debe aplicar defaults para campos opcionales', () => {
      const result = checkAvailableQuestionsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        selectedThemes: [1],
      })
      expect(result.success).toBe(true)
      expect(result.data.difficulty).toBe('mixed')
      expect(result.data.onlyOfficialQuestions).toBe(false)
      expect(result.data.focusEssentialArticles).toBe(false)
    })

    it('debe rechazar selectedThemes vacío', () => {
      const result = checkAvailableQuestionsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        selectedThemes: [],
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar difficulty inválido', () => {
      const result = checkAvailableQuestionsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        selectedThemes: [1],
        difficulty: 'extreme', // no válido para test aleatorio
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar themeIds negativos', () => {
      const result = checkAvailableQuestionsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        selectedThemes: [-1, 0, 1],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getDetailedThemeStatsRequestSchema', () => {
    it('debe aceptar request válido', () => {
      const result = getDetailedThemeStatsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        themeId: 1,
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar themeId negativo', () => {
      const result = getDetailedThemeStatsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        themeId: -1,
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(false)
    })

    it('debe requerir userId (no opcional)', () => {
      const result = getDetailedThemeStatsRequestSchema.safeParse({
        oposicion: 'administrativo-estado',
        themeId: 1,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// DATA SCHEMA TESTS
// ============================================

describe('Random Test Data - Data Schemas', () => {
  describe('themeQuestionCountSchema', () => {
    it('debe validar conteo válido', () => {
      const result = themeQuestionCountSchema.safeParse({
        themeId: 1,
        questionCount: 308,
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar questionCount 0', () => {
      const result = themeQuestionCountSchema.safeParse({
        themeId: 45,
        questionCount: 0,
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar questionCount negativo', () => {
      const result = themeQuestionCountSchema.safeParse({
        themeId: 1,
        questionCount: -10,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('themeQuestionCountsSchema', () => {
    it('debe validar mapa de conteos', () => {
      const result = themeQuestionCountsSchema.safeParse({
        '1': 308,
        '2': 150,
        '3': 0,
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar mapa vacío', () => {
      const result = themeQuestionCountsSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe('userThemeStatSchema', () => {
    it('debe validar stat completo', () => {
      const result = userThemeStatSchema.safeParse({
        total: 100,
        correct: 85,
        accuracy: 85,
        lastStudy: '2025-01-10T10:30:00Z',
        lastStudyFormatted: 'hace 1 día',
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar lastStudy null (tema nunca estudiado)', () => {
      const result = userThemeStatSchema.safeParse({
        total: 0,
        correct: 0,
        accuracy: 0,
        lastStudy: null,
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar accuracy > 100', () => {
      const result = userThemeStatSchema.safeParse({
        total: 10,
        correct: 11,
        accuracy: 110,
        lastStudy: null,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar accuracy negativo', () => {
      const result = userThemeStatSchema.safeParse({
        total: 10,
        correct: 5,
        accuracy: -50,
        lastStudy: null,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('detailedThemeStatsSchema', () => {
    it('debe validar stats detalladas', () => {
      const result = detailedThemeStatsSchema.safeParse({
        themeId: 1,
        total: 308,
        answered: 150,
        neverSeen: 158,
      })
      expect(result.success).toBe(true)
    })

    it('debe aceptar todas en 0', () => {
      const result = detailedThemeStatsSchema.safeParse({
        themeId: 45,
        total: 0,
        answered: 0,
        neverSeen: 0,
      })
      expect(result.success).toBe(true)
    })

    it('debe rechazar valores negativos', () => {
      const result = detailedThemeStatsSchema.safeParse({
        themeId: 1,
        total: 100,
        answered: -10,
        neverSeen: 110,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// RESPONSE SCHEMA TESTS
// ============================================

describe('Random Test Data - Response Schemas', () => {
  describe('getRandomTestDataResponseSchema', () => {
    it('debe validar respuesta exitosa completa', () => {
      const result = getRandomTestDataResponseSchema.safeParse({
        success: true,
        themeQuestionCounts: {
          '1': 308,
          '2': 150,
          '3': 0,
        },
        userStats: {
          '1': {
            total: 100,
            correct: 85,
            accuracy: 85,
            lastStudy: '2025-01-10T10:30:00Z',
            lastStudyFormatted: 'hace 1 día',
          },
        },
        cached: false,
        generatedAt: '2025-01-11T12:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta para usuario anónimo (sin userStats)', () => {
      const result = getRandomTestDataResponseSchema.safeParse({
        success: true,
        themeQuestionCounts: {
          '1': 308,
        },
        generatedAt: '2025-01-11T12:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta de error', () => {
      const result = getRandomTestDataResponseSchema.safeParse({
        success: false,
        error: 'Oposición no válida',
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta con flag cached', () => {
      const result = getRandomTestDataResponseSchema.safeParse({
        success: true,
        themeQuestionCounts: {},
        cached: true,
        generatedAt: '2025-01-11T12:00:00Z',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('checkAvailableQuestionsResponseSchema', () => {
    it('debe validar respuesta exitosa', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 250,
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta con 0 preguntas', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 0,
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta de error', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: false,
        error: 'No se encontraron temas válidos',
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta con breakdown por ley', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 350,
        breakdown: {
          'law-uuid-1': 200,
          'law-uuid-2': 150,
        },
      })
      expect(result.success).toBe(true)
      expect(result.data.breakdown['law-uuid-1']).toBe(200)
    })

    it('debe validar respuesta con flag cached', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 100,
        cached: true,
      })
      expect(result.success).toBe(true)
      expect(result.data.cached).toBe(true)
    })

    it('debe validar respuesta completa con todos los campos', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 500,
        breakdown: {
          'ce-uuid': 308,
          'ley39-uuid': 192,
        },
        cached: false,
      })
      expect(result.success).toBe(true)
      expect(result.data.availableQuestions).toBe(500)
      expect(result.data.breakdown).toBeDefined()
      expect(result.data.cached).toBe(false)
    })

    it('debe rechazar availableQuestions negativo', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: -10,
      })
      expect(result.success).toBe(false)
    })

    it('debe rechazar breakdown con valores negativos', () => {
      const result = checkAvailableQuestionsResponseSchema.safeParse({
        success: true,
        availableQuestions: 100,
        breakdown: {
          'law-uuid': -50,
        },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('getDetailedThemeStatsResponseSchema', () => {
    it('debe validar respuesta exitosa', () => {
      const result = getDetailedThemeStatsResponseSchema.safeParse({
        success: true,
        stats: {
          themeId: 1,
          total: 308,
          answered: 150,
          neverSeen: 158,
        },
      })
      expect(result.success).toBe(true)
    })

    it('debe validar respuesta de error', () => {
      const result = getDetailedThemeStatsResponseSchema.safeParse({
        success: false,
        error: 'Tema no encontrado',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// VALIDATOR FUNCTION TESTS
// ============================================

describe('Random Test Data - Validator Functions', () => {
  describe('validateGetRandomTestDataRequest', () => {
    it('debe lanzar error con oposición inválida', () => {
      expect(() => {
        validateGetRandomTestDataRequest({
          oposicion: 'invalida',
        })
      }).toThrow()
    })

    it('debe retornar datos válidos', () => {
      const result = validateGetRandomTestDataRequest({
        oposicion: 'administrativo-estado',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.oposicion).toBe('administrativo-estado')
      expect(result.userId).toBe('123e4567-e89b-12d3-a456-426614174000')
    })
  })

  describe('safeParseGetRandomTestDataRequest', () => {
    it('no debe lanzar errores con datos inválidos', () => {
      const result = safeParseGetRandomTestDataRequest({
        oposicion: 'invalida',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('debe retornar success: true con datos válidos', () => {
      const result = safeParseGetRandomTestDataRequest({
        oposicion: 'administrativo-estado',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('validateCheckAvailableQuestionsRequest', () => {
    it('debe validar request completo', () => {
      const result = validateCheckAvailableQuestionsRequest({
        oposicion: 'administrativo-estado',
        selectedThemes: [1, 2, 3],
        difficulty: 'medium',
        onlyOfficialQuestions: true,
        focusEssentialArticles: false,
      })
      expect(result.selectedThemes).toEqual([1, 2, 3])
      expect(result.difficulty).toBe('medium')
    })
  })

  describe('validateGetDetailedThemeStatsRequest', () => {
    it('debe validar request completo', () => {
      const result = validateGetDetailedThemeStatsRequest({
        oposicion: 'administrativo-estado',
        themeId: 1,
        userId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.themeId).toBe(1)
    })
  })
})

// ============================================
// HELPER FUNCTION TESTS
// ============================================

describe('Random Test Data - Helper Functions', () => {
  describe('isValidThemeId', () => {
    it('debe validar themeIds para administrativo (1-45)', () => {
      expect(isValidThemeId(1, 'administrativo-estado')).toBe(true)
      expect(isValidThemeId(45, 'administrativo-estado')).toBe(true)
      expect(isValidThemeId(0, 'administrativo-estado')).toBe(false)
      expect(isValidThemeId(46, 'administrativo-estado')).toBe(false)
    })

    it('debe validar themeIds para auxiliar (1-28)', () => {
      expect(isValidThemeId(1, 'auxiliar-administrativo-estado')).toBe(true)
      expect(isValidThemeId(16, 'auxiliar-administrativo-estado')).toBe(true)
      expect(isValidThemeId(28, 'auxiliar-administrativo-estado')).toBe(true)
      expect(isValidThemeId(0, 'auxiliar-administrativo-estado')).toBe(false)
      expect(isValidThemeId(29, 'auxiliar-administrativo-estado')).toBe(false)
    })
  })

  describe('getTopicNumberFromThemeId - Administrativo', () => {
    it('debe mapear Bloque I (1-11) correctamente', () => {
      expect(getTopicNumberFromThemeId(1, 'administrativo-estado')).toBe(1)
      expect(getTopicNumberFromThemeId(11, 'administrativo-estado')).toBe(11)
    })

    it('debe mapear Bloque II (12-15) a 201-204', () => {
      expect(getTopicNumberFromThemeId(12, 'administrativo-estado')).toBe(201)
      expect(getTopicNumberFromThemeId(13, 'administrativo-estado')).toBe(202)
      expect(getTopicNumberFromThemeId(14, 'administrativo-estado')).toBe(203)
      expect(getTopicNumberFromThemeId(15, 'administrativo-estado')).toBe(204)
    })

    it('debe mapear Bloque III (16-22) a 301-307', () => {
      expect(getTopicNumberFromThemeId(16, 'administrativo-estado')).toBe(301)
      expect(getTopicNumberFromThemeId(22, 'administrativo-estado')).toBe(307)
    })

    it('debe mapear Bloque IV (23-31) a 401-409', () => {
      expect(getTopicNumberFromThemeId(23, 'administrativo-estado')).toBe(401)
      expect(getTopicNumberFromThemeId(31, 'administrativo-estado')).toBe(409)
    })

    it('debe mapear Bloque V (32-37) a 501-506', () => {
      expect(getTopicNumberFromThemeId(32, 'administrativo-estado')).toBe(501)
      expect(getTopicNumberFromThemeId(37, 'administrativo-estado')).toBe(506)
    })

    it('debe mapear Bloque VI (38-45) a 601-608', () => {
      expect(getTopicNumberFromThemeId(38, 'administrativo-estado')).toBe(601)
      expect(getTopicNumberFromThemeId(45, 'administrativo-estado')).toBe(608)
    })
  })

  describe('getTopicNumberFromThemeId - Auxiliar', () => {
    it('debe mapear Bloque I (1-16) correctamente', () => {
      expect(getTopicNumberFromThemeId(1, 'auxiliar-administrativo-estado')).toBe(1)
      expect(getTopicNumberFromThemeId(16, 'auxiliar-administrativo-estado')).toBe(16)
    })

    it('debe mapear Bloque II (17-28) a 101-112', () => {
      expect(getTopicNumberFromThemeId(17, 'auxiliar-administrativo-estado')).toBe(101)
      expect(getTopicNumberFromThemeId(18, 'auxiliar-administrativo-estado')).toBe(102)
      expect(getTopicNumberFromThemeId(28, 'auxiliar-administrativo-estado')).toBe(112)
    })
  })

  describe('getThemeIdFromTopicNumber - Administrativo', () => {
    it('debe invertir el mapeo de Bloque II', () => {
      expect(getThemeIdFromTopicNumber(201, 'administrativo-estado')).toBe(12)
      expect(getThemeIdFromTopicNumber(204, 'administrativo-estado')).toBe(15)
    })

    it('debe invertir el mapeo de Bloque III', () => {
      expect(getThemeIdFromTopicNumber(301, 'administrativo-estado')).toBe(16)
      expect(getThemeIdFromTopicNumber(307, 'administrativo-estado')).toBe(22)
    })

    it('debe invertir el mapeo de Bloque VI', () => {
      expect(getThemeIdFromTopicNumber(601, 'administrativo-estado')).toBe(38)
      expect(getThemeIdFromTopicNumber(608, 'administrativo-estado')).toBe(45)
    })
  })

  describe('getThemeIdFromTopicNumber - Auxiliar', () => {
    it('debe invertir el mapeo de Bloque II', () => {
      expect(getThemeIdFromTopicNumber(101, 'auxiliar-administrativo-estado')).toBe(17)
      expect(getThemeIdFromTopicNumber(112, 'auxiliar-administrativo-estado')).toBe(28)
    })
  })

  describe('ADMINISTRATIVO_THEME_TO_TOPIC mapping', () => {
    it('debe tener 45 entradas', () => {
      expect(Object.keys(ADMINISTRATIVO_THEME_TO_TOPIC).length).toBe(45)
    })

    it('debe cubrir todos los topic_numbers esperados', () => {
      const expectedTopicNumbers = [
        ...Array.from({ length: 11 }, (_, i) => i + 1),      // 1-11
        ...Array.from({ length: 4 }, (_, i) => 201 + i),     // 201-204
        ...Array.from({ length: 7 }, (_, i) => 301 + i),     // 301-307
        ...Array.from({ length: 9 }, (_, i) => 401 + i),     // 401-409
        ...Array.from({ length: 6 }, (_, i) => 501 + i),     // 501-506
        ...Array.from({ length: 8 }, (_, i) => 601 + i),     // 601-608
      ]
      const mappedTopicNumbers = Object.values(ADMINISTRATIVO_THEME_TO_TOPIC)

      expect(mappedTopicNumbers.sort((a, b) => a - b)).toEqual(expectedTopicNumbers.sort((a, b) => a - b))
    })
  })
})

// ============================================
// CONSTANTS TESTS
// ============================================

describe('Random Test Data - Constants', () => {
  describe('OPOSICION_TO_POSITION_TYPE', () => {
    it('debe mapear correctamente las oposiciones', () => {
      expect(OPOSICION_TO_POSITION_TYPE['auxiliar-administrativo-estado']).toBe('auxiliar_administrativo')
      expect(OPOSICION_TO_POSITION_TYPE['administrativo-estado']).toBe('administrativo')
    })
  })

  describe('VALID_THEME_IDS', () => {
    it('debe tener rangos correctos para auxiliar', () => {
      expect(VALID_THEME_IDS['auxiliar-administrativo-estado'].min).toBe(1)
      expect(VALID_THEME_IDS['auxiliar-administrativo-estado'].max).toBe(28)
    })

    it('debe tener rangos correctos para administrativo', () => {
      expect(VALID_THEME_IDS['administrativo-estado'].min).toBe(1)
      expect(VALID_THEME_IDS['administrativo-estado'].max).toBe(45)
    })
  })
})

// ============================================
// REGRESSION TESTS
// ============================================

describe('Random Test Data - Regression Tests', () => {
  it('CRÍTICO: Los 45 temas de administrativo deben estar mapeados', () => {
    for (let i = 1; i <= 45; i++) {
      expect(ADMINISTRATIVO_THEME_TO_TOPIC[i]).toBeDefined()
      expect(typeof ADMINISTRATIVO_THEME_TO_TOPIC[i]).toBe('number')
    }
  })

  it('CRÍTICO: El mapeo debe ser bidireccional', () => {
    // Para administrativo
    for (let themeId = 1; themeId <= 45; themeId++) {
      const topicNumber = getTopicNumberFromThemeId(themeId, 'administrativo-estado')
      const backToThemeId = getThemeIdFromTopicNumber(topicNumber, 'administrativo-estado')
      expect(backToThemeId).toBe(themeId)
    }
  })

  it('CRÍTICO: La respuesta debe seguir el schema exacto esperado por el frontend', () => {
    // Simular respuesta completa del API
    const mockResponse = {
      success: true,
      themeQuestionCounts: {
        '1': 308,
        '12': 50,
        '38': 0,
      },
      userStats: {
        '1': {
          total: 100,
          correct: 85,
          accuracy: 85,
          lastStudy: '2025-01-10T10:30:00Z',
          lastStudyFormatted: 'hace 1 día',
        },
      },
      cached: false,
      generatedAt: '2025-01-11T12:00:00Z',
    }

    const result = safeParseGetRandomTestDataResponse(mockResponse)
    expect(result.success).toBe(true)

    // Verificar que podemos acceder a los datos como espera el frontend
    expect(result.data.themeQuestionCounts['1']).toBe(308)
    expect(result.data.userStats['1'].accuracy).toBe(85)
  })
})
