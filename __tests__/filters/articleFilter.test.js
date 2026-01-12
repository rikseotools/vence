// __tests__/filters/articleFilter.test.js
// Tests unitarios para el filtro de artículos por ley

import { jest } from '@jest/globals'

// Helper: Crear mock de mappings (topic_scope)
const createMockMappings = () => [
  {
    laws: { short_name: 'CE', id: 'ce-id', name: 'Constitución Española' },
    article_numbers: ['1', '2', '3', '14', '23', '27', '53', '103', '169']
  },
  {
    laws: { short_name: 'Ley 40/2015', id: 'ley40-id', name: 'Ley de Régimen Jurídico' },
    article_numbers: ['1', '2', '3', '4', '5', '25', '30', '40']
  },
  {
    laws: { short_name: 'Ley 39/2015', id: 'ley39-id', name: 'Procedimiento Administrativo' },
    article_numbers: ['1', '2', '10', '20', '30', '40', '50']
  }
]

// Helper: Crear mock de preguntas
const createMockQuestions = () => [
  { id: 'q1', law_short_name: 'CE', article_number: '1', question_text: 'Pregunta CE Art. 1' },
  { id: 'q2', law_short_name: 'CE', article_number: '14', question_text: 'Pregunta CE Art. 14' },
  { id: 'q3', law_short_name: 'CE', article_number: '103', question_text: 'Pregunta CE Art. 103' },
  { id: 'q4', law_short_name: 'Ley 40/2015', article_number: '1', question_text: 'Pregunta Ley40 Art. 1' },
  { id: 'q5', law_short_name: 'Ley 40/2015', article_number: '25', question_text: 'Pregunta Ley40 Art. 25' },
  { id: 'q6', law_short_name: 'Ley 39/2015', article_number: '10', question_text: 'Pregunta Ley39 Art. 10' },
  { id: 'q7', law_short_name: 'Ley 39/2015', article_number: '50', question_text: 'Pregunta Ley39 Art. 50' },
]

// ============================================
// FUNCIÓN DE FILTRADO POR LEYES (extraída del código real)
// ============================================
const applyLawFilter = (mappings, selectedLaws) => {
  if (!selectedLaws || selectedLaws.length === 0) {
    return mappings
  }
  return mappings.filter(m => selectedLaws.includes(m.laws.short_name))
}

// ============================================
// FUNCIÓN DE FILTRADO POR ARTÍCULOS (extraída del código real)
// ============================================
const applyArticleFilter = (mappings, selectedArticlesByLaw) => {
  if (!selectedArticlesByLaw || Object.keys(selectedArticlesByLaw).length === 0) {
    return mappings
  }

  return mappings.map(mapping => {
    const lawShortName = mapping.laws.short_name
    const selectedArticles = selectedArticlesByLaw[lawShortName]

    if (selectedArticles && selectedArticles.length > 0) {
      // Convertir a strings para comparación consistente
      const selectedArticlesAsStrings = selectedArticles.map(num => String(num))
      const filteredArticleNumbers = mapping.article_numbers.filter(articleNum =>
        selectedArticlesAsStrings.includes(String(articleNum))
      )

      return {
        ...mapping,
        article_numbers: filteredArticleNumbers
      }
    }

    return mapping
  }).filter(m => m.article_numbers.length > 0)
}

