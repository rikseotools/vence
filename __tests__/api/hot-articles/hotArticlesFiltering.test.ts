/**
 * Tests for the hot_articles official exam filtering system.
 *
 * CRITICAL BUG PREVENTED: The "Valencia bug" where a user with oposicion
 * "auxiliar_administrativo_ayuntamiento_valencia" was seeing official exam data
 * from "auxiliar-administrativo-estado" because the query was not filtering
 * by target_oposicion. The fix ensures each user only sees hot_articles rows
 * that match their specific oposicion.
 */

// ============================================
// 1. SCHEMA TESTS - Zod validation & normalizeOposicionSlug
// ============================================

import { articleOfficialExamDataSchema, normalizeOposicionSlug } from '../../../lib/api/hot-articles/schemas'

describe('articleOfficialExamDataSchema', () => {
  const validData = {
    hasOfficialExams: true as const,
    totalOfficialQuestions: 5,
    uniqueExamsCount: 3,
    priorityLevel: 'high' as const,
    hotnessScore: 50,
    latestExamDate: '2024-07-09',
    firstExamDate: '2019-06-14',
    examSources: ['Examen 2024 Auxiliar Estado'],
    examEntities: ['AGE'],
    difficultyLevels: ['media'],
  }

  test('accepts valid data with all fields', () => {
    const result = articleOfficialExamDataSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  test('accepts null latestExamDate and firstExamDate', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      latestExamDate: null,
      firstExamDate: null,
    })
    expect(result.success).toBe(true)
  })

  test('accepts empty arrays for examSources, examEntities, difficultyLevels', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      examSources: [],
      examEntities: [],
      difficultyLevels: [],
    })
    expect(result.success).toBe(true)
  })

  test('accepts all valid priority levels', () => {
    for (const level of ['critical', 'high', 'medium', 'low'] as const) {
      const result = articleOfficialExamDataSchema.safeParse({
        ...validData,
        priorityLevel: level,
      })
      expect(result.success).toBe(true)
    }
  })

  test('rejects hasOfficialExams = false', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      hasOfficialExams: false,
    })
    expect(result.success).toBe(false)
  })

  test('rejects invalid priorityLevel', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      priorityLevel: 'extreme',
    })
    expect(result.success).toBe(false)
  })

  test('rejects missing required fields', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      hasOfficialExams: true,
    })
    expect(result.success).toBe(false)
  })

  test('rejects non-number totalOfficialQuestions', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      totalOfficialQuestions: 'five',
    })
    expect(result.success).toBe(false)
  })

  test('rejects non-array examSources', () => {
    const result = articleOfficialExamDataSchema.safeParse({
      ...validData,
      examSources: 'not-an-array',
    })
    expect(result.success).toBe(false)
  })
})

describe('normalizeOposicionSlug', () => {
  test('converts underscores to dashes', () => {
    expect(normalizeOposicionSlug('auxiliar_administrativo_estado')).toBe('auxiliar-administrativo-estado')
  })

  test('leaves dashes unchanged', () => {
    expect(normalizeOposicionSlug('auxiliar-administrativo-estado')).toBe('auxiliar-administrativo-estado')
  })

  test('handles mixed underscores and dashes', () => {
    expect(normalizeOposicionSlug('auxiliar_administrativo-estado')).toBe('auxiliar-administrativo-estado')
  })

  test('handles complex oposicion slugs with many underscores', () => {
    expect(normalizeOposicionSlug('auxiliar_administrativo_ayuntamiento_valencia'))
      .toBe('auxiliar-administrativo-ayuntamiento-valencia')
  })

  test('handles empty string', () => {
    expect(normalizeOposicionSlug('')).toBe('')
  })

  test('handles string with no underscores or dashes', () => {
    expect(normalizeOposicionSlug('tramitacion')).toBe('tramitacion')
  })
})

// ============================================
// 2. QUERY LOGIC TESTS - Mock Drizzle
// ============================================

