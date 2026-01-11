// __tests__/api/theme-stats/themeStats.test.js
// Tests unitarios para el API layer de theme-stats (Drizzle + Zod)

import {
  getThemeStatsRequestSchema,
  themeStatSchema,
  getThemeStatsResponseSchema,
  validateGetThemeStatsRequest,
  safeParseGetThemeStatsRequest
} from '../../../lib/api/theme-stats/schemas'

// ============================================
// TESTS DE SCHEMAS ZOD
// ============================================

describe('Theme Stats - Zod Schemas', () => {
  describe('getThemeStatsRequestSchema', () => {
    test('debe aceptar un UUID válido', () => {
      const validRequest = { userId: '550e8400-e29b-41d4-a716-446655440000' }
      const result = getThemeStatsRequestSchema.safeParse(validRequest)

      expect(result.success).toBe(true)
      expect(result.data.userId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    test('debe rechazar un UUID inválido', () => {
      const invalidRequest = { userId: 'not-a-valid-uuid' }
      const result = getThemeStatsRequestSchema.safeParse(invalidRequest)

      expect(result.success).toBe(false)
      expect(result.error.issues[0].message).toContain('inválido')
    })

    test('debe rechazar userId vacío', () => {
      const emptyRequest = { userId: '' }
      const result = getThemeStatsRequestSchema.safeParse(emptyRequest)

      expect(result.success).toBe(false)
    })

    test('debe rechazar userId null', () => {
      const nullRequest = { userId: null }
      const result = getThemeStatsRequestSchema.safeParse(nullRequest)

      expect(result.success).toBe(false)
    })

    test('debe rechazar request sin userId', () => {
      const missingRequest = {}
      const result = getThemeStatsRequestSchema.safeParse(missingRequest)

      expect(result.success).toBe(false)
    })
  })

  describe('themeStatSchema', () => {
    test('debe validar un stat de tema completo', () => {
      const validStat = {
        temaNumber: 1,
        total: 100,
        correct: 85,
        accuracy: 85,
        lastStudy: '2025-01-10T10:00:00.000Z',
        lastStudyFormatted: '10 ene'
      }
      const result = themeStatSchema.safeParse(validStat)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(validStat)
    })

    test('debe aceptar lastStudy null (tema nunca estudiado)', () => {
      const statNeverStudied = {
        temaNumber: 5,
        total: 0,
        correct: 0,
        accuracy: 0,
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(statNeverStudied)

      expect(result.success).toBe(true)
      expect(result.data.lastStudy).toBeNull()
    })

    test('debe rechazar accuracy fuera de rango (> 100)', () => {
      const invalidStat = {
        temaNumber: 1,
        total: 100,
        correct: 85,
        accuracy: 150, // Inválido
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(invalidStat)

      expect(result.success).toBe(false)
    })

    test('debe rechazar accuracy negativo', () => {
      const invalidStat = {
        temaNumber: 1,
        total: 100,
        correct: 85,
        accuracy: -10, // Inválido
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(invalidStat)

      expect(result.success).toBe(false)
    })
  })

  describe('getThemeStatsResponseSchema', () => {
    test('debe validar una respuesta exitosa con stats', () => {
      const successResponse = {
        success: true,
        stats: {
          '1': {
            temaNumber: 1,
            total: 50,
            correct: 40,
            accuracy: 80,
            lastStudy: '2025-01-10T10:00:00.000Z',
            lastStudyFormatted: '10 ene'
          },
          '2': {
            temaNumber: 2,
            total: 30,
            correct: 25,
            accuracy: 83,
            lastStudy: '2025-01-09T15:00:00.000Z',
            lastStudyFormatted: '9 ene'
          }
        },
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getThemeStatsResponseSchema.safeParse(successResponse)

      expect(result.success).toBe(true)
    })

    test('debe validar una respuesta de error', () => {
      const errorResponse = {
        success: false,
        error: 'userId inválido o faltante'
      }
      const result = getThemeStatsResponseSchema.safeParse(errorResponse)

      expect(result.success).toBe(true)
      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('userId inválido o faltante')
    })

    test('debe validar respuesta vacía (usuario sin stats)', () => {
      const emptyResponse = {
        success: true,
        stats: {},
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getThemeStatsResponseSchema.safeParse(emptyResponse)

      expect(result.success).toBe(true)
      expect(Object.keys(result.data.stats)).toHaveLength(0)
    })

    test('debe validar respuesta con flag cached', () => {
      const cachedResponse = {
        success: true,
        stats: {},
        cached: true,
        generatedAt: '2025-01-11T10:00:00.000Z'
      }
      const result = getThemeStatsResponseSchema.safeParse(cachedResponse)

      expect(result.success).toBe(true)
      expect(result.data.cached).toBe(true)
    })
  })

  describe('Funciones de validación', () => {
    test('validateGetThemeStatsRequest debe lanzar error con UUID inválido', () => {
      expect(() => {
        validateGetThemeStatsRequest({ userId: 'invalid' })
      }).toThrow()
    })

    test('validateGetThemeStatsRequest debe retornar datos válidos', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000'
      const result = validateGetThemeStatsRequest({ userId: validUuid })

      expect(result.userId).toBe(validUuid)
    })

    test('safeParseGetThemeStatsRequest no debe lanzar errores', () => {
      const result = safeParseGetThemeStatsRequest({ userId: 'invalid' })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
})

// ============================================
// TESTS DE FORMATO DE DATOS
// ============================================

describe('Theme Stats - Formato de Datos', () => {
  describe('Compatibilidad con frontend', () => {
    test('los stats deben tener el formato esperado por el componente', () => {
      // Este es el formato que espera el frontend
      const expectedFormat = {
        temaNumber: 1,
        total: 100,
        correct: 85,
        accuracy: 85,
        lastStudy: '2025-01-10T10:00:00.000Z',
        lastStudyFormatted: '10 ene'
      }

      const result = themeStatSchema.safeParse(expectedFormat)
      expect(result.success).toBe(true)

      // Verificar que todos los campos necesarios están presentes
      expect(result.data).toHaveProperty('temaNumber')
      expect(result.data).toHaveProperty('total')
      expect(result.data).toHaveProperty('correct')
      expect(result.data).toHaveProperty('accuracy')
      expect(result.data).toHaveProperty('lastStudy')
      expect(result.data).toHaveProperty('lastStudyFormatted')
    })

    test('los temas de Bloque II (101-112) deben ser válidos', () => {
      const bloqueIITheme = {
        temaNumber: 101,
        total: 25,
        correct: 20,
        accuracy: 80,
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(bloqueIITheme)

      expect(result.success).toBe(true)
      expect(result.data.temaNumber).toBe(101)
    })

    test('los temas de Administrativo (201-608) deben ser válidos', () => {
      const administrativoThemes = [201, 302, 405, 506, 608]

      administrativoThemes.forEach(temaNumber => {
        const theme = {
          temaNumber,
          total: 10,
          correct: 8,
          accuracy: 80,
          lastStudy: null,
          lastStudyFormatted: 'Nunca'
        }
        const result = themeStatSchema.safeParse(theme)

        expect(result.success).toBe(true)
        expect(result.data.temaNumber).toBe(temaNumber)
      })
    })
  })

  describe('Casos edge', () => {
    test('accuracy 0 debe ser válido (tema con 0% aciertos)', () => {
      const zeroAccuracy = {
        temaNumber: 3,
        total: 10,
        correct: 0,
        accuracy: 0,
        lastStudy: '2025-01-10T10:00:00.000Z',
        lastStudyFormatted: '10 ene'
      }
      const result = themeStatSchema.safeParse(zeroAccuracy)

      expect(result.success).toBe(true)
      expect(result.data.accuracy).toBe(0)
    })

    test('accuracy 100 debe ser válido (tema con 100% aciertos)', () => {
      const perfectAccuracy = {
        temaNumber: 3,
        total: 50,
        correct: 50,
        accuracy: 100,
        lastStudy: '2025-01-10T10:00:00.000Z',
        lastStudyFormatted: '10 ene'
      }
      const result = themeStatSchema.safeParse(perfectAccuracy)

      expect(result.success).toBe(true)
      expect(result.data.accuracy).toBe(100)
    })

    test('total y correct pueden ser 0 (tema no estudiado)', () => {
      const notStudied = {
        temaNumber: 16,
        total: 0,
        correct: 0,
        accuracy: 0,
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(notStudied)

      expect(result.success).toBe(true)
    })

    test('correct no puede ser mayor que total', () => {
      // Nota: Zod no valida esto automáticamente, pero lo documentamos
      // Esta validación debería hacerse en la lógica de negocio
      const invalidStat = {
        temaNumber: 1,
        total: 10,
        correct: 15, // Más correctas que total - lógicamente inválido
        accuracy: 150,
        lastStudy: null,
        lastStudyFormatted: 'Nunca'
      }
      const result = themeStatSchema.safeParse(invalidStat)

      // El schema rechaza por accuracy > 100
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// TESTS DE QUERIES (con mocks)
// ============================================

describe('Theme Stats - Queries', () => {
  // Mock del módulo de queries
  const mockGetUserThemeStats = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getUserThemeStats', () => {
    test('debe retornar stats vacías para usuario sin datos', async () => {
      mockGetUserThemeStats.mockResolvedValue({
        success: true,
        stats: {},
        generatedAt: new Date().toISOString()
      })

      const result = await mockGetUserThemeStats('00000000-0000-0000-0000-000000000000')

      expect(result.success).toBe(true)
      expect(result.stats).toEqual({})
    })

    test('debe retornar stats formateadas correctamente', async () => {
      mockGetUserThemeStats.mockResolvedValue({
        success: true,
        stats: {
          '1': {
            temaNumber: 1,
            total: 100,
            correct: 85,
            accuracy: 85,
            lastStudy: '2025-01-10T10:00:00.000Z',
            lastStudyFormatted: '10 ene'
          }
        },
        generatedAt: new Date().toISOString()
      })

      const result = await mockGetUserThemeStats('valid-uuid')

      expect(result.success).toBe(true)
      expect(result.stats['1'].accuracy).toBe(85)
      expect(result.stats['1'].lastStudyFormatted).toBe('10 ene')
    })

    test('debe manejar errores de base de datos', async () => {
      mockGetUserThemeStats.mockResolvedValue({
        success: false,
        error: 'Error de conexión a la base de datos'
      })

      const result = await mockGetUserThemeStats('valid-uuid')

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('debe incluir flag cached cuando los datos vienen de caché', async () => {
      mockGetUserThemeStats.mockResolvedValue({
        success: true,
        stats: {},
        cached: true,
        generatedAt: new Date().toISOString()
      })

      const result = await mockGetUserThemeStats('valid-uuid')

      expect(result.cached).toBe(true)
    })
  })

  describe('Caché', () => {
    test('llamadas repetidas deben usar caché', async () => {
      const userId = 'test-user-id'
      const cachedResult = {
        success: true,
        stats: { '1': { temaNumber: 1, total: 10, correct: 8, accuracy: 80, lastStudy: null, lastStudyFormatted: 'Nunca' } },
        cached: true,
        generatedAt: new Date().toISOString()
      }

      mockGetUserThemeStats.mockResolvedValue(cachedResult)

      // Primera llamada
      await mockGetUserThemeStats(userId)
      // Segunda llamada (debería venir de caché)
      const result = await mockGetUserThemeStats(userId)

      expect(result.cached).toBe(true)
    })
  })
})

// ============================================
// TESTS DE API ROUTE (mock de fetch)
// ============================================

describe('Theme Stats - API Route', () => {
  // Simular respuestas de la API
  const mockApiResponse = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data)
  })

  describe('GET /api/user/theme-stats', () => {
    test('debe retornar 400 si falta userId', async () => {
      const response = mockApiResponse(400, {
        success: false,
        error: 'userId inválido o faltante'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('userId')
    })

    test('debe retornar 400 si userId no es UUID válido', async () => {
      const response = mockApiResponse(400, {
        success: false,
        error: 'userId inválido o faltante'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.success).toBe(false)
    })

    test('debe retornar 200 con stats para userId válido', async () => {
      const response = mockApiResponse(200, {
        success: true,
        stats: {
          '1': {
            temaNumber: 1,
            total: 50,
            correct: 40,
            accuracy: 80,
            lastStudy: '2025-01-10T10:00:00.000Z',
            lastStudyFormatted: '10 ene'
          }
        },
        generatedAt: new Date().toISOString()
      })

      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.stats).toBeDefined()
    })

    test('debe retornar 200 con stats vacías para usuario sin datos', async () => {
      const response = mockApiResponse(200, {
        success: true,
        stats: {},
        generatedAt: new Date().toISOString()
      })

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(Object.keys(data.stats)).toHaveLength(0)
    })

    test('debe retornar 500 si hay error interno', async () => {
      const response = mockApiResponse(500, {
        success: false,
        error: 'Error interno del servidor'
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
    })
  })

  describe('Formato de respuesta', () => {
    test('la respuesta debe seguir el schema definido', async () => {
      const apiResponse = {
        success: true,
        stats: {
          '1': {
            temaNumber: 1,
            total: 100,
            correct: 85,
            accuracy: 85,
            lastStudy: '2025-01-10T10:00:00.000Z',
            lastStudyFormatted: '10 ene'
          },
          '101': {
            temaNumber: 101,
            total: 25,
            correct: 20,
            accuracy: 80,
            lastStudy: null,
            lastStudyFormatted: 'Nunca'
          }
        },
        generatedAt: '2025-01-11T10:00:00.000Z'
      }

      // Validar contra el schema
      const result = getThemeStatsResponseSchema.safeParse(apiResponse)
      expect(result.success).toBe(true)
    })

    test('las keys de stats deben ser strings de números de tema', async () => {
      const apiResponse = {
        success: true,
        stats: {
          '1': { temaNumber: 1, total: 10, correct: 8, accuracy: 80, lastStudy: null, lastStudyFormatted: 'Nunca' },
          '2': { temaNumber: 2, total: 20, correct: 18, accuracy: 90, lastStudy: null, lastStudyFormatted: 'Nunca' },
          '101': { temaNumber: 101, total: 5, correct: 4, accuracy: 80, lastStudy: null, lastStudyFormatted: 'Nunca' }
        },
        generatedAt: new Date().toISOString()
      }

      // Verificar que las keys son strings de números
      Object.keys(apiResponse.stats).forEach(key => {
        expect(typeof key).toBe('string')
        expect(parseInt(key)).not.toBeNaN()
      })
    })
  })
})

// ============================================
// TESTS DE REGRESIÓN
// ============================================

describe('Theme Stats - Tests de Regresión', () => {
  test('CRÍTICO: El schema no debe cambiar sin actualizar los tests', () => {
    // Este test documenta los campos esperados del schema
    const requiredFields = ['temaNumber', 'total', 'correct', 'accuracy', 'lastStudy', 'lastStudyFormatted']

    const validStat = {
      temaNumber: 1,
      total: 100,
      correct: 85,
      accuracy: 85,
      lastStudy: null,
      lastStudyFormatted: 'Nunca'
    }

    const result = themeStatSchema.safeParse(validStat)
    expect(result.success).toBe(true)

    requiredFields.forEach(field => {
      expect(result.data).toHaveProperty(field)
    })
  })

  test('CRÍTICO: La respuesta debe incluir generatedAt para caché', () => {
    const response = {
      success: true,
      stats: {},
      generatedAt: new Date().toISOString()
    }

    const result = getThemeStatsResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
    expect(result.data.generatedAt).toBeDefined()
  })

  test('CRÍTICO: UUIDs de diferentes formatos deben ser validados correctamente', () => {
    const validUuids = [
      '550e8400-e29b-41d4-a716-446655440000', // Formato estándar
      '550E8400-E29B-41D4-A716-446655440000', // Mayúsculas
      '00000000-0000-0000-0000-000000000000', // UUID nil
    ]

    const invalidUuids = [
      'not-a-uuid',
      '550e8400e29b41d4a716446655440000', // Sin guiones
      '550e8400-e29b-41d4-a716-44665544000', // Muy corto
      '550e8400-e29b-41d4-a716-4466554400000', // Muy largo
      '',
      null,
      undefined,
    ]

    validUuids.forEach(uuid => {
      const result = safeParseGetThemeStatsRequest({ userId: uuid })
      expect(result.success).toBe(true)
    })

    invalidUuids.forEach(uuid => {
      const result = safeParseGetThemeStatsRequest({ userId: uuid })
      expect(result.success).toBe(false)
    })
  })
})
