/** @jest-environment node */
// GET /api/v2/psychometric/difficulty + /api/v2/psychometric/first-attempt
// (dificultad efectiva + primera respuesta del PROPIO usuario, hot-path psicotécnico).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as DIFF } from '@/app/api/v2/psychometric/difficulty/route'
import { GET as FIRST } from '@/app/api/v2/psychometric/first-attempt/route'

function req(qs = '') { return { headers: { get: () => null }, url: `https://x${qs}` } as unknown as NextRequest }
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

describe('GET /api/v2/psychometric/difficulty', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await DIFF(req('?questionId=q1'))).status).toBe(401)
  })
  test('400 sin questionId', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    expect((await DIFF(req())).status).toBe(400)
  })
  test('devuelve rpc cuando existe + usa user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValueOnce({ rows: [{ base_difficulty: 'medium', effective_difficulty: 50 }] })
    const j = await (await DIFF(req('?questionId=q1'))).json()
    expect(j.rpc.effective_difficulty).toBe(50)
    expect(j.fallbackBaseDifficulty).toBeNull()
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
  test('fallback a difficulty base cuando rpc vacío', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute
      .mockResolvedValueOnce({ rows: [] })                       // rpc vacío
      .mockResolvedValueOnce({ rows: [{ difficulty: 'hard' }] }) // fallback
    const j = await (await DIFF(req('?questionId=q1'))).json()
    expect(j.rpc).toBeNull()
    expect(j.fallbackBaseDifficulty).toBe('hard')
  })
})

describe('GET /api/v2/psychometric/first-attempt', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await FIRST(req('?questionId=q1'))).status).toBe(401)
  })
  test('sin registro previo → isFirstAttempt true (user del token)', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [] })
    const j = await (await FIRST(req('?questionId=q1'))).json()
    expect(j.isFirstAttempt).toBe(true)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
  })
  test('con registro → isFirstAttempt false', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] })
    const j = await (await FIRST(req('?questionId=q1'))).json()
    expect(j.isFirstAttempt).toBe(false)
  })
})
