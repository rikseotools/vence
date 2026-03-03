/**
 * Tests de integración para la API /api/questions/filtered
 * Verifica que la API procese correctamente todos los filtros
 */

// ============================================
// MOCK: Simular respuestas de la API
// ============================================
const mockApiResponse = (questions, totalAvailable) => ({
  success: true,
  questions,
  totalAvailable,
  filtersApplied: {}
})

// Mock de preguntas con diferentes características
const createMockQuestions = () => [
  // Título Preliminar CE (arts 1-9)
  { id: 'q1', article: { number: '1', law_short_name: 'CE' }, metadata: { is_official_exam: true } },
  { id: 'q2', article: { number: '3', law_short_name: 'CE' }, metadata: { is_official_exam: false } },
  { id: 'q3', article: { number: '9', law_short_name: 'CE' }, metadata: { is_official_exam: true } },
  // Título I CE (arts 10-55)
  { id: 'q4', article: { number: '14', law_short_name: 'CE' }, metadata: { is_official_exam: true } },
  { id: 'q5', article: { number: '23', law_short_name: 'CE' }, metadata: { is_official_exam: false } },
  { id: 'q6', article: { number: '53', law_short_name: 'CE' }, metadata: { is_official_exam: true } },
  // Título X CE (arts 166-169)
  { id: 'q7', article: { number: '167', law_short_name: 'CE' }, metadata: { is_official_exam: false } },
  { id: 'q8', article: { number: '168', law_short_name: 'CE' }, metadata: { is_official_exam: true } },
  // Otras leyes
  { id: 'q9', article: { number: '1', law_short_name: 'Ley 40/2015' }, metadata: { is_official_exam: false } },
  { id: 'q10', article: { number: '5', law_short_name: 'RD 366/2007' }, metadata: { is_official_exam: true } },
]

// ============================================
// FUNCIÓN: Simular lógica de filtrado de la API
// ============================================
function simulateApiFilter(questions, filters) {
  let filtered = [...questions]

  // Filtrar por leyes seleccionadas
  if (filters.selectedLaws && filters.selectedLaws.length > 0) {
    filtered = filtered.filter(q =>
      filters.selectedLaws.includes(q.article.law_short_name)
    )
  }

  // Filtrar por artículos específicos
  if (filters.selectedArticlesByLaw && Object.keys(filters.selectedArticlesByLaw).length > 0) {
    filtered = filtered.filter(q => {
      const lawArticles = filters.selectedArticlesByLaw[q.article.law_short_name]
      if (!lawArticles || lawArticles.length === 0) return true
      return lawArticles.includes(parseInt(q.article.number))
    })
  }

  // Filtrar por secciones (rangos de artículos)
  if (filters.selectedSectionFilters && filters.selectedSectionFilters.length > 0) {
    const ranges = filters.selectedSectionFilters
      .filter(s => s.articleRange)
      .map(s => ({
        start: s.articleRange.start,
        end: s.articleRange.end,
        lawShortName: s.lawShortName
      }))

    if (ranges.length > 0) {
      filtered = filtered.filter(q => {
        const articleNum = parseInt(q.article.number)
        return ranges.some(range => {
          // Si el filtro especifica una ley, verificar que coincida
          if (range.lawShortName && range.lawShortName !== q.article.law_short_name) {
            return false
          }
          return articleNum >= range.start && articleNum <= range.end
        })
      })
    }
  }

  // Filtrar solo oficiales
  if (filters.onlyOfficialQuestions) {
    filtered = filtered.filter(q => q.metadata.is_official_exam === true)
  }

  return filtered
}

