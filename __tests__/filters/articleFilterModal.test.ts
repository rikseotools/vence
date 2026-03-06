// __tests__/filters/articleFilterModal.test.ts
// Tests para la lógica de UI del modal de artículos con artículos sin preguntas

export {} // Module boundary para evitar colisión de scope con otros tests

type ArticleItem = {
  article_number: string | number
  title: string | null
  question_count: number
}

// ============================================
// Funciones extraídas del TestConfigurator
// ============================================

/** selectAllArticlesForLaw: solo selecciona artículos con question_count > 0 */
function selectAllArticlesForLaw(articles: ArticleItem[]): Set<string | number> {
  return new Set(
    articles.filter(art => art.question_count > 0).map(art => art.article_number)
  )
}

/** toggleArticleSelection: ignora artículos con question_count === 0 */
function toggleArticleSelection(
  articles: ArticleItem[],
  currentSelection: Set<string | number>,
  articleNumber: string | number,
): Set<string | number> {
  const article = articles.find(a => a.article_number === articleNumber)
  if (article && article.question_count === 0) return currentSelection

  const newSelection = new Set(currentSelection)
  if (newSelection.has(articleNumber)) {
    newSelection.delete(articleNumber)
  } else {
    newSelection.add(articleNumber)
  }
  return newSelection
}

/** Cuenta artículos con preguntas disponibles (para resumen "X de Y") */
function countArticlesWithQuestions(articles: ArticleItem[]): number {
  return articles.filter(art => art.question_count > 0).length
}

/** Cuenta preguntas estimadas según selección */
function countEstimatedQuestions(
  articles: ArticleItem[],
  selected: Set<string | number>,
): number {
  return articles
    .filter(art => selected.has(art.article_number))
    .reduce((sum, art) => sum + art.question_count, 0)
}

// ============================================
// Datos de test: LPRL con artículos con/sin preguntas
// ============================================
const mockArticles: ArticleItem[] = [
  { article_number: 1, title: 'Normativa sobre PRL', question_count: 0 },
  { article_number: 4, title: 'Definiciones', question_count: 5 },
  { article_number: 10, title: 'Vigilancia salud', question_count: 0 },
  { article_number: 15, title: 'Equipos de trabajo', question_count: 0 },
  { article_number: 35, title: 'Delegados prevención', question_count: 3 },
  { article_number: 38, title: 'Comité seguridad', question_count: 2 },
]

// ============================================
// TESTS
// ============================================

describe('Article Filter Modal - Artículos sin preguntas', () => {
  test('selectAll NO incluye artículos con question_count=0', () => {
    const selected = selectAllArticlesForLaw(mockArticles)

    expect(selected.size).toBe(3) // Solo 4, 35, 38
    expect(selected.has(4)).toBe(true)
    expect(selected.has(35)).toBe(true)
    expect(selected.has(38)).toBe(true)

    // No incluye artículos sin preguntas
    expect(selected.has(1)).toBe(false)
    expect(selected.has(10)).toBe(false)
    expect(selected.has(15)).toBe(false)
  })

  test('toggleArticleSelection ignora artículos con question_count=0', () => {
    const currentSelection = new Set<string | number>([4])

    // Intentar seleccionar artículo sin preguntas
    const afterToggle = toggleArticleSelection(mockArticles, currentSelection, 1)
    expect(afterToggle.size).toBe(1)
    expect(afterToggle.has(1)).toBe(false)

    // Intentar seleccionar otro artículo sin preguntas
    const afterToggle2 = toggleArticleSelection(mockArticles, currentSelection, 10)
    expect(afterToggle2.has(10)).toBe(false)
  })

  test('toggleArticleSelection funciona con artículos que SÍ tienen preguntas', () => {
    const currentSelection = new Set<string | number>([4])

    // Seleccionar artículo con preguntas
    const afterAdd = toggleArticleSelection(mockArticles, currentSelection, 35)
    expect(afterAdd.has(35)).toBe(true)
    expect(afterAdd.size).toBe(2)

    // Deseleccionar artículo con preguntas
    const afterRemove = toggleArticleSelection(mockArticles, afterAdd, 4)
    expect(afterRemove.has(4)).toBe(false)
    expect(afterRemove.size).toBe(1)
  })

  test('resumen "X de Y" solo cuenta artículos con preguntas disponibles', () => {
    const totalWithQuestions = countArticlesWithQuestions(mockArticles)
    expect(totalWithQuestions).toBe(3) // 4, 35, 38

    // NO cuenta los 6 artículos totales
    expect(totalWithQuestions).not.toBe(mockArticles.length)
  })

  test('preguntas estimadas no cuenta artículos sin preguntas', () => {
    // Aunque seleccionáramos artículos sin preguntas, no suman
    const selected = new Set<string | number>([4, 35]) // Solo artículos con preguntas
    const estimated = countEstimatedQuestions(mockArticles, selected)
    expect(estimated).toBe(8) // 5 + 3

    // Con todos seleccionados
    const allSelected = selectAllArticlesForLaw(mockArticles)
    const estimatedAll = countEstimatedQuestions(mockArticles, allSelected)
    expect(estimatedAll).toBe(10) // 5 + 3 + 2
  })

  test('artículos sin preguntas aparecen en la lista pero son informativos', () => {
    // Verificar que todos los artículos están presentes
    expect(mockArticles).toHaveLength(6)

    // Los sin preguntas deben marcarse como deshabilitados
    const disabledArticles = mockArticles.filter(art => art.question_count === 0)
    expect(disabledArticles).toHaveLength(3)
    expect(disabledArticles.map(a => a.article_number)).toEqual([1, 10, 15])

    // Los con preguntas son seleccionables
    const selectableArticles = mockArticles.filter(art => art.question_count > 0)
    expect(selectableArticles).toHaveLength(3)
  })

  test('selectAll con todos los artículos sin preguntas devuelve set vacío', () => {
    const allEmpty: ArticleItem[] = [
      { article_number: 1, title: 'Art 1', question_count: 0 },
      { article_number: 2, title: 'Art 2', question_count: 0 },
    ]
    const selected = selectAllArticlesForLaw(allEmpty)
    expect(selected.size).toBe(0)
  })

  test('selectAll con todos los artículos con preguntas los selecciona todos', () => {
    const allWithQuestions: ArticleItem[] = [
      { article_number: 1, title: 'Art 1', question_count: 5 },
      { article_number: 2, title: 'Art 2', question_count: 3 },
    ]
    const selected = selectAllArticlesForLaw(allWithQuestions)
    expect(selected.size).toBe(2)
  })
})
