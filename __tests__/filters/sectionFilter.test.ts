// __tests__/filters/sectionFilter.test.js
// Tests unitarios para el filtro de secciones/títulos

import { jest } from '@jest/globals'

// Helper: Crear mock de secciones (títulos de la CE)
const createMockSections = () => [
  {
    id: 'sec-preliminar',
    slug: 'titulo-preliminar',
    title: 'Título Preliminar',
    description: 'Principios fundamentales del Estado español',
    articleRange: { start: 1, end: 9 },
    sectionNumber: 'Preliminar',
    sectionType: 'titulo',
    orderPosition: 1
  },
  {
    id: 'sec-titulo-1',
    slug: 'titulo-1',
    title: 'Título I',
    description: 'De los derechos y deberes fundamentales',
    articleRange: { start: 10, end: 55 },
    sectionNumber: '1',
    sectionType: 'titulo',
    orderPosition: 2
  },
  {
    id: 'sec-titulo-2',
    slug: 'titulo-2',
    title: 'Título II',
    description: 'De la Corona',
    articleRange: { start: 56, end: 65 },
    sectionNumber: '2',
    sectionType: 'titulo',
    orderPosition: 3
  },
  {
    id: 'sec-titulo-3',
    slug: 'titulo-3',
    title: 'Título III',
    description: 'De las Cortes Generales',
    articleRange: { start: 66, end: 96 },
    sectionNumber: '3',
    sectionType: 'titulo',
    orderPosition: 4
  },
  {
    id: 'sec-titulo-4',
    slug: 'titulo-4',
    title: 'Título IV',
    description: 'Del Gobierno y de la Administración',
    articleRange: { start: 97, end: 107 },
    sectionNumber: '4',
    sectionType: 'titulo',
    orderPosition: 5
  }
]

// Helper: Crear mock de preguntas con artículos
const createMockQuestionsWithArticles = () => [
  // Título Preliminar (1-9)
  { id: 'q1', article_number: 1, law_short_name: 'CE', question_text: 'Pregunta Art. 1' },
  { id: 'q2', article_number: 2, law_short_name: 'CE', question_text: 'Pregunta Art. 2' },
  { id: 'q3', article_number: 5, law_short_name: 'CE', question_text: 'Pregunta Art. 5' },
  { id: 'q4', article_number: 9, law_short_name: 'CE', question_text: 'Pregunta Art. 9' },
  // Título I (10-55)
  { id: 'q5', article_number: 14, law_short_name: 'CE', question_text: 'Pregunta Art. 14' },
  { id: 'q6', article_number: 23, law_short_name: 'CE', question_text: 'Pregunta Art. 23' },
  { id: 'q7', article_number: 27, law_short_name: 'CE', question_text: 'Pregunta Art. 27' },
  { id: 'q8', article_number: 53, law_short_name: 'CE', question_text: 'Pregunta Art. 53' },
  // Título II (56-65)
  { id: 'q9', article_number: 56, law_short_name: 'CE', question_text: 'Pregunta Art. 56' },
  { id: 'q10', article_number: 62, law_short_name: 'CE', question_text: 'Pregunta Art. 62' },
  // Título III (66-96)
  { id: 'q11', article_number: 66, law_short_name: 'CE', question_text: 'Pregunta Art. 66' },
  { id: 'q12', article_number: 78, law_short_name: 'CE', question_text: 'Pregunta Art. 78' },
  // Título IV (97-107)
  { id: 'q13', article_number: 97, law_short_name: 'CE', question_text: 'Pregunta Art. 97' },
  { id: 'q14', article_number: 103, law_short_name: 'CE', question_text: 'Pregunta Art. 103' },
  // Otras leyes (no deberían filtrarse por sección)
  { id: 'q15', article_number: 5, law_short_name: 'Ley 40/2015', question_text: 'Pregunta Ley 40' },
]

// Helper: Crear mock de mappings (topic_scope)
const createMockMappings = () => [
  {
    laws: { short_name: 'CE', id: 'ce-id', name: 'Constitución Española' },
    article_numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '14', '23', '27', '53', '56', '62', '66', '78', '97', '103']
  }
]

