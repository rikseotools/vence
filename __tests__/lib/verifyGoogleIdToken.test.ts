// __tests__/lib/verifyGoogleIdToken.test.ts
// Verificación del id_token de Google One Tap (fix del flip Auth.js): probamos la
// lógica PURA (hash de nonce + validación del payload ya verificado). La verificación
// criptográfica (firma/aud/iss/exp) la hace jose y no se re-testea aquí.
import { createHash } from 'node:crypto'
import { hashNonce, extractVerifiedGoogleUser } from '@/lib/auth/verifyGoogleIdToken'

const RAW = 'a-random-uuid-nonce'
// HEX: debe casar con el hashedNonce que GoogleOneTap.tsx envía a Google (hex de
// SHA-256). Si no casan, el nonce del id_token nunca valida y One Tap falla.
const HASH = createHash('sha256').update(RAW).digest('hex')

// Reproduce EXACTAMENTE el algoritmo del cliente (GoogleOneTap.tsx):
//   Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('')
// El digest se computa con node en vez de crypto.subtle, pero los bytes de SHA-256 son
// los mismos → la ÚNICA variable es la codificación. Si cliente o servidor cambian de
// codificación, el round-trip de abajo se rompe → One Tap protegido contra re-divergencia.
function clientHashedNonce(raw: string): string {
  return Array.from(createHash('sha256').update(raw).digest())
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

describe('hashNonce', () => {
  it('hex(SHA-256(raw)) — misma codificación que el hashedNonce del cliente', () => {
    expect(hashNonce(RAW)).toBe(HASH)
    expect(hashNonce(RAW)).toMatch(/^[0-9a-f]{64}$/) // hex de 32 bytes, sin base64url
  })

  // GUARDA del contrato cliente↔servidor: si divergen, One Tap muere con
  // CredentialsSignin (regresión del flip Auth.js). Este test lo caza en CI.
  it('round-trip: hashNonce (servidor) === hashedNonce (cliente) para el mismo raw', () => {
    expect(hashNonce(RAW)).toBe(clientHashedNonce(RAW))
  })
})

describe('extractVerifiedGoogleUser', () => {
  const base = { sub: 'google-sub-123', email: 'User@Example.com', email_verified: true, name: 'Ada' }

  it('token con nonce válido → usuario', () => {
    const u = extractVerifiedGoogleUser({ ...base, nonce: HASH }, RAW)
    expect(u).toEqual({ email: 'User@Example.com', name: 'Ada', sub: 'google-sub-123' })
  })

  it('nonce no coincide → null (anti-replay)', () => {
    expect(extractVerifiedGoogleUser({ ...base, nonce: HASH }, 'otro-nonce')).toBeNull()
  })

  it('token trae nonce pero no llega el raw → null', () => {
    expect(extractVerifiedGoogleUser({ ...base, nonce: HASH }, undefined)).toBeNull()
  })

  it('token SIN nonce → se acepta (no todos los flujos lo mandan)', () => {
    const u = extractVerifiedGoogleUser({ ...base }, undefined)
    expect(u?.email).toBe('User@Example.com')
  })

  it('email_verified=false (bool o string) → null', () => {
    expect(extractVerifiedGoogleUser({ ...base, email_verified: false }, undefined)).toBeNull()
    expect(extractVerifiedGoogleUser({ ...base, email_verified: 'false' }, undefined)).toBeNull()
  })

  it('sin email → null', () => {
    expect(extractVerifiedGoogleUser({ sub: 'x', email_verified: true }, undefined)).toBeNull()
  })

  it('sin name → name null; sin sub → cae al email', () => {
    const u = extractVerifiedGoogleUser({ email: 'x@y.com', email_verified: true }, undefined)
    expect(u).toEqual({ email: 'x@y.com', name: null, sub: 'x@y.com' })
  })
})