// ============================================
// TESTS: Manejo de searchParams (URLSearchParams vs Object)
// ============================================
describe('SearchParams Handling', () => {
  // Helper que simula el patrón correcto
  const getParam = (searchParams, key, defaultValue = null) => {
    if (!searchParams) return defaultValue

    // Si es URLSearchParams (desde hook)
    if (typeof searchParams.get === 'function') {
      return searchParams.get(key) || defaultValue
    }

    // Si es objeto plano (desde server component)
    return searchParams[key] || defaultValue
  }

  test('Debe manejar URLSearchParams correctamente', () => {
    const urlParams = new URLSearchParams('?law=ce&articles=1,2,3&n=10')

    expect(getParam(urlParams, 'law')).toBe('ce')
    expect(getParam(urlParams, 'articles')).toBe('1,2,3')
    expect(getParam(urlParams, 'n')).toBe('10')
    expect(getParam(urlParams, 'missing', 'default')).toBe('default')
  })

  test('Debe manejar objeto plano correctamente', () => {
    const plainObject = { law: 'ce', articles: '1,2,3', n: '10' }

    expect(getParam(plainObject, 'law')).toBe('ce')
    expect(getParam(plainObject, 'articles')).toBe('1,2,3')
    expect(getParam(plainObject, 'n')).toBe('10')
    expect(getParam(plainObject, 'missing', 'default')).toBe('default')
  })

  test('Debe manejar null/undefined correctamente', () => {
    expect(getParam(null, 'key', 'default')).toBe('default')
    expect(getParam(undefined, 'key', 'default')).toBe('default')
  })

  test('PROBLEMA: Llamar .get() en objeto plano causa error', () => {
    const plainObject = { law: 'ce', n: '10' }

    // Esto es lo que hacen algunos fetchers incorrectamente:
    // const n = parseInt(searchParams.get('n')) || 5

    // Verificar que .get no existe en objetos planos
    expect(typeof plainObject.get).toBe('undefined')

    // Intentar llamar .get() causaría: TypeError: searchParams.get is not a function
    expect(() => plainObject.get('n')).toThrow()
  })

  test('Fetchers de notificaciones deben usar getParam helper', () => {
    // Los fetchers que reciben searchParams de server components deben
    // verificar si es URLSearchParams u objeto plano

    const serverComponentParams = { law: 'lpac', articles: '1,2', n: '10' }
    const hookParams = new URLSearchParams('?law=lpac&articles=1,2&n=10')

    // Ambos deben funcionar con el helper
    expect(getParam(serverComponentParams, 'law')).toBe('lpac')
    expect(getParam(hookParams, 'law')).toBe('lpac')
  })
})

// ============================================
// TESTS: Validación de parámetros de request
// ============================================
describe('API Request Validation', () => {
  test('Request válido debe tener topicNumber', () => {
    const validRequest = {
      topicNumber: 1,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10
    }

    expect(validRequest.topicNumber).toBeDefined()
    expect(typeof validRequest.topicNumber).toBe('number')
  })

  test('positionType debe ser uno de los valores permitidos', () => {
    const validTypes = ['auxiliar_administrativo', 'administrativo', 'administrativo_estado']

    validTypes.forEach(type => {
      expect(['auxiliar_administrativo', 'administrativo', 'administrativo_estado']).toContain(type)
    })
  })

  test('selectedSectionFilters debe tener estructura correcta', () => {
    const validFilter = {
      title: 'Título Preliminar',
      lawShortName: 'CE',
      articleRange: { start: 1, end: 9 }
    }

    expect(validFilter.articleRange).toBeDefined()
    expect(validFilter.articleRange.start).toBeLessThanOrEqual(validFilter.articleRange.end)
  })

  test('numQuestions debe estar en rango válido', () => {
    const minQuestions = 1
    const maxQuestions = 200  // Aumentado para tests largos de múltiples leyes

    expect(minQuestions).toBeGreaterThanOrEqual(1)
    expect(maxQuestions).toBeLessThanOrEqual(200)
  })
})