// ============================================
// TESTS: Parseo de filtros desde URL
// ============================================
describe('Article Filter URL Parsing', () => {
  test('Debería parsear correctamente selectedLaws desde URL', () => {
    const urlParam = '["CE","Ley 40/2015"]'
    const parsed = JSON.parse(urlParam)

    expect(parsed).toHaveLength(2)
    expect(parsed).toContain('CE')
    expect(parsed).toContain('Ley 40/2015')
  })

  test('Debería parsear correctamente selectedArticlesByLaw desde URL', () => {
    const urlParam = '{"CE":["1","14","103"],"Ley 40/2015":["25","30"]}'
    const parsed = JSON.parse(urlParam)

    expect(Object.keys(parsed)).toHaveLength(2)
    expect(parsed['CE']).toEqual(['1', '14', '103'])
    expect(parsed['Ley 40/2015']).toEqual(['25', '30'])
  })

  test('Debería manejar URL params vacíos', () => {
    expect(JSON.parse('[]')).toEqual([])
    expect(JSON.parse('{}')).toEqual({})
  })

  test('Debería manejar JSON malformado gracefully', () => {
    let result = []
    try {
      result = JSON.parse('[invalid')
    } catch (error) {
      result = []
    }
    expect(result).toEqual([])
  })

  test('Debería parsear artículos como números o strings', () => {
    // A veces llegan como números desde el frontend
    const urlParamNumbers = '{"CE":[1,14,103]}'
    const urlParamStrings = '{"CE":["1","14","103"]}'

    const parsedNumbers = JSON.parse(urlParamNumbers)
    const parsedStrings = JSON.parse(urlParamStrings)

    // Ambos deberían funcionar al convertir a strings
    expect(parsedNumbers['CE'].map(String)).toEqual(['1', '14', '103'])
    expect(parsedStrings['CE']).toEqual(['1', '14', '103'])
  })
})

// ============================================
// TESTS: Filtro por leyes seleccionadas
// ============================================
describe('Law Filter Logic', () => {
  test('Debería filtrar solo las leyes seleccionadas', () => {
    const mappings = createMockMappings()
    const selectedLaws = ['CE']

    const filtered = applyLawFilter(mappings, selectedLaws)

    expect(filtered).toHaveLength(1)
    expect(filtered[0].laws.short_name).toBe('CE')
  })

  test('Debería permitir seleccionar múltiples leyes', () => {
    const mappings = createMockMappings()
    const selectedLaws = ['CE', 'Ley 39/2015']

    const filtered = applyLawFilter(mappings, selectedLaws)

    expect(filtered).toHaveLength(2)
    expect(filtered.map(m => m.laws.short_name)).toEqual(['CE', 'Ley 39/2015'])
  })

  test('Debería retornar todas las leyes si no hay filtro', () => {
    const mappings = createMockMappings()

    const filtered1 = applyLawFilter(mappings, [])
    const filtered2 = applyLawFilter(mappings, null)
    const filtered3 = applyLawFilter(mappings, undefined)

    expect(filtered1).toHaveLength(3)
    expect(filtered2).toHaveLength(3)
    expect(filtered3).toHaveLength(3)
  })

  test('Debería manejar ley no existente gracefully', () => {
    const mappings = createMockMappings()
    const selectedLaws = ['Ley Inexistente']

    const filtered = applyLawFilter(mappings, selectedLaws)

    expect(filtered).toHaveLength(0)
  })

  test('Debería mantener el orden original de las leyes', () => {
    const mappings = createMockMappings()
    const selectedLaws = ['Ley 39/2015', 'CE'] // Orden inverso

    const filtered = applyLawFilter(mappings, selectedLaws)

    // El filtro mantiene el orden del array original (mappings), no de selectedLaws
    expect(filtered[0].laws.short_name).toBe('CE')
    expect(filtered[1].laws.short_name).toBe('Ley 39/2015')
  })
})

