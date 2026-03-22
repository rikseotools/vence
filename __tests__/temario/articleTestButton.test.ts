/**
 * Tests para el bug de "Hacer test Art. X" en artículos sin preguntas
 *
 * Bug: El botón "Hacer test Art. X" se mostraba para artículos con 0 preguntas,
 * lo que provocaba errores 400 en /api/questions/filtered cuando el usuario
 * hacía clic. El artículo existía pero no tenía preguntas vinculadas.
 *
 * Fix: Añadir campo `questionCount` al schema de artículos del temario y
 * ocultar el botón cuando `questionCount === 0`.
 */

// ============================================
// TEST: ArticleSchema incluye questionCount
// ============================================
describe('ArticleSchema', () => {
  // Importar dinámicamente para evitar problemas de resolución de módulos en Jest
  let ArticleSchema: any

  beforeAll(async () => {
    const mod = await import('@/lib/api/temario/schemas')
    ArticleSchema = mod.ArticleSchema
  })

  const baseArticle = {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    articleNumber: '3',
    title: 'Fuentes de la relación laboral',
    content: 'Contenido del artículo...',
    titleNumber: null,
    chapterNumber: null,
    section: null,
    officialQuestionCount: 0,
  }

  it('should accept questionCount field', () => {
    const result = ArticleSchema.safeParse({
      ...baseArticle,
      questionCount: 5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.questionCount).toBe(5)
    }
  })

  it('should default questionCount to 0 when not provided', () => {
    const result = ArticleSchema.safeParse(baseArticle)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.questionCount).toBe(0)
    }
  })

  it('should accept questionCount of 0', () => {
    const result = ArticleSchema.safeParse({
      ...baseArticle,
      questionCount: 0,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.questionCount).toBe(0)
    }
  })

  it('should preserve officialQuestionCount independently', () => {
    const result = ArticleSchema.safeParse({
      ...baseArticle,
      officialQuestionCount: 3,
      questionCount: 10,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.officialQuestionCount).toBe(3)
      expect(result.data.questionCount).toBe(10)
    }
  })
})

// ============================================
// TEST: Lógica de visibilidad del botón "Hacer test"
// ============================================
describe('Article test button visibility logic', () => {
  // Simula la condición usada en TopicContentView.tsx:
  // {article.questionCount > 0 && (<div>...</div>)}
  function shouldShowTestButton(article: { questionCount: number }): boolean {
    return article.questionCount > 0
  }

  it('should show button when article has questions', () => {
    expect(shouldShowTestButton({ questionCount: 5 })).toBe(true)
    expect(shouldShowTestButton({ questionCount: 1 })).toBe(true)
    expect(shouldShowTestButton({ questionCount: 100 })).toBe(true)
  })

  it('should hide button when article has 0 questions', () => {
    expect(shouldShowTestButton({ questionCount: 0 })).toBe(false)
  })

  it('should show button even if only non-official questions exist', () => {
    // Un artículo puede tener 0 preguntas oficiales pero preguntas normales
    const article = { questionCount: 3, officialQuestionCount: 0 }
    expect(shouldShowTestButton(article)).toBe(true)
  })
})

// ============================================
// TEST: Escenario del bug original
// ============================================
describe('Bug scenario: user clicks test for article with 0 questions', () => {
  // Simula los datos que devuelve la API de temario
  const mockTemarioArticles = [
    { articleNumber: '1', title: 'Ámbito de aplicación', questionCount: 12, officialQuestionCount: 2 },
    { articleNumber: '2', title: 'Regulación', questionCount: 8, officialQuestionCount: 0 },
    { articleNumber: '3', title: 'Fuentes de la relación laboral', questionCount: 0, officialQuestionCount: 0 },
    { articleNumber: '4', title: 'Disposiciones generales', questionCount: 0, officialQuestionCount: 0 },
    { articleNumber: '5', title: 'Derechos laborales', questionCount: 5, officialQuestionCount: 1 },
  ]

  it('should only show test buttons for articles with questions', () => {
    const articlesWithButton = mockTemarioArticles.filter(a => a.questionCount > 0)
    expect(articlesWithButton).toHaveLength(3)
    expect(articlesWithButton.map(a => a.articleNumber)).toEqual(['1', '2', '5'])
  })

  it('should hide test buttons for articles 3 and 4 (the bug case)', () => {
    const articlesWithoutButton = mockTemarioArticles.filter(a => a.questionCount === 0)
    expect(articlesWithoutButton).toHaveLength(2)
    expect(articlesWithoutButton.map(a => a.articleNumber)).toEqual(['3', '4'])
  })

  it('should not generate URLs for articles with 0 questions', () => {
    // Simula la generación de URLs del LawTestConfigurator
    const generateTestUrl = (lawSlug: string, articleNumber: string) =>
      `/leyes/${lawSlug}?selected_articles=${articleNumber}&source=temario`

    const urlsGenerated = mockTemarioArticles
      .filter(a => a.questionCount > 0)
      .map(a => generateTestUrl('rdl-2-2015', a.articleNumber))

    // Art 3 y Art 4 no deben generar URLs
    expect(urlsGenerated).toHaveLength(3)
    expect(urlsGenerated.some(u => u.includes('selected_articles=3'))).toBe(false)
    expect(urlsGenerated.some(u => u.includes('selected_articles=4'))).toBe(false)
  })
})

// ============================================
// TEST: Consistencia entre conteos
// ============================================
describe('Question count consistency', () => {
  it('questionCount should always be >= officialQuestionCount', () => {
    // officialQuestionCount es un subconjunto de questionCount
    const articles = [
      { questionCount: 10, officialQuestionCount: 3 },
      { questionCount: 5, officialQuestionCount: 0 },
      { questionCount: 0, officialQuestionCount: 0 },
      { questionCount: 1, officialQuestionCount: 1 },
    ]

    for (const article of articles) {
      expect(article.questionCount).toBeGreaterThanOrEqual(article.officialQuestionCount)
    }
  })

  it('article with officialQuestionCount > 0 must have questionCount > 0', () => {
    // Si hay preguntas oficiales, necesariamente hay preguntas totales
    const article = { questionCount: 2, officialQuestionCount: 2 }
    expect(article.questionCount).toBeGreaterThan(0)
  })
})

// ============================================
// TEST: Todos los TopicContentView usan questionCount
// ============================================
describe('TopicContentView files consistency', () => {
  const fs = require('fs')
  const path = require('path')
  const glob = require('glob')

  const topicContentFiles = glob.sync('app/**/temario/*/TopicContentView.tsx')

  it('should find all 15 TopicContentView files', () => {
    expect(topicContentFiles.length).toBe(17)
  })

  it.each(topicContentFiles)('%s should check article.questionCount before showing test button', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('article.questionCount > 0')
  })

  it.each(topicContentFiles)('%s should wrap test button in questionCount guard', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    // Verify the pattern: {article.questionCount > 0 && ( ... Hacer test Art. ...)}
    // The guard must appear before the button in the same block
    const guardPattern = /article\.questionCount > 0 && \(\s*\n\s*<div className="no-print.*?Hacer test Art\./s
    expect(content).toMatch(guardPattern)
  })
})
