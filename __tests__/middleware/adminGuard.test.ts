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

// Verificador RS256 (tokens del flip Auth.js). El guard lo usa cuando el alg del
// header es RS256; para HS256/otros cae al getUser remoto de Supabase.
const mockVerifyRs256 = jest.fn()
jest.mock('@/lib/api/auth/verifyJwtRs256', () => ({
  verifyJwtRs256: (...a: unknown[]) => mockVerifyRs256(...a),
}))

import { guardAdminApi } from '@/lib/security/adminApiGuard'
import { NextRequest } from 'next/server'

/** Construye un JWT con un header `alg` real (payload/firma ficticios: el
 *  verificador está mockeado; solo importa que decodeProtectedHeader lea el alg). */
function jwtWithAlg(alg: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg, typ: 'JWT' })}.${b64({ sub: 'u' })}.sig`
}

const OLD_ENV = process.env
beforeEach(() => {
  jest.clearAllMocks()
  process.env = { ...OLD_ENV, CRON_SECRET: 'cron-xyz', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' }
})
afterAll(() => { process.env = OLD_ENV })

function req(headers: Record<string, string> = {}, method = 'GET', path = '/api/admin/newsletters/send') {
  return new NextRequest(`https://www.vence.es${path}`, { method, headers })
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

describe('guardAdminApi — rutas con auth propia (SELF_AUTHENTICATED_PREFIXES)', () => {
  test('stripe-fees-summary sin token → permite (null): se autoprotege en el handler', async () => {
    const res = await guardAdminApi(req({}, 'GET', '/api/admin/stripe-fees-summary'))
    expect(res).toBeNull()
    expect(mockGetUser).not.toHaveBeenCalled()
  })

  test('subruta de stripe-fees-summary también exenta', async () => {
    const res = await guardAdminApi(req({}, 'GET', '/api/admin/stripe-fees-summary/detail'))
    expect(res).toBeNull()
  })

  test('lookalike (stripe-fees-summary-X) NO se exime → 401 sin token', async () => {
    const res = await guardAdminApi(req({}, 'GET', '/api/admin/stripe-fees-summary-fake'))
    expect(res?.status).toBe(401)
  })
})

// REGRESIÓN del flip (03/07): el guard solo hacía getUser remoto → Supabase no
// reconoce los RS256 de Auth.js → TODO el panel admin daba 401. Ahora enruta por alg.
describe('guardAdminApi — tokens RS256 del flip (enrutado por alg)', () => {
  test('RS256 de admin whitelist → permite (null) SIN tocar Supabase remoto', async () => {
    mockVerifyRs256.mockResolvedValue({ success: true, userId: 'u', email: 'manueltrader@gmail.com' })
    const res = await guardAdminApi(req({ authorization: `Bearer ${jwtWithAlg('RS256')}` }, 'GET', '/api/v2/admin/dashboard'))
    expect(res).toBeNull()
    expect(mockVerifyRs256).toHaveBeenCalledTimes(1)
    expect(mockGetUser).not.toHaveBeenCalled() // RS256 NO va por el path remoto legacy
  })

  test('RS256 de usuario NO admin → 403', async () => {
    mockVerifyRs256.mockResolvedValue({ success: true, userId: 'u', email: 'random@gmail.com' })
    expect((await guardAdminApi(req({ authorization: `Bearer ${jwtWithAlg('RS256')}` })))?.status).toBe(403)
  })

  test('RS256 inválido (firma/exp) → 401', async () => {
    mockVerifyRs256.mockResolvedValue({ success: false, error: 'invalid_signature' })
    expect((await guardAdminApi(req({ authorization: `Bearer ${jwtWithAlg('RS256')}` })))?.status).toBe(401)
  })

  test('HS256 sigue yendo por Supabase remoto (legacy intacto)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'manueltrader@gmail.com' } }, error: null })
    const res = await guardAdminApi(req({ authorization: `Bearer ${jwtWithAlg('HS256')}` }))
    expect(res).toBeNull()
    expect(mockGetUser).toHaveBeenCalledTimes(1)
    expect(mockVerifyRs256).not.toHaveBeenCalled()
  })
})

describe('guardAdminApi — /api/v2/admin/* (mismo guard, ahora cubierto por el proxy)', () => {
  test('/api/v2/admin/validation-errors sin token → 401', async () => {
    const res = await guardAdminApi(req({}, 'GET', '/api/v2/admin/validation-errors'))
    expect(res?.status).toBe(401)
  })

  test('/api/v2/admin/dashboard con Bearer admin → permite (null)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'manueltrader@gmail.com' } }, error: null })
    const res = await guardAdminApi(req({ authorization: 'Bearer tok' }, 'GET', '/api/v2/admin/dashboard'))
    expect(res).toBeNull()
  })
})
