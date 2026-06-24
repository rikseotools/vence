/** @jest-environment node */
// GET /api/v2/psychometric/questions (carga por categoría, embeds, público)
// + POST /api/v2/psychometric/answered-count (conteo del propio usuario).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()
const mockRate = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: (...a: unknown[]) => mockRate(...a),
  getClientIp: () => '1.2.3.4',
  RATE_LIMIT_PSYCHOMETRIC: {},
}))

import { GET as QUESTIONS } from '@/app/api/v2/psychometric/questions/route'
import { POST as ANSWERED } from '@/app/api/v2/psychometric/answered-count/route'

const U1 = '11111111-1111-1111-1111-111111111111'
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

function getReq(qs = '') { return { headers: { get: () => null }, url: `https://x${qs}` } as unknown as NextRequest }
function postReq(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
  mockRate.mockReturnValue({ allowed: true, resetMs: 0 })
})

describe('GET /api/v2/psychometric/questions', () => {
  test('400 sin categories', async () => {
    expect((await QUESTIONS(getReq())).status).toBe(400)
  })
  test('429 si rate limit', async () => {
    mockRate.mockReturnValue({ allowed: false, resetMs: 1000 })
    expect((await QUESTIONS(getReq('?categories=x'))).status).toBe(429)
  })
  test('devuelve las questions del embed (incl. correct_option preservado)', async () => {
    mockExecute.mockResolvedValue({ rows: [{ question: { id: U1, correct_option: 2, psychometric_categories: {} } }] })
    const j = await (await QUESTIONS(getReq('?categories=verbal,numerico&sections=s1'))).json()
    expect(j.questions).toHaveLength(1)
    expect(j.questions[0].correct_option).toBe(2)
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('category_key')
    expect(s).toContain('section_key') // el filtro de secciones se aplicó
  })
})

describe('POST /api/v2/psychometric/answered-count', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await ANSWERED(postReq({ questionIds: [U1] }))).status).toBe(401)
  })
  test('0 sin questionIds válidos', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    const j = await (await ANSWERED(postReq({ questionIds: ["x'; DROP--"] }))).json()
    expect(j.count).toBe(0)
    expect(mockExecute).not.toHaveBeenCalled() // descarta no-UUID, no consulta
  })
  test('cuenta con user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [{ n: 3 }] })
    const j = await (await ANSWERED(postReq({ questionIds: [U1] }))).json()
    expect(j.count).toBe(3)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})