// ============================================
// TESTS: Filtro por artículos específicos
// ============================================
describe('Article Filter Logic', () => {
  test('Debería filtrar artículos específicos de una ley', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'CE': ['1', '14']
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // CE debería tener solo 2 artículos
    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')
    expect(ceMaping.article_numbers).toEqual(['1', '14'])

    // Las otras leyes no deberían verse afectadas
    const ley40Mapping = filtered.find(m => m.laws.short_name === 'Ley 40/2015')
    expect(ley40Mapping.article_numbers.length).toBe(8) // Todos sus artículos
  })

  test('Debería filtrar artículos de múltiples leyes', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'CE': ['1', '103'],
      'Ley 40/2015': ['25', '30']
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')
    const ley40Mapping = filtered.find(m => m.laws.short_name === 'Ley 40/2015')

    expect(ceMaping.article_numbers).toEqual(['1', '103'])
    expect(ley40Mapping.article_numbers).toEqual(['25', '30'])
  })

  test('Debería manejar artículos como números y strings', () => {
    const mappings = createMockMappings()

    // Artículos como números (desde frontend)
    const selectedArticlesByLaw = {
      'CE': [1, 14, 103] // Números, no strings
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)
    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')

    expect(ceMaping.article_numbers).toEqual(['1', '14', '103'])
  })

  test('Debería retornar todos los artículos si no hay filtro', () => {
    const mappings = createMockMappings()
    const originalCeCount = mappings[0].article_numbers.length

    const filtered1 = applyArticleFilter(mappings, {})
    const filtered2 = applyArticleFilter(mappings, null)
    const filtered3 = applyArticleFilter(mappings, undefined)

    expect(filtered1[0].article_numbers.length).toBe(originalCeCount)
    expect(filtered2[0].article_numbers.length).toBe(originalCeCount)
    expect(filtered3[0].article_numbers.length).toBe(originalCeCount)
  })

  test('Debería eliminar mapping si no tiene artículos válidos', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'CE': ['999'] // Artículo que no existe
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // CE debería ser eliminado porque no tiene artículos válidos
    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')
    expect(ceMaping).toBeUndefined()

    // Las otras leyes siguen intactas
    expect(filtered).toHaveLength(2)
  })

  test('Debería manejar artículos con formatos especiales (bis, ter)', () => {
    const mappings = [{
      laws: { short_name: 'Ley X' },
      article_numbers: ['1', '2', '2bis', '3', '3ter', '4']
    }]

    const selectedArticlesByLaw = {
      'Ley X': ['2', '2bis', '3ter']
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    expect(filtered[0].article_numbers).toEqual(['2', '2bis', '3ter'])
  })
})

// ============================================
// TESTS: Combinación de filtros (Ley + Artículo)
// ============================================
describe('Combined Law and Article Filters', () => {
  test('Debería aplicar filtro de ley primero, luego filtro de artículos', () => {
    const mappings = createMockMappings()

    // Paso 1: Filtrar por ley
    const selectedLaws = ['CE', 'Ley 40/2015']
    const lawFiltered = applyLawFilter(mappings, selectedLaws)

    expect(lawFiltered).toHaveLength(2)

    // Paso 2: Filtrar por artículos
    const selectedArticlesByLaw = {
      'CE': ['1', '14'],
      'Ley 40/2015': ['25']
    }
    const articleFiltered = applyArticleFilter(lawFiltered, selectedArticlesByLaw)

    expect(articleFiltered).toHaveLength(2)
    expect(articleFiltered[0].article_numbers).toEqual(['1', '14'])
    expect(articleFiltered[1].article_numbers).toEqual(['25'])
  })

  test('Debería manejar caso donde ley está en filtro pero sin artículos específicos', () => {
    const mappings = createMockMappings()

    const selectedLaws = ['CE', 'Ley 40/2015']
    const lawFiltered = applyLawFilter(mappings, selectedLaws)

    // Solo especificamos artículos para CE, no para Ley 40/2015
    const selectedArticlesByLaw = {
      'CE': ['1']
    }
    const articleFiltered = applyArticleFilter(lawFiltered, selectedArticlesByLaw)

    // CE: solo artículo 1
    // Ley 40/2015: todos sus artículos (sin filtro específico)
    expect(articleFiltered[0].article_numbers).toEqual(['1'])
    expect(articleFiltered[1].article_numbers.length).toBe(8)
  })
})

