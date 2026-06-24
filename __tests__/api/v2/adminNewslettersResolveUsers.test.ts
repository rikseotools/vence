/** @jest-environment node */
// Tests de POST /api/v2/admin/newsletters/resolve-users (Fase C1, migración de
// /admin/newsletters retry). requireAdmin + resolución emails→usuarios.

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { POST } from '@/app/api/v2/admin/newsletters/resolve-users/route'

function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('POST /api/v2/admin/newsletters/resolve-users', () => {
  test('403 si no admin', async () => {
    const { NextResponse } = await import('next/server')
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) })
    expect((await POST(reqBody({ emails: ['a@x'] }))).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })
  test('400 si emails vacío', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    expect((await POST(reqBody({ emails: [] }))).status).toBe(400)
  })
  test('admin → resuelve usuarios; query usa los emails', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValue({ rows: [{ id: 'U1', email: 'a@x', full_name: 'A' }] })
    const j = await (await POST(reqBody({ emails: ['a@x', 'b@x'] }))).json()
    expect(j.users).toHaveLength(1)
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('a@x')
  })
})
