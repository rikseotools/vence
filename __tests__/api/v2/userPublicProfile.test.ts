/** @jest-environment node */
// Tests de GET /api/v2/user-public-profile (Fase C1, migración de UserProfileModal).
// CRÍTICO: replica la RLS de `tests` — el perfil público y el avatar son públicos,
// pero los tests SOLO se devuelven al dueño o a un admin (nunca a otro viewer).

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockIsAdminEmail = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a),
}))
jest.mock('@/lib/auth/adminEmails', () => ({
  isAdminEmail: (...a: unknown[]) => mockIsAdminEmail(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET } from '@/app/api/v2/user-public-profile/route'

const TARGET = '11111111-1111-4111-8111-111111111111'
const TODAY = '2026-06-24T00:00:00.000Z'
const TOMORROW = '2026-06-25T00:00:00.000Z'
function req(userId = TARGET) {
  return {
    headers: { get: () => null },
    url: `https://x?userId=${userId}&todayStart=${TODAY}&todayEnd=${TOMORROW}`,
  } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockIsAdminEmail.mockReturnValue(false)
  // 1ª query: public profile, 2ª: avatar settings, 3ª (si aplica): tests
  mockExecute
    .mockResolvedValueOnce({ rows: [{ display_name: 'Ana' }] })
    .mockResolvedValueOnce({ rows: [{ mode: 'auto' }] })
    .mockResolvedValueOnce({ rows: [{ title: 'Test 1', test_type: 'practice' }] })
})

describe('GET /api/v2/user-public-profile', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await GET(req())).status).toBe(401)
  })

  test('400 sin userId', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'V', email: 'v@x' })
    const r = { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
    expect((await GET(r)).status).toBe(400)
  })

  test('perfil + avatar siempre públicos', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'OTHER', email: 'o@x' })
    const j = await (await GET(req())).json()
    expect(j.publicProfile).toEqual({ display_name: 'Ana' })
    expect(j.avatarSettings).toEqual({ mode: 'auto' })
  })

  test('🔒 viewer ≠ dueño y NO admin → tests vacíos (no fuga) + NO consulta tests', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'OTHER', email: 'o@x' })
    mockIsAdminEmail.mockReturnValue(false)
    const j = await (await GET(req())).json()
    expect(j.todayTests).toEqual([])
    expect(mockExecute).toHaveBeenCalledTimes(2) // perfil + avatar, NO tests
  })

  test('viewer === dueño → tests devueltos', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: TARGET, email: 'self@x' })
    const j = await (await GET(req())).json()
    expect(j.todayTests).toHaveLength(1)
    expect(mockExecute).toHaveBeenCalledTimes(3)
  })

  test('viewer admin → tests devueltos aunque no sea el dueño', async () => {
    mockVerifyAuth.mockResolvedValue({ success: true, userId: 'ADMIN', email: 'a@vencemitfg.es' })
    mockIsAdminEmail.mockReturnValue(true)
    const j = await (await GET(req())).json()
    expect(j.todayTests).toHaveLength(1)
  })
})