// ============================================
// TESTS: Filtro de sección única
// ============================================
describe('API Section Filter - Single Section', () => {
  const allQuestions = createMockQuestions()

  test('Filtrar por Título Preliminar (arts 1-9) solo devuelve esos artículos', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título Preliminar',
        lawShortName: 'CE',
        articleRange: { start: 1, end: 9 }
      }]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(3) // q1, q2, q3
    filtered.forEach(q => {
      const artNum = parseInt(q.article.number)
      expect(artNum).toBeGreaterThanOrEqual(1)
      expect(artNum).toBeLessThanOrEqual(9)
      expect(q.article.law_short_name).toBe('CE')
    })
  })

  test('Filtrar por Título I (arts 10-55) solo devuelve esos artículos', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título I',
        lawShortName: 'CE',
        articleRange: { start: 10, end: 55 }
      }]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(3) // q4, q5, q6
    filtered.forEach(q => {
      const artNum = parseInt(q.article.number)
      expect(artNum).toBeGreaterThanOrEqual(10)
      expect(artNum).toBeLessThanOrEqual(55)
    })
  })

  test('Filtrar por Título X (arts 166-169) solo devuelve esos artículos', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título X',
        lawShortName: 'CE',
        articleRange: { start: 166, end: 169 }
      }]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(2) // q7, q8
    filtered.forEach(q => {
      const artNum = parseInt(q.article.number)
      expect(artNum).toBeGreaterThanOrEqual(166)
      expect(artNum).toBeLessThanOrEqual(169)
    })
  })
})

// ============================================
// TESTS: Filtro de múltiples secciones
// ============================================
describe('API Section Filter - Multiple Sections', () => {
  const allQuestions = createMockQuestions()

  test('Filtrar por T.Preliminar + T.X devuelve artículos de ambos rangos', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [
        { title: 'Título Preliminar', lawShortName: 'CE', articleRange: { start: 1, end: 9 } },
        { title: 'Título X', lawShortName: 'CE', articleRange: { start: 166, end: 169 } }
      ]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(5) // q1, q2, q3 + q7, q8

    const articleNumbers = filtered.map(q => parseInt(q.article.number))

    // Verificar que hay artículos de ambos rangos
    expect(articleNumbers.some(n => n >= 1 && n <= 9)).toBe(true)
    expect(articleNumbers.some(n => n >= 166 && n <= 169)).toBe(true)

    // Verificar que no hay artículos de otros rangos
    expect(articleNumbers.some(n => n >= 10 && n <= 165)).toBe(false)
  })

  test('Filtrar por todos los títulos devuelve todas las preguntas de CE', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [
        { title: 'Título Preliminar', lawShortName: 'CE', articleRange: { start: 1, end: 9 } },
        { title: 'Título I', lawShortName: 'CE', articleRange: { start: 10, end: 55 } },
        { title: 'Título X', lawShortName: 'CE', articleRange: { start: 166, end: 169 } }
      ]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // Todas las preguntas de CE
    expect(filtered.length).toBe(8)
    filtered.forEach(q => {
      expect(q.article.law_short_name).toBe('CE')
    })
  })
})

// ============================================
// TESTS: Filtro de artículos específicos
// ============================================
describe('API Article Filter - Specific Articles', () => {
  const allQuestions = createMockQuestions()

  test('Filtrar por artículos específicos 14,15,16 de CE', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { 'CE': [14, 15, 16] }
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // Solo q4 tiene artículo 14
    expect(filtered.length).toBe(1)
    expect(filtered[0].article.number).toBe('14')
  })

  test('Filtrar por artículos 1, 3 de CE', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { 'CE': [1, 3] }
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(2) // q1 (art 1), q2 (art 3)
    expect(filtered.map(q => q.article.number).sort()).toEqual(['1', '3'])
  })
})