// ============================================
// FUNCIÓN DE FILTRADO (extraída del código real)
// ============================================
const applySectionFilter = (mappings, selectedSectionFilters) => {
  if (!selectedSectionFilters || selectedSectionFilters.length === 0) {
    return mappings
  }

  const ranges = selectedSectionFilters
    .filter(s => s.articleRange)
    .map(s => ({ start: s.articleRange.start, end: s.articleRange.end, title: s.title }))

  if (ranges.length === 0) {
    return mappings
  }

  return mappings.map(mapping => {
    const filteredArticleNumbers = mapping.article_numbers.filter(articleNum => {
      const num = parseInt(articleNum)
      return ranges.some(range => num >= range.start && num <= range.end)
    })

    return {
      ...mapping,
      article_numbers: filteredArticleNumbers
    }
  }).filter(m => m.article_numbers.length > 0)
}

// ============================================
// TESTS: Parseo de filtro de secciones desde URL
// ============================================
describe('Section Filter URL Parsing', () => {
  test('Debería parsear correctamente un filtro de sección desde URL', () => {
    const urlParam = '[{"id":"sec-preliminar","slug":"titulo-preliminar","title":"Título Preliminar","articleRange":{"start":1,"end":9}}]'

    const parsed = JSON.parse(urlParam)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe('Título Preliminar')
    expect(parsed[0].articleRange.start).toBe(1)
    expect(parsed[0].articleRange.end).toBe(9)
  })

  test('Debería parsear múltiples secciones desde URL', () => {
    const sections = createMockSections().slice(0, 3) // Preliminar, I, II
    const urlParam = JSON.stringify(sections)

    const parsed = JSON.parse(urlParam)

    expect(parsed).toHaveLength(3)
    expect(parsed.map(s => s.title)).toEqual(['Título Preliminar', 'Título I', 'Título II'])
  })

  test('Debería manejar URL param vacío o null', () => {
    expect(JSON.parse('[]')).toEqual([])

    const emptyFilter = null
    const result = emptyFilter ? JSON.parse(emptyFilter) : []
    expect(result).toEqual([])
  })

  test('Debería manejar JSON malformado gracefully', () => {
    const malformedJson = '[{"invalid json'

    let result = []
    try {
      result = JSON.parse(malformedJson)
    } catch (error) {
      result = []
    }

    expect(result).toEqual([])
  })
})

// ============================================
// TESTS: Lógica de filtrado por rangos de artículos
// ============================================
describe('Section Filter Article Range Logic', () => {
  test('Debería filtrar artículos solo del Título Preliminar (1-9)', () => {
    const mappings = createMockMappings()
    const selectedSections = [createMockSections()[0]] // Solo Título Preliminar

    const filtered = applySectionFilter(mappings, selectedSections)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].article_numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(filtered[0].article_numbers).not.toContain('10')
    expect(filtered[0].article_numbers).not.toContain('14')
  })

  test('Debería filtrar artículos solo del Título I (10-55)', () => {
    const mappings = createMockMappings()
    const selectedSections = [createMockSections()[1]] // Solo Título I

    const filtered = applySectionFilter(mappings, selectedSections)

    expect(filtered).toHaveLength(1)
    // Solo artículos 10, 14, 23, 27, 53 están en el mock de mappings y en rango 10-55
    expect(filtered[0].article_numbers).toEqual(['10', '14', '23', '27', '53'])
    expect(filtered[0].article_numbers).not.toContain('9')
    expect(filtered[0].article_numbers).not.toContain('56')
  })

  test('Debería combinar múltiples rangos de secciones', () => {
    const mappings = createMockMappings()
    const selectedSections = [
      createMockSections()[0], // Título Preliminar (1-9)
      createMockSections()[2], // Título II (56-65)
    ]

    const filtered = applySectionFilter(mappings, selectedSections)

    expect(filtered).toHaveLength(1)
    // Debería incluir artículos de ambos rangos
    const articleNumbers = filtered[0].article_numbers.map(n => parseInt(n))

    // Verificar artículos del Título Preliminar
    expect(articleNumbers).toContain(1)
    expect(articleNumbers).toContain(9)

    // Verificar artículos del Título II
    expect(articleNumbers).toContain(56)
    expect(articleNumbers).toContain(62)

    // No debería incluir artículos de otros títulos
    expect(articleNumbers).not.toContain(14) // Título I
    expect(articleNumbers).not.toContain(97) // Título IV
  })

  test('Debería retornar todos los artículos si no hay filtro de sección', () => {
    const mappings = createMockMappings()
    const originalCount = mappings[0].article_numbers.length

    const filtered1 = applySectionFilter(mappings, [])
    const filtered2 = applySectionFilter(mappings, null)
    const filtered3 = applySectionFilter(mappings, undefined)

    expect(filtered1[0].article_numbers.length).toBe(originalCount)
    expect(filtered2[0].article_numbers.length).toBe(originalCount)
    expect(filtered3[0].article_numbers.length).toBe(originalCount)
  })

  test('Debería manejar secciones sin articleRange', () => {
    const mappings = createMockMappings()
    const sectionsWithoutRange = [
      { id: 'invalid', title: 'Sin rango', articleRange: null },
      createMockSections()[0] // Con rango válido
    ]

    const filtered = applySectionFilter(mappings, sectionsWithoutRange)

    // Solo debería aplicar el filtro de la sección con rango válido
    expect(filtered[0].article_numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  test('Debería retornar array vacío si ningún artículo está en los rangos', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['150', '151', '152'] // Artículos fuera de todos los títulos mock
    }]

    const selectedSections = [createMockSections()[0]] // Título Preliminar (1-9)

    const filtered = applySectionFilter(mappings, selectedSections)

    expect(filtered).toHaveLength(0) // El mapping se filtra porque no tiene artículos en rango
  })
})

