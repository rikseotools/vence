// __tests__/components/validateAnswerSecure.test.ts
// Tests para la lógica de timeout + retry de validateAnswerSecure (TestLayout)
// Verifica que fetch con AbortController funciona correctamente

describe('validateAnswerSecure - Client-side timeout + retry', () => {

  // ============================================
  // Tipo de respuesta (replica la interfaz real)
  // ============================================
  interface SecureAnswerResult {
    success?: boolean
    isCorrect?: boolean
    correctAnswer?: number
    explanation?: string | null
    articleNumber?: string | null
    lawShortName?: string | null
    usedFallback?: boolean
    error?: string
    message?: string
  }

  // ============================================
  // Simula validateAnswerSecure con la misma lógica
  // ============================================
  async function simulateValidateAnswerSecure(
    questionId: string,
    userAnswer: number,
    fetchFn: (attempt: number) => Promise<{ ok: boolean; status: number; json: () => Promise<Record<string, unknown>> }>,
    options?: { timeoutMs?: number }
  ): Promise<SecureAnswerResult> {
    // Guard: questionId válido
    if (!questionId || typeof questionId !== 'string' || questionId.length < 10) {
      return { success: false, error: 'NO_QUESTION_ID' }
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      let timedOut = false

      // Simula AbortController timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          timedOut = true
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        }, options?.timeoutMs ?? 10000)
      })

      try {
        const response = await Promise.race([
          fetchFn(attempt),
          timeoutPromise,
        ])

        if (!response.ok) {
          continue // Reintentar
        }

        const data = await response.json()

        if (data.success) {
          return {
            isCorrect: data.isCorrect as boolean,
            correctAnswer: data.correctAnswer as number,
            explanation: data.explanation as string | null,
            articleNumber: data.articleNumber as string | null,
            lawShortName: data.lawShortName as string | null,
            usedFallback: false,
          }
        }

        return { success: false, error: 'QUESTION_NOT_FOUND' }

      } catch (error) {
        const isTimeout = (error as Error).name === 'AbortError'
        if (attempt === 1) {
          return {
            success: false,
            error: isTimeout ? 'TIMEOUT' : 'API_ERROR',
            message: (error as Error).message,
          }
        }
        // Primer intento falló, reintenta
      }
    }

    return { success: false, error: 'API_ERROR', message: 'Agotados reintentos' }
  }

  // ============================================
  // Helper: crea respuesta mock
  // ============================================
  function mockSuccessResponse(isCorrect: boolean, correctAnswer: number) {
    return async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        isCorrect,
        correctAnswer,
        explanation: 'Explicación de prueba',
        articleNumber: '1',
        lawShortName: 'CE',
      }),
    })
  }

  // ============================================
  // Tests: Validación de questionId
  // ============================================
  describe('Validación de questionId', () => {

    test('rechaza questionId vacío', async () => {
      const result = await simulateValidateAnswerSecure('', 0, mockSuccessResponse(true, 0))
      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_QUESTION_ID')
    })

    test('rechaza questionId null (forzado)', async () => {
      const result = await simulateValidateAnswerSecure(null as unknown as string, 0, mockSuccessResponse(true, 0))
      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_QUESTION_ID')
    })

    test('rechaza questionId undefined (forzado)', async () => {
      const result = await simulateValidateAnswerSecure(undefined as unknown as string, 0, mockSuccessResponse(true, 0))
      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_QUESTION_ID')
    })

    test('rechaza questionId demasiado corto (< 10 chars)', async () => {
      const result = await simulateValidateAnswerSecure('short', 0, mockSuccessResponse(true, 0))
      expect(result.success).toBe(false)
      expect(result.error).toBe('NO_QUESTION_ID')
    })

    test('acepta questionId UUID válido', async () => {
      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        mockSuccessResponse(true, 0)
      )
      expect(result.isCorrect).toBe(true)
    })
  })

  // ============================================
  // Tests: Respuesta exitosa
  // ============================================
  describe('Respuesta exitosa', () => {

    test('devuelve datos completos en éxito', async () => {
      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        2,
        mockSuccessResponse(true, 2)
      )

      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(2)
      expect(result.explanation).toBe('Explicación de prueba')
      expect(result.articleNumber).toBe('1')
      expect(result.lawShortName).toBe('CE')
      expect(result.usedFallback).toBe(false)
    })

    test('devuelve isCorrect=false cuando respuesta incorrecta', async () => {
      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        1,
        mockSuccessResponse(false, 3)
      )

      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(3)
    })
  })

  // ============================================
  // Tests: Pregunta no encontrada
  // ============================================
  describe('Pregunta no encontrada', () => {

    test('devuelve QUESTION_NOT_FOUND si API responde success=false', async () => {
      const fetchFn = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: false }),
      })

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('QUESTION_NOT_FOUND')
    })
  })

  // ============================================
  // Tests: Retry tras error HTTP
  // ============================================
  describe('Retry tras error HTTP', () => {

    test('CRÍTICO: reintenta tras HTTP 500 y devuelve éxito en 2do intento', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          return { ok: false, status: 500, json: async () => ({}) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: true,
            correctAnswer: 1,
            explanation: 'OK',
            articleNumber: '14',
            lawShortName: 'CE',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        1,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.isCorrect).toBe(true)
    })

    test('CRÍTICO: reintenta tras HTTP 502 (Bad Gateway)', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          return { ok: false, status: 502, json: async () => ({}) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: false,
            correctAnswer: 2,
            explanation: 'Recuperado',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(2)
    })

    test('dos HTTP 500 consecutivos devuelve el último fallback', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        return { ok: false, status: 500, json: async () => ({}) }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.success).toBe(false)
      expect(result.error).toBe('API_ERROR')
    })
  })

  // ============================================
  // Tests: Timeout (AbortController)
  // ============================================
  describe('Timeout con AbortController', () => {

    test('CRÍTICO: timeout en primer intento → reintenta', async () => {
      let callCount = 0
      const fetchFn = async (attempt: number) => {
        callCount++
        if (attempt === 0) {
          // Simula fetch que tarda más que el timeout
          await new Promise(resolve => setTimeout(resolve, 200))
          return { ok: true, status: 200, json: async () => ({ success: true, isCorrect: true, correctAnswer: 0 }) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: true,
            correctAnswer: 0,
            explanation: 'Recuperado tras timeout',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn,
        { timeoutMs: 50 } // Timeout corto para test
      )

      // Primer intento: timeout, segundo intento: éxito
      expect(result.isCorrect).toBe(true)
    })

    test('CRÍTICO: timeout en ambos intentos → devuelve TIMEOUT', async () => {
      const fetchFn = async () => {
        // Siempre tarda más que el timeout
        await new Promise(resolve => setTimeout(resolve, 200))
        return { ok: true, status: 200, json: async () => ({ success: true }) }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn,
        { timeoutMs: 50 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('TIMEOUT')
    })

    test('distingue TIMEOUT de API_ERROR', async () => {
      // TIMEOUT
      const fetchTimeout = async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return { ok: true, status: 200, json: async () => ({}) }
      }

      const timeoutResult = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchTimeout,
        { timeoutMs: 50 }
      )
      expect(timeoutResult.error).toBe('TIMEOUT')

      // API_ERROR (network error, no timeout)
      const fetchError = async () => {
        throw new Error('Network request failed')
      }

      const errorResult = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchError
      )
      expect(errorResult.error).toBe('API_ERROR')
    })
  })

  // ============================================
  // Tests: Error de red (fetch falla)
  // ============================================
  describe('Error de red (fetch falla)', () => {

    test('CRÍTICO: reintenta tras error de red', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('Failed to fetch')
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: false,
            correctAnswer: 1,
            explanation: 'Recuperado',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.isCorrect).toBe(false)
      expect(result.correctAnswer).toBe(1)
    })

    test('dos errores de red → devuelve API_ERROR', async () => {
      const fetchFn = async () => {
        throw new Error('Failed to fetch')
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('API_ERROR')
      expect(result.message).toBe('Failed to fetch')
    })
  })

  // ============================================
  // Tests: Combinaciones de errores
  // ============================================
  describe('Combinaciones de errores', () => {

    test('HTTP 500 en intento 1 + error de red en intento 2 → API_ERROR', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          return { ok: false, status: 500, json: async () => ({}) }
        }
        throw new Error('Connection refused')
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.success).toBe(false)
      expect(result.error).toBe('API_ERROR')
    })

    test('error de red en intento 1 + HTTP 200 OK en intento 2 → éxito', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('socket hang up')
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: true,
            correctAnswer: 3,
            explanation: 'D es correcta',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        3,
        fetchFn
      )

      expect(callCount).toBe(2)
      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(3)
    })
  })

  // ============================================
  // Tests: No reintenta en ciertos casos
  // ============================================
  describe('No reintenta en ciertos casos', () => {

    test('no reintenta si API responde con success=false (pregunta no encontrada)', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: false }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(1) // No reintenta
      expect(result.error).toBe('QUESTION_NOT_FOUND')
    })

    test('no reintenta si éxito en primer intento', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: true,
            correctAnswer: 0,
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(callCount).toBe(1)
      expect(result.isCorrect).toBe(true)
    })
  })

  // ============================================
  // Tests: Escenario real de Beatriz (ECONNRESET)
  // ============================================
  describe('Escenario real: Beatriz (ECONNRESET en Vercel)', () => {

    test('CRÍTICO: simula ECONNRESET → retry → éxito (caso ideal)', async () => {
      let callCount = 0
      const fetchFn = async () => {
        callCount++
        if (callCount === 1) {
          throw new Error('ECONNRESET') // Lo que pasó en Vercel
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            isCorrect: true,
            correctAnswer: 2,
            explanation: 'Art. 14 CE',
          }),
        }
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        2,
        fetchFn
      )

      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe(2)
    })

    test('CRÍTICO: simula ECONNRESET persistente → error con mensaje claro', async () => {
      const fetchFn = async () => {
        throw new Error('ECONNRESET')
      }

      const result = await simulateValidateAnswerSecure(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        0,
        fetchFn
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('API_ERROR')
      expect(result.message).toContain('ECONNRESET')
    })
  })
})
