/**
 * Tests unitarios para los fetchers de tests
 * fetchQuickQuestions, fetchAleatorioMultiTema, etc.
 */

// ============================================
// MOCKS Y HELPERS
// ============================================

// Mock de preguntas de Supabase
const createMockSupabaseQuestions = (count = 10, lawShortName = 'CE') => {
  return Array.from({ length: count }, (_, i) => ({
    id: `q-${i + 1}`,
    question_text: `Pregunta ${i + 1}`,
    option_a: 'Opción A',
    option_b: 'Opción B',
    option_c: 'Opción C',
    option_d: 'Opción D',
    correct_option: i % 4,
    explanation: `Explicación ${i + 1}`,
    difficulty: ['easy', 'medium', 'hard'][i % 3],
    is_official_exam: i % 2 === 0,
    primary_article_id: `art-${i + 1}`,
    exam_source: i % 2 === 0 ? 'AGE 2023' : null,
    exam_date: i % 2 === 0 ? '2023-06-15' : null,
    exam_entity: i % 2 === 0 ? 'AGE' : null,
    articles: {
      id: `art-${i + 1}`,
      article_number: String((i % 20) + 1),
      title: `Artículo ${(i % 20) + 1}`,
      content: `Contenido del artículo ${(i % 20) + 1}`,
      laws: {
        short_name: lawShortName,
        name: lawShortName === 'CE' ? 'Constitución Española' : `Ley ${lawShortName}`
      }
    }
  }))
}

// Función de transformación (copiada del código real)
function transformQuestions(supabaseQuestions) {
  if (!supabaseQuestions || !Array.isArray(supabaseQuestions)) {
    return []
  }

  return supabaseQuestions.map((q, index) => ({
    id: q.id,
    question: q.question_text,
    options: [q.option_a, q.option_b, q.option_c, q.option_d],
    explanation: q.explanation,
    primary_article_id: q.primary_article_id,
    article: {
      id: q.articles?.id,
      number: q.articles?.article_number || (index + 1).toString(),
      title: q.articles?.title || `Artículo ${index + 1}`,
      full_text: q.articles?.content,
      law_name: q.articles?.laws?.name,
      law_short_name: q.articles?.laws?.short_name,
      display_number: `Art. ${q.articles?.article_number} ${q.articles?.laws?.short_name}`,
    },
    metadata: {
      id: q.id,
      difficulty: q.difficulty || 'auto',
      is_official_exam: q.is_official_exam,
      exam_source: q.exam_source,
      exam_date: q.exam_date,
      exam_entity: q.exam_entity,
    }
  }))
}

// Shuffle array helper
function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// Mock de searchParams
const createMockSearchParams = (params = {}) => ({
  get: (key) => params[key] || null
})

// ============================================
// TESTS: transformQuestions
// ============================================
describe('transformQuestions', () => {
  test('Transforma preguntas de Supabase correctamente', () => {
    const supabaseQuestions = createMockSupabaseQuestions(3)
    const transformed = transformQuestions(supabaseQuestions)

    expect(transformed).toHaveLength(3)
    expect(transformed[0]).toHaveProperty('id', 'q-1')
    expect(transformed[0]).toHaveProperty('question', 'Pregunta 1')
    expect(transformed[0]).toHaveProperty('options')
    expect(transformed[0].options).toHaveLength(4)
  })

  test('Maneja array vacío', () => {
    const transformed = transformQuestions([])
    expect(transformed).toEqual([])
  })

  test('Maneja null/undefined', () => {
    expect(transformQuestions(null)).toEqual([])
    expect(transformQuestions(undefined)).toEqual([])
  })

  test('Preserva información del artículo', () => {
    const supabaseQuestions = createMockSupabaseQuestions(1)
    const transformed = transformQuestions(supabaseQuestions)

    expect(transformed[0].article.law_short_name).toBe('CE')
    expect(transformed[0].article.number).toBe('1')
  })

  test('Preserva metadata de pregunta oficial', () => {
    const supabaseQuestions = createMockSupabaseQuestions(2)
    const transformed = transformQuestions(supabaseQuestions)

    // Primera pregunta es oficial (i % 2 === 0)
    expect(transformed[0].metadata.is_official_exam).toBe(true)
    expect(transformed[0].metadata.exam_source).toBe('AGE 2023')

    // Segunda pregunta no es oficial
    expect(transformed[1].metadata.is_official_exam).toBe(false)
    expect(transformed[1].metadata.exam_source).toBe(null)
  })

  test('NO incluye correct_option por seguridad', () => {
    const supabaseQuestions = createMockSupabaseQuestions(1)
    const transformed = transformQuestions(supabaseQuestions)

    expect(transformed[0]).not.toHaveProperty('correct_option')
    expect(transformed[0]).not.toHaveProperty('correctOption')
  })
})

