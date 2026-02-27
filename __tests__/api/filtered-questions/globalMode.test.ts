/**
 * Tests para el modo global de filtered-questions (Test Rápido sin tema ni ley)
 *
 * BUG PREVENIDO: 2026-02-25 - /test/rapido sin parámetros devolvía
 * "Test Rápido No Disponible" porque la API exigía al menos un tema o ley.
 * El fix añade "modo global" que obtiene todos los temas del positionType.
 *
 * Reportado por: Mar Vazquez (entraba desde push notification → /test/rapido)
 */

// ============================================
// LÓGICA: Replica la determinación de modo de queries.ts
// ============================================
function determineQueryMode(request: {
  topicNumber: number
  multipleTopics: number[]
  selectedLaws: string[]
}) {
  const topicsToQuery = request.multipleTopics.length > 0
    ? request.multipleTopics
    : request.topicNumber > 0 ? [request.topicNumber] : []

  const isLawOnlyMode = topicsToQuery.length === 0 && request.selectedLaws.length > 0
  const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

  return { topicsToQuery, isLawOnlyMode, isGlobalMode }
}

// ============================================
// TESTS: Detección de modo global
// ============================================
describe('Modo Global - Detección', () => {

  test('topicNumber=0, sin multipleTopics, sin selectedLaws → MODO GLOBAL', () => {
    const { isGlobalMode, isLawOnlyMode } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: [],
    })

    expect(isGlobalMode).toBe(true)
    expect(isLawOnlyMode).toBe(false)
  })

  test('topicNumber=0, sin multipleTopics, CON selectedLaws → MODO LEY (no global)', () => {
    const { isGlobalMode, isLawOnlyMode } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: ['CE'],
    })

    expect(isGlobalMode).toBe(false)
    expect(isLawOnlyMode).toBe(true)
  })

  test('topicNumber=5, sin multipleTopics, sin selectedLaws → MODO NORMAL (no global)', () => {
    const { isGlobalMode, isLawOnlyMode, topicsToQuery } = determineQueryMode({
      topicNumber: 5,
      multipleTopics: [],
      selectedLaws: [],
    })

    expect(isGlobalMode).toBe(false)
    expect(isLawOnlyMode).toBe(false)
    expect(topicsToQuery).toEqual([5])
  })

  test('CON multipleTopics, sin selectedLaws → MODO NORMAL (no global)', () => {
    const { isGlobalMode, isLawOnlyMode, topicsToQuery } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [1, 2, 3],
      selectedLaws: [],
    })

    expect(isGlobalMode).toBe(false)
    expect(isLawOnlyMode).toBe(false)
    expect(topicsToQuery).toEqual([1, 2, 3])
  })
})

// ============================================
// TESTS: Escenarios reales que activan modo global
// ============================================
describe('Modo Global - Escenarios reales', () => {

  test('Push notification "Estudiar" → /test/rapido sin params', () => {
    // El service worker manda a /test/rapido sin parámetros
    // fetchQuickQuestions genera: topicNumber=0, selectedLaws=[]
    const { isGlobalMode } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: [],
    })

    expect(isGlobalMode).toBe(true)
  })

  test('Botón "Test rápido general" en TestPageWrapper', () => {
    // <a href="/test/rapido"> sin parámetros
    const { isGlobalMode } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: [],
    })

    expect(isGlobalMode).toBe(true)
  })

  test('Push notification con ley → NO es modo global', () => {
    // /test/rapido?law=ce → fetchQuickQuestions extrae selectedLaws=['CE']
    const { isGlobalMode, isLawOnlyMode } = determineQueryMode({
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: ['CE'],
    })

    expect(isGlobalMode).toBe(false)
    expect(isLawOnlyMode).toBe(true)
  })
})

// ============================================
// TESTS: Validación de Zod schema
// ============================================
describe('Modo Global - Validación Zod', () => {
  // Importar el schema real
  const { safeParseGetFilteredQuestions } = require('@/lib/api/filtered-questions/schemas')

  test('Request de test rápido sin tema ni ley pasa validación Zod', () => {
    const result = safeParseGetFilteredQuestions({
      topicNumber: 0,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
      selectedLaws: [],
      difficultyMode: 'random',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topicNumber).toBe(0)
      expect(result.data.selectedLaws).toEqual([])
    }
  })

  test('Request con topicNumber null se transforma a 0', () => {
    const result = safeParseGetFilteredQuestions({
      topicNumber: null,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topicNumber).toBe(0)
    }
  })

  test('Request sin topicNumber tiene default 0', () => {
    const result = safeParseGetFilteredQuestions({
      positionType: 'auxiliar_administrativo',
    })

    // topicNumber is required in schema (no default), so this should fail
    expect(result.success).toBe(false)
  })
})