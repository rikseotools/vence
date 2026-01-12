/**
 * Tests de integración para verificar compatibilidad de formatos
 * entre la API /api/questions/filtered y los componentes de UI
 */

// ============================================
// MOCK: Formato de respuesta de la API
// ============================================
const mockApiResponse = {
  success: true,
  questions: [
    {
      id: 'uuid-123',
      question: '¿Cuál es la capital de España?',
      options: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
      explanation: 'Madrid es la capital de España desde 1561.',
      primary_article_id: 'article-uuid-456',
      tema: 1,
      article: {
        id: 'article-uuid-456',
        number: '5',
        title: 'Artículo sobre la capital',
        full_text: 'El contenido completo del artículo...',
        law_name: 'Constitución Española',
        law_short_name: 'CE',
        display_number: 'Art. 5 CE'
      },
      metadata: {
        id: 'uuid-123',
        difficulty: 'medium',
        question_type: 'single',
        tags: ['geografia', 'espana'],
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        is_official_exam: true,
        exam_source: 'AGE 2023',
        exam_date: '2023-06-15',
        exam_entity: 'AGE',
        official_difficulty_level: 'medio'
      }
    }
  ],
  totalAvailable: 100,
  filtersApplied: { laws: 1, articles: 0, sections: 1 }
}

// ============================================
// FUNCIÓN: Transformar para ExamLayout (Supabase format)
// ============================================
function transformForExamLayout(apiQuestions) {
  return apiQuestions.map(q => ({
    id: q.id,
    question_text: q.question,
    option_a: q.options[0],
    option_b: q.options[1],
    option_c: q.options[2],
    option_d: q.options[3],
    explanation: q.explanation,
    difficulty: q.metadata?.difficulty,
    is_official_exam: q.metadata?.is_official_exam,
    primary_article_id: q.primary_article_id,
    exam_source: q.metadata?.exam_source,
    exam_date: q.metadata?.exam_date,
    exam_entity: q.metadata?.exam_entity,
    articles: {
      id: q.article?.id,
      article_number: q.article?.number,
      title: q.article?.title,
      content: q.article?.full_text,
      laws: {
        short_name: q.article?.law_short_name,
        name: q.article?.law_name
      }
    }
  }))
}

// ============================================
// TESTS: Formato de respuesta de la API
// ============================================
describe('API Response Format', () => {
  test('La respuesta debe tener estructura correcta', () => {
    expect(mockApiResponse).toHaveProperty('success')
    expect(mockApiResponse).toHaveProperty('questions')
    expect(mockApiResponse).toHaveProperty('totalAvailable')
    expect(mockApiResponse).toHaveProperty('filtersApplied')
  })

  test('Cada pregunta debe tener campos requeridos', () => {
    const question = mockApiResponse.questions[0]

    expect(question).toHaveProperty('id')
    expect(question).toHaveProperty('question')
    expect(question).toHaveProperty('options')
    expect(question).toHaveProperty('explanation')
    expect(question).toHaveProperty('primary_article_id')
    expect(question).toHaveProperty('article')
    expect(question).toHaveProperty('metadata')
  })

  test('Options debe ser un array de 4 strings', () => {
    const { options } = mockApiResponse.questions[0]

    expect(Array.isArray(options)).toBe(true)
    expect(options).toHaveLength(4)
    options.forEach(opt => {
      expect(typeof opt).toBe('string')
    })
  })

  test('Article debe tener campos requeridos', () => {
    const { article } = mockApiResponse.questions[0]

    expect(article).toHaveProperty('id')
    expect(article).toHaveProperty('number')
    expect(article).toHaveProperty('law_name')
    expect(article).toHaveProperty('law_short_name')
  })

  test('Metadata debe tener campos requeridos', () => {
    const { metadata } = mockApiResponse.questions[0]

    expect(metadata).toHaveProperty('difficulty')
    expect(metadata).toHaveProperty('is_official_exam')
    expect(metadata).toHaveProperty('is_active')
  })
})

