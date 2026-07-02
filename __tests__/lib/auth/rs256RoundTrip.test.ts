/**
 * @jest-environment node
 */
// __tests__/lib/auth/rs256RoundTrip.test.ts
// Entorno NODE (no jsdom): la firma/verificación RSA de jose exige que
// TextEncoder/crypto.subtle/Uint8Array vivan en el MISMO realm; jsdom rompe el
// `instanceof Uint8Array` interno de jose. Auth es server-side → node es lo correcto.
//
// Prueba end-to-end del pipeline RS256/JWKS (Fase B — emisor Auth.js):
//   mintAccessToken → verifyJwtRs256 → routing en verifyAuth → JWKS público.
// Genera un par RSA en el propio test (NUNCA la clave de prod).
//
// Foco de seguridad: doble-aceptación (RS256/HS256 por alg) + anti
// algorithm-confusion (la pública RSA jamás verifica como secreto HS).

import {
  generateKeyPair,
  exportPKCS8,
  exportSPKI,
  importPKCS8,
  SignJWT,
  decodeProtectedHeader,
} from 'jose'
import jwt from 'jsonwebtoken'

import { mintAccessToken } from '@/lib/auth/mintAccessToken'
import { verifyJwtRs256 } from '@/lib/api/auth/verifyJwtRs256'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { _clearRs256KeyCache } from '@/lib/api/auth/rs256'
import { _clearRemoteJwksCache } from '@/lib/api/auth/verifyJwtRs256'

const ISSUER = 'https://test.vence.es'
const KID = 'test-kid-202607'
const SUB = '550e8400-e29b-41d4-a716-446655440000'
const HS_SECRET = 'test-secret-must-be-at-least-32-bytes-long-1234567890'

let privatePem: string
let publicPem: string

function buildReq(token: string | null): unknown {
  return {
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'authorization'
          ? token === null
            ? null
            : `Bearer ${token}`
          : null,
    },
  }
}

async function signRs256(
  payload: Record<string, unknown>,
  opts: { issuer?: string; expiresInSec?: number } = {},
): Promise<string> {
  const key = await importPKCS8(privatePem, 'RS256')
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .setSubject(SUB)
    .setAudience('authenticated')
    .setIssuer(opts.issuer ?? ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + (opts.expiresInSec ?? 3600))
    .sign(key)
}

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  })
  privatePem = await exportPKCS8(privateKey)
  publicPem = await exportSPKI(publicKey)
})

beforeEach(() => {
  process.env.AUTH_JWT_PRIVATE_KEY = privatePem
  process.env.AUTH_JWT_PUBLIC_KEY = publicPem
  process.env.AUTH_JWT_KID = KID
  process.env.AUTH_JWT_ISSUER = ISSUER
  process.env.SUPABASE_JWT_SECRET = HS_SECRET
  process.env.JWT_LOCAL_VERIFY_MODE = 'on'
  _clearRs256KeyCache()
  _clearRemoteJwksCache()
})

describe('mint → verify (round trip)', () => {
  it('acuña un RS256 con el contrato correcto y verifica con sub intacto', async () => {
    const minted = await mintAccessToken({ sub: SUB, email: 'u@test.com' })
    expect(minted).not.toBeNull()

    const header = decodeProtectedHeader(minted!.token)
    expect(header.alg).toBe('RS256')
    expect(header.kid).toBe(KID)

    const res = await verifyJwtRs256(minted!.token)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.userId).toBe(SUB) // el sub NUNCA cambia
      expect(res.email).toBe('u@test.com')
      expect(res.role).toBe('authenticated')
    }
  })

  it('mint devuelve null si el emisor no está configurado (dormido)', async () => {
    delete process.env.AUTH_JWT_PRIVATE_KEY
    _clearRs256KeyCache()
    const minted = await mintAccessToken({ sub: SUB, email: null })
    expect(minted).toBeNull()
  })
})

