// __tests__/lib/auth/verifyJwtLocal.test.ts
// Tests críticos de seguridad del verificador JWT local.
//
// COBERTURA OBLIGATORIA:
// 1. Tokens válidos → userId/email/role extraídos correctamente
// 2. Algorithm confusion attack → rechazo (none, RS256, HS512)
// 3. Firma incorrecta → rechazo
// 4. Token expirado → rechazo
// 5. Audience incorrecta → rechazo
// 6. Token malformado → rechazo
// 7. Bearer token extraction edge cases
// 8. Sin secret configurado → error específico (no false positive de validación)
//
// Si CUALQUIER test falla, NO mergear. Es código de seguridad — un bypass
// aquí = bypass de auth en toda la app.

import jwt from 'jsonwebtoken'
import { verifyJwtLocal, extractBearerToken, _clearSecretCache } from '@/lib/api/auth/verifyJwtLocal'

const TEST_SECRET = 'test-secret-must-be-at-least-32-bytes-long-1234567890'
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

/** Helper: firma un token de prueba con claims customizables. */
function signTestToken(opts: {
  alg?: 'HS256' | 'HS384' | 'HS512' | 'none'
  sub?: string
  email?: string | null
  role?: string
  aud?: string
  iss?: string
  exp?: number
  iat?: number
  secret?: string
  extraClaims?: Record<string, unknown>
} = {}): string {
  const alg = opts.alg ?? 'HS256'
  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, unknown> = {
    sub: opts.sub ?? VALID_USER_ID,
    aud: opts.aud ?? 'authenticated',
    iat: opts.iat ?? now,
    exp: opts.exp ?? now + 3600,
    role: opts.role ?? 'authenticated',
    ...(opts.extraClaims ?? {}),
  }
  if (opts.email !== null) {
    payload.email = opts.email ?? 'user@test.com'
  }
  if (opts.iss) payload.iss = opts.iss

  return jwt.sign(payload, opts.secret ?? TEST_SECRET, { algorithm: alg as jwt.Algorithm })
}

describe('verifyJwtLocal — happy path', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('token HS256 válido con email + role → success con campos extraídos', () => {
    const token = signTestToken({
      sub: VALID_USER_ID,
      email: 'manuel@vence.es',
      role: 'authenticated',
    })

    const result = verifyJwtLocal(token)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.userId).toBe(VALID_USER_ID)
    expect(result.email).toBe('manuel@vence.es')
    expect(result.role).toBe('authenticated')
    expect(result.payload).toBeDefined()
  })

  it('token sin email (OAuth con privacy mode) → success con email=null', () => {
    const token = signTestToken({ email: null })
    const result = verifyJwtLocal(token)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.email).toBeNull()
  })

  it('token con app_metadata custom → claims accesibles vía payload', () => {
    const token = signTestToken({
      extraClaims: {
        app_metadata: { provider: 'google', tier: 'premium' },
        user_metadata: { full_name: 'Manuel Casado' },
      },
    })

    const result = verifyJwtLocal(token)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect((result.payload as Record<string, unknown>).app_metadata).toEqual({ provider: 'google', tier: 'premium' })
    expect((result.payload as Record<string, unknown>).user_metadata).toEqual({ full_name: 'Manuel Casado' })
  })

  it('clockTolerance 5s — token recién firmado funciona aunque haya skew mínimo', () => {
    const now = Math.floor(Date.now() / 1000)
    // Token firmado "en el futuro" por 3 segundos (clock skew). Debe pasar.
    const token = signTestToken({ iat: now + 3, exp: now + 3603 })
    const result = verifyJwtLocal(token)
    expect(result.success).toBe(true)
  })
})

describe('verifyJwtLocal — algorithm confusion attacks', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('CRÍTICO: rechaza token con alg "none" (intento bypass)', () => {
    // Construir manualmente un token con alg:none (jsonwebtoken sí permite firmar
    // con none, pero verify lo rechaza con whitelist).
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({
      sub: VALID_USER_ID,
      email: 'attacker@evil.com',
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    })).toString('base64url')
    const fakeToken = `${header}.${payload}.`

    const result = verifyJwtLocal(fakeToken)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(['unsupported_alg', 'invalid_signature', 'malformed']).toContain(result.error)
  })

  it('CRÍTICO: rechaza token firmado con HS512 (alg fuera de whitelist)', () => {
    const token = signTestToken({ alg: 'HS512' })
    const result = verifyJwtLocal(token)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(['unsupported_alg', 'invalid_signature']).toContain(result.error)
  })

  it('CRÍTICO: rechaza token firmado con HS384 (alg fuera de whitelist)', () => {
    const token = signTestToken({ alg: 'HS384' })
    const result = verifyJwtLocal(token)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(['unsupported_alg', 'invalid_signature']).toContain(result.error)
  })
})

