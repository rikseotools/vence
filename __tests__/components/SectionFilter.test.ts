/**
 * Tests para la lógica de LawArticlesClient.js
 * Cubre: filtro de secciones, detección de leyes virtuales,
 * extracción de YouTube URLs, parseo de artículos problemáticos
 */

// ============================================================
// Funciones extraídas de LawArticlesClient.js para testing
// ============================================================

function isVirtualLaw(law) {
  return law?.description?.toLowerCase().includes('ficticia') ||
         law?.description?.toLowerCase().includes('virtual')
}

function getYouTubeEmbedUrl(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

function filterArticlesBySections(articles, selectedSectionFilter) {
  if (!selectedSectionFilter || selectedSectionFilter.length === 0) {
    return articles
  }
  return articles.filter(article => {
    const articleNum = parseInt(article.article_number)
    return selectedSectionFilter.some(section => {
      if (!section.articleRange) return false
      return articleNum >= section.articleRange.start &&
             articleNum <= section.articleRange.end
    })
  })
}

function handleSectionSelect(sections) {
  return sections && sections.length > 0 ? sections : null
}

function getBadgeText(selectedSectionFilter) {
  if (!selectedSectionFilter || selectedSectionFilter.length === 0) return null
  if (selectedSectionFilter.length === 1) return selectedSectionFilter[0].title
  return `${selectedSectionFilter.length} títulos`
}

/**
 * Parsea artículos problemáticos desde un notification_id y URL params
 * Extraído de loadProblematicArticles en LawArticlesClient.js
 */
function parseProblematicArticles(notificationId, articlesParam, lawArticles) {
  if (!notificationId || !notificationId.startsWith('problematic-law-')) return []

  let problematicArticleNumbers = []

  if (articlesParam) {
    problematicArticleNumbers = articlesParam.split(',').map(num => num.trim())
  } else {
    const parts = notificationId.replace('problematic-law-', '').split('-')
    const numbers = notificationId.match(/\d+/g)

    const articlesIndex = parts.indexOf('articles')
    if (articlesIndex !== -1 && parts[articlesIndex + 1]) {
      const articlesPart = parts.slice(articlesIndex + 1).join('-')
      problematicArticleNumbers = articlesPart.split(',').map(num => num.trim())
    } else if (numbers && numbers.length > 0) {
      const articleMatch = notificationId.match(/(?:Art\.?\s*|article[s]?[-_]?)(\d+)/i)
      if (articleMatch) {
        problematicArticleNumbers = [articleMatch[1]]
      } else {
        const filteredNumbers = numbers.filter(num => {
          const num_int = parseInt(num)
          return num_int < 1000 && num_int > 0
        })
        if (filteredNumbers.length > 1 && filteredNumbers[filteredNumbers.length - 1] === '1') {
          problematicArticleNumbers = filteredNumbers.slice(0, -1)
        } else {
          problematicArticleNumbers = filteredNumbers
        }
      }
    }
  }

  if (problematicArticleNumbers.length > 0 && lawArticles) {
    const existingArticles = problematicArticleNumbers.filter(articleNum =>
      lawArticles.some(article => article.article_number === articleNum)
    )
    return existingArticles.sort((a, b) => parseInt(a) - parseInt(b))
  }

  return problematicArticleNumbers
}

// ============================================================
// Datos de prueba
// ============================================================

const mockArticles = [
  { article_number: '1', title: 'Objeto de la Ley' },
  { article_number: '2', title: 'Ámbito subjetivo' },
  { article_number: '3', title: 'Capacidad de obrar' },
  { article_number: '13', title: 'Derechos de las personas' },
  { article_number: '14', title: 'Derecho y obligación de relacionarse' },
  { article_number: '28', title: 'Obligación de resolver' },
  { article_number: '53', title: 'Forma de los actos' },
  { article_number: '54', title: 'Motivación' },
  { article_number: '77', title: 'Medios de prueba' },
  { article_number: '100', title: 'Recurso de alzada' },
  { article_number: '112', title: 'Recurso extraordinario de revisión' },
  { article_number: '128', title: 'Potestad reglamentaria' },
  { article_number: '133', title: 'Participación ciudadana' },
]

const mockSections = {
  preliminar: {
    id: 'sec-1',
    title: 'Título Preliminar',
    description: 'Disposiciones generales',
    articleRange: { start: 1, end: 3 }
  },
  titulo1: {
    id: 'sec-2',
    title: 'Título I - De los interesados',
    description: 'Interesados en el procedimiento',
    articleRange: { start: 4, end: 12 }
  },
  titulo2: {
    id: 'sec-3',
    title: 'Título II - Actividad de las AAPP',
    description: 'Actividad administrativa',
    articleRange: { start: 13, end: 33 }
  },
  titulo4: {
    id: 'sec-5',
    title: 'Título IV - Disposiciones sobre procedimiento',
    description: 'Procedimiento administrativo común',
    articleRange: { start: 53, end: 95 }
  },
  titulo5: {
    id: 'sec-6',
    title: 'Título V - Revisión de actos',
    description: 'Revisión de los actos en vía administrativa',
    articleRange: { start: 96, end: 126 }
  },
  titulo6: {
    id: 'sec-7',
    title: 'Título VI - Iniciativa legislativa',
    description: 'Iniciativa legislativa y potestad reglamentaria',
    articleRange: { start: 127, end: 133 }
  },
  sinRango: {
    id: 'sec-8',
    title: 'Disposiciones Adicionales',
    description: 'Sin rango de artículos',
    articleRange: null
  }
}

// ============================================================
// Tests
// ============================================================

describe('isVirtualLaw - Detección de leyes virtuales', () => {
  test('detecta ley con descripción "ficticia"', () => {
    expect(isVirtualLaw({ description: 'Esta es una ley ficticia para prácticas' })).toBe(true)
  })

  test('detecta ley con descripción "virtual"', () => {
    expect(isVirtualLaw({ description: 'Ley virtual de prueba' })).toBe(true)
  })

  test('no detecta ley real', () => {
    expect(isVirtualLaw({ description: 'Ley del Procedimiento Administrativo Común' })).toBe(false)
  })

  test('devuelve falsy para ley sin descripción', () => {
    expect(isVirtualLaw({ description: null })).toBeFalsy()
    expect(isVirtualLaw({})).toBeFalsy()
  })

  test('devuelve falsy para null/undefined', () => {
    expect(isVirtualLaw(null)).toBeFalsy()
    expect(isVirtualLaw(undefined)).toBeFalsy()
  })

  test('es case-insensitive', () => {
    expect(isVirtualLaw({ description: 'LEY FICTICIA' })).toBe(true)
    expect(isVirtualLaw({ description: 'Contenido VIRTUAL' })).toBe(true)
  })
})

describe('getYouTubeEmbedUrl - Extracción de URLs de YouTube', () => {
  test('extrae ID de youtube.com/watch?v=', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=RuYQ8EqwV4U'))
      .toBe('https://www.youtube.com/embed/RuYQ8EqwV4U')
  })

  test('extrae ID de youtu.be/', () => {
    expect(getYouTubeEmbedUrl('https://youtu.be/RuYQ8EqwV4U'))
      .toBe('https://www.youtube.com/embed/RuYQ8EqwV4U')
  })

  test('extrae ID con parámetros adicionales', () => {
    expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=abc123_-X&t=30'))
      .toBe('https://www.youtube.com/embed/abc123_-X')
  })

  test('devuelve null para URL no YouTube', () => {
    expect(getYouTubeEmbedUrl('https://vimeo.com/123456')).toBeNull()
  })

  test('devuelve null para null/undefined/vacío', () => {
    expect(getYouTubeEmbedUrl(null)).toBeNull()
    expect(getYouTubeEmbedUrl(undefined)).toBeNull()
    expect(getYouTubeEmbedUrl('')).toBeNull()
  })

  test('funciona con http (sin s)', () => {
    expect(getYouTubeEmbedUrl('http://www.youtube.com/watch?v=test123'))
      .toBe('https://www.youtube.com/embed/test123')
  })
})