// ============================================
// TESTS: Edge cases y robustez
// ============================================
describe('Article Filter Edge Cases', () => {
  test('Debería manejar array vacío de artículos seleccionados', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'CE': [] // Array vacío = sin filtro específico para esta ley
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // Con array vacío, la ley mantiene TODOS sus artículos (sin filtro)
    // Este es el comportamiento esperado: seleccionar ley sin artículos = ver todos
    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')
    expect(ceMaping).toBeDefined()
    expect(ceMaping.article_numbers.length).toBe(9) // Todos los artículos de CE
  })

  test('Debería manejar ley en filtro que no existe en mappings', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'Ley Fantasma': ['1', '2', '3']
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // No debería afectar a ninguna ley existente
    expect(filtered).toHaveLength(3)
    expect(filtered[0].article_numbers.length).toBe(9) // CE intacta
  })

  test('Debería manejar duplicados en artículos seleccionados', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = {
      'CE': ['1', '1', '14', '14', '14'] // Duplicados
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)
    const ceMaping = filtered.find(m => m.laws.short_name === 'CE')

    // Debería retornar sin duplicados (porque filtra del original)
    expect(ceMaping.article_numbers).toEqual(['1', '14'])
  })

  test('Debería preservar estructura del mapping original', () => {
    const mappings = [{
      laws: { short_name: 'CE', id: 'ce-id', name: 'Constitución Española', extra_field: 'value' },
      article_numbers: ['1', '2', '3'],
      topics: { topic_number: 1 }
    }]

    const selectedArticlesByLaw = { 'CE': ['1'] }
    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    expect(filtered[0].laws.extra_field).toBe('value')
    expect(filtered[0].topics.topic_number).toBe(1)
  })

  test('Debería manejar artículos con espacios o caracteres especiales', () => {
    const mappings = [{
      laws: { short_name: 'Ley X' },
      article_numbers: ['1', ' 2 ', '3.1', '4-A']
    }]

    const selectedArticlesByLaw = {
      'Ley X': [' 2 ', '3.1'] // Incluyendo espacios
    }

    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)

    expect(filtered[0].article_numbers).toEqual([' 2 ', '3.1'])
  })
})

// ============================================
// TESTS: Rendimiento y consistencia
// ============================================
describe('Article Filter Performance and Consistency', () => {
  test('Debería manejar muchos artículos eficientemente', () => {
    // Simular ley con 200 artículos
    const manyArticles = Array.from({ length: 200 }, (_, i) => String(i + 1))
    const mappings = [{
      laws: { short_name: 'Ley Grande' },
      article_numbers: manyArticles
    }]

    // Seleccionar artículos pares
    const evenArticles = manyArticles.filter((_, i) => i % 2 === 0)
    const selectedArticlesByLaw = {
      'Ley Grande': evenArticles
    }

    const startTime = Date.now()
    const filtered = applyArticleFilter(mappings, selectedArticlesByLaw)
    const endTime = Date.now()

    expect(filtered[0].article_numbers.length).toBe(100)
    expect(endTime - startTime).toBeLessThan(100) // Menos de 100ms
  })

  test('Debería retornar resultados consistentes en múltiples llamadas', () => {
    const mappings = createMockMappings()
    const selectedArticlesByLaw = { 'CE': ['1', '14'] }

    const result1 = applyArticleFilter(mappings, selectedArticlesByLaw)
    const result2 = applyArticleFilter(mappings, selectedArticlesByLaw)
    const result3 = applyArticleFilter(mappings, selectedArticlesByLaw)

    expect(result1[0].article_numbers).toEqual(result2[0].article_numbers)
    expect(result2[0].article_numbers).toEqual(result3[0].article_numbers)
  })

  test('No debería mutar el array original', () => {
    const mappings = createMockMappings()
    const originalCeArticles = [...mappings[0].article_numbers]

    const selectedArticlesByLaw = { 'CE': ['1'] }
    applyArticleFilter(mappings, selectedArticlesByLaw)

    // El original no debería haber cambiado
    expect(mappings[0].article_numbers).toEqual(originalCeArticles)
  })
})

