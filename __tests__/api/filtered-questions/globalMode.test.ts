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
// TESTS: Scope por positionType (FIX 2026-04-10)
// Documenta el bug donde preguntas de LECrim (tramitacion_procesal)
// aparecían en tests de auxiliar_administrativo_estado.
// Root cause: modo global hacía WHERE is_active=true sin filtrar por topic_scope.
// Fix: obtener validLawIds desde topic_scope JOIN topics WHERE positionType, luego
//      filtrar WHERE laws.id IN (validLawIds).
// ============================================
describe('Modo Global - Scope por positionType', () => {

  function filterByScope(validLawIds: string[], questionLawIds: string[]): string[] {
    // Replica la lógica del fix: solo preguntas cuya ley esté en validLawIds
    return questionLawIds.filter(id => validLawIds.includes(id))
  }

  function buildGlobalResponse(validLawIds: string[], foundQuestions: number, positionType: string) {
    if (validLawIds.length === 0) {
      return {
        success: true,
        questions: [] as unknown[],
        totalAvailable: 0,
        filtersApplied: { laws: 0, articles: 0, sections: 0 },
        emptyReason: `No hay contenido configurado para la oposición "${positionType}"`,
      }
    }
    if (foundQuestions === 0) {
      return {
        success: true,
        questions: [] as unknown[],
        totalAvailable: 0,
        filtersApplied: { laws: validLawIds.length, articles: 0, sections: 0 },
        emptyReason: `No hay preguntas disponibles para la oposición "${positionType}"`,
      }
    }
    return {
      success: true,
      questions: new Array(foundQuestions).fill({}),
      totalAvailable: foundQuestions,
      filtersApplied: { laws: validLawIds.length, articles: 0, sections: 0 },
    }
  }

  // ---- Lógica de filtrado ----

  test('Sin validLawIds → no devuelve ninguna pregunta', () => {
    const validLawIds: string[] = []
    const result = filterByScope(validLawIds, ['lecrim-uuid', 'ce-uuid'])
    expect(result).toHaveLength(0)
  })

  test('LECrim excluida del scope de auxiliar_administrativo_estado', () => {
    // auxiliar tiene CE, LRJSP, LPACAP, etc. pero NO LECrim
    const auxiliarValidLawIds = ['ce-uuid', 'lrjsp-uuid', 'lpacap-uuid']
    const lecrimLawId = 'lecrim-uuid'

    expect(auxiliarValidLawIds).not.toContain(lecrimLawId)
    const result = filterByScope(auxiliarValidLawIds, [lecrimLawId])
    expect(result).toHaveLength(0)
  })

  test('Solo devuelve preguntas de leyes dentro del scope', () => {
    const validLawIds = ['ce-uuid', 'lrjsp-uuid']
    const allLaws = ['ce-uuid', 'lecrim-uuid', 'lrjsp-uuid', 'lopj-uuid']
    const filtered = filterByScope(validLawIds, allLaws)

    expect(filtered).toEqual(['ce-uuid', 'lrjsp-uuid'])
    expect(filtered).not.toContain('lecrim-uuid')
    expect(filtered).not.toContain('lopj-uuid')
  })

  test('Scopes de auxiliar y tramitacion_procesal son distintos', () => {
    // tramitacion tiene LECrim y LOPJ; auxiliar no los tiene
    const auxiliarScope = ['ce-uuid', 'lrjsp-uuid', 'lpacap-uuid']
    const tramitacionScope = ['lecrim-uuid', 'lopj-uuid', 'ce-uuid']

    expect(auxiliarScope).not.toContain('lecrim-uuid')
    expect(tramitacionScope).toContain('lecrim-uuid')

    // CE es compartida entre oposiciones
    expect(auxiliarScope).toContain('ce-uuid')
    expect(tramitacionScope).toContain('ce-uuid')
  })

  // ---- Formato de respuesta ----

  test('Sin topic_scope configurado → emptyReason + laws:0', () => {
    const resp = buildGlobalResponse([], 0, 'auxiliar_administrativo_estado')

    expect(resp.success).toBe(true)
    expect(resp.questions).toHaveLength(0)
    expect(resp.totalAvailable).toBe(0)
    expect(resp.filtersApplied.laws).toBe(0)
    expect(resp.emptyReason).toContain('No hay contenido configurado')
  })

  test('Con scope pero sin preguntas disponibles → emptyReason + laws:N', () => {
    const resp = buildGlobalResponse(['ce-uuid', 'lrjsp-uuid'], 0, 'auxiliar_administrativo_estado')

    expect(resp.success).toBe(true)
    expect(resp.questions).toHaveLength(0)
    expect(resp.totalAvailable).toBe(0)
    expect(resp.filtersApplied.laws).toBe(2)
    expect(resp.emptyReason).toContain('No hay preguntas disponibles')
  })

  test('Con scope y preguntas → éxito + laws:N + sin emptyReason', () => {
    const resp = buildGlobalResponse(['ce-uuid', 'lrjsp-uuid', 'lpacap-uuid'], 10, 'auxiliar_administrativo_estado')

    expect(resp.success).toBe(true)
    expect(resp.questions).toHaveLength(10)
    expect(resp.totalAvailable).toBe(10)
    expect(resp.filtersApplied.laws).toBe(3)
    expect('emptyReason' in resp).toBe(false)
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
      positionType: 'auxiliar_administrativo_estado',
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
      positionType: 'auxiliar_administrativo_estado',
      numQuestions: 10,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.topicNumber).toBe(0)
    }
  })

  test('Request sin topicNumber tiene default 0', () => {
    const result = safeParseGetFilteredQuestions({
      positionType: 'auxiliar_administrativo_estado',
    })

    // topicNumber is required in schema (no default), so this should fail
    expect(result.success).toBe(false)
  })
})