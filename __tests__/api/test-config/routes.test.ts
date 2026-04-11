/**
 * Tests para las routes GET de /api/v2/test-config/*
 *
 * @jest-environment node
 */

// Mock de queries
jest.mock('../../../lib/api/test-config/queries', () => ({
  getArticlesForLaw: jest.fn(),
  estimateAvailableQuestions: jest.fn(),
  getEssentialArticles: jest.fn(),
  getScopedLawSections: jest.fn(),
}))

import { NextRequest } from 'next/server'
import { getArticlesForLaw, estimateAvailableQuestions, getEssentialArticles, getScopedLawSections } from '../../../lib/api/test-config/queries'
import { GET as articlesGET } from '../../../app/api/v2/test-config/articles/route'
import { GET as estimateGET } from '../../../app/api/v2/test-config/estimate/route'
import { GET as essentialArticlesGET } from '../../../app/api/v2/test-config/essential-articles/route'
import { GET as sectionsGET } from '../../../app/api/v2/test-config/sections/route'

const mockGetArticlesForLaw = getArticlesForLaw as jest.MockedFunction<typeof getArticlesForLaw>
const mockEstimateAvailableQuestions = estimateAvailableQuestions as jest.MockedFunction<typeof estimateAvailableQuestions>
const mockGetEssentialArticles = getEssentialArticles as jest.MockedFunction<typeof getEssentialArticles>
const mockGetScopedLawSections = getScopedLawSections as jest.MockedFunction<typeof getScopedLawSections>

function createRequest(path: string) {
  return new NextRequest(`http://localhost:3000${path}`)
}

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================
// GET /api/v2/test-config/articles
// ============================================

describe('GET /api/v2/test-config/articles', () => {
  test('request valido devuelve 200 con articulos', async () => {
    mockGetArticlesForLaw.mockResolvedValue({
      success: true,
      articles: [
        { article_number: 1, title: 'Titulo Preliminar', question_count: 15 },
        { article_number: 14, title: 'Igualdad', question_count: 8 },
      ],
    })

    const request = createRequest(
      '/api/v2/test-config/articles?lawShortName=CE&topicNumber=1&positionType=auxiliar_administrativo_estado'
    )
    const response = await articlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.articles).toHaveLength(2)
  })

  test('falta lawShortName devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/articles?positionType=auxiliar_administrativo_estado'
    )
    const response = await articlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('inválidos')
  })

  test('positionType invalido devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/articles?lawShortName=CE&positionType=invalido'
    )
    const response = await articlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('sin topicNumber funciona (standalone)', async () => {
    mockGetArticlesForLaw.mockResolvedValue({
      success: true,
      articles: [{ article_number: 1, title: 'Art 1', question_count: 5 }],
    })

    const request = createRequest(
      '/api/v2/test-config/articles?lawShortName=CE&positionType=auxiliar_administrativo_estado'
    )
    const response = await articlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    // Verify topicNumber is null in the call
    expect(mockGetArticlesForLaw).toHaveBeenCalledWith(
      expect.objectContaining({ topicNumber: null })
    )
  })

  test('error de query devuelve 500', async () => {
    mockGetArticlesForLaw.mockResolvedValue({
      success: false,
      error: 'DB error',
    })

    const request = createRequest(
      '/api/v2/test-config/articles?lawShortName=CE&positionType=auxiliar_administrativo_estado'
    )
    const response = await articlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })
})

// ============================================
// GET /api/v2/test-config/estimate
// ============================================

describe('GET /api/v2/test-config/estimate', () => {
  test('request valido devuelve 200 con count', async () => {
    mockEstimateAvailableQuestions.mockResolvedValue({
      success: true,
      count: 42,
      byLaw: { CE: 30, 'Ley 39/2015': 12 },
    })

    const request = createRequest(
      '/api/v2/test-config/estimate?topicNumber=1&positionType=auxiliar_administrativo_estado'
    )
    const response = await estimateGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.count).toBe(42)
    expect(data.byLaw).toEqual({ CE: 30, 'Ley 39/2015': 12 })
  })

  test('con filtros complejos devuelve 200', async () => {
    mockEstimateAvailableQuestions.mockResolvedValue({
      success: true,
      count: 5,
      byLaw: { CE: 5 },
    })

    const articlesByLaw = JSON.stringify({ CE: [14, 16] })
    const request = createRequest(
      `/api/v2/test-config/estimate?topicNumber=1&positionType=auxiliar_administrativo_estado&onlyOfficialQuestions=true&selectedLaws=CE&selectedArticlesByLaw=${encodeURIComponent(articlesByLaw)}`
    )
    const response = await estimateGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.count).toBe(5)
  })

  test('params invalidos devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/estimate?positionType=invalido'
    )
    const response = await estimateGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('error de query devuelve 500', async () => {
    mockEstimateAvailableQuestions.mockResolvedValue({
      success: false,
      error: 'No se encontró mapeo',
    })

    const request = createRequest(
      '/api/v2/test-config/estimate?topicNumber=999&positionType=auxiliar_administrativo_estado'
    )
    const response = await estimateGET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
  })
})

