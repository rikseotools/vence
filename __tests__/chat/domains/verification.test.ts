// __tests__/chat/domains/verification.test.js
// Tests para el dominio de verificación de respuestas

// Mock de Supabase para evitar problemas con ESM
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
}))

// Funciones de detección de errores replicadas para testing
function detectErrorInResponse(response) {
  if (!response || typeof response !== 'string') return false

  const responseText = response.toLowerCase()

  // Patrones que indican error detectado
  const errorPatterns = [
    /⚠️.*posible\s*error/i,
    /⚠️.*error\s*detectado/i,
    /la\s*respuesta\s*marcada\s*como\s*correcta\s*(es|está)\s*incorrecta/i,
    /error\s*en\s*la\s*pregunta/i,
    /he\s*detectado\s*un\s*posible\s*error/i,
  ]

  // Patrones de exclusión (no es error)
  const excludePatterns = [
    /sin\s*errores/i,
    /no\s*hay\s*error/i,
    /no\s*tiene\s*error/i,
  ]

  // Si contiene patrón de exclusión, no es error
  if (excludePatterns.some(p => p.test(response))) {
    return false
  }

  return errorPatterns.some(p => p.test(response))
}

function extractErrorDetails(response) {
  if (!response || typeof response !== 'string') return null
  if (!detectErrorInResponse(response)) return null

  // Buscar el warning emoji y extraer texto después
  const warningIndex = response.indexOf('⚠️')
  if (warningIndex !== -1) {
    const afterWarning = response.substring(warningIndex)
    const endIndex = afterWarning.indexOf('\n\n')
    const errorSection = endIndex !== -1 ? afterWarning.substring(0, endIndex) : afterWarning
    return errorSection.substring(0, 500)
  }

  // Si no hay emoji, buscar el patrón de error
  const match = response.match(/error[^.]*\./i)
  if (match) {
    return match[0].substring(0, 500)
  }

  return response.substring(0, 500)
}

describe('Verification Domain - Error Detector', () => {

  // ============================================
  // DETECCIÓN DE ERRORES EN RESPUESTAS
  // ============================================
  describe('detectErrorInResponse', () => {

    test('debe detectar "POSIBLE ERROR DETECTADO"', () => {
      const response = `La respuesta correcta es la B.

⚠️ POSIBLE ERROR DETECTADO: La opción marcada como correcta (A) no coincide con lo que establece el artículo 21.

El artículo 21 de la Ley 39/2015 establece...`

      const result = detectErrorInResponse(response)
      expect(result).toBe(true)
    })

    test('debe detectar warning emoji seguido de texto de error', () => {
      const response = `Analizando la pregunta...

⚠️ He detectado un posible error en esta pregunta. El plazo establecido es de 10 días, no 15.`

      const result = detectErrorInResponse(response)
      expect(result).toBe(true)
    })

    test('debe detectar "la respuesta marcada como correcta es incorrecta"', () => {
      const response = `Según el artículo 53, la respuesta marcada como correcta es incorrecta porque...`

      const result = detectErrorInResponse(response)
      expect(result).toBe(true)
    })

    test('debe detectar "error en la pregunta"', () => {
      const response = `He encontrado un error en la pregunta. El artículo citado no existe.`

      const result = detectErrorInResponse(response)
      expect(result).toBe(true)
    })

    test('NO debe detectar error en respuesta normal', () => {
      const response = `La respuesta correcta es la B porque el artículo 21 establece un plazo de 10 días.`

      const result = detectErrorInResponse(response)
      expect(result).toBe(false)
    })

    test('NO debe detectar error cuando menciona "sin errores"', () => {
      const response = `La pregunta está bien formulada, sin errores. La respuesta correcta es la A.`

      const result = detectErrorInResponse(response)
      expect(result).toBe(false)
    })

    test('NO debe detectar error cuando dice "no hay error"', () => {
      const response = `He revisado la pregunta y no hay error. La respuesta B es correcta.`

      const result = detectErrorInResponse(response)
      expect(result).toBe(false)
    })
  })

  // ============================================
  // EXTRACCIÓN DE DETALLES DEL ERROR
  // ============================================
  describe('extractErrorDetails', () => {

    test('debe extraer descripción del error con warning', () => {
      const response = `⚠️ POSIBLE ERROR: El artículo 21 establece 10 días, no 15.

Por lo tanto, la respuesta correcta debería ser la B.`

      const details = extractErrorDetails(response)
      expect(details).toContain('10 días')
    })

    test('debe extraer descripción del error sin warning', () => {
      const response = `He detectado un posible error en la pregunta. El plazo correcto es de 3 meses, no 1 mes.`

      const details = extractErrorDetails(response)
      expect(details).not.toBeNull()
    })

    test('debe devolver null si no hay error', () => {
      const response = `La respuesta correcta es la A porque el artículo 21 lo establece claramente.`

      const details = extractErrorDetails(response)
      expect(details).toBeNull()
    })

    test('debe truncar descripciones muy largas', () => {
      const longError = `⚠️ POSIBLE ERROR: ${'A'.repeat(1000)}`

      const details = extractErrorDetails(longError)
      expect(details.length).toBeLessThanOrEqual(500)
    })
  })

  // ============================================
  // CASOS EDGE
  // ============================================
  describe('Edge Cases', () => {

    test('debe manejar respuesta vacía', () => {
      expect(detectErrorInResponse('')).toBe(false)
      expect(extractErrorDetails('')).toBeNull()
    })

    test('debe manejar respuesta null/undefined', () => {
      expect(detectErrorInResponse(null)).toBe(false)
      expect(detectErrorInResponse(undefined)).toBe(false)
    })

    test('debe manejar solo emoji warning', () => {
      const response = '⚠️'
      expect(detectErrorInResponse(response)).toBe(false)
    })

    test('debe detectar error con diferentes formatos de warning', () => {
      const variations = [
        '⚠️ POSIBLE ERROR DETECTADO',
        '⚠️POSIBLE ERROR DETECTADO',
        '⚠️ Posible error detectado',
        '⚠️ posible error',
      ]

      variations.forEach(v => {
        expect(detectErrorInResponse(v)).toBe(true)
      })
    })
  })

})