describe('verifyAuth — routing por alg (doble-aceptación)', () => {
  it('token RS256 → verificado localmente (verifiedBy=local)', async () => {
    const minted = await mintAccessToken({ sub: SUB, email: 'u@test.com' })
    const result = await verifyAuth(buildReq(minted!.token) as never, '/test')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.userId).toBe(SUB)
      expect(result.verifiedBy).toBe('local')
    }
  })

  it('token HS256 legacy → sigue verificándose por la rama HS (intacto)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const hs = jwt.sign(
      { sub: SUB, email: 'u@test.com', role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 },
      HS_SECRET,
      { algorithm: 'HS256' },
    )
    const result = await verifyAuth(buildReq(hs) as never, '/test')
    expect(result.success).toBe(true)
    if (result.success) expect(result.userId).toBe(SUB)
  })
})

describe('anti algorithm-confusion', () => {
  it('un HS256 firmado con la clave PÚBLICA como secreto → RECHAZADO por verifyJwtRs256', async () => {
    const now = Math.floor(Date.now() / 1000)
    const confusion = jwt.sign(
      { sub: SUB, aud: 'authenticated', iss: ISSUER, iat: now, exp: now + 3600 },
      publicPem, // ← la pública usada como secreto HMAC (ataque clásico)
      { algorithm: 'HS256' },
    )
    const res = await verifyJwtRs256(confusion)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('unsupported_alg')
  })

  it('ese mismo token, vía verifyAuth, se enruta a HS y falla firma (no bypass)', async () => {
    const now = Math.floor(Date.now() / 1000)
    const confusion = jwt.sign(
      { sub: SUB, aud: 'authenticated', iat: now, exp: now + 3600 },
      publicPem,
      { algorithm: 'HS256' },
    )
    // alg=HS256 → rama HS con SUPABASE_JWT_SECRET (≠ publicPem) → firma inválida.
    const result = await verifyAuth(buildReq(confusion) as never, '/test')
    expect(result.success).toBe(false)
  })
})

describe('validación de claims', () => {
  it('token expirado → expired', async () => {
    const expired = await signRs256({ email: 'u@test.com', role: 'authenticated' }, { expiresInSec: -10 })
    const res = await verifyJwtRs256(expired)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('expired')
  })

  it('issuer distinto → wrong_issuer', async () => {
    const badIss = await signRs256({ email: 'u@test.com', role: 'authenticated' }, { issuer: 'https://evil.example.com' })
    const res = await verifyJwtRs256(badIss)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('wrong_issuer')
  })

  it('token firmado con OTRA clave (forjado) → invalid_signature', async () => {
    // Determinista: una firma de clave distinta NUNCA verifica contra la pública.
    // (Flipear un char de la firma es no-determinista: los bits "don't care" del
    // último char base64url a veces dejan los bytes idénticos → firma aún válida.)
    const other = await generateKeyPair('RS256', { extractable: true })
    const otherPriv = await exportPKCS8(other.privateKey)
    const forged = await new SignJWT({ email: 'u@test.com', role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
      .setSubject(SUB)
      .setAudience('authenticated')
      .setIssuer(ISSUER)
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(await importPKCS8(otherPriv, 'RS256'))
    const res = await verifyJwtRs256(forged)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('invalid_signature')
  })

  it('sin token → no_token', async () => {
    const res = await verifyJwtRs256(null)
    expect(res.success).toBe(false)
    if (!res.success) expect(res.error).toBe('no_token')
  })
})

describe('JWKS público (buildJwks)', () => {
  it('sirve la clave con kid/alg/use cuando el emisor está configurado', async () => {
    const { buildJwks } = await import('@/lib/api/auth/rs256')
    const body = await buildJwks()
    expect(body.keys).toHaveLength(1)
    expect(body.keys[0].kid).toBe(KID)
    expect(body.keys[0].alg).toBe('RS256')
    expect(body.keys[0].use).toBe('sig')
    expect(body.keys[0].kty).toBe('RSA')
    // NUNCA debe filtrar material privado.
    expect(body.keys[0].d).toBeUndefined()
  })

  it('dormido (sin clave pública) → { keys: [] }', async () => {
    delete process.env.AUTH_JWT_PUBLIC_KEY
    _clearRs256KeyCache()
    const { buildJwks } = await import('@/lib/api/auth/rs256')
    const body = await buildJwks()
    expect(body.keys).toEqual([])
  })
})