// ============================================
// GET /api/v2/test-config/essential-articles
// ============================================

describe('GET /api/v2/test-config/essential-articles', () => {
  test('request valido devuelve 200 con essentialCount + articles + byDifficulty', async () => {
    mockGetEssentialArticles.mockResolvedValue({
      success: true,
      essentialCount: 5,
      essentialArticles: [
        { number: 14, law: 'CE', questionsCount: 3 },
        { number: 23, law: 'CE', questionsCount: 2 },
      ],
      totalQuestions: 25,
      byDifficulty: { easy: 10, medium: 10, hard: 5 },
    })

    const request = createRequest(
      '/api/v2/test-config/essential-articles?topicNumber=1&positionType=auxiliar_administrativo_estado'
    )
    const response = await essentialArticlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.essentialCount).toBe(5)
    expect(data.essentialArticles).toHaveLength(2)
    expect(data.totalQuestions).toBe(25)
    expect(data.byDifficulty).toEqual({ easy: 10, medium: 10, hard: 5 })
  })

  test('falta topicNumber devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/essential-articles?positionType=auxiliar_administrativo_estado'
    )
    const response = await essentialArticlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('inválidos')
  })

  test('falta positionType devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/essential-articles?topicNumber=1'
    )
    const response = await essentialArticlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('tema sin scope devuelve error', async () => {
    mockGetEssentialArticles.mockResolvedValue({
      success: false,
      error: 'No se encontró mapeo para tema 999',
    })

    const request = createRequest(
      '/api/v2/test-config/essential-articles?topicNumber=999&positionType=auxiliar_administrativo_estado'
    )
    const response = await essentialArticlesGET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toContain('No se encontró mapeo')
  })
})

// ============================================
// GET /api/v2/test-config/sections
// ============================================

describe('GET /api/v2/test-config/sections', () => {
  test('request válido devuelve 200 con secciones + scopeMeta', async () => {
    mockGetScopedLawSections.mockResolvedValue({
      success: true,
      sections: [
        {
          id: 's1',
          slug: 'titulo-vi',
          title: 'Título VI. De la iniciativa legislativa',
          description: null,
          articleRange: { start: 127, end: 133 },
          sectionNumber: '6',
          sectionType: 'titulo',
          orderPosition: 7,
          scopeMeta: {
            articlesInScope: ['128'],
            articleCountInScope: 1,
          },
        },
      ],
      totalInScope: 1,
    })

    const request = createRequest(
      '/api/v2/test-config/sections?lawShortName=Ley%2039%2F2015&topicNumber=5&positionType=auxiliar_administrativo_estado'
    )
    const response = await sectionsGET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.sections).toHaveLength(1)
    expect(data.sections[0].scopeMeta.articleCountInScope).toBe(1)
    expect(data.totalInScope).toBe(1)

    // Asegurar que la query recibe los params parseados correctamente
    expect(mockGetScopedLawSections).toHaveBeenCalledWith({
      lawShortName: 'Ley 39/2015',
      topicNumber: 5,
      positionType: 'auxiliar_administrativo_estado',
    })
  })

  test('falta lawShortName devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/sections?topicNumber=1&positionType=auxiliar_administrativo_estado'
    )
    const response = await sectionsGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toContain('inválidos')
  })

  test('falta topicNumber devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/sections?lawShortName=CE&positionType=auxiliar_administrativo_estado'
    )
    const response = await sectionsGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('positionType inválido devuelve 400', async () => {
    const request = createRequest(
      '/api/v2/test-config/sections?lawShortName=CE&topicNumber=1&positionType=invalido'
    )
    const response = await sectionsGET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('error de query devuelve 500', async () => {
    mockGetScopedLawSections.mockResolvedValue({
      success: false,
      error: 'Ley no encontrada: XXX',
    })

    const request = createRequest(
      '/api/v2/test-config/sections?lawShortName=XXX&topicNumber=1&positionType=auxiliar_administrativo_estado'
    )
    const response = await sectionsGET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.success).toBe(false)
    expect(data.error).toContain('Ley no encontrada')
  })
})