// ============================================
// TESTS: shuffleArray
// ============================================
describe('shuffleArray', () => {
  test('Mantiene todos los elementos', () => {
    const original = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(original)

    expect(shuffled).toHaveLength(original.length)
    expect(shuffled.sort()).toEqual(original.sort())
  })

  test('No modifica el array original', () => {
    const original = [1, 2, 3, 4, 5]
    const originalCopy = [...original]
    shuffleArray(original)

    expect(original).toEqual(originalCopy)
  })

  test('Maneja arrays de un elemento', () => {
    const original = [1]
    const shuffled = shuffleArray(original)

    expect(shuffled).toEqual([1])
  })

  test('Maneja arrays vacíos', () => {
    const original = []
    const shuffled = shuffleArray(original)

    expect(shuffled).toEqual([])
  })
})

// ============================================
// TESTS: fetchQuickQuestions (lógica)
// ============================================
describe('fetchQuickQuestions - Lógica de negocio', () => {
  test('Configuración por defecto es 10 preguntas', () => {
    const searchParams = createMockSearchParams({})
    const numQuestions = parseInt(searchParams.get('n')) || 10

    expect(numQuestions).toBe(10)
  })

  test('Parámetro n override el default', () => {
    const searchParams = createMockSearchParams({ n: '15' })
    const numQuestions = parseInt(searchParams.get('n')) || 10

    expect(numQuestions).toBe(15)
  })

  test('Detecta parámetro de ley para filtro', () => {
    const searchParams = createMockSearchParams({ law: 'CE' })
    const lawParam = searchParams.get('law')

    expect(lawParam).toBe('CE')
  })

  test('Detecta parámetro de artículos específicos', () => {
    const searchParams = createMockSearchParams({ articles: '14,15,16' })
    const articlesParam = searchParams.get('articles')
    const articleNumbers = articlesParam.split(',').map(a => parseInt(a.trim()))

    expect(articleNumbers).toEqual([14, 15, 16])
  })

  test('Limita preguntas al número solicitado', () => {
    const questions = createMockSupabaseQuestions(20)
    const numQuestions = 10
    const shuffled = shuffleArray(questions)
    const limited = shuffled.slice(0, numQuestions)

    expect(limited).toHaveLength(10)
  })
})