// ============================================
// TESTS: Integración con filtro de leyes
// ============================================
describe('Section Filter Integration with Law Filter', () => {
  test('Debería aplicar filtro de sección después de filtro de ley', () => {
    // Simular múltiples leyes
    const mappings = [
      {
        laws: { short_name: 'CE' },
        article_numbers: ['1', '2', '3', '14', '23', '56', '97']
      },
      {
        laws: { short_name: 'Ley 40/2015' },
        article_numbers: ['1', '2', '3', '4', '5']
      }
    ]

    // Primero filtrar por ley
    const selectedLaws = ['CE']
    const lawFilteredMappings = mappings.filter(m => selectedLaws.includes(m.laws.short_name))

    // Luego filtrar por sección
    const selectedSections = [createMockSections()[0]] // Título Preliminar (1-9)
    const sectionFilteredMappings = applySectionFilter(lawFilteredMappings, selectedSections)

    expect(sectionFilteredMappings).toHaveLength(1)
    expect(sectionFilteredMappings[0].laws.short_name).toBe('CE')
    expect(sectionFilteredMappings[0].article_numbers).toEqual(['1', '2', '3'])
  })

  test('El filtro de sección no debería afectar a otras leyes sin secciones definidas', () => {
    const mappings = [
      {
        laws: { short_name: 'CE' },
        article_numbers: ['1', '2', '14', '23']
      },
      {
        laws: { short_name: 'Ley 40/2015' },
        article_numbers: ['1', '2', '3'] // Mismos números pero diferente ley
      }
    ]

    // Aplicar filtro de sección (solo debería afectar artículos con números en rango)
    const selectedSections = [createMockSections()[0]] // Título Preliminar (1-9)
    const filtered = applySectionFilter(mappings, selectedSections)

    // CE: solo artículos 1, 2 (14 y 23 están fuera del rango)
    // Ley 40/2015: artículos 1, 2, 3 (todos en el rango numérico)
    expect(filtered).toHaveLength(2)
    expect(filtered[0].article_numbers).toEqual(['1', '2'])
    expect(filtered[1].article_numbers).toEqual(['1', '2', '3'])
  })
})