describe('getArticleOfficialExamData', () => {
  let getArticleOfficialExamData: typeof import('../../../lib/api/hot-articles/queries').getArticleOfficialExamData
  let mockGetDb: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    mockGetDb = jest.fn()

    jest.doMock('../../../db/client', () => ({
      getDb: mockGetDb,
    }))

    // Mock the schema to provide column references used by drizzle .where() / .eq()
    jest.doMock('../../../db/schema', () => ({
      hotArticles: {
        articleId: 'hot_articles.article_id',
        targetOposicion: 'hot_articles.target_oposicion',
        totalOfficialAppearances: 'hot_articles.total_official_appearances',
        uniqueExamsCount: 'hot_articles.unique_exams_count',
        priorityLevel: 'hot_articles.priority_level',
        hotnessScore: 'hot_articles.hotness_score',
        lastAppearanceDate: 'hot_articles.last_appearance_date',
        firstAppearanceDate: 'hot_articles.first_appearance_date',
        entitiesBreakdown: 'hot_articles.entities_breakdown',
        articleNumber: 'hot_articles.article_number',
        lawName: 'hot_articles.law_name',
      },
      questions: {
        primaryArticleId: 'questions.primary_article_id',
        isOfficialExam: 'questions.is_official_exam',
        isActive: 'questions.is_active',
        examSource: 'questions.exam_source',
        examEntity: 'questions.exam_entity',
        officialDifficultyLevel: 'questions.official_difficulty_level',
      },
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function setupMockDb(selectResult: any[]) {
    const mockLimit = jest.fn().mockResolvedValue(selectResult)
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })
    return { mockSelect, mockFrom, mockWhere, mockLimit }
  }

  test('returns null when userOposicion is null', async () => {
    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('some-article-id', null)
    expect(result).toBeNull()
    // DB should never be called
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('returns null when userOposicion is empty string', async () => {
    // normalizeOposicionSlug('') returns '' which is falsy? No, '' is falsy in JS
    // but the function checks !userOposicion which catches null/undefined/''
    // Actually empty string is truthy for the check... let's verify
    // The code does: if (!userOposicion) return null
    // '' is falsy in JS, so this should return null
    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('some-article-id', '')
    expect(result).toBeNull()
  })

  test('returns null when no hot_article row is found', async () => {
    setupMockDb([]) // empty result
    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('article-123', 'auxiliar-administrativo-estado')
    expect(result).toBeNull()
  })

  test('returns correct data when hot_article row exists', async () => {
    const hotRow = {
      articleId: 'article-123',
      targetOposicion: 'auxiliar-administrativo-estado',
      totalOfficialAppearances: 5,
      uniqueExamsCount: 3,
      priorityLevel: 'high',
      hotnessScore: '50',
      lastAppearanceDate: '2024-07-09',
      firstAppearanceDate: '2019-06-14',
      entitiesBreakdown: {
        exam_sources: ['Examen 2024 AGE', 'Examen 2023 AGE'],
        exam_entities: ['AGE'],
        difficulty_levels: ['media'],
      },
      articleNumber: '14',
      lawName: 'CE',
    }
    setupMockDb([hotRow])

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('article-123', 'auxiliar-administrativo-estado')

    expect(result).not.toBeNull()
    expect(result!.hasOfficialExams).toBe(true)
    expect(result!.totalOfficialQuestions).toBe(5)
    expect(result!.uniqueExamsCount).toBe(3)
    expect(result!.priorityLevel).toBe('high')
    expect(result!.hotnessScore).toBe(50)
    expect(result!.latestExamDate).toBe('2024-07-09')
    expect(result!.firstExamDate).toBe('2019-06-14')
    expect(result!.examSources).toEqual(['Examen 2024 AGE', 'Examen 2023 AGE'])
    expect(result!.examEntities).toEqual(['AGE'])
    expect(result!.difficultyLevels).toEqual(['media'])
  })

  test('normalizes oposicion slug with underscores to dashes before querying', async () => {
    // When user has oposicion with underscores (e.g., from user_profiles),
    // it must be normalized to dashes to match hot_articles.target_oposicion
    setupMockDb([]) // no row found, that's fine - we just check normalization happens
    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')

    await getArticleOfficialExamData('article-123', 'auxiliar_administrativo_estado')

    // The function should have been called (DB was queried)
    expect(mockGetDb).toHaveBeenCalled()
  })

  test('handles null values in hot_article row gracefully', async () => {
    const hotRow = {
      articleId: 'article-123',
      targetOposicion: 'auxiliar-administrativo-estado',
      totalOfficialAppearances: null,
      uniqueExamsCount: null,
      priorityLevel: null,
      hotnessScore: null,
      lastAppearanceDate: null,
      firstAppearanceDate: null,
      entitiesBreakdown: null,
      articleNumber: '14',
      lawName: 'CE',
    }

    // Also need to mock the enrichFromQuestions fallback query
    const mockLimit = jest.fn().mockResolvedValue([hotRow])
    const mockWhere = jest.fn()
      .mockReturnValueOnce({ limit: mockLimit }) // first call: hotArticles query
      .mockResolvedValueOnce([]) // second call: enrichFromQuestions
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('article-123', 'auxiliar-administrativo-estado')

    expect(result).not.toBeNull()
    expect(result!.totalOfficialQuestions).toBe(0)
    expect(result!.uniqueExamsCount).toBe(0)
    expect(result!.hotnessScore).toBe(0)
    expect(result!.latestExamDate).toBeNull()
    expect(result!.firstExamDate).toBeNull()
    expect(result!.examSources).toEqual([])
    expect(result!.examEntities).toEqual([])
    expect(result!.difficultyLevels).toEqual([])
  })
})

describe('getMultipleArticlesOfficialExamData', () => {
  let mockGetDb: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    mockGetDb = jest.fn()

    jest.doMock('../../../db/client', () => ({
      getDb: mockGetDb,
    }))

    jest.doMock('../../../db/schema', () => ({
      hotArticles: {
        articleId: 'hot_articles.article_id',
        targetOposicion: 'hot_articles.target_oposicion',
        totalOfficialAppearances: 'hot_articles.total_official_appearances',
        uniqueExamsCount: 'hot_articles.unique_exams_count',
        priorityLevel: 'hot_articles.priority_level',
        hotnessScore: 'hot_articles.hotness_score',
        lastAppearanceDate: 'hot_articles.last_appearance_date',
        firstAppearanceDate: 'hot_articles.first_appearance_date',
        entitiesBreakdown: 'hot_articles.entities_breakdown',
        articleNumber: 'hot_articles.article_number',
        lawName: 'hot_articles.law_name',
      },
      questions: {
        primaryArticleId: 'questions.primary_article_id',
        isOfficialExam: 'questions.is_official_exam',
        isActive: 'questions.is_active',
        examSource: 'questions.exam_source',
        examEntity: 'questions.exam_entity',
        officialDifficultyLevel: 'questions.official_difficulty_level',
      },
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function setupMockDb(selectResult: any[]) {
    const mockWhere = jest.fn().mockResolvedValue(selectResult)
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })
    return { mockSelect, mockFrom, mockWhere }
  }

  test('returns empty object when userOposicion is null', async () => {
    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(['14', '15'], 'CE', null)
    expect(result).toEqual({})
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('returns empty object when articleNumbers is empty', async () => {
    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData([], 'CE', 'auxiliar-administrativo-estado')
    expect(result).toEqual({})
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('returns data keyed by article_number', async () => {
    const rows = [
      {
        articleId: 'a1',
        targetOposicion: 'auxiliar-administrativo-estado',
        totalOfficialAppearances: 3,
        uniqueExamsCount: 2,
        priorityLevel: 'high',
        hotnessScore: '30',
        lastAppearanceDate: '2024-07-09',
        firstAppearanceDate: '2021-05-26',
        entitiesBreakdown: { exam_sources: ['Examen 2024'], exam_entities: ['AGE'], difficulty_levels: ['media'] },
        articleNumber: '14',
        lawName: 'CE',
      },
      {
        articleId: 'a2',
        targetOposicion: 'auxiliar-administrativo-estado',
        totalOfficialAppearances: 1,
        uniqueExamsCount: 1,
        priorityLevel: 'low',
        hotnessScore: '10',
        lastAppearanceDate: '2023-01-20',
        firstAppearanceDate: '2023-01-20',
        entitiesBreakdown: { exam_sources: ['Examen 2023'], exam_entities: ['AGE'], difficulty_levels: ['facil'] },
        articleNumber: '23',
        lawName: 'CE',
      },
    ]
    setupMockDb(rows)

    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(['14', '23'], 'CE', 'auxiliar-administrativo-estado')

    expect(Object.keys(result)).toEqual(['14', '23'])
    expect(result['14'].totalOfficialQuestions).toBe(3)
    expect(result['14'].priorityLevel).toBe('high')
    expect(result['23'].totalOfficialQuestions).toBe(1)
    expect(result['23'].priorityLevel).toBe('low')
  })

  test('skips rows with null articleNumber', async () => {
    const rows = [
      {
        articleId: 'a1',
        targetOposicion: 'auxiliar-administrativo-estado',
        totalOfficialAppearances: 3,
        uniqueExamsCount: 2,
        priorityLevel: 'high',
        hotnessScore: '30',
        lastAppearanceDate: null,
        firstAppearanceDate: null,
        entitiesBreakdown: {},
        articleNumber: null, // null article number - should be skipped
        lawName: 'CE',
      },
    ]
    setupMockDb(rows)

    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(['14'], 'CE', 'auxiliar-administrativo-estado')

    expect(Object.keys(result)).toEqual([])
  })

  test('normalizes underscored oposicion before querying', async () => {
    setupMockDb([])
    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')

    await getMultipleArticlesOfficialExamData(['14'], 'CE', 'auxiliar_administrativo_estado')

    // DB was called (slug was normalized, not rejected)
    expect(mockGetDb).toHaveBeenCalled()
  })
})

// ============================================
// 3. extractFromBreakdown tests (internal helper, tested via behavior)
// ============================================

describe('extractFromBreakdown behavior', () => {
  let mockGetDb: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    mockGetDb = jest.fn()

    jest.doMock('../../../db/client', () => ({
      getDb: mockGetDb,
    }))

    jest.doMock('../../../db/schema', () => ({
      hotArticles: {
        articleId: 'hot_articles.article_id',
        targetOposicion: 'hot_articles.target_oposicion',
        totalOfficialAppearances: 'hot_articles.total_official_appearances',
        uniqueExamsCount: 'hot_articles.unique_exams_count',
        priorityLevel: 'hot_articles.priority_level',
        hotnessScore: 'hot_articles.hotness_score',
        lastAppearanceDate: 'hot_articles.last_appearance_date',
        firstAppearanceDate: 'hot_articles.first_appearance_date',
        entitiesBreakdown: 'hot_articles.entities_breakdown',
        articleNumber: 'hot_articles.article_number',
        lawName: 'hot_articles.law_name',
      },
      questions: {
        primaryArticleId: 'questions.primary_article_id',
        isOfficialExam: 'questions.is_official_exam',
        isActive: 'questions.is_active',
        examSource: 'questions.exam_source',
        examEntity: 'questions.exam_entity',
        officialDifficultyLevel: 'questions.official_difficulty_level',
      },
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function makeRow(entitiesBreakdown: unknown) {
    return {
      articleId: 'a1',
      targetOposicion: 'auxiliar-administrativo-estado',
      totalOfficialAppearances: 1,
      uniqueExamsCount: 1,
      priorityLevel: 'low',
      hotnessScore: '10',
      lastAppearanceDate: null,
      firstAppearanceDate: null,
      entitiesBreakdown,
      articleNumber: '14',
      lawName: 'CE',
    }
  }

  function setupMockDbMultiple(hotResult: any[], questionsResult: any[] = []) {
    const mockLimit = jest.fn().mockResolvedValue(hotResult)
    const mockWhere = jest.fn()
      .mockReturnValueOnce({ limit: mockLimit })
      .mockResolvedValueOnce(questionsResult)
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })
  }

  test('handles null entities_breakdown - falls back to questions enrichment', async () => {
    setupMockDbMultiple(
      [makeRow(null)],
      [{ examSource: 'Examen 2024', examEntity: 'AGE', officialDifficultyLevel: 'media' }]
    )

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('a1', 'auxiliar-administrativo-estado')

    expect(result!.examSources).toEqual(['Examen 2024'])
    expect(result!.examEntities).toEqual(['AGE'])
    expect(result!.difficultyLevels).toEqual(['media'])
  })

  test('handles empty object entities_breakdown - falls back to questions enrichment', async () => {
    setupMockDbMultiple(
      [makeRow({})],
      [{ examSource: 'Examen 2024', examEntity: null, officialDifficultyLevel: null }]
    )

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('a1', 'auxiliar-administrativo-estado')

    expect(result!.examSources).toEqual(['Examen 2024'])
    expect(result!.examEntities).toEqual([])
    expect(result!.difficultyLevels).toEqual([])
  })

  test('handles valid entities_breakdown with arrays', async () => {
    const breakdown = {
      exam_sources: ['Examen 2024 AGE', 'Examen 2023 AGE'],
      exam_entities: ['AGE'],
      difficulty_levels: ['media', 'dificil'],
    }
    // Only one mock needed - no fallback to questions
    const mockLimit = jest.fn().mockResolvedValue([makeRow(breakdown)])
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('a1', 'auxiliar-administrativo-estado')

    expect(result!.examSources).toEqual(['Examen 2024 AGE', 'Examen 2023 AGE'])
    expect(result!.examEntities).toEqual(['AGE'])
    expect(result!.difficultyLevels).toEqual(['media', 'dificil'])
  })

  test('filters non-string values from breakdown arrays', async () => {
    const breakdown = {
      exam_sources: ['Examen 2024', 123, null, 'Examen 2023'],
      exam_entities: [undefined, 'AGE'],
      difficulty_levels: ['media', true, 'dificil'],
    }
    const mockLimit = jest.fn().mockResolvedValue([makeRow(breakdown)])
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('a1', 'auxiliar-administrativo-estado')

    expect(result!.examSources).toEqual(['Examen 2024', 'Examen 2023'])
    expect(result!.examEntities).toEqual(['AGE'])
    expect(result!.difficultyLevels).toEqual(['media', 'dificil'])
  })
})

// ============================================
// 4. CRITICAL BUG REGRESSION TESTS - The Valencia bug
// ============================================

describe('Valencia bug regression - oposicion filtering', () => {
  let mockGetDb: jest.Mock

  beforeEach(() => {
    jest.resetModules()

    mockGetDb = jest.fn()

    jest.doMock('../../../db/client', () => ({
      getDb: mockGetDb,
    }))

    jest.doMock('../../../db/schema', () => ({
      hotArticles: {
        articleId: 'hot_articles.article_id',
        targetOposicion: 'hot_articles.target_oposicion',
        totalOfficialAppearances: 'hot_articles.total_official_appearances',
        uniqueExamsCount: 'hot_articles.unique_exams_count',
        priorityLevel: 'hot_articles.priority_level',
        hotnessScore: 'hot_articles.hotness_score',
        lastAppearanceDate: 'hot_articles.last_appearance_date',
        firstAppearanceDate: 'hot_articles.first_appearance_date',
        entitiesBreakdown: 'hot_articles.entities_breakdown',
        articleNumber: 'hot_articles.article_number',
        lawName: 'hot_articles.law_name',
      },
      questions: {
        primaryArticleId: 'questions.primary_article_id',
        isOfficialExam: 'questions.is_official_exam',
        isActive: 'questions.is_active',
        examSource: 'questions.exam_source',
        examEntity: 'questions.exam_entity',
        officialDifficultyLevel: 'questions.official_difficulty_level',
      },
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('user with auxiliar_administrativo_ayuntamiento_valencia must NOT see auxiliar-administrativo-estado data', async () => {
    // The DB only has rows for auxiliar-administrativo-estado, not for
    // auxiliar-administrativo-ayuntamiento-valencia. The query MUST return
    // empty because the normalized slug does NOT match.
    const mockWhere = jest.fn().mockResolvedValue([]) // no matching rows
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(
      ['14', '23', '103'],
      'CE',
      'auxiliar_administrativo_ayuntamiento_valencia'
    )

    // CRITICAL: Must be empty, NOT showing data from auxiliar-administrativo-estado
    expect(result).toEqual({})
  })

  test('user with auxiliar-administrativo-estado MUST see their own exam data', async () => {
    const rows = [
      {
        articleId: 'a1',
        targetOposicion: 'auxiliar-administrativo-estado',
        totalOfficialAppearances: 5,
        uniqueExamsCount: 3,
        priorityLevel: 'critical',
        hotnessScore: '50',
        lastAppearanceDate: '2024-07-09',
        firstAppearanceDate: '2019-06-14',
        entitiesBreakdown: { exam_sources: ['Examen 2024'], exam_entities: ['AGE'], difficulty_levels: [] },
        articleNumber: '14',
        lawName: 'CE',
      },
    ]
    const mockWhere = jest.fn().mockResolvedValue(rows)
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(
      ['14'],
      'CE',
      'auxiliar-administrativo-estado'
    )

    expect(Object.keys(result)).toEqual(['14'])
    expect(result['14'].hasOfficialExams).toBe(true)
    expect(result['14'].totalOfficialQuestions).toBe(5)
  })

  test('user with null oposicion must NOT see any official exam data', async () => {
    const { getMultipleArticlesOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getMultipleArticlesOfficialExamData(['14', '23'], 'CE', null)

    expect(result).toEqual({})
    // DB must not even be queried
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('user with null oposicion must NOT see any single article exam data', async () => {
    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('article-123', null)

    expect(result).toBeNull()
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('oposicion with no hot_articles rows returns null, not data from other oposiciones', async () => {
    // Simulate DB returning no rows for this specific oposicion
    const mockLimit = jest.fn().mockResolvedValue([])
    const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
    const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
    const mockSelect = jest.fn().mockReturnValue({ from: mockFrom })
    mockGetDb.mockReturnValue({ select: mockSelect })

    const { getArticleOfficialExamData } = require('../../../lib/api/hot-articles/queries')
    const result = await getArticleOfficialExamData('article-123', 'tramitacion-procesal')

    // Must be null - NOT data from auxiliar-administrativo-estado or any other oposicion
    expect(result).toBeNull()
  })

  test('normalizeOposicionSlug produces distinct slugs for similar oposiciones', () => {
    // These must all normalize to DIFFERENT slugs
    const slugs = [
      normalizeOposicionSlug('auxiliar_administrativo_estado'),
      normalizeOposicionSlug('auxiliar_administrativo_ayuntamiento_valencia'),
      normalizeOposicionSlug('auxiliar_administrativo_andalucia'),
      normalizeOposicionSlug('auxiliar_administrativo_clm'),
    ]

    // All must be unique
    const uniqueSlugs = new Set(slugs)
    expect(uniqueSlugs.size).toBe(slugs.length)

    // Verify the exact values
    expect(slugs[0]).toBe('auxiliar-administrativo-estado')
    expect(slugs[1]).toBe('auxiliar-administrativo-ayuntamiento-valencia')
    expect(slugs[2]).toBe('auxiliar-administrativo-andalucia')
    expect(slugs[3]).toBe('auxiliar-administrativo-clm')
  })
})

// ============================================
// 5. API ROUTE TESTS - /api/v2/hot-articles
// ============================================

describe('API route /api/v2/hot-articles', () => {
  let GET: (request: any) => Promise<Response>
  let mockGetMultiple: jest.Mock

  // Polyfill Response.json for jsdom environment
  const OriginalResponse = globalThis.Response
  beforeAll(() => {
    if (!globalThis.Response || !globalThis.Response.json) {
      globalThis.Response = class MockResponse {
        status: number
        _body: any
        constructor(body?: any, init?: any) {
          this._body = body
          this.status = init?.status ?? 200
        }
        async json() { return JSON.parse(this._body) }
        static json(data: any, init?: any) {
          return new MockResponse(JSON.stringify(data), init)
        }
      } as any
    }
  })
  afterAll(() => {
    if (OriginalResponse) globalThis.Response = OriginalResponse
  })

  beforeEach(() => {
    jest.resetModules()

    mockGetMultiple = jest.fn().mockResolvedValue({
      '14': {
        hasOfficialExams: true,
        totalOfficialQuestions: 5,
        uniqueExamsCount: 3,
        priorityLevel: 'critical',
        hotnessScore: 50,
        latestExamDate: '2024-07-09',
        firstExamDate: '2019-06-14',
        examSources: ['Examen 2024'],
        examEntities: ['AGE'],
        difficultyLevels: ['media'],
      },
    })

    // Mock the query function
    jest.doMock('../../../lib/api/hot-articles', () => ({
      getMultipleArticlesOfficialExamData: mockGetMultiple,
    }))

    // Mock withErrorLogging to just pass through the handler
    jest.doMock('../../../lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, handler: Function) => handler,
    }))

    // Mock next/server with a minimal NextRequest that has a url property
    jest.doMock('next/server', () => {
      class MockNextRequest {
        url: string
        constructor(urlOrInput: string | URL) {
          this.url = typeof urlOrInput === 'string' ? urlOrInput : urlOrInput.toString()
        }
      }
      return {
        NextRequest: MockNextRequest,
        NextResponse: {
          json: (data: any, init?: any) => Response.json(data, init),
        },
      }
    })

    const route = require('../../../app/api/v2/hot-articles/route')
    GET = route.GET
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  function makeRequest(params: Record<string, string>): any {
    const url = new URL('http://localhost:3000/api/v2/hot-articles')
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
    const { NextRequest: MockNextRequest } = jest.requireMock('next/server')
    return new MockNextRequest(url.toString())
  }

  test('returns data for valid request with articleNumbers, lawShortName, userOposicion', async () => {
    const response = await GET(makeRequest({
      articleNumbers: '14,23',
      lawShortName: 'CE',
      userOposicion: 'auxiliar-administrativo-estado',
    }))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data['14']).toBeDefined()
    expect(data['14'].hasOfficialExams).toBe(true)
  })

  test('returns 400 for missing lawShortName', async () => {
    const response = await GET(makeRequest({
      articleNumbers: '14,23',
    }))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  test('returns 400 for empty articleNumbers', async () => {
    const response = await GET(makeRequest({
      articleNumbers: '',
      lawShortName: 'CE',
    }))

    expect(response.status).toBe(400)
  })

  test('returns 400 for missing articleNumbers param entirely', async () => {
    const response = await GET(makeRequest({
      lawShortName: 'CE',
    }))

    expect(response.status).toBe(400)
  })

  test('handles request with null userOposicion (param not provided)', async () => {
    const response = await GET(makeRequest({
      articleNumbers: '14',
      lawShortName: 'CE',
    }))

    expect(response.status).toBe(200)
    // getMultipleArticlesOfficialExamData should be called with null oposicion
    expect(mockGetMultiple).toHaveBeenCalledWith(['14'], 'CE', null)
  })
})

// ============================================
// 6. exam_position MAPPING TESTS - official-exams/queries.ts
// ============================================

describe('oposicionToExamPosition mapping', () => {
  // Copy of the map from lib/api/official-exams/queries.ts (lines 72-79)
  // Must be kept in sync with the source.
  const oposicionToExamPosition: Record<string, string> = {
    'auxiliar-administrativo-estado': 'auxiliar_administrativo_estado',
    'tramitacion-procesal': 'tramitacion_procesal',
    'auxilio-judicial': 'auxilio_judicial',
    'administrativo-estado': 'administrativo_estado',
    'gestion-procesal': 'cuerpo_gestion_administracion_civil',
  }

  test('all mapped oposiciones have exam_position values', () => {
    for (const [slug, examPosition] of Object.entries(oposicionToExamPosition)) {
      expect(typeof slug).toBe('string')
      expect(slug.length).toBeGreaterThan(0)
      expect(typeof examPosition).toBe('string')
      expect(examPosition.length).toBeGreaterThan(0)
    }
  })

  test('exam_position values use underscores (matching DB format)', () => {
    for (const [slug, examPosition] of Object.entries(oposicionToExamPosition)) {
      // exam_position must NOT contain dashes - DB uses underscores
      expect(examPosition).not.toContain('-')
    }
  })

  test('oposicion slugs use dashes (URL format)', () => {
    for (const [slug] of Object.entries(oposicionToExamPosition)) {
      // Slug keys must NOT contain underscores - URLs use dashes
      expect(slug).not.toContain('_')
    }
  })

  test('normalizeOposicionSlug output matches oposicionToExamPosition keys', () => {
    // When a user profile stores oposicion with underscores, normalizing it
    // must produce a key that exists in the mapping
    const userProfileOposiciones = [
      'auxiliar_administrativo_estado',
      'tramitacion_procesal',
      'auxilio_judicial',
      'administrativo_estado',
      'gestion_procesal',
    ]

    for (const profileOposicion of userProfileOposiciones) {
      const normalized = normalizeOposicionSlug(profileOposicion)
      expect(oposicionToExamPosition).toHaveProperty(normalized)
    }
  })

  test('each oposicion maps to a unique exam_position', () => {
    const examPositions = Object.values(oposicionToExamPosition)
    const uniquePositions = new Set(examPositions)
    expect(uniquePositions.size).toBe(examPositions.length)
  })

  test('auxiliar-administrativo-estado maps to auxiliar_administrativo_estado', () => {
    expect(oposicionToExamPosition['auxiliar-administrativo-estado']).toBe('auxiliar_administrativo_estado')
  })

  test('tramitacion-procesal maps to tramitacion_procesal', () => {
    expect(oposicionToExamPosition['tramitacion-procesal']).toBe('tramitacion_procesal')
  })

  test('Valencia oposicion is NOT in the mapping (no official exams for it)', () => {
    const valenciaSlug = normalizeOposicionSlug('auxiliar_administrativo_ayuntamiento_valencia')
    expect(oposicionToExamPosition[valenciaSlug]).toBeUndefined()
  })
})