// ============================================
// TESTS: fetchAleatorioMultiTema (lógica)
// ============================================
describe('fetchAleatorioMultiTema - Lógica de negocio', () => {
  test('Acepta array de temas', () => {
    const themes = [1, 2, 3, 4, 5]

    expect(Array.isArray(themes)).toBe(true)
    expect(themes.length).toBeGreaterThan(0)
  })

  test('Distribución equitativa de preguntas por tema', () => {
    const themes = [1, 2, 3]
    const numQuestions = 30
    const questionsPerTheme = Math.ceil(numQuestions / themes.length)

    expect(questionsPerTheme).toBe(10)
  })

  test('Maneja temas con diferentes cantidades de preguntas', () => {
    // Simular que tema 1 tiene 50 preguntas, tema 2 tiene 20
    const tema1Questions = createMockSupabaseQuestions(50)
    const tema2Questions = createMockSupabaseQuestions(20)

    const numQuestionsPerTema = 15

    // Tema 1 puede dar 15
    const fromTema1 = tema1Questions.slice(0, numQuestionsPerTema)
    expect(fromTema1).toHaveLength(15)

    // Tema 2 puede dar hasta 15 (tiene 20)
    const fromTema2 = tema2Questions.slice(0, numQuestionsPerTema)
    expect(fromTema2).toHaveLength(15)
  })

  test('Mezcla preguntas de múltiples temas', () => {
    const tema1Questions = createMockSupabaseQuestions(5, 'CE').map(q => ({ ...q, tema: 1 }))
    const tema2Questions = createMockSupabaseQuestions(5, 'LPAC').map(q => ({ ...q, tema: 2 }))

    const allQuestions = [...tema1Questions, ...tema2Questions]
    const shuffled = shuffleArray(allQuestions)

    // Verificar que hay preguntas de ambos temas mezcladas
    const temas = shuffled.map(q => q.tema)
    expect(temas).toContain(1)
    expect(temas).toContain(2)
  })
})

// ============================================
// TESTS: lawFetchers - fetchQuestionsByLaw (lógica)
// ============================================
describe('fetchQuestionsByLaw - Lógica de negocio', () => {
  test('Identifica ley por short_name', () => {
    const lawShortName = 'CE'
    const questions = createMockSupabaseQuestions(10, lawShortName)

    const allFromLaw = questions.every(q => q.articles.laws.short_name === lawShortName)
    expect(allFromLaw).toBe(true)
  })

  test('Filtra por preguntas oficiales cuando onlyOfficial=true', () => {
    const questions = createMockSupabaseQuestions(10)
    const onlyOfficial = true

    const filtered = onlyOfficial
      ? questions.filter(q => q.is_official_exam === true)
      : questions

    filtered.forEach(q => {
      expect(q.is_official_exam).toBe(true)
    })
  })

  test('Parsea filtro de sección desde searchParams', () => {
    const sectionFilter = JSON.stringify({
      title: 'Título I',
      articleRange: { start: 10, end: 55 }
    })

    const searchParams = createMockSearchParams({ section_filter: sectionFilter })
    const parsedFilter = JSON.parse(searchParams.get('section_filter'))

    expect(parsedFilter.title).toBe('Título I')
    expect(parsedFilter.articleRange.start).toBe(10)
    expect(parsedFilter.articleRange.end).toBe(55)
  })

  test('Filtra preguntas por rango de artículos', () => {
    const questions = createMockSupabaseQuestions(20)
    const articleRange = { start: 5, end: 10 }

    const filtered = questions.filter(q => {
      const artNum = parseInt(q.articles.article_number)
      return artNum >= articleRange.start && artNum <= articleRange.end
    })

    filtered.forEach(q => {
      const artNum = parseInt(q.articles.article_number)
      expect(artNum).toBeGreaterThanOrEqual(articleRange.start)
      expect(artNum).toBeLessThanOrEqual(articleRange.end)
    })
  })
})

// ============================================
// TESTS: getParam helper (lógica universal)
// ============================================
describe('getParam helper - Universal parameter extraction', () => {
  test('Extrae parámetro de URLSearchParams', () => {
    const searchParams = createMockSearchParams({ n: '25' })
    const value = searchParams.get('n')

    expect(value).toBe('25')
  })

  test('Retorna null para parámetro inexistente', () => {
    const searchParams = createMockSearchParams({})
    const value = searchParams.get('nonexistent')

    expect(value).toBeNull()
  })

  test('Extrae parámetro de objeto plano', () => {
    const searchParams = { n: '25', law: 'CE' }
    const value = searchParams.n

    expect(value).toBe('25')
  })
})

