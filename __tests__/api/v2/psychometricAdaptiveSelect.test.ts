/** @jest-environment node */
// POST /api/v2/psychometric/adaptive-select — reordena IDs (no-vistas primero +
// filtro de dificultad) para el PROPIO usuario. Hot-path psicotécnico.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { POST } from '@/app/api/v2/psychometric/adaptive-select/route'

const U1 = '11111111-1111-1111-1111-111111111111'
const U2 = '22222222-2222-2222-2222-222222222222'
const U3 = '33333333-3333-3333-3333-333333333333'
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

function req(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

test('401 sin auth', async () => {
  mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
  expect((await POST(req({}))).status).toBe(401)
})

test('historial de respuestas se consulta con el user del token', async () => {
  mockVerifyAuth.mockResolvedValue(AUTH)
  await POST(req({ currentPerformance: null, questions: [{ id: U1 }] }))
  expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('U_TOKEN')
})

test('sin performance → baraja todos los ids (mismos elementos)', async () => {
  mockVerifyAuth.mockResolvedValue(AUTH)
  mockExecute.mockResolvedValue({ rows: [] }) // sin historial
  const j = await (await POST(req({ currentPerformance: null, questions: [{ id: U1 }, { id: U2 }, { id: U3 }] }))).json()
  expect(j.orderedIds.sort()).toEqual([U1, U2, U3].sort())
})

test('baseline (questionsAnswered<2): no-vistas primero, respondidas al final', async () => {
  mockVerifyAuth.mockResolvedValue(AUTH)
  // U1 ya respondida; U2/U3 nunca vistas → U1 debe quedar al final
  mockExecute.mockResolvedValue({ rows: [{ question_id: U1, created_at: '2026-01-01T00:00:00Z' }] })
  const j = await (await POST(req({
    currentPerformance: { questionsAnswered: 0, correctAnswers: 0, incorrectStreak: 0 },
    questions: [{ id: U1 }, { id: U2 }, { id: U3 }],
  }))).json()
  expect(j.orderedIds[2]).toBe(U1)
  expect(j.orderedIds.slice(0, 2).sort()).toEqual([U2, U3].sort())
})

test('descarta ids que no son UUID (anti-inyección)', async () => {
  mockVerifyAuth.mockResolvedValue(AUTH)
  mockExecute.mockResolvedValue({ rows: [] })
  const j = await (await POST(req({
    currentPerformance: null,
    questions: [{ id: U1 }, { id: "x'; DROP TABLE--" }, { id: U2 }],
  }))).json()
  expect(j.orderedIds.sort()).toEqual([U1, U2].sort())
})
