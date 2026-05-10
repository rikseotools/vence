// __tests__/lib/auth/verifyAuth.test.ts
// Tests del wrapper de auth con shadow mode.
//
// COBERTURA:
// 1. Modo off: solo remote (comportamiento legacy)
// 2. Modo on: solo local
// 3. Modo shadow: ambos en paralelo, sirve remote, loguea divergencia
// 4. Sin Bearer token → 401
// 5. Modos rechazados con flag inválido → fallback a 'off' (seguro)

import jwt from 'jsonwebtoken'

const TEST_SECRET = 'test-secret-must-be-at-least-32-bytes-long-1234567890'
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

function signTestToken(opts: { sub?: string; email?: string; secret?: string } = {}): string {
  const now = Math.floor(Date.now() / 1000)
  return jwt.sign(
    {
      sub: opts.sub ?? VALID_USER_ID,
      email: opts.email ?? 'user@test.com',
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + 3600,
    },
    opts.secret ?? TEST_SECRET,
    { algorithm: 'HS256' },
  )
}

function buildReq(opts: { token?: string | null } = {}): unknown {
  const token = opts.token === undefined ? signTestToken() : opts.token
  return {
    headers: {
      get: (k: string) => {
        if (k.toLowerCase() === 'authorization') {
          return token === null ? null : `Bearer ${token}`
        }
        return null
      },
    },
  }
}

describe('verifyAuth — modo off (legacy)', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.JWT_LOCAL_VERIFY_MODE = 'off'
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'

    jest.doMock('@/lib/api/validation-error-log', () => ({
      logValidationError: jest.fn(),
    }))
  })

  it('remote OK → success con verifiedBy=remote', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: VALID_USER_ID, email: 'remote@test.com' } },
            error: null,
          }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.userId).toBe(VALID_USER_ID)
    expect(result.email).toBe('remote@test.com')
    expect(result.verifiedBy).toBe('remote')
  })

  it('remote fail → 401', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.status).toBe(401)
  })
})

describe('verifyAuth — modo on (local only)', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.JWT_LOCAL_VERIFY_MODE = 'on'
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'

    jest.doMock('@/lib/api/validation-error-log', () => ({
      logValidationError: jest.fn(),
    }))
  })

  it('token válido → success sin tocar remote', async () => {
    const remoteSpy = jest.fn()
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: remoteSpy },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.verifiedBy).toBe('local')
    expect(result.userId).toBe(VALID_USER_ID)
    expect(remoteSpy).not.toHaveBeenCalled() // CRÍTICO: no round-trip
  })

  it('token inválido (firma rota) → 401 sin tocar remote', async () => {
    const remoteSpy = jest.fn()
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: remoteSpy },
      }),
    }))

    const badToken = signTestToken({ secret: 'wrong-secret-different-from-server-1234567' })
    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq({ token: badToken }) as never, '/test/endpoint')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.status).toBe(401)
    expect(result.reason).toContain('local_')
    expect(remoteSpy).not.toHaveBeenCalled()
  })
})

describe('verifyAuth — modo shadow', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.JWT_LOCAL_VERIFY_MODE = 'shadow'
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
  })

  it('ambos OK + same userId → success con verifiedBy=shadow_remote, NO log', async () => {
    const logFn = jest.fn()
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: logFn }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: VALID_USER_ID, email: 'user@test.com' } },
            error: null,
          }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.verifiedBy).toBe('shadow_remote')
    expect(result.userId).toBe(VALID_USER_ID)
    expect(logFn).not.toHaveBeenCalled() // sin divergencia, sin log
  })

  it('local OK pero remote fail → divergencia logueada, sirve remote (401)', async () => {
    const logFn = jest.fn()
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: logFn }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(false) // sirve resultado de remote (fail)
    if (result.success) return
    expect(result.status).toBe(401)
    expect(logFn).toHaveBeenCalledTimes(1)
    expect(logFn.mock.calls[0][0].errorType).toBe('shadow_auth_divergence')
  })

  it('userId mismatch → divergencia logueada, sirve remote', async () => {
    const logFn = jest.fn()
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: logFn }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'different-user-id', email: 'remote@test.com' } },
            error: null,
          }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    // Sirve remote (different-user-id), aunque local dice VALID_USER_ID
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.userId).toBe('different-user-id')
    expect(logFn).toHaveBeenCalledTimes(1)
    expect(logFn.mock.calls[0][0].errorMessage).toContain('userid_mismatch')
  })

  it('email mismatch → divergencia logueada (informativa)', async () => {
    const logFn = jest.fn()
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: logFn }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: VALID_USER_ID, email: 'updated@test.com' } },
            error: null,
          }),
        },
      }),
    }))

    // Token tiene email "user@test.com", remote dice "updated@test.com"
    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.email).toBe('updated@test.com') // sirve email de remote
    expect(logFn).toHaveBeenCalledTimes(1)
    expect(logFn.mock.calls[0][0].errorMessage).toContain('email_mismatch')
  })
})

describe('verifyAuth — input edge cases', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.JWT_LOCAL_VERIFY_MODE = 'shadow'
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: jest.fn() }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      }),
    }))
  })

  it('sin Authorization header → 401 no_bearer_token sin tocar verify', async () => {
    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq({ token: null }) as never, '/test/endpoint')

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.status).toBe(401)
    expect(result.reason).toBe('no_bearer_token')
  })

  it('flag con valor inválido → fallback a "off" (defensivo)', async () => {
    process.env.JWT_LOCAL_VERIFY_MODE = 'invalid_value' as never

    jest.resetModules()
    jest.doMock('@/lib/api/validation-error-log', () => ({ logValidationError: jest.fn() }))
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: { id: VALID_USER_ID, email: 'user@test.com' } },
            error: null,
          }),
        },
      }),
    }))

    const { verifyAuth } = require('@/lib/api/auth/verifyAuth')
    const result = await verifyAuth(buildReq() as never, '/test/endpoint')

    // Debería comportarse como off
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.verifiedBy).toBe('remote')
  })
})