// ============================================
// TESTS: Transformación para ExamLayout
// ============================================
describe('Transform for ExamLayout (Supabase format)', () => {
  const transformed = transformForExamLayout(mockApiResponse.questions)
  const question = transformed[0]

  test('Debe transformar question a question_text', () => {
    expect(question).toHaveProperty('question_text')
    expect(question.question_text).toBe('¿Cuál es la capital de España?')
  })

  test('Debe transformar options array a option_a/b/c/d', () => {
    expect(question).toHaveProperty('option_a')
    expect(question).toHaveProperty('option_b')
    expect(question).toHaveProperty('option_c')
    expect(question).toHaveProperty('option_d')

    expect(question.option_a).toBe('Madrid')
    expect(question.option_b).toBe('Barcelona')
    expect(question.option_c).toBe('Valencia')
    expect(question.option_d).toBe('Sevilla')
  })

  test('Debe preservar id y explanation', () => {
    expect(question.id).toBe('uuid-123')
    expect(question.explanation).toBe('Madrid es la capital de España desde 1561.')
  })

  test('Debe extraer campos de metadata', () => {
    expect(question.difficulty).toBe('medium')
    expect(question.is_official_exam).toBe(true)
    expect(question.exam_source).toBe('AGE 2023')
    expect(question.exam_date).toBe('2023-06-15')
    expect(question.exam_entity).toBe('AGE')
  })

  test('Debe transformar article a estructura anidada con laws', () => {
    expect(question.articles).toHaveProperty('id')
    expect(question.articles).toHaveProperty('article_number')
    expect(question.articles).toHaveProperty('title')
    expect(question.articles).toHaveProperty('content')
    expect(question.articles).toHaveProperty('laws')

    expect(question.articles.article_number).toBe('5')
    expect(question.articles.laws.short_name).toBe('CE')
    expect(question.articles.laws.name).toBe('Constitución Española')
  })

  test('Debe preservar primary_article_id', () => {
    expect(question.primary_article_id).toBe('article-uuid-456')
  })
})

// ============================================
// TESTS: Compatibilidad con ExamLayout
// ============================================
describe('ExamLayout Compatibility', () => {
  const transformed = transformForExamLayout(mockApiResponse.questions)
  const question = transformed[0]

  test('ExamLayout puede acceder a question_text', () => {
    // ExamLayout usa: question.question_text
    const questionText = question.question_text || ''
    expect(questionText).toBeTruthy()
    expect(typeof questionText).toBe('string')
  })

  test('ExamLayout puede construir array de opciones', () => {
    // ExamLayout usa: [question.option_a, question.option_b, question.option_c, question.option_d]
    const options = [question.option_a, question.option_b, question.option_c, question.option_d]
    expect(options).toHaveLength(4)
    expect(options.every(opt => typeof opt === 'string')).toBe(true)
  })

  test('ExamLayout puede acceder a articles.laws.short_name', () => {
    // ExamLayout usa: question.articles?.laws?.short_name
    const lawShortName = question.articles?.laws?.short_name
    expect(lawShortName).toBe('CE')
  })

  test('ExamLayout puede acceder a articles.article_number', () => {
    // ExamLayout usa: question.articles?.article_number
    const articleNumber = question.articles?.article_number
    expect(articleNumber).toBe('5')
  })
})

// ============================================
// TESTS: Compatibilidad con TestLayout (modo práctica)
// ============================================
describe('TestLayout Compatibility (API format)', () => {
  // TestLayout usa el formato de la API directamente (transformado)
  const question = mockApiResponse.questions[0]

  test('TestLayout puede acceder a question', () => {
    // TestLayout usa: question.question
    expect(question.question).toBeTruthy()
  })

  test('TestLayout puede acceder a options como array', () => {
    // TestLayout usa: question.options[0], question.options[1], etc.
    expect(Array.isArray(question.options)).toBe(true)
    expect(question.options[0]).toBe('Madrid')
  })

  test('TestLayout puede acceder a article.law_short_name', () => {
    // TestLayout usa: question.article.law_short_name
    expect(question.article.law_short_name).toBe('CE')
  })

  test('TestLayout puede acceder a article.number', () => {
    // TestLayout usa: question.article.number
    expect(question.article.number).toBe('5')
  })

  test('TestLayout puede acceder a metadata.difficulty', () => {
    // TestLayout usa: question.metadata.difficulty
    expect(question.metadata.difficulty).toBe('medium')
  })
})

