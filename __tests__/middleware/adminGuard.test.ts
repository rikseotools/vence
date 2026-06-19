/**
 * Guard de /api/admin/* (lib/security/adminApiGuard, llamado desde proxy.ts).
 * Verifica las ramas: sin token → 401, x-cron-secret válido → permite (null),
 * token no-admin → 403, token admin → permite. Hallazgo 18/06: estas rutas eran
 * invocables sin auth. (Next 16+ usa proxy.ts, no middleware.ts.)
 */

// jsdom no trae el estático Response.json (lo usa NextResponse.json). Polyfill.
if (typeof (Response as unknown as { json?: unknown }).json !== 'function') {
  ;(Response as unknown as { json: unknown }).json = (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
    })
}

const mockGetUser = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: (...a: unknown[]) => mockGetUser(...a) } }),
}))

import { guardAdminApi } from '@/lib/security/adminApiGuard'
import { NextRequest } from 'next/server'

const OLD_ENV = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, CRON_SECRET: 'cron-xyz', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }
})
afterAll(() => { process.env = OLD_ENV })

function req(headers: Record<string, string> = {}, method = 'GET') {
  return new NextRequest('https://www.vence.es/api/admin/newsletters/send', { method, headers })
}

describe('guardAdminApi — /api/admin/*', () => {
  test('sin Authorization ni cron-secret → 401', async () => {
    const res = await guardAdminApi(req())
    expect(res?.status).toBe(401)
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  test('x-cron-secret válido → permite (null), sin validar token', async () => {
    const res = await guardAdminApi(req({ 'x-cron-secret': 'cron-xyz' }))
    expect(res).toBeNull()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  test('x-cron-secret incorrecto + sin token → 401', async () => {
    expect((await guardAdminApi(req({ 'x-cron-secret': 'malo' })))?.status).toBe(401)
  })

  test('Bearer de token inválido → 401', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    expect((await guardAdminApi(req({ authorization: 'Bearer bad' })))?.status).toBe(401)
  })

  test('Bearer de usuario NO admin → 403', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'random@gmail.com' } }, error: null })
    expect((await guardAdminApi(req({ authorization: 'Bearer tok' })))?.status).toBe(403)
  })

  test('Bearer de admin whitelist → permite (null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'manueltrader@gmail.com' } }, error: null })
    expect(await guardAdminApi(req({ authorization: 'Bearer tok' }))).toBeNull()
  })

  test('Bearer de dominio @vencemitfg.es → permite (null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'quien@vencemitfg.es' } }, error: null })
    expect(await guardAdminApi(req({ authorization: 'Bearer tok' }))).toBeNull()
  })

  test('OPTIONS (preflight) → permite (null) sin auth', async () => {
    const res = await guardAdminApi(req({}, 'OPTIONS'))
    expect(res).toBeNull()
    expect(mockGetUser).not.toHaveBeenCalled()
  })
})