// ============================================
// TESTS: Edge cases y robustez
// ============================================
describe('Section Filter Edge Cases', () => {
  test('Debería manejar artículos como strings y números', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: [1, '2', 3, '4', 5] // Mezcla de tipos
    }]

    const selectedSections = [{
      articleRange: { start: 1, end: 3 }
    }]

    const filtered = applySectionFilter(mappings, selectedSections)

    // parseInt debería manejar ambos tipos
    expect(filtered[0].article_numbers.map(n => parseInt(n))).toEqual([1, 2, 3])
  })

  test('Debería manejar rangos con un solo artículo', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '4', '5']
    }]

    const selectedSections = [{
      articleRange: { start: 3, end: 3 } // Solo artículo 3
    }]

    const filtered = applySectionFilter(mappings, selectedSections)

    expect(filtered[0].article_numbers).toEqual(['3'])
  })

  test('Debería manejar rangos superpuestos', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
    }]

    const selectedSections = [
      { articleRange: { start: 1, end: 5 } },
      { articleRange: { start: 3, end: 8 } } // Se superpone con el anterior
    ]

    const filtered = applySectionFilter(mappings, selectedSections)

    // Debería incluir artículos del 1 al 8 sin duplicados
    expect(filtered[0].article_numbers).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
  })

  test('Debería preservar el orden original de artículos', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['9', '5', '3', '1', '7'] // Orden no secuencial
    }]

    const selectedSections = [{
      articleRange: { start: 1, end: 9 }
    }]

    const filtered = applySectionFilter(mappings, selectedSections)

    // Debería mantener el orden original
    expect(filtered[0].article_numbers).toEqual(['9', '5', '3', '1', '7'])
  })

  test('Debería manejar artículos con bis o ter', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '2bis', '3', '3ter', '4']
    }]

    const selectedSections = [{
      articleRange: { start: 1, end: 3 }
    }]

    const filtered = applySectionFilter(mappings, selectedSections)

    // parseInt('2bis') = 2, parseInt('3ter') = 3, deberían incluirse
    expect(filtered[0].article_numbers).toEqual(['1', '2', '2bis', '3', '3ter'])
    expect(filtered[0].article_numbers).not.toContain('4')
  })
})

// ============================================
// TESTS: Selección múltiple de secciones
// ============================================
describe('Multiple Section Selection', () => {
  test('Debería permitir seleccionar todos los títulos', () => {
    const mappings = createMockMappings()
    const allSections = createMockSections() // 5 títulos

    const filtered = applySectionFilter(mappings, allSections)

    // Debería incluir todos los artículos que están en algún título
    expect(filtered).toHaveLength(1)
    // Rango total: 1-107
    const articleNumbers = filtered[0].article_numbers.map(n => parseInt(n))
    expect(Math.min(...articleNumbers)).toBeGreaterThanOrEqual(1)
    expect(Math.max(...articleNumbers)).toBeLessThanOrEqual(107)
  })

  test('Debería manejar selección vacía tras deseleccionar todo', () => {
    const mappings = createMockMappings()
    const originalCount = mappings[0].article_numbers.length

    // Usuario seleccionó algo y luego deseleccionó todo
    const emptySelection = []

    const filtered = applySectionFilter(mappings, emptySelection)

    // Sin filtros, debería retornar todos los artículos
    expect(filtered[0].article_numbers.length).toBe(originalCount)
  })

  test('Debería calcular correctamente el conteo de artículos por sección', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
    }]

    // Selección: Solo Título Preliminar (1-9)
    const section1 = [{ articleRange: { start: 1, end: 9 } }]
    const filtered1 = applySectionFilter(mappings, section1)
    expect(filtered1[0].article_numbers.length).toBe(9)

    // Selección: Título I parcial (10-15)
    const section2 = [{ articleRange: { start: 10, end: 15 } }]
    const filtered2 = applySectionFilter(mappings, section2)
    expect(filtered2[0].article_numbers.length).toBe(6)

    // Selección: Ambos títulos
    const bothSections = [
      { articleRange: { start: 1, end: 9 } },
      { articleRange: { start: 10, end: 15 } }
    ]
    const filteredBoth = applySectionFilter(mappings, bothSections)
    expect(filteredBoth[0].article_numbers.length).toBe(15)
  })
})

