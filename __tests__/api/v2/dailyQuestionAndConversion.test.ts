/** @jest-environment node */
// Tests de los endpoints que reemplazan los .rpc de useDailyQuestionLimit +
// conversionTracker (Fase C1):
//   GET  /api/v2/daily-question/status     (get_daily_question_status)
//   POST /api/v2/daily-question/increment  (increment_daily_questions)
//   POST /api/v2/conversion-event          (track_conversion_event)
// Seguridad: p_user_id SIEMPRE del token.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET as STATUS } from '@/app/api/v2/daily-question/status/route'
import { POST as INCREMENT } from '@/app/api/v2/daily-question/increment/route'
import { POST as CONVERSION } from '@/app/api/v2/conversion-event/route'

function reqUrl() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}
function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/daily-question/status', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await STATUS(reqUrl())).status).toBe(401)
  })
  test('devuelve status del usuario del token', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ questions_today: 3, is_premium: false }] })
    expect((await (await STATUS(reqUrl())).json()).status).toEqual({ questions_today: 3, is_premium: false })
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
})

describe('POST /api/v2/daily-question/increment', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await INCREMENT(reqBody({ limit: 25 }))).status).toBe(401)
  })
  test('incrementa con userId del token (no del body)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ questions_today: 4, is_premium: false }] })
    await INCREMENT(reqBody({ limit: 25, p_user_id: 'U_ATTACKER' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
  })
})

describe('POST /api/v2/conversion-event', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await CONVERSION(reqBody({ eventType: 'limit_reached' }))).status).toBe(401)
  })
  test('400 si falta eventType', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    expect((await CONVERSION(reqBody({ eventData: {} }))).status).toBe(400)
  })
  test('registra con userId del token; body no inyecta user', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValue({ rows: [{ id: 'ev1' }] })
    await CONVERSION(reqBody({ eventType: 'limit_reached', eventData: { questions_today: 25 }, p_user_id: 'U_ATTACKER' }))
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).not.toContain('U_ATTACKER')
  })
})