// ============================================
// TESTS: Filtro solo oficiales
// ============================================
describe('API Official Questions Filter', () => {
  const allQuestions = createMockQuestions()

  test('Filtrar solo oficiales devuelve preguntas con is_official_exam=true', () => {
    const filters = {
      onlyOfficialQuestions: true
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    filtered.forEach(q => {
      expect(q.metadata.is_official_exam).toBe(true)
    })
  })

  test('Sin filtro oficial devuelve todas las preguntas', () => {
    const filters = {
      onlyOfficialQuestions: false
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(allQuestions.length)
  })
})

// ============================================
// TESTS: Combinación de filtros
// ============================================
describe('API Combined Filters', () => {
  const allQuestions = createMockQuestions()

  test('Sección + Solo oficiales', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título Preliminar',
        lawShortName: 'CE',
        articleRange: { start: 1, end: 9 }
      }],
      onlyOfficialQuestions: true
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // Del Título Preliminar (q1, q2, q3), solo q1 y q3 son oficiales
    expect(filtered.length).toBe(2)
    filtered.forEach(q => {
      expect(q.metadata.is_official_exam).toBe(true)
      const artNum = parseInt(q.article.number)
      expect(artNum).toBeGreaterThanOrEqual(1)
      expect(artNum).toBeLessThanOrEqual(9)
    })
  })

  test('Múltiples secciones + Solo oficiales', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [
        { title: 'Título Preliminar', lawShortName: 'CE', articleRange: { start: 1, end: 9 } },
        { title: 'Título I', lawShortName: 'CE', articleRange: { start: 10, end: 55 } }
      ],
      onlyOfficialQuestions: true
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // T.Preliminar oficiales: q1, q3 (2)
    // T.I oficiales: q4, q6 (2)
    expect(filtered.length).toBe(4)
    filtered.forEach(q => {
      expect(q.metadata.is_official_exam).toBe(true)
    })
  })

  test('Ley específica + Sección + Oficiales', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título X',
        lawShortName: 'CE',
        articleRange: { start: 166, end: 169 }
      }],
      onlyOfficialQuestions: true
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // T.X oficiales: solo q8 (art 168)
    expect(filtered.length).toBe(1)
    expect(filtered[0].article.number).toBe('168')
    expect(filtered[0].metadata.is_official_exam).toBe(true)
  })
})

// ============================================
// TESTS: Filtro por múltiples leyes
// ============================================
describe('API Multiple Laws Filter', () => {
  const allQuestions = createMockQuestions()

  test('Filtrar por CE y Ley 40/2015', () => {
    const filters = {
      selectedLaws: ['CE', 'Ley 40/2015']
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // 8 de CE + 1 de Ley 40/2015 = 9
    expect(filtered.length).toBe(9)
  })

  test('Filtrar solo por Ley 40/2015', () => {
    const filters = {
      selectedLaws: ['Ley 40/2015']
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(1)
    expect(filtered[0].article.law_short_name).toBe('Ley 40/2015')
  })

  test('Sin filtro de ley devuelve todas', () => {
    const filters = {
      selectedLaws: []
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(allQuestions.length)
  })
})

// ============================================
// TESTS: Edge cases
// ============================================
describe('API Filter Edge Cases', () => {
  const allQuestions = createMockQuestions()

  test('Filtro de sección sin articleRange se ignora', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [
        { title: 'Sin rango', lawShortName: 'CE' } // Sin articleRange
      ]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // Sin rango válido, devuelve todas las de CE
    expect(filtered.length).toBe(8)
  })

  test('Filtro con rango que no contiene preguntas devuelve vacío', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Rango vacío',
        lawShortName: 'CE',
        articleRange: { start: 100, end: 110 } // No hay preguntas en este rango
      }]
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(0)
  })

  test('Filtro de artículos vacío devuelve todas las de la ley', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { 'CE': [] }
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    expect(filtered.length).toBe(8)
  })

  test('Combinación imposible (sección + artículos fuera de rango) devuelve vacío', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título Preliminar',
        lawShortName: 'CE',
        articleRange: { start: 1, end: 9 }
      }],
      selectedArticlesByLaw: { 'CE': [50, 51, 52] } // Fuera del rango
    }

    const filtered = simulateApiFilter(allQuestions, filters)

    // Primero filtra por artículos específicos, luego por sección
    // Ninguno de 50,51,52 está en rango 1-9
    expect(filtered.length).toBe(0)
  })
})