// ============================================
// TESTS: Logging y debugging
// ============================================
describe('Section Filter Logging', () => {
  test('Debería generar descripción legible de los rangos filtrados', () => {
    const selectedSections = [
      { title: 'Título Preliminar', articleRange: { start: 1, end: 9 } },
      { title: 'Título II', articleRange: { start: 56, end: 65 } }
    ]

    const ranges = selectedSections
      .filter(s => s.articleRange)
      .map(s => ({ start: s.articleRange.start, end: s.articleRange.end, title: s.title }))

    const rangeDescriptions = ranges.map(r => `${r.title} (${r.start}-${r.end})`).join(', ')

    expect(rangeDescriptions).toBe('Título Preliminar (1-9), Título II (56-65)')
  })

  test('Debería reportar conteo de artículos antes y después del filtro', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '4', '5', '14', '23', '56', '97']
    }]

    const originalCount = mappings[0].article_numbers.length

    const selectedSections = [{ articleRange: { start: 1, end: 9 } }]
    const filtered = applySectionFilter(mappings, selectedSections)

    const filteredCount = filtered[0]?.article_numbers.length || 0

    const logMessage = `Ley CE: ${filteredCount}/${originalCount} artículos en rangos seleccionados`

    expect(logMessage).toBe('Ley CE: 5/9 artículos en rangos seleccionados')
  })
})

// ============================================
// TESTS: Simulación de flujo completo
// ============================================
describe('Section Filter Complete Flow Simulation', () => {
  test('Debería simular flujo completo: config -> URL -> parse -> filter -> questions', () => {
    // 1. Usuario selecciona sección en TestConfigurator
    const selectedSectionFilters = [createMockSections()[0]] // Título Preliminar

    // 2. Se serializa a URL
    const urlParam = JSON.stringify(selectedSectionFilters)
    expect(urlParam).toContain('Título Preliminar')

    // 3. Se parsea en test-personalizado/page.js
    const parsedFilters = JSON.parse(urlParam)
    expect(parsedFilters).toHaveLength(1)

    // 4. Se pasa a TestPageWrapper y luego a testFetchers
    const mappings = createMockMappings()
    const filteredMappings = applySectionFilter(mappings, parsedFilters)

    // 5. Se obtienen solo preguntas de artículos filtrados
    const allowedArticles = new Set(filteredMappings[0].article_numbers)
    const allQuestions = createMockQuestionsWithArticles()

    const filteredQuestions = allQuestions.filter(q =>
      q.law_short_name === 'CE' && allowedArticles.has(String(q.article_number))
    )

    // 6. Verificar resultado final
    expect(filteredQuestions.length).toBe(4) // q1, q2, q3, q4 (artículos 1, 2, 5, 9)
    expect(filteredQuestions.every(q => q.article_number >= 1 && q.article_number <= 9)).toBe(true)
    expect(filteredQuestions.every(q => q.law_short_name === 'CE')).toBe(true)
  })

  test('Debería simular usuario que selecciona y luego cambia de sección', () => {
    const mappings = createMockMappings()

    // Primera selección: Título I
    const firstSelection = [createMockSections()[1]]
    const firstFiltered = applySectionFilter(mappings, firstSelection)
    const firstArticleCount = firstFiltered[0].article_numbers.length

    // Cambio de selección: Título Preliminar
    const secondSelection = [createMockSections()[0]]
    const secondFiltered = applySectionFilter(mappings, secondSelection)
    const secondArticleCount = secondFiltered[0].article_numbers.length

    // Los resultados deberían ser diferentes
    expect(firstArticleCount).not.toBe(secondArticleCount)

    // El segundo debería tener los artículos del Título Preliminar
    expect(secondFiltered[0].article_numbers.every(n => parseInt(n) >= 1 && parseInt(n) <= 9)).toBe(true)
  })

  test('Debería mantener consistencia cuando se seleccionan las mismas secciones múltiples veces', () => {
    const mappings = createMockMappings()
    const selectedSections = [createMockSections()[0]]

    const result1 = applySectionFilter(mappings, selectedSections)
    const result2 = applySectionFilter(mappings, selectedSections)
    const result3 = applySectionFilter(mappings, selectedSections)

    expect(result1[0].article_numbers).toEqual(result2[0].article_numbers)
    expect(result2[0].article_numbers).toEqual(result3[0].article_numbers)
  })
})
