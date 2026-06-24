/** @jest-environment node */
// Tests de los 5 endpoints de detección de fraude (Fase C1, migración de /admin/fraudes).
// Todos requireAdmin. Verifica el gate + que devuelven la clave esperada.

import { NextRequest } from 'next/server'

const mockRequireAdmin = jest.fn()
const mockExecute = jest.fn()

jest.mock('@/lib/api/shared/auth', () => ({ requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a) }))
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: mockExecute }) }))
jest.mock('@/lib/api/withErrorLogging', () => ({ withErrorLogging: (_p: string, h: unknown) => h }))

import { GET as PREMIUM } from '@/app/api/v2/admin/fraud/premium/route'
import { GET as MULTI } from '@/app/api/v2/admin/fraud/multi/route'
import { GET as BOTS } from '@/app/api/v2/admin/fraud/bots/route'
import { GET as SCRIPTS } from '@/app/api/v2/admin/fraud/scripts/route'
import { GET as BLOCKED } from '@/app/api/v2/admin/fraud/blocked/route'

function req() { return { headers: { get: () => null }, url: 'https://x' } as unknown as NextRequest }
async function forbidden() {
  const { NextResponse } = await import('next/server')
  return { ok: false, response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
}
const all: [string, (r: NextRequest) => Promise<Response>, string][] = [
  ['premium', PREMIUM as any, 'premium'],
  ['multi', MULTI as any, 'multi'],
  ['bots', BOTS as any, 'bots'],
  ['scripts', SCRIPTS as any, 'scripts'],
  ['blocked', BLOCKED as any, 'blocked'],
]

beforeEach(() => {
  jest.clearAllMocks()
  mockExecute.mockResolvedValue({ rows: [] })
})

describe('admin fraud endpoints', () => {
  test('403 en todos sin admin', async () => {
    mockRequireAdmin.mockResolvedValue(await forbidden())
    for (const [, fn] of all) expect((await fn(req())).status).toBe(403)
    expect(mockExecute).not.toHaveBeenCalled()
  })

  test('admin: cada uno devuelve su clave (lista vacía sin datos)', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    for (const [, fn, key] of all) {
      const j = await (await fn(req())).json()
      expect(j.success).toBe(true)
      expect(Array.isArray(j[key])).toBe(true)
    }
  })

  test('bots: usa created_at (no answered_at, columna inexistente)', async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, user: { id: 'A', email: 'a@x' } })
    mockExecute.mockResolvedValue({ rows: [] })
    await BOTS(req())
    const s = JSON.stringify(mockExecute.mock.calls[0][0])
    expect(s).toContain('created_at')
    expect(s).not.toContain('answered_at')
  })
})