describe('verifyJwtLocal — invalid signatures', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('rechaza token firmado con secret distinto', () => {
    const token = signTestToken({ secret: 'attacker-controlled-secret-1234567890abcdef' })

    const result = verifyJwtLocal(token)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('invalid_signature')
  })

  it('rechaza token con firma manipulada (último char modificado)', () => {
    const token = signTestToken()
    // Manipular último carácter de la firma (parte 3 del JWT)
    const parts = token.split('.')
    const lastChar = parts[2].slice(-1)
    const newChar = lastChar === 'A' ? 'B' : 'A'
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}${newChar}`

    const result = verifyJwtLocal(tampered)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(['invalid_signature', 'malformed']).toContain(result.error)
  })

  it('CRÍTICO: rechaza token con payload manipulado (impersonar otro user)', () => {
    const token = signTestToken({ sub: VALID_USER_ID })
    const parts = token.split('.')
    const decoded = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    decoded.sub = 'attacker-tries-to-impersonate'
    const newPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url')
    const tampered = `${parts[0]}.${newPayload}.${parts[2]}`

    const result = verifyJwtLocal(tampered)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('invalid_signature')
  })
})

describe('verifyJwtLocal — expiry & timing', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('rechaza token expirado hace 10 minutos', () => {
    const past = Math.floor(Date.now() / 1000) - 600
    const token = signTestToken({ iat: past - 3600, exp: past })

    const result = verifyJwtLocal(token)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('expired')
  })

  it('rechaza token expirado hace 6 segundos (fuera de tolerancia 5s)', () => {
    const justExpired = Math.floor(Date.now() / 1000) - 6
    const token = signTestToken({ exp: justExpired, iat: justExpired - 3600 })

    const result = verifyJwtLocal(token)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('expired')
  })
})

describe('verifyJwtLocal — audience validation', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('rechaza token con aud distinto de "authenticated"', () => {
    const token = signTestToken({ aud: 'admin' })
    const result = verifyJwtLocal(token)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('wrong_audience')
  })

  it('rechaza token con aud "anon" (anon key reutilizado)', () => {
    const token = signTestToken({ aud: 'anon' })
    const result = verifyJwtLocal(token)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('wrong_audience')
  })
})

describe('verifyJwtLocal — input validation', () => {
  beforeEach(() => {
    _clearSecretCache()
    process.env.SUPABASE_JWT_SECRET = TEST_SECRET
  })

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET
    _clearSecretCache()
  })

  it('null → no_token', () => {
    const result = verifyJwtLocal(null)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('no_token')
  })

  it('undefined → no_token', () => {
    const result = verifyJwtLocal(undefined)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('no_token')
  })

  it('string vacío → no_token', () => {
    const result = verifyJwtLocal('')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('no_token')
  })

  it('string aleatorio (no es JWT) → malformed', () => {
    const result = verifyJwtLocal('definitely-not-a-jwt-token')
    expect(result.success).toBe(false)
    if (result.success) return
    expect(['malformed', 'unsupported_alg', 'invalid_signature']).toContain(result.error)
  })

  it('JWT sin sub → malformed', () => {
    // Firmamos un token sin sub
    const now = Math.floor(Date.now() / 1000)
    const token = jwt.sign(
      { email: 'x@y.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 },
      TEST_SECRET,
      { algorithm: 'HS256' },
    )

    const result = verifyJwtLocal(token)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('malformed')
  })
})

describe('verifyJwtLocal — secret missing', () => {
  beforeEach(() => {
    _clearSecretCache()
    delete process.env.SUPABASE_JWT_SECRET
  })

  afterEach(() => {
    _clearSecretCache()
  })

  it('CRÍTICO: sin SUPABASE_JWT_SECRET → no_secret_configured (NO false positive)', () => {
    const token = signTestToken({ secret: TEST_SECRET })
    const result = verifyJwtLocal(token)

    expect(result.success).toBe(false)
    if (result.success) return
    // CRÍTICO: nunca devolver success=true sin secret. El error debe ser
    // explícito para que el wrapper sepa que NO puede usar local verify.
    expect(result.error).toBe('no_secret_configured')
  })
})

describe('extractBearerToken', () => {
  it('header válido → token sin prefijo', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it('header con espacios extra → token trimmed', () => {
    expect(extractBearerToken('Bearer    abc.def.ghi  ')).toBe('abc.def.ghi')
  })

  it('null → null', () => {
    expect(extractBearerToken(null)).toBeNull()
  })

  it('undefined → null', () => {
    expect(extractBearerToken(undefined)).toBeNull()
  })

  it('header sin prefijo Bearer → null', () => {
    expect(extractBearerToken('abc.def.ghi')).toBeNull()
  })

  it('header con prefijo Bearer pero token vacío → null', () => {
    expect(extractBearerToken('Bearer ')).toBeNull()
    expect(extractBearerToken('Bearer    ')).toBeNull()
  })

  it('case sensitive: "bearer" minúsculas no es válido (Supabase envía "Bearer")', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBeNull()
  })
})
