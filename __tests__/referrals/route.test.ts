/**
 * @jest-environment node
 */
// __tests__/referrals/route.test.ts — CAPA unit de la ruta /r/[code] (query mockeada, sin DB).

import { NextRequest } from 'next/server'

jest.mock('@/lib/referrals/observability', () => ({ emitReferralEvent: jest.fn() }))
jest.mock('@/lib/referrals/queries', () => ({
  resolveActiveReferralCode: jest.fn(),
}))
import { resolveActiveReferralCode } from '@/lib/referrals/queries'
import { emitReferralEvent } from '@/lib/referrals/observability'
import { _GET } from '@/app/r/[code]/route'

const mockResolve = resolveActiveReferralCode as unknown as jest.Mock
const mockEmit = emitReferralEvent as unknown as jest.Mock
const req = (url: string) => new NextRequest(url)
const params = (code: string) => Promise.resolve({ code })

describe('GET /r/[code]', () => {
  afterEach(() => jest.clearAllMocks())

  it('código válido → 302 a la HOME con ?ref=<code> + cookie vence_ref', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1', code: 'abc123', sanitized: false })
    const res = await _GET(req('https://www.vence.es/r/abc123'), { params: params('abc123') })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/?ref=abc123')
    expect(res.headers.get('location')).not.toContain('/embajadores')
    expect(res.headers.get('set-cookie') || '').toContain('vence_ref=abc123')
  })

  // Regresión del bug medido el 27/07 (21 clicks perdidos): WhatsApp pega el texto del mensaje
  // al enlace y el código llega sucio. La cookie y el ?ref deben llevar el CANÓNICO, no el crudo.
  it('enlace con texto pegado → recupera el código y propaga el CANÓNICO (cookie + ref)', async () => {
    const sucio = '7d5f7ed7fe83..................esto'
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1', code: '7d5f7ed7fe83', sanitized: true })
    const res = await _GET(req(`https://www.vence.es/r/${sucio}`), { params: params(sucio) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/?ref=7d5f7ed7fe83')
    expect(res.headers.get('location')).not.toContain('esto')
    expect(res.headers.get('set-cookie') || '').toContain('vence_ref=7d5f7ed7fe83')
    // …y queda señal de que se salvó, para poder medir cuántos recupera el fix.
    expect(mockEmit).toHaveBeenCalledWith('referral_link_click', expect.objectContaining({
      metadata: expect.objectContaining({ code: '7d5f7ed7fe83', valid: true, sanitized: true }),
    }))
  })

  it('código inválido → 302 a la HOME SIN ref ni cookie', async () => {
    mockResolve.mockResolvedValue(null)
    const res = await _GET(req('https://www.vence.es/r/bad'), { params: params('bad') })
    expect(res.status).toBe(302)
    const loc = res.headers.get('location') || ''
    expect(loc).not.toContain('/embajadores')
    expect(loc).not.toContain('ref=')
    expect(res.headers.get('set-cookie') || '').not.toContain('vence_ref')
  })

  it('el redirect usa el dominio público, NO el host de la request (regresión bug 0.0.0.0 del contenedor)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1', code: 'abc', sanitized: false })
    // Simula el host interno del contenedor detrás del ALB.
    const res = await _GET(req('http://0.0.0.0:3000/r/abc'), { params: params('abc') })
    const loc = res.headers.get('location') || ''
    expect(loc).not.toContain('0.0.0.0')
    expect(loc).toContain('/?ref=abc')
  })

  it('la cookie es httpOnly + lax (funcional, resiste al banner de consentimiento)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1', code: 'xyz', sanitized: false })
    const res = await _GET(req('https://www.vence.es/r/xyz'), { params: params('xyz') })
    const sc = res.headers.get('set-cookie') || ''
    expect(sc.toLowerCase()).toContain('httponly')
    expect(sc.toLowerCase()).toContain('samesite=lax')
  })

  it('petición normal → emite referral_link_click (cuenta en el embudo)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1' })
    await _GET(req('https://www.vence.es/r/abc'), { params: params('abc') })
    expect(mockEmit).toHaveBeenCalledWith('referral_link_click', expect.objectContaining({ metadata: expect.objectContaining({ code: 'abc' }) }))
  })

  it('petición SINTÉTICA (x-vence-canary) → NO emite (no infla el embudo)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1' })
    const r = new NextRequest('https://www.vence.es/r/abc', { headers: { 'x-vence-canary': '1' } })
    const res = await _GET(r, { params: params('abc') })
    expect(res.status).toBe(302)   // el redirect + cookie SÍ siguen (el canary valida eso)
    expect(mockEmit).not.toHaveBeenCalled()
  })
})