describe('filterArticlesBySections - Filtrado de artículos', () => {
  describe('Sin filtro activo', () => {
    test('null devuelve todos los artículos', () => {
      expect(filterArticlesBySections(mockArticles, null)).toEqual(mockArticles)
    })

    test('array vacío devuelve todos los artículos', () => {
      expect(filterArticlesBySections(mockArticles, [])).toEqual(mockArticles)
    })

    test('undefined devuelve todos los artículos', () => {
      expect(filterArticlesBySections(mockArticles, undefined)).toEqual(mockArticles)
    })
  })

  describe('Selección única', () => {
    test('Título Preliminar (arts 1-3) devuelve 3 artículos', () => {
      const result = filterArticlesBySections(mockArticles, [mockSections.preliminar])
      expect(result.map(a => a.article_number)).toEqual(['1', '2', '3'])
    })

    test('Título II (arts 13-33) devuelve arts 13, 14 y 28', () => {
      const result = filterArticlesBySections(mockArticles, [mockSections.titulo2])
      expect(result.map(a => a.article_number)).toEqual(['13', '14', '28'])
    })

    test('Título V (arts 96-126) devuelve arts 100 y 112', () => {
      const result = filterArticlesBySections(mockArticles, [mockSections.titulo5])
      expect(result.map(a => a.article_number)).toEqual(['100', '112'])
    })

    test('Título VI (arts 127-133) devuelve arts 128 y 133', () => {
      const result = filterArticlesBySections(mockArticles, [mockSections.titulo6])
      expect(result.map(a => a.article_number)).toEqual(['128', '133'])
    })

    test('sección sin artículos coincidentes devuelve vacío', () => {
      const result = filterArticlesBySections(mockArticles, [mockSections.titulo1])
      expect(result).toHaveLength(0)
    })
  })

  describe('Multi-selección', () => {
    test('Preliminar + Título II combina correctamente', () => {
      const result = filterArticlesBySections(mockArticles, [
        mockSections.preliminar,
        mockSections.titulo2
      ])
      expect(result.map(a => a.article_number)).toEqual(['1', '2', '3', '13', '14', '28'])
    })

    test('Título IV + V + VI devuelve 7 artículos', () => {
      const result = filterArticlesBySections(mockArticles, [
        mockSections.titulo4,
        mockSections.titulo5,
        mockSections.titulo6
      ])
      expect(result.map(a => a.article_number)).toEqual(['53', '54', '77', '100', '112', '128', '133'])
    })

    test('todas las secciones con rango devuelve todos los artículos', () => {
      const allWithRange = Object.values(mockSections).filter(s => s.articleRange)
      const result = filterArticlesBySections(mockArticles, allWithRange)
      expect(result).toHaveLength(13)
    })

    test('secciones duplicadas no duplican artículos', () => {
      const result = filterArticlesBySections(mockArticles, [
        mockSections.preliminar,
        mockSections.preliminar
      ])
      expect(result).toHaveLength(3)
    })
  })

  describe('Secciones sin rango', () => {
    test('sección sin articleRange no incluye artículos', () => {
      expect(filterArticlesBySections(mockArticles, [mockSections.sinRango])).toHaveLength(0)
    })

    test('sección sin rango + sección con rango funciona', () => {
      const result = filterArticlesBySections(mockArticles, [
        mockSections.sinRango,
        mockSections.preliminar
      ])
      expect(result.map(a => a.article_number)).toEqual(['1', '2', '3'])
    })
  })

  describe('Límites de rango', () => {
    test('incluye artículo exactamente en inicio del rango', () => {
      const section = { id: 'x', title: 'Test', articleRange: { start: 53, end: 60 } }
      expect(filterArticlesBySections(mockArticles, [section]).map(a => a.article_number)).toContain('53')
    })

    test('incluye artículo exactamente en final del rango', () => {
      const section = { id: 'x', title: 'Test', articleRange: { start: 50, end: 54 } }
      expect(filterArticlesBySections(mockArticles, [section]).map(a => a.article_number)).toContain('54')
    })

    test('rango de un solo artículo funciona', () => {
      const section = { id: 'x', title: 'Test', articleRange: { start: 77, end: 77 } }
      const result = filterArticlesBySections(mockArticles, [section])
      expect(result).toHaveLength(1)
      expect(result[0].article_number).toBe('77')
    })

    test('lista vacía de artículos devuelve vacío', () => {
      expect(filterArticlesBySections([], [mockSections.preliminar])).toHaveLength(0)
    })
  })
})