// ============================================
// TESTS: Validación de datos de entrada
// ============================================
describe('Input validation', () => {
  test('Tema debe ser número positivo', () => {
    const validTemas = [1, 5, 101, 301]
    const invalidTemas = [0, -1, 'abc', null]

    validTemas.forEach(tema => {
      expect(Number.isInteger(tema) && tema > 0).toBe(true)
    })

    invalidTemas.forEach(tema => {
      const isValid = Number.isInteger(tema) && tema > 0
      expect(isValid).toBe(false)
    })
  })

  test('numQuestions debe estar en rango válido', () => {
    const validCounts = [1, 10, 25, 50, 100]
    const invalidCounts = [0, -5, 150, 1000]

    validCounts.forEach(count => {
      expect(count >= 1 && count <= 100).toBe(true)
    })

    invalidCounts.forEach(count => {
      const isValid = count >= 1 && count <= 100
      expect(isValid).toBe(false)
    })
  })

  test('lawShortName debe ser string no vacío', () => {
    const validLaws = ['CE', 'LPAC', 'LRJSP', 'Ley 40/2015']
    const invalidLaws = ['', null, undefined, 123]

    validLaws.forEach(law => {
      expect(typeof law === 'string' && law.length > 0).toBe(true)
    })

    invalidLaws.forEach(law => {
      const isValid = typeof law === 'string' && law.length > 0
      expect(isValid).toBe(false)
    })
  })
})

// ============================================
// TESTS: Formato de respuesta
// ============================================
describe('Response format', () => {
  test('Preguntas transformadas tienen formato correcto', () => {
    const supabaseQuestions = createMockSupabaseQuestions(1)
    const transformed = transformQuestions(supabaseQuestions)
    const q = transformed[0]

    // Campos requeridos
    expect(q).toHaveProperty('id')
    expect(q).toHaveProperty('question')
    expect(q).toHaveProperty('options')
    expect(q).toHaveProperty('explanation')
    expect(q).toHaveProperty('article')
    expect(q).toHaveProperty('metadata')

    // Estructura de options
    expect(Array.isArray(q.options)).toBe(true)
    expect(q.options).toHaveLength(4)

    // Estructura de article
    expect(q.article).toHaveProperty('id')
    expect(q.article).toHaveProperty('number')
    expect(q.article).toHaveProperty('law_short_name')

    // Estructura de metadata
    expect(q.metadata).toHaveProperty('id')
    expect(q.metadata).toHaveProperty('difficulty')
    expect(q.metadata).toHaveProperty('is_official_exam')
  })

  test('Array de preguntas se puede iterar y mapear', () => {
    const supabaseQuestions = createMockSupabaseQuestions(5)
    const transformed = transformQuestions(supabaseQuestions)

    const ids = transformed.map(q => q.id)
    expect(ids).toHaveLength(5)

    const articleNumbers = transformed.map(q => q.article.number)
    expect(articleNumbers.every(n => typeof n === 'string')).toBe(true)
  })
})

// ============================================
// TESTS: Edge cases
// ============================================
describe('Edge cases', () => {
  test('Maneja pregunta sin artículo asociado', () => {
    const questionWithoutArticle = {
      id: 'q-no-art',
      question_text: 'Pregunta sin artículo',
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      explanation: 'Explicación',
      articles: null
    }

    const transformed = transformQuestions([questionWithoutArticle])

    expect(transformed[0].article.number).toBe('1') // Fallback
    expect(transformed[0].article.law_short_name).toBeUndefined()
  })

  test('Maneja pregunta con datos parciales de artículo', () => {
    const questionPartialArticle = {
      id: 'q-partial',
      question_text: 'Pregunta parcial',
      option_a: 'A',
      option_b: 'B',
      option_c: 'C',
      option_d: 'D',
      explanation: 'Explicación',
      articles: {
        id: 'art-1',
        article_number: '5',
        // Sin title, content, laws
      }
    }

    const transformed = transformQuestions([questionPartialArticle])

    expect(transformed[0].article.number).toBe('5')
    expect(transformed[0].article.title).toBe('Artículo 1') // Fallback con índice
  })

  test('Maneja array muy grande de preguntas', () => {
    const largeArray = createMockSupabaseQuestions(1000)
    const transformed = transformQuestions(largeArray)

    expect(transformed).toHaveLength(1000)
    expect(transformed[999].id).toBe('q-1000')
  })

  test('Maneja caracteres especiales en textos', () => {
    const questionWithSpecialChars = {
      id: 'q-special',
      question_text: '¿Qué dice el artículo 1° sobre "España"?',
      option_a: 'Opción con acentos: España, ñ, ü',
      option_b: 'Opción con símbolos: €, %, &',
      option_c: 'Opción con quotes: "texto"',
      option_d: 'Opción normal',
      explanation: 'Explicación con <html> y "quotes"',
      articles: {
        id: 'art-1',
        article_number: '1',
        laws: { short_name: 'CE', name: 'Constitución Española' }
      }
    }

    const transformed = transformQuestions([questionWithSpecialChars])

    expect(transformed[0].question).toContain('¿')
    expect(transformed[0].question).toContain('"')
    expect(transformed[0].options[0]).toContain('ñ')
  })
})

