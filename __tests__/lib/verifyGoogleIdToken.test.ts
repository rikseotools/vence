// __tests__/lib/verifyGoogleIdToken.test.ts
// Verificación del id_token de Google One Tap (fix del flip Auth.js): probamos la
// lógica PURA (hash de nonce + validación del payload ya verificado). La verificación
// criptográfica (firma/aud/iss/exp) la hace jose y no se re-testea aquí.
import { createHash } from 'node:crypto'
import { hashNonce, extractVerifiedGoogleUser } from '@/lib/auth/verifyGoogleIdToken'

const RAW = 'a-random-uuid-nonce'
const HASH = createHash('sha256').update(RAW).digest('base64url')

describe('hashNonce', () => {
  it('base64url(SHA-256(raw)) — el formato que Google pone en el claim nonce', () => {
    expect(hashNonce(RAW)).toBe(HASH)
    expect(hashNonce(RAW)).not.toContain('=') // base64url, sin padding
    expect(hashNonce(RAW)).not.toContain('+')
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