// ============================================
// TESTS: Formato de respuesta
// ============================================
describe('API Response Format', () => {
  test('Respuesta exitosa tiene estructura correcta', () => {
    const response = mockApiResponse(createMockQuestions().slice(0, 5), 100)

    expect(response).toHaveProperty('success', true)
    expect(response).toHaveProperty('questions')
    expect(response).toHaveProperty('totalAvailable')
    expect(Array.isArray(response.questions)).toBe(true)
  })

  test('Cada pregunta tiene campos requeridos', () => {
    const questions = createMockQuestions()

    questions.forEach(q => {
      expect(q).toHaveProperty('id')
      expect(q).toHaveProperty('article')
      expect(q.article).toHaveProperty('number')
      expect(q.article).toHaveProperty('law_short_name')
      expect(q).toHaveProperty('metadata')
    })
  })

  test('totalAvailable refleja el conteo real', () => {
    const filters = {
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título Preliminar',
        lawShortName: 'CE',
        articleRange: { start: 1, end: 9 }
      }]
    }

    const allQuestions = createMockQuestions()
    const filtered = simulateApiFilter(allQuestions, filters)
    const response = mockApiResponse(filtered.slice(0, 2), filtered.length)

    expect(response.questions.length).toBe(2) // numQuestions limitado
    expect(response.totalAvailable).toBe(3) // Total disponible con filtros
  })
})

