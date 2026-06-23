/** @jest-environment node */
// Tests del endpoint /api/v2/daily-goal/status (Fase C1). Conteos por user_id del
// TOKEN; fechas (today/weekAgo) como params del cliente. Foco: aislamiento + semana.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/db/client', () => ({
  getDb: () => ({ execute: mockExecute }),
  getPoolerDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/daily-goal/status/route'

const TODAY = '2026-06-23T00:00:00.000Z'
const WEEK = '2026-06-16T00:00:00.000Z'
function req(url: string) {
  return { headers: { get: () => 'Bearer t' }, url } as unknown as NextRequest
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/v2/daily-goal/status', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    const res = await GET(req(`https://x/api?today=${TODAY}`))
    expect(res.status).toBe(401)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('400 si falta today (o inválido)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    expect((await GET(req('https://x/api'))).status).toBe(400)
    expect((await GET(req('https://x/api?today=nope'))).status).toBe(400)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('today-only: suma leg+psycho, weekCount null, 1 sola query', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValueOnce([{ leg: 7, psycho: 3 }])
    const res = await GET(req(`https://x/api?today=${TODAY}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, questionsToday: 10, weekCount: null })
    expect(mockExecute).toHaveBeenCalledTimes(1)
  })

  test('con weekAgo: calcula weekCount (2 queries)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute
      .mockResolvedValueOnce([{ leg: 2, psycho: 1 }])   // today
      .mockResolvedValueOnce([{ leg: 40, psycho: 30 }]) // week
    const res = await GET(req(`https://x/api?today=${TODAY}&weekAgo=${WEEK}`))
    const body = await res.json()
    expect(body).toEqual({ success: true, questionsToday: 3, weekCount: 70 })
    expect(mockExecute).toHaveBeenCalledTimes(2)
  })

  test('AISLAMIENTO: cuenta por el userId del TOKEN, ignora userId del request', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_TOKEN', email: 'a@b.c' })
    mockExecute.mockResolvedValueOnce([{ leg: 0, psycho: 0 }])
    await GET(req(`https://x/api?today=${TODAY}&userId=U_ATTACKER`))
    const serialized = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(serialized).toContain('U_TOKEN')
    expect(serialized).not.toContain('U_ATTACKER')
  })

  test('tolera shape { rows }', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'U_A', email: 'a@b.c' })
    mockExecute.mockResolvedValueOnce({ rows: [{ leg: 5, psycho: 0 }] })
    expect((await (await GET(req(`https://x/api?today=${TODAY}`))).json()).questionsToday).toBe(5)
  })
})