describe('handleSectionSelect - Handler del modal', () => {
  test('array con secciones devuelve el array', () => {
    const sections = [mockSections.preliminar, mockSections.titulo2]
    expect(handleSectionSelect(sections)).toEqual(sections)
  })

  test('array de un elemento devuelve el array', () => {
    expect(handleSectionSelect([mockSections.preliminar])).toEqual([mockSections.preliminar])
  })

  test('array vacío devuelve null', () => {
    expect(handleSectionSelect([])).toBeNull()
  })

  test('null devuelve null', () => {
    expect(handleSectionSelect(null)).toBeNull()
  })

  test('undefined devuelve null', () => {
    expect(handleSectionSelect(undefined)).toBeNull()
  })
})

describe('getBadgeText - Texto del badge', () => {
  test('null → null (sin badge)', () => {
    expect(getBadgeText(null)).toBeNull()
  })

  test('array vacío → null', () => {
    expect(getBadgeText([])).toBeNull()
  })

  test('1 sección → muestra el título', () => {
    expect(getBadgeText([mockSections.preliminar])).toBe('Título Preliminar')
  })

  test('2 secciones → "2 títulos"', () => {
    expect(getBadgeText([mockSections.preliminar, mockSections.titulo2])).toBe('2 títulos')
  })

  test('5 secciones → "5 títulos"', () => {
    const five = Object.values(mockSections).slice(0, 5)
    expect(getBadgeText(five)).toBe('5 títulos')
  })
})

