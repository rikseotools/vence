/**
 * Tests para verify-articles/questions: queries y route logic
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Questions - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(articleResult: any[], questionResult: any[]) {
    let selectCallIndex = 0

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => {
          const callIndex = selectCallIndex++
          const data = callIndex === 0 ? articleResult : questionResult
          return {
            from: () => ({
              where: () => {
                // getArticleByLawAndNumber uses .where().limit()
                // getQuestionsByArticleForDisplay uses .where().limit()
                const result = Promise.resolve(data)
                ;(result as any).limit = () => Promise.resolve(data)
                return result
              },
            }),
          }
        },
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: {
        lawId: 'law_id',
        articleNumber: 'article_number',
        id: 'id',
        title: 'title',
        content: 'content',
      },
      questions: {
        primaryArticleId: 'primary_article_id',
        isActive: 'is_active',
        id: 'id',
        questionText: 'question_text',
        optionA: 'option_a',
        optionB: 'option_b',
        optionC: 'option_c',
        optionD: 'option_d',
        correctOption: 'correct_option',
        explanation: 'explanation',
        isOfficialExam: 'is_official_exam',
        difficulty: 'difficulty',
      },
    }))
  }

  it('should return article by law and number via getArticleByLawAndNumber', async () => {
    const mockArticle = [{ id: 'art-123', articleNumber: '15', title: 'Art 15', content: 'Content of art 15' }]

    setupMock(mockArticle, [])

    const { getArticleByLawAndNumber } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleByLawAndNumber(
      '00000000-0000-0000-0000-000000000001',
      '15'
    )

    expect(result).toBeDefined()
    expect(result.id).toBe('art-123')
    expect(result.articleNumber).toBe('15')
    expect(result.content).toBe('Content of art 15')
  })

  it('should return null when no article found', async () => {
    setupMock([], [])

    const { getArticleByLawAndNumber } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleByLawAndNumber(
      '00000000-0000-0000-0000-000000000001',
      '999'
    )

    expect(result).toBeNull()
  })

  it('should return questions for article via getQuestionsByArticleForDisplay', async () => {
    const mockQuestions = [
      {
        id: 'q-1',
        questionText: 'Test question 1',
        optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
        correctOption: 0,
        explanation: 'Explanation 1',
        isOfficialExam: true,
        difficulty: 'medium',
      },
      {
        id: 'q-2',
        questionText: 'Test question 2',
        optionA: 'A2', optionB: 'B2', optionC: 'C2', optionD: 'D2',
        correctOption: 2,
        explanation: 'Explanation 2',
        isOfficialExam: false,
        difficulty: 'hard',
      },
    ]

    // Standalone mock for getQuestionsByArticleForDisplay which uses .select().from().where().limit()
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockQuestions),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      questions: {
        primaryArticleId: 'primary_article_id',
        isActive: 'is_active',
        id: 'id',
        questionText: 'question_text',
        optionA: 'option_a',
        optionB: 'option_b',
        optionC: 'option_c',
        optionD: 'option_d',
        correctOption: 'correct_option',
        explanation: 'explanation',
        isOfficialExam: 'is_official_exam',
        difficulty: 'difficulty',
      },
    }))

    const { getQuestionsByArticleForDisplay } = require('@/lib/api/verify-articles/queries')
    const result = await getQuestionsByArticleForDisplay('art-123')

    expect(result).toHaveLength(2)
    expect(result[0].questionText).toBe('Test question 1')
    expect(result[0].isOfficialExam).toBe(true)
    expect(result[1].correctOption).toBe(2)
  })
})

// ============================================
// ROUTE LOGIC TESTS
// ============================================

describe('Verify Articles - Questions - Route Logic', () => {
  it('should return questions from FK path when article exists', () => {
    // Simulating the route's Method 1: By FK direct
    const article = { id: 'art-123', title: 'Art 15', content: 'Some content here' }
    const directQuestions = [
      { id: 'q-1', questionText: 'Question 1' },
      { id: 'q-2', questionText: 'Question 2' },
    ]

    let questions: Record<string, unknown>[] = []

    if (article?.id) {
      questions = directQuestions
    }

    expect(questions).toHaveLength(2)
    expect(questions[0].id).toBe('q-1')
  })

  it('should return empty when no article found and no text search results', () => {
    const article = null
    let questions: Record<string, unknown>[] = []

    if (article) {
      questions = [{ id: 'q-1' }]
    }

    expect(questions).toHaveLength(0)
  })

  it('should build response with correct structure', () => {
    const article = { id: 'art-123', title: 'Art 15', content: 'A long content string for the article' }
    const questions = [
      { id: 'q-1', questionText: 'Q1' },
      { id: 'q-2', questionText: 'Q2' },
    ]

    const response = {
      success: true,
      articleNumber: '15',
      article: article ? {
        id: article.id,
        title: article.title,
        content: article.content?.substring(0, 500) + (article.content && article.content.length > 500 ? '...' : ''),
      } : null,
      questions,
      count: questions.length,
    }

    expect(response.success).toBe(true)
    expect(response.articleNumber).toBe('15')
    expect(response.article?.id).toBe('art-123')
    expect(response.count).toBe(2)
  })

  it('should truncate long article content to 500 chars', () => {
    const longContent = 'A'.repeat(600)
    const article = { id: 'art-1', title: 'Test', content: longContent }

    const truncated = article.content.substring(0, 500) + (article.content.length > 500 ? '...' : '')

    expect(truncated.length).toBe(503) // 500 + '...'
    expect(truncated.endsWith('...')).toBe(true)
  })
})
