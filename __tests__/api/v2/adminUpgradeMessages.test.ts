/** @jest-environment node */
// Tests de los endpoints admin que reemplazan los .from de /admin/conversiones (C1):
//   GET  /api/v2/admin/upgrade-messages/impressions  (embed)
//   POST /api/v2/admin/upgrade-messages/update        (weight / is_active)

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({
  requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
}))
jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: mockExecute }),
}))
jest.mock('@/lib/api/withErrorLogging', () => ({
  withErrorLogging: (_p: string, h: unknown) => h,
}))

import { GET as IMPRESSIONS } from '@/app/api/v2/admin/upgrade-messages/impressions/route'
import { POST as UPDATE } from '@/app/api/v2/admin/upgrade-messages/update/route'

const MID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
function reqUrl() {
  return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest
}
function reqBody(body: unknown) {
  return { headers: { get: () => null }, url: 'https://x', json: async () => body } as unknown as NextRequest
}
async function forbidden() {
  const { NextResponse } = await import('next/server')
  return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('GET /api/v2/admin/upgrade-messages/impressions', () => {
  test('403 si no admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await IMPRESSIONS(reqUrl())).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })
  test('admin → devuelve impressions', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValue({ rows: [{ id: 'i1', upgrade_messages: { title: 'T' } }] })
    expect((await (await IMPRESSIONS(reqUrl())).json()).impressions).toHaveLength(1)
  })
})

describe('POST /api/v2/admin/upgrade-messages/update', () => {
  test('403 si no admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    expect((await UPDATE(reqBody({ messageId: MID, weight: 5 }))).status).toBe(403)
  })
  test('400 si no hay nada que actualizar', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    expect((await UPDATE(reqBody({ messageId: MID }))).status).toBe(400)
  })
  test('actualiza weight', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    const res = await UPDATE(reqBody({ messageId: MID, weight: 7 }))
    expect(res.status).toBe(200)
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('weight')
    expect(s).toContain(MID)
  })
  test('actualiza is_active', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    await UPDATE(reqBody({ messageId: MID, isActive: false }))
    expect(JSON.stringify(mockExecute.mock.calls[0][0])).toContain('is_active')
  })
})
