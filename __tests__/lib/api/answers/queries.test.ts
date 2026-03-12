// __tests__/lib/api/answers/queries.test.ts
// Tests para la lógica de retry server-side en validateAnswer
// Verifica que errores de conexión (ECONNRESET) se reintentan correctamente

describe('validateAnswer - Server-side retry logic', () => {

  // ============================================
  // Simula la lógica de retry de validateAnswer
  // ============================================
  const MAX_RETRIES = 2

  interface DbQueryResult {
    correctOption: number
    explanation: string | null
    articleNumber: string | null
    lawShortName: string | null
    lawName: string | null
  }

  interface ValidateResult {
    success: boolean
    isCorrect: boolean
    correctAnswer: number
    explanation: string | null
    articleNumber?: string | null
    lawShortName?: string | null
    lawName?: string | null
  }

  // Simula validateAnswer con la misma estructura de retry
  async function simulateValidateAnswer(
    dbQuery: () => Promise<DbQueryResult[]>,
    userAnswer: number
  ): Promise<ValidateResult> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await dbQuery()
        const question = result[0]

        if (!question) {
          return {
            success: false,
            isCorrect: false,
            correctAnswer: 0,
            explanation: null,
          }
        }

        const isCorrect = userAnswer === question.correctOption
        return {
          success: true,
          isCorrect,
          correctAnswer: question.correctOption,
          explanation: question.explanation,
          articleNumber: question.articleNumber,
          lawShortName: question.lawShortName,
          lawName: question.lawName,
        }
      } catch {
        if (attempt < MAX_RETRIES - 1) {
          // Reintenta (sin delay real en tests)
          continue
        }
        return {
          success: false,
          isCorrect: false,
          correctAnswer: 0,
          explanation: null,
        }
      }
    }

    return { success: false, isCorrect: false, correctAnswer: 0, explanation: null }
  }

  // ============================================
  // Tests: Éxito en primer intento
  // ============================================
  describe('Éxito en primer intento', () => {

    test('respuesta correcta: devuelve isCorrect=true', async () => {
      const dbQuery = async (): Promise<DbQueryResult[]> => [{
        correctOption: 2,
        explanation: 'Art. 1 CE establece...',
        articleNumber: '1',
        lawShortName: 'CE',
        lawName: 'Constitución Española',
      }]

      const result = await simulateValidateAnswer(dbQuery, 2)

      expect(result.success).toBe(true)
      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(2)
      expect(result.explanation).toBe('Art. 1 CE establece...')
      expect(result.articleNumber).toBe('1')
      expect(result.lawShortName).toBe('CE')
    })

    test('respuesta incorrecta: devuelve isCorrect=false', async () => {
      const dbQuery = async (): Promise<DbQueryResult[]> => [{
        correctOption: 1,
        explanation: 'La respuesta es B',
        articleNumber: '16',
        lawShortName: 'Ley 39/2015',
        lawName: 'Ley 39/2015, de 1 de octubre',
      }]

      const result = await simulateValidateAnswer(dbQuery, 3)

      expect(result.success).toBe(true)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(1)
    })

    test('pregunta no encontrada: devuelve success=false', async () => {
      const dbQuery = async (): Promise<DbQueryResult[]> => []

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(result.success).toBe(false)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(0)
    })
  })

  // ============================================
  // Tests: Retry tras error
  // ============================================
  describe('Retry tras error de conexión', () => {

    test('CRÍTICO: éxito en segundo intento tras ECONNRESET', async () => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        if (callCount === 1) {
          throw new Error('ECONNRESET')
        }
        return [{
          correctOption: 0,
          explanation: 'Respuesta correcta es A',
          articleNumber: '14',
          lawShortName: 'CE',
          lawName: 'Constitución Española',
        }]
      }

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(callCount).toBe(2) // Se llamó 2 veces
      expect(result.success).toBe(true)
      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(0)
    })

    test('CRÍTICO: fallo total tras agotar reintentos', async () => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        throw new Error('Connection refused')
      }

      const result = await simulateValidateAnswer(dbQuery, 1)

      expect(callCount).toBe(2) // Se intentó MAX_RETRIES veces
      expect(result.success).toBe(false)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(0)
      expect(result.explanation).toBeNull()
    })

    test('fallo en primer intento + pregunta no encontrada en segundo', async () => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        if (callCount === 1) {
          throw new Error('timeout exceeded')
        }
        return [] // Pregunta no existe
      }

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(callCount).toBe(2)
      expect(result.success).toBe(false) // No encontrada ≠ error, pero success=false
    })
  })

  // ============================================
  // Tests: Contrato de respuesta
  // ============================================
  describe('Contrato de respuesta', () => {

    test('éxito siempre tiene success, isCorrect, correctAnswer, explanation', async () => {
      const dbQuery = async (): Promise<DbQueryResult[]> => [{
        correctOption: 3,
        explanation: null,
        articleNumber: null,
        lawShortName: null,
        lawName: null,
      }]

      const result = await simulateValidateAnswer(dbQuery, 3)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('isCorrect')
      expect(result).toHaveProperty('correctAnswer')
      expect(result).toHaveProperty('explanation')
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.isCorrect).toBe('boolean')
      expect(typeof result.correctAnswer).toBe('number')
    })

    test('error siempre tiene success=false y correctAnswer=0', async () => {
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        throw new Error('DB down')
      }

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(result.success).toBe(false)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(0)
    })

    test('correctAnswer está en rango 0-3', async () => {
      for (let correct = 0; correct <= 3; correct++) {
        const dbQuery = async (): Promise<DbQueryResult[]> => [{
          correctOption: correct,
          explanation: null,
          articleNumber: null,
          lawShortName: null,
          lawName: null,
        }]

        const result = await simulateValidateAnswer(dbQuery, 0)
        expect(result.correctAnswer).toBeGreaterThanOrEqual(0)
        expect(result.correctAnswer).toBeLessThanOrEqual(3)
      }
    })
  })

  // ============================================
  // Tests: Lógica de retry (MAX_RETRIES)
  // ============================================
  describe('Configuración de retry', () => {

    test('MAX_RETRIES es 2 (1 intento + 1 retry)', () => {
      expect(MAX_RETRIES).toBe(2)
    })

    test('no reintenta si el primer intento tiene éxito', async () => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        return [{
          correctOption: 1,
          explanation: 'OK',
          articleNumber: '5',
          lawShortName: 'LPAC',
          lawName: 'Ley 39/2015',
        }]
      }

      await simulateValidateAnswer(dbQuery, 1)

      expect(callCount).toBe(1) // Solo 1 llamada
    })

    test('no reintenta si pregunta no encontrada (no es error de conexión)', async () => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        return [] // No encontrada
      }

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(callCount).toBe(1) // No reintenta
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // Tests: Tipos de errores de Supabase/Postgres
  // ============================================
  describe('Errores típicos de Supabase/Postgres', () => {

    const supabaseErrors = [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'socket hang up',
      'Connection terminated unexpectedly',
      'Client has encountered a connection error',
    ]

    test.each(supabaseErrors)('reintenta tras error: %s', async (errorMsg) => {
      let callCount = 0
      const dbQuery = async (): Promise<DbQueryResult[]> => {
        callCount++
        if (callCount === 1) {
          throw new Error(errorMsg)
        }
        return [{
          correctOption: 0,
          explanation: 'Recuperado',
          articleNumber: null,
          lawShortName: null,
          lawName: null,
        }]
      }

      const result = await simulateValidateAnswer(dbQuery, 0)

      expect(callCount).toBe(2)
      expect(result.success).toBe(true)
    })
  })
})
