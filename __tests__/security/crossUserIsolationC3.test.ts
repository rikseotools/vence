/** @jest-environment node */
// ============================================================================
// C3 — AISLAMIENTO CROSS-USER (docs/roadmap/auth-agnostico-jwks-y-rls.md)
// ============================================================================
// Prueba CONDUCTUAL que reemplaza a RLS (complementa al guardrail estático C2):
// para cada endpoint user-scoped, autenticados como el usuario A pero con la
// petición intentando colar el id del usuario B (en body/query), el SQL que llega
// a la BD DEBE acotarse a A — y el id de B NO debe aparecer NUNCA.
//
// Esto demuestra que el id sale SIEMPRE del TOKEN (verifyAuth), no del input:
// imposible que A lea/escriba filas de B aunque lo pida explícitamente.

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))
jest.mock('@/lib/api/rateLimit', () => ({
  checkRateLimit: () => ({ allowed: true, resetMs: 0 }),
  getClientIp: () => '1.2.3.4',
  RATE_LIMIT_PSYCHOMETRIC: {},
}))

import { GET as SESSIONS } from '@/app/api/v2/psychometric/sessions/route'
import { GET as WEAK } from '@/app/api/v2/psychometric/weak-areas/route'
import { GET as STUDIED } from '@/app/api/v2/studied-topics/route'
import { GET as DIFFICULTY } from '@/app/api/v2/psychometric/difficulty/route'
import { GET as FIRST } from '@/app/api/v2/psychometric/first-attempt/route'
import { POST as MARK_ALL } from '@/app/api/v2/disputes/mark-all-read/route'
import { POST as ANSWERED } from '@/app/api/v2/psychometric/answered-count/route'
import { POST as ADAPTIVE } from '@/app/api/v2/psychometric/adaptive-select/route'

// A = usuario autenticado (el del token). B = víctima cuyo id intentamos colar.
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const Q = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

function getReq(qs: string) {
  return { headers: { get: () => null }, url: `https://x${qs}`, json: async () => ({}) } as unknown as NextRequest
}
function postReq(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

// Cada caso: el handler + una petición que SÍ intenta colar el id de B.
const CASES: { name: string; run: () => Promise<unknown> }[] = [
  { name: 'GET psychometric/sessions', run: () => SESSIONS(getReq(`?userId=${B}`)) },
  { name: 'GET psychometric/weak-areas', run: () => WEAK(getReq(`?userId=${B}&days=30`)) },
  { name: 'GET studied-topics', run: () => STUDIED(getReq(`?userId=${B}`)) },
  { name: 'GET psychometric/difficulty', run: () => DIFFICULTY(getReq(`?questionId=${Q}&userId=${B}`)) },
  { name: 'GET psychometric/first-attempt', run: () => FIRST(getReq(`?questionId=${Q}&userId=${B}`)) },
  { name: 'POST disputes/mark-all-read', run: () => MARK_ALL(postReq({ userId: B, user_id: B })) },
  { name: 'POST psychometric/answered-count', run: () => ANSWERED(postReq({ userId: B, questionIds: [Q] })) },
  { name: 'POST psychometric/adaptive-select', run: () => ADAPTIVE(postReq({ userId: B, currentPerformance: null, questions: [{ id: Q }] })) },
]

beforeEach(() => {
  jest.clearAllMocks()
  // Autenticados SIEMPRE como A. Las respuestas vacías bastan (medimos el SQL).
  mockVerifyAuth.mockResolvedValue({ success: true, userId: A, email: 'a@a.a' })
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('C3 — el SQL se acota al TOKEN (A), nunca al id colado (B)', () => {
  for (const c of CASES) {
    it(`${c.name}: usa A y nunca B`, async () => {
      await c.run()
      const allSql = mockExecute.mock.calls.map((call) => JSON.stringify(call[0])).join('\n')
      // Debe haberse ejecutado al menos una query con el id del token.
      expect(allSql).toContain(A)
      // El id de la víctima jamás debe llegar al SQL.
      expect(allSql).not.toContain(B)
    })
  }
})

describe('C3 — sin token no se ejecuta ninguna query', () => {
  for (const c of CASES) {
    it(`${c.name}: 401 y 0 queries si no hay auth`, async () => {
      mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
      const res = (await c.run()) as { status: number }
      expect(res.status).toBe(401)
      expect(mockExecute).not.toHaveBeenCalled()
    })
  }
})
