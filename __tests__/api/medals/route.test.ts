/**
 * Tests para el endpoint /api/medals
 *
 * @jest-environment node
 */

jest.mock('../../../lib/api/medals', () => ({
  safeParseGetMedalsRequest: jest.fn(),
  safeParseCheckMedalsRequest: jest.fn(),
  getUserMedals: jest.fn(),
  checkAndSaveNewMedals: jest.fn(),
}))

import { GET, POST } from '../../../app/api/medals/route'
import {
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
  getUserMedals,
  checkAndSaveNewMedals,
} from '../../../lib/api/medals'
import { NextRequest } from 'next/server'

const mockSafeParseGet = safeParseGetMedalsRequest as jest.MockedFunction<typeof safeParseGetMedalsRequest>
const mockSafeParseCheck = safeParseCheckMedalsRequest as jest.MockedFunction<typeof safeParseCheckMedalsRequest>
const mockGetUserMedals = getUserMedals as jest.MockedFunction<typeof getUserMedals>
const mockCheckAndSave = checkAndSaveNewMedals as jest.MockedFunction<typeof checkAndSaveNewMedals>

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/medals')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/medals', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('GET /api/medals', () => {
  beforeEach(() => jest.clearAllMocks())

  test('sin userId -> 400', async () => {
    mockSafeParseGet.mockReturnValue({ success: false, error: { issues: [] } } as any)

    const response = await GET(makeGetRequest())
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('con userId -> 200 + medallas', async () => {
    mockSafeParseGet.mockReturnValue({
      success: true,
      data: { userId: '550e8400-e29b-41d4-a716-446655440000' },
    } as any)
    mockGetUserMedals.mockResolvedValue({
      success: true,
      medals: [],
    })

    const response = await GET(makeGetRequest({ userId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.medals).toEqual([])
  })

  test('excepcion -> 500', async () => {
    mockSafeParseGet.mockImplementation(() => {
      throw new Error('unexpected')
    })

    const response = await GET(makeGetRequest({ userId: 'test' }))
    expect(response.status).toBe(500)
  })
})

describe('POST /api/medals', () => {
  beforeEach(() => jest.clearAllMocks())

  test('sin userId -> 400', async () => {
    mockSafeParseCheck.mockReturnValue({ success: false, error: { issues: [] } } as any)

    const response = await POST(makePostRequest({}))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.success).toBe(false)
  })

  test('con userId -> 200 + newMedals', async () => {
    mockSafeParseCheck.mockReturnValue({
      success: true,
      data: { userId: '550e8400-e29b-41d4-a716-446655440000' },
    } as any)
    mockCheckAndSave.mockResolvedValue({
      success: true,
      newMedals: [],
    })

    const response = await POST(makePostRequest({ userId: '550e8400-e29b-41d4-a716-446655440000' }))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.newMedals).toEqual([])
  })

  test('excepcion -> 500', async () => {
    mockSafeParseCheck.mockImplementation(() => {
      throw new Error('unexpected')
    })

    const response = await POST(makePostRequest({ userId: 'test' }))
    expect(response.status).toBe(500)
  })
})