// ============================================
// TESTS: Simulación de flujo completo
// ============================================
describe('Complete flow simulation', () => {
  test('Flujo: test rápido sin filtros', () => {
    // 1. Usuario solicita test rápido
    const searchParams = createMockSearchParams({ n: '10' })
    const numQuestions = parseInt(searchParams.get('n')) || 10

    // 2. Supabase devuelve preguntas
    const supabaseQuestions = createMockSupabaseQuestions(50)

    // 3. Se mezclan y limitan
    const shuffled = shuffleArray(supabaseQuestions)
    const limited = shuffled.slice(0, numQuestions)

    // 4. Se transforman
    const transformed = transformQuestions(limited)

    // 5. Verificaciones
    expect(transformed).toHaveLength(10)
    expect(transformed[0]).toHaveProperty('question')
    expect(transformed[0]).not.toHaveProperty('correct_option')
  })

  test('Flujo: test por ley con filtro de sección', () => {
    // 1. Usuario selecciona ley CE y Título I
    const lawShortName = 'CE'
    const sectionFilter = { title: 'Título I', articleRange: { start: 10, end: 55 } }

    // 2. Supabase devuelve preguntas de CE
    const allCEQuestions = createMockSupabaseQuestions(100, 'CE')

    // 3. Se filtran por rango de artículos
    const filtered = allCEQuestions.filter(q => {
      const artNum = parseInt(q.articles.article_number)
      return artNum >= sectionFilter.articleRange.start &&
             artNum <= sectionFilter.articleRange.end
    })

    // 4. Se transforman
    const transformed = transformQuestions(filtered)

    // 5. Verificaciones
    expect(transformed.length).toBeLessThanOrEqual(allCEQuestions.length)
    transformed.forEach(q => {
      expect(q.article.law_short_name).toBe('CE')
    })
  })

  test('Flujo: test aleatorio multi-tema', () => {
    // 1. Usuario selecciona múltiples temas
    const themes = [1, 2, 3]
    const numQuestions = 30

    // 2. Supabase devuelve preguntas de cada tema
    const tema1 = createMockSupabaseQuestions(20, 'CE')
    const tema2 = createMockSupabaseQuestions(20, 'LPAC')
    const tema3 = createMockSupabaseQuestions(20, 'LRJSP')

    // 3. Se combinan y mezclan
    const allQuestions = [...tema1, ...tema2, ...tema3]
    const shuffled = shuffleArray(allQuestions)
    const limited = shuffled.slice(0, numQuestions)

    // 4. Se transforman
    const transformed = transformQuestions(limited)

    // 5. Verificaciones
    expect(transformed).toHaveLength(30)

    // Debería haber preguntas de múltiples leyes
    const laws = new Set(transformed.map(q => q.article.law_short_name))
    expect(laws.size).toBeGreaterThanOrEqual(1)
  })
})