// ============================================
// TESTS: Integración con filtro de secciones
// ============================================
describe('Article Filter Integration with Section Filter', () => {
  // Función de filtrado de secciones (del otro test file)
  const applySectionFilter = (mappings, selectedSectionFilters) => {
    if (!selectedSectionFilters || selectedSectionFilters.length === 0) {
      return mappings
    }

    const ranges = selectedSectionFilters
      .filter(s => s.articleRange)
      .map(s => ({ start: s.articleRange.start, end: s.articleRange.end }))

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

  test('Debería aplicar ambos filtros en secuencia correcta', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '14', '23', '56', '97', '103']
    }]

    // Paso 1: Filtro de artículos específicos
    const selectedArticlesByLaw = {
      'CE': ['1', '2', '3', '14', '56', '103']
    }
    const articleFiltered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // Paso 2: Filtro de sección (Título Preliminar: 1-9)
    const selectedSectionFilters = [{
      articleRange: { start: 1, end: 9 }
    }]
    const sectionFiltered = applySectionFilter(articleFiltered, selectedSectionFilters)

    // Solo deberían quedar artículos 1, 2, 3 (están en ambos filtros)
    expect(sectionFiltered[0].article_numbers).toEqual(['1', '2', '3'])
  })

  test('Debería manejar caso donde filtros no se superponen', () => {
    const mappings = [{
      laws: { short_name: 'CE' },
      article_numbers: ['1', '2', '3', '14', '23', '56', '97', '103']
    }]

    // Artículos seleccionados: solo del Título IV (97-107)
    const selectedArticlesByLaw = {
      'CE': ['97', '103']
    }
    const articleFiltered = applyArticleFilter(mappings, selectedArticlesByLaw)

    // Sección seleccionada: Título Preliminar (1-9) - no se superpone
    const selectedSectionFilters = [{
      articleRange: { start: 1, end: 9 }
    }]
    const sectionFiltered = applySectionFilter(articleFiltered, selectedSectionFilters)

    // No debería quedar ningún artículo
    expect(sectionFiltered).toHaveLength(0)
  })
})

// ============================================
// TESTS: Simulación de flujo completo
// ============================================
describe('Article Filter Complete Flow Simulation', () => {
  test('Debería simular flujo completo: config -> URL -> parse -> filter', () => {
    // 1. Usuario selecciona en TestConfigurator
    const config = {
      selectedLaws: ['CE', 'Ley 40/2015'],
      selectedArticlesByLaw: {
        'CE': [1, 14, 103], // Como números
        'Ley 40/2015': ['25', '30'] // Como strings
      }
    }

    // 2. Se serializa a URL
    const lawsParam = JSON.stringify(config.selectedLaws)
    const articlesParam = JSON.stringify(config.selectedArticlesByLaw)

    expect(lawsParam).toBe('["CE","Ley 40/2015"]')

    // 3. Se parsea en page.js
    const parsedLaws = JSON.parse(lawsParam)
    const parsedArticles = JSON.parse(articlesParam)

    // 4. Se aplican filtros
    const mappings = createMockMappings()
    const lawFiltered = applyLawFilter(mappings, parsedLaws)
    const articleFiltered = applyArticleFilter(lawFiltered, parsedArticles)

    // 5. Verificar resultado
    expect(articleFiltered).toHaveLength(2)

    const ceMapping = articleFiltered.find(m => m.laws.short_name === 'CE')
    const ley40Mapping = articleFiltered.find(m => m.laws.short_name === 'Ley 40/2015')

    expect(ceMapping.article_numbers).toEqual(['1', '14', '103'])
    expect(ley40Mapping.article_numbers).toEqual(['25', '30'])
  })

  test('Debería simular cambio de selección de artículos', () => {
    const mappings = createMockMappings()
    const selectedLaws = ['CE']
    const lawFiltered = applyLawFilter(mappings, selectedLaws)

    // Primera selección
    const firstSelection = { 'CE': ['1', '2'] }
    const firstFiltered = applyArticleFilter(lawFiltered, firstSelection)
    expect(firstFiltered[0].article_numbers).toEqual(['1', '2'])

    // Cambio de selección
    const secondSelection = { 'CE': ['14', '103'] }
    const secondFiltered = applyArticleFilter(lawFiltered, secondSelection)
    expect(secondFiltered[0].article_numbers).toEqual(['14', '103'])

    // Las selecciones son independientes
    expect(firstFiltered[0].article_numbers).not.toEqual(secondFiltered[0].article_numbers)
  })
})
