/** @jest-environment node */
// Tests de los endpoints de analytics psicotécnicas (Fase C1, historial del propio usuario):
//   GET /api/v2/psychometric/sessions    (mis-estadisticas/psicotecnicos)
//   GET /api/v2/psychometric/weak-areas  (PsychometricWeakAreasAnalysis, embed)

import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as SESSIONS } from '@/app/api/v2/psychometric/sessions/route'
import { GET as WEAK } from '@/app/api/v2/psychometric/weak-areas/route'

function req(url = 'https://x') { return { headers: { get: () => null }, url } as unknown as NextRequest }
const AUTH = { success: true, userId: 'U_TOKEN', email: 'a@b.c' }

beforeEach(() => { jest.clearAllMocks(); mockExecute.mockResolvedValue({ rows: [] }) })

describe('GET /api/v2/psychometric/sessions', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await SESSIONS(req())).status).toBe(401)
  })
  test('filtra por user del token + session_type', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [{ id: 's1' }] })
    const j = await (await SESSIONS(req('https://x?days=7'))).json()
    expect(j.sessions).toHaveLength(1)
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).toContain('psychometric')
  })
})

describe('GET /api/v2/psychometric/weak-areas', () => {
  test('401 sin auth', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401 })
    expect((await WEAK(req())).status).toBe(401)
  })
  test('embed con columnas reales (difficulty/time_limit_seconds, no las inexistentes) + user del token', async () => {
    mockVerifyAuth.mockResolvedValue(AUTH)
    mockExecute.mockResolvedValue({ rows: [{ id: 'a1', psychometric_questions: {} }] })
    const j = await (await WEAK(req('https://x?days=30'))).json()
    expect(j.answers).toHaveLength(1)
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('U_TOKEN')
    expect(s).toContain('q.difficulty')             // columna fuente real
    expect(s).toContain('q.time_limit_seconds')     // columna fuente real
    expect(s).not.toContain('q.difficulty_level')   // la inexistente que tenía el original
    expect(s).not.toContain('q.estimated_time_seconds')
  })
})