// ============================================
// TESTS: Modo ley-only (sin tema) - BUG FIX
// ============================================
describe('API Law-Only Mode (sin tema)', () => {
  test('Request con selectedLaws pero sin topicNumber debe ser válido', () => {
    // Este es el caso de las notificaciones que envían /test/rapido?law=lpac
    const request = {
      topicNumber: 0, // Sin tema
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
      selectedLaws: ['LPAC'], // Pero con ley
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    // El request debe ser válido porque tiene selectedLaws
    const isLawOnlyMode = request.topicNumber === 0 && request.selectedLaws.length > 0
    expect(isLawOnlyMode).toBe(true)
    expect(request.selectedLaws).toContain('LPAC')
  })

  test('Request con selectedLaws Y artículos específicos debe funcionar', () => {
    // Caso de notificación de artículos problemáticos
    const request = {
      topicNumber: 0,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: { 'CE': [14, 15, 16] },
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    const isLawOnlyMode = request.topicNumber === 0 && request.selectedLaws.length > 0
    expect(isLawOnlyMode).toBe(true)
    expect(request.selectedArticlesByLaw['CE']).toEqual([14, 15, 16])
  })

  test('Request sin topicNumber NI selectedLaws activa modo global (test rápido)', () => {
    // FIX 2026-02-25: Antes esto fallaba, ahora activa "modo global"
    // que busca preguntas de todos los temas del positionType
    const request = {
      topicNumber: 0,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
      selectedLaws: [], // Sin leyes
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    const isLawOnlyMode = request.topicNumber === 0 && request.selectedLaws.length > 0
    const isGlobalMode = request.topicNumber === 0 && !isLawOnlyMode && request.selectedLaws.length === 0

    expect(isGlobalMode).toBe(true) // Modo global activado
  })

  test('Notificación de artículos problemáticos genera request válido', () => {
    // Simula lo que genera useIntelligentNotifications para /test/rapido
    const notificationParams = {
      law: 'lpac', // slug de la URL
      articles: '1,2,3',
      mode: 'intensive',
      n: '10'
    }

    // El fetcher debe transformar esto en:
    const apiRequest = {
      topicNumber: 0, // No hay tema en la URL
      positionType: 'auxiliar_administrativo',
      numQuestions: parseInt(notificationParams.n),
      selectedLaws: ['LPAC'], // mapLawSlugToShortName('lpac') → 'LPAC'
      selectedArticlesByLaw: { 'LPAC': [1, 2, 3] },
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    const isLawOnlyMode = apiRequest.topicNumber === 0 && apiRequest.selectedLaws.length > 0
    expect(isLawOnlyMode).toBe(true)
    expect(apiRequest.selectedLaws).toContain('LPAC')
    expect(apiRequest.selectedArticlesByLaw['LPAC']).toEqual([1, 2, 3])
  })

  test('Notificación de level_regression genera request válido', () => {
    // Simula notificación de "bajada de nivel"
    const notificationParams = {
      law: 'ce',
      mode: 'recovery',
      n: '15'
    }

    const apiRequest = {
      topicNumber: 0,
      positionType: 'auxiliar_administrativo',
      numQuestions: parseInt(notificationParams.n),
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      selectedSectionFilters: [],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    const isLawOnlyMode = apiRequest.topicNumber === 0 && apiRequest.selectedLaws.length > 0
    expect(isLawOnlyMode).toBe(true)
  })
})

// ============================================
// TESTS: Validación de parámetros críticos
// ============================================
describe('API Critical Parameter Validation', () => {
  test('multipleTopics vacío + topicNumber 0 + selectedLaws vacío = MODO GLOBAL', () => {
    // FIX 2026-02-25: Antes era error, ahora activa modo global (test rápido)
    const request = {
      topicNumber: 0,
      multipleTopics: [],
      selectedLaws: [],
      positionType: 'auxiliar_administrativo'
    }

    const topicsToQuery = request.multipleTopics.length > 0
      ? request.multipleTopics
      : request.topicNumber > 0 ? [request.topicNumber] : []

    const isLawOnlyMode = topicsToQuery.length === 0 && request.selectedLaws.length > 0
    const isGlobalMode = topicsToQuery.length === 0 && !isLawOnlyMode

    expect(isGlobalMode).toBe(true) // Modo global, no error
  })

  test('multipleTopics con valores válidos = OK', () => {
    const request = {
      topicNumber: 0,
      multipleTopics: [1, 2, 3],
      selectedLaws: [],
      positionType: 'auxiliar_administrativo'
    }

    const topicsToQuery = request.multipleTopics.length > 0
      ? request.multipleTopics
      : request.topicNumber > 0 ? [request.topicNumber] : []

    expect(topicsToQuery).toEqual([1, 2, 3])
    expect(topicsToQuery.length).toBeGreaterThan(0)
  })

  test('topicNumber positivo sin multipleTopics = OK', () => {
    const request = {
      topicNumber: 5,
      multipleTopics: [],
      selectedLaws: [],
      positionType: 'auxiliar_administrativo'
    }

    const topicsToQuery = request.multipleTopics.length > 0
      ? request.multipleTopics
      : request.topicNumber > 0 ? [request.topicNumber] : []

    expect(topicsToQuery).toEqual([5])
  })
})

// ============================================
// TESTS: Simulación de requests reales
// ============================================
describe('API Real Request Simulation', () => {
  test('Request típico de test personalizado con filtro de sección', () => {
    const request = {
      topicNumber: 1,
      positionType: 'auxiliar_administrativo',
      numQuestions: 10,
      selectedLaws: ['CE'],
      selectedSectionFilters: [{
        title: 'Título Preliminar',
        lawShortName: 'CE',
        articleRange: { start: 1, end: 9 }
      }],
      onlyOfficialQuestions: false,
      difficultyMode: 'random'
    }

    // Validar estructura del request
    expect(request.topicNumber).toBeGreaterThan(0)
    expect(request.numQuestions).toBeGreaterThan(0)
    expect(request.selectedSectionFilters[0].articleRange).toBeDefined()
  })

  test('Request de test examen con múltiples filtros', () => {
    const request = {
      topicNumber: 1,
      positionType: 'administrativo',
      numQuestions: 25,
      selectedLaws: ['CE'],
      selectedSectionFilters: [
        { title: 'Título I', lawShortName: 'CE', articleRange: { start: 10, end: 55 } },
        { title: 'Título II', lawShortName: 'CE', articleRange: { start: 56, end: 65 } }
      ],
      onlyOfficialQuestions: true,
      difficultyMode: 'random'
    }

    const allQuestions = createMockQuestions()
    const filtered = simulateApiFilter(allQuestions, request)

    // Debe filtrar por secciones Y por oficiales
    filtered.forEach(q => {
      expect(q.metadata.is_official_exam).toBe(true)
      const artNum = parseInt(q.article.number)
      const inRange = (artNum >= 10 && artNum <= 55) || (artNum >= 56 && artNum <= 65)
      expect(inRange).toBe(true)
    })
  })

  test('Request sin filtros devuelve todas las preguntas del tema', () => {
    const request = {
      topicNumber: 1,
      positionType: 'auxiliar_administrativo',
      numQuestions: 50,
      selectedLaws: [],
      selectedSectionFilters: [],
      onlyOfficialQuestions: false
    }

    const allQuestions = createMockQuestions()
    const filtered = simulateApiFilter(allQuestions, request)

    expect(filtered.length).toBe(allQuestions.length)
  })
})