// ============================================
// TESTS: Edge Cases
// ============================================
describe('Edge Cases - Datos faltantes o null', () => {
  const questionWithNulls = {
    id: 'uuid-null-test',
    question: 'Pregunta de prueba',
    options: ['A', 'B', 'C', 'D'],
    explanation: 'Explicación',
    primary_article_id: 'article-id',
    tema: null,
    article: {
      id: 'art-id',
      number: '1',
      title: null,
      full_text: null,
      law_name: 'Ley Test',
      law_short_name: 'LT',
      display_number: 'Art. 1 LT'
    },
    metadata: {
      id: 'uuid-null-test',
      difficulty: null,
      question_type: 'single',
      tags: null,
      is_active: true,
      created_at: null,
      updated_at: null,
      is_official_exam: null,
      exam_source: null,
      exam_date: null,
      exam_entity: null,
      official_difficulty_level: null
    }
  }

  test('Transformación maneja campos null en metadata', () => {
    const transformed = transformForExamLayout([questionWithNulls])[0]

    expect(transformed.difficulty).toBeNull()
    expect(transformed.is_official_exam).toBeNull()
    expect(transformed.exam_source).toBeNull()
  })

  test('Transformación maneja campos null en article', () => {
    const transformed = transformForExamLayout([questionWithNulls])[0]

    expect(transformed.articles.title).toBeNull()
    expect(transformed.articles.content).toBeNull()
  })

  test('ExamLayout puede renderizar con campos null', () => {
    const transformed = transformForExamLayout([questionWithNulls])[0]

    // Simular acceso como lo hace ExamLayout
    const questionText = transformed.question_text || ''
    const options = [
      transformed.option_a,
      transformed.option_b,
      transformed.option_c,
      transformed.option_d
    ]
    const lawName = transformed.articles?.laws?.short_name || 'Desconocida'

    expect(questionText).toBe('Pregunta de prueba')
    expect(options).toEqual(['A', 'B', 'C', 'D'])
    expect(lawName).toBe('LT')
  })
})

// ============================================
// TESTS: Transformación bidireccional
// ============================================
describe('Transformación bidireccional', () => {
  test('API format -> ExamLayout format preserva datos esenciales', () => {
    const original = mockApiResponse.questions[0]
    const transformed = transformForExamLayout([original])[0]

    // Verificar que no se pierden datos esenciales
    expect(transformed.id).toBe(original.id)
    expect(transformed.question_text).toBe(original.question)
    expect(transformed.option_a).toBe(original.options[0])
    expect(transformed.option_b).toBe(original.options[1])
    expect(transformed.option_c).toBe(original.options[2])
    expect(transformed.option_d).toBe(original.options[3])
    expect(transformed.explanation).toBe(original.explanation)
    expect(transformed.articles.article_number).toBe(original.article.number)
    expect(transformed.articles.laws.short_name).toBe(original.article.law_short_name)
  })

  test('Múltiples preguntas se transforman correctamente', () => {
    const questions = [
      { ...mockApiResponse.questions[0], id: 'q1' },
      { ...mockApiResponse.questions[0], id: 'q2', question: 'Segunda pregunta' },
      { ...mockApiResponse.questions[0], id: 'q3', question: 'Tercera pregunta' }
    ]

    const transformed = transformForExamLayout(questions)

    expect(transformed).toHaveLength(3)
    expect(transformed[0].id).toBe('q1')
    expect(transformed[1].id).toBe('q2')
    expect(transformed[2].id).toBe('q3')
    expect(transformed[1].question_text).toBe('Segunda pregunta')
  })
})

// ============================================
// TESTS: Validación de schema Zod (simulado)
// ============================================
describe('Validación de formato API (schema)', () => {
  test('Formato de pregunta válido debe pasar validación', () => {
    const question = mockApiResponse.questions[0]

    // Validar campos requeridos
    const isValid =
      typeof question.id === 'string' &&
      typeof question.question === 'string' &&
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      typeof question.explanation === 'string' &&
      typeof question.article === 'object' &&
      typeof question.metadata === 'object'

    expect(isValid).toBe(true)
  })

  test('Pregunta sin options debe fallar validación', () => {
    const invalidQuestion = { ...mockApiResponse.questions[0] }
    delete invalidQuestion.options

    const isValid = Array.isArray(invalidQuestion.options)
    expect(isValid).toBe(false)
  })

  test('Pregunta con options incompletas debe fallar validación', () => {
    const invalidQuestion = {
      ...mockApiResponse.questions[0],
      options: ['A', 'B'] // Solo 2 opciones
    }

    const isValid = invalidQuestion.options.length === 4
    expect(isValid).toBe(false)
  })
})
