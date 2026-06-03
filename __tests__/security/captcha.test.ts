/**
 * @jest-environment node
 */
// __tests__/security/captcha.test.ts
//
// Tests de la capa reutilizable de verificación humana (captcha). No requieren
// claves reales: mockean global.fetch (siteverify) y usan claves de prueba.
// Entorno node (no jsdom) para que NextResponse.json use el Response nativo.

import { getCaptchaConfig, getPublicSiteKey } from '@/lib/security/captcha/config'
import {
  CAPTCHA_TOKEN_HEADER,
  extractCaptchaToken,
  isChallengeRequiredResponse,
  challengeRequiredResponse,
} from '@/lib/security/captcha/challenge'
import { createTurnstileVerifier } from '@/lib/security/captcha/providers/turnstile'
import { verifyHumanChallenge } from '@/lib/security/captcha/verify'
import { _resetVerifierForTests } from '@/lib/security/captcha/factory'

// Observabilidad → no-op en tests (no tocar red).
jest.mock('@/lib/observability/emit', () => ({
  emit: jest.fn(),
  emitFireAndForget: jest.fn(),
}))

const SITE = '1x00000000000000000000AA'
const SECRET = '1x0000000000000000000000000000000AA'

function reqWith(token?: string) {
  const headers = new Map<string, string>()
  if (token) headers.set(CAPTCHA_TOKEN_HEADER, token)
  return { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? headers.get(k) ?? null } }
}

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  _resetVerifierForTests()
  process.env = { ...ORIGINAL_ENV }
  process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY = SITE
  process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = SECRET
  process.env.CAPTCHA_ENABLED = 'true'
  process.env.CAPTCHA_PROVIDER = 'turnstile'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.restoreAllMocks()
})

describe('config', () => {
  it('enabled sólo con flag on Y claves presentes', () => {
    expect(getCaptchaConfig().enabled).toBe(true)
    process.env.CAPTCHA_ENABLED = 'false'
    expect(getCaptchaConfig().enabled).toBe(false)
  })

  it('sin secret → desactivado aunque el flag esté on (fail-safe)', () => {
    delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
    const cfg = getCaptchaConfig()
    expect(cfg.enabled).toBe(false)
    expect(cfg.provider).toBe('disabled')
  })

  it('expone la site key pública', () => {
    expect(getPublicSiteKey()).toBe(SITE)
  })
})

describe('challenge protocol', () => {
  it('extractCaptchaToken lee la cabecera', () => {
    expect(extractCaptchaToken(reqWith('tok123'))).toBe('tok123')
    expect(extractCaptchaToken(reqWith())).toBeNull()
  })

  it('isChallengeRequiredResponse identifica el cuerpo', () => {
    expect(isChallengeRequiredResponse({ challengeRequired: true })).toBe(true)
    expect(isChallengeRequiredResponse({ ok: true })).toBe(false)
    expect(isChallengeRequiredResponse(null)).toBe(false)
  })

  it('challengeRequiredResponse es 403 con marcador y site key', async () => {
    const res = challengeRequiredResponse('load_questions')
    expect(res.status).toBe(403)
    expect(res.headers.get('x-challenge-required')).toBe('1')
    const body = await res.json()
    expect(body.challengeRequired).toBe(true)
    expect(body.siteKey).toBe(SITE)
    expect(body.action).toBe('load_questions')
  })
})

describe('turnstile adapter', () => {
  it('mapea success de siteverify', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, challenge_ts: '2026-06-03T00:00:00Z', hostname: 'vence.es' }),
    }) as unknown as typeof fetch
    const v = createTurnstileVerifier({ secretKey: SECRET })
    const r = await v.verify('tok')
    expect(r.success).toBe(true)
    expect(r.provider).toBe('turnstile')
    expect(r.hostname).toBe('vence.es')
  })

  it('mapea fallo con error-codes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as unknown as typeof fetch
    const v = createTurnstileVerifier({ secretKey: SECRET })
    const r = await v.verify('bad')
    expect(r.success).toBe(false)
    expect(r.errorCodes).toContain('invalid-input-response')
  })

  it('token vacío → missing-input-response sin llamar a la red', async () => {
    const spy = (global.fetch = jest.fn() as unknown as typeof fetch)
    const v = createTurnstileVerifier({ secretKey: SECRET })
    const r = await v.verify('')
    expect(r.success).toBe(false)
    expect(r.errorCodes).toContain('missing-input-response')
    expect(spy).not.toHaveBeenCalled()
  })

  it('error de red → verify-network-error (no lanza)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch
    const v = createTurnstileVerifier({ secretKey: SECRET })
    const r = await v.verify('tok')
    expect(r.success).toBe(false)
    expect(r.errorCodes).toContain('verify-network-error')
  })
})

describe('verifyHumanChallenge (end-to-end)', () => {
  it('capa desactivada → pasa (no-op)', async () => {
    process.env.CAPTCHA_ENABLED = 'false'
    const out = await verifyHumanChallenge(reqWith(), { action: 'x' })
    expect(out.ok).toBe(true)
    expect(out.challengeRequired).toBe(false)
  })

  it('sin token → challengeRequired', async () => {
    const out = await verifyHumanChallenge(reqWith(), { action: 'x' })
    expect(out.ok).toBe(false)
    expect(out.challengeRequired).toBe(true)
  })

  it('token válido → ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch
    const out = await verifyHumanChallenge(reqWith('good'), { action: 'x' })
    expect(out.ok).toBe(true)
  })

  it('token inválido → challengeRequired', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as unknown as typeof fetch
    const out = await verifyHumanChallenge(reqWith('bad'), { action: 'x' })
    expect(out.ok).toBe(false)
    expect(out.challengeRequired).toBe(true)
  })

  it('error del proveedor + failOpen → pasa degradado', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch
    const out = await verifyHumanChallenge(reqWith('tok'), { action: 'x', failOpen: true })
    expect(out.ok).toBe(true)
    expect(out.result?.degraded).toBe(true)
  })

  it('error del proveedor + failClosed → challengeRequired', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch
    const out = await verifyHumanChallenge(reqWith('tok'), { action: 'x', failOpen: false })
    expect(out.ok).toBe(false)
    expect(out.challengeRequired).toBe(true)
  })
})
