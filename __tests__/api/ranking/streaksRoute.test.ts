/**
 * Tests para el endpoint /api/ranking/streaks
 *
 * @jest-environment node
 */

// Mock de las queries
jest.mock('../../../lib/api/ranking', () => ({
  safeParseGetStreakRankingRequest: jest.fn(),
  getStreakRanking: jest.fn(),
}))

import { GET } from '../../../app/api/ranking/streaks/route'
import { safeParseGetStreakRankingRequest, getStreakRanking } from '../../../lib/api/ranking'
import { NextRequest } from 'next/server'

const mockSafeParse = safeParseGetStreakRankingRequest as jest.MockedFunction<typeof safeParseGetStreakRankingRequest>
const mockGetStreakRanking = getStreakRanking as jest.MockedFunction<typeof getStreakRanking>

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/ranking/streaks')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

describe('GET /api/ranking/streaks', () => {
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

  test('timeFilter=week -> 200 con streaks', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'week', category: 'all', limit: 50, offset: 0 },
    } as any)
    mockGetStreakRanking.mockResolvedValue({
      success: true,
      streaks: [
        { userId: 'u1', streak: 5, rank: 1, name: 'User 1', ciudad: 'Madrid', avatar: null, isNovato: false },
        { userId: 'u2', streak: 3, rank: 2, name: 'User 2', ciudad: null, avatar: null, isNovato: true },
      ],
      hasMore: false,
    })

    const response = await GET(makeRequest({ timeFilter: 'week' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.streaks).toHaveLength(2)
    expect(body.streaks[0].streak).toBe(5)
    expect(body.hasMore).toBe(false)
  })

  test('con category=principiantes -> lo pasa al parser', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'week', category: 'principiantes', limit: 50, offset: 0 },
    } as any)
    mockGetStreakRanking.mockResolvedValue({
      success: true,
      streaks: [],
      hasMore: false,
    })

    await GET(makeRequest({ timeFilter: 'week', category: 'principiantes' }))

    expect(mockSafeParse).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'principiantes' })
    )
  })

  test('con offset y limit -> los pasa como numeros', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'month', category: 'all', limit: 25, offset: 50 },
    } as any)
    mockGetStreakRanking.mockResolvedValue({
      success: true,
      streaks: [],
      hasMore: false,
    })

    await GET(makeRequest({ timeFilter: 'month', limit: '25', offset: '50' }))

    expect(mockSafeParse).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 50 })
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
      data: { timeFilter: 'week', category: 'all', limit: 50, offset: 0 },
    } as any)
    mockGetStreakRanking.mockResolvedValue({
      success: false,
      error: 'Database error',
    })

    const response = await GET(makeRequest({ timeFilter: 'week' }))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('excepcion inesperada -> 500', async () => {
    mockSafeParse.mockImplementation(() => {
      throw new Error('unexpected')
    })

    const response = await GET(makeRequest({ timeFilter: 'week' }))
    expect(response.status).toBe(500)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('respuesta incluye Cache-Control header', async () => {
    mockSafeParse.mockReturnValue({
      success: true,
      data: { timeFilter: 'all', category: 'all', limit: 50, offset: 0 },
    } as any)
    mockGetStreakRanking.mockResolvedValue({
      success: true,
      streaks: [],
      hasMore: false,
    })

    const response = await GET(makeRequest({ timeFilter: 'all' }))
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60')
  })
})
