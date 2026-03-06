/**
 * Tests para el endpoint /api/ranking
 *
 * @jest-environment node
 */

// Mock de las queries
jest.mock('../../../lib/api/ranking', () => ({
  safeParseGetRankingRequest: jest.fn(),
  getRanking: jest.fn(),
}))

import { GET } from '../../../app/api/ranking/route'
import { safeParseGetRankingRequest, getRanking } from '../../../lib/api/ranking'
import { NextRequest } from 'next/server'

const mockSafeParse = safeParseGetRankingRequest as jest.MockedFunction<typeof safeParseGetRankingRequest>
const mockGetRanking = getRanking as jest.MockedFunction<typeof getRanking>

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/ranking')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

describe('GET /api/ranking', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('sin timeFilter -> 400', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [] } } as any)

    const response = await GET(makeRequest())
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('timeFilter=today -> 200', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: true,
      ranking: [
        { userId: 'u1', totalQuestions: 20, correctAnswers: 16, accuracy: 80, rank: 1, name: 'User', ciudad: null, avatar: null },
      ],
      hasMore: false,
      generatedAt: '2026-03-05T14:30:00.000Z',
    })

    const response = await GET(makeRequest({ timeFilter: 'today' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.ranking).toHaveLength(1)
    expect(body.hasMore).toBe(false)
  })

  test('con userId -> incluye userPosition', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', userId: 'u1', minQuestions: 5, limit: 50, offset: 0 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: true,
      ranking: [],
      userPosition: { rank: 3, totalQuestions: 20, correctAnswers: 16, accuracy: 80, totalUsers: 10 },
      hasMore: false,
      generatedAt: '2026-03-05T14:30:00.000Z',
    })

    const response = await GET(makeRequest({ timeFilter: 'today', userId: 'u1' }))
    const body = await response.json()

    expect(body.userPosition).toBeDefined()
    expect(body.userPosition.rank).toBe(3)
  })

  test('con offset -> lo pasa al parser', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', minQuestions: 5, limit: 50, offset: 100 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: true,
      ranking: [],
      hasMore: false,
      generatedAt: '2026-03-05T14:30:00.000Z',
    })

    await GET(makeRequest({ timeFilter: 'today', offset: '100' }))

    expect(mockSafeParse).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 100 })
    )
  })

  test('timeFilter invalido -> 400', async () => {
    mockSafeParse.mockReturnValue({ success: false, error: { issues: [{ message: 'invalid' }] } } as any)

    const response = await GET(makeRequest({ timeFilter: 'invalid' }))
    expect(response.status).toBe(400)
  })

  test('error interno -> 500', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: false,
      error: 'Database error',
    })

    const response = await GET(makeRequest({ timeFilter: 'today' }))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('excepcion inesperada -> 500', async () => {
    mockSafeParse.mockImplementation(() => {
      throw new Error('unexpected')
    })

    const response = await GET(makeRequest({ timeFilter: 'today' }))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('respuesta incluye header Cache-Control', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', minQuestions: 5, limit: 50, offset: 0 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: true,
      ranking: [],
      hasMore: false,
      generatedAt: '2026-03-05T14:30:00.000Z',
    })

    const response = await GET(makeRequest({ timeFilter: 'today' }))
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60')
  })

  test('minQuestions, limit y offset se pasan como numeros', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'today', minQuestions: 10, limit: 25, offset: 50 },
    } as any)
    mockGetRanking.mockResolvedValue({
      success: true,
      ranking: [],
      hasMore: false,
      generatedAt: '2026-03-05T14:30:00.000Z',
    })

    await GET(makeRequest({ timeFilter: 'today', minQuestions: '10', limit: '25', offset: '50' }))

    expect(mockSafeParse).toHaveBeenCalledWith(
      expect.objectContaining({
        minQuestions: 10,
        limit: 25,
        offset: 50,
      })
    )
  })
})