describe('parseProblematicArticles - Parseo de artículos problemáticos', () => {
  const lawArticles = [
    { article_number: '1' }, { article_number: '2' }, { article_number: '3' },
    { article_number: '10' }, { article_number: '15' }, { article_number: '20' },
    { article_number: '61' }, { article_number: '62' }, { article_number: '63' },
    { article_number: '100' }, { article_number: '128' },
  ]

  describe('Desde URL param ?articles=', () => {
    test('parsea artículos separados por coma', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015',
        '61,62,63',
        lawArticles
      )
      expect(result).toEqual(['61', '62', '63'])
    })

    test('parsea un solo artículo', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015',
        '100',
        lawArticles
      )
      expect(result).toEqual(['100'])
    })

    test('filtra artículos que no existen en la ley', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015',
        '61,999,62',
        lawArticles
      )
      expect(result).toEqual(['61', '62'])
    })

    test('ordena numéricamente', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015',
        '128,3,61',
        lawArticles
      )
      expect(result).toEqual(['3', '61', '128'])
    })
  })

  describe('Desde notification_id formato nuevo (articles-X,Y,Z)', () => {
    test('parsea formato problematic-law-LAW-articles-61,62,63', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015-articles-61,62,63',
        null,
        lawArticles
      )
      expect(result).toEqual(['61', '62', '63'])
    })
  })

  describe('Desde notification_id formato con números', () => {
    test('filtra años (>= 1000) y valores <= 0', () => {
      const result = parseProblematicArticles(
        'problematic-law-Ley-39-2015-10',
        null,
        lawArticles
      )
      // Números: 39, 2015, 10 → filtrados: 39 (<1000), 10 (<1000) → excluye 2015
      expect(result).not.toContain('2015')
    })
  })

  describe('Casos edge', () => {
    test('notification_id sin prefijo correcto devuelve vacío', () => {
      expect(parseProblematicArticles('other-notification', null, lawArticles)).toEqual([])
    })

    test('null notification_id devuelve vacío', () => {
      expect(parseProblematicArticles(null, null, lawArticles)).toEqual([])
    })

    test('sin lawArticles devuelve los números sin filtrar', () => {
      const result = parseProblematicArticles(
        'problematic-law-test',
        '1,2,3',
        null
      )
      expect(result).toEqual(['1', '2', '3'])
    })
  })
})

describe('Regresión: bug original del filtro (objeto en vez de array)', () => {
  test('pasar un objeto individual (formato antiguo roto) lanza error', () => {
    // Antes del fix: selectedSectionFilter era un objeto, no array
    // El nuevo código llama .some() que no existe en objetos
    const singleObject = mockSections.preliminar
    expect(() => filterArticlesBySections(mockArticles, singleObject)).toThrow()
  })

  test('pasar array de un elemento (formato correcto) funciona', () => {
    const result = filterArticlesBySections(mockArticles, [mockSections.preliminar])
    expect(result).toHaveLength(3)
  })
})
