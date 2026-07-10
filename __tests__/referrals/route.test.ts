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

  it('código válido → 302 a /embajadores?ref=<code> + cookie vence_ref', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1' })
    const res = await _GET(req('https://www.vence.es/r/abc123'), { params: params('abc123') })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('/embajadores?ref=abc123')
    expect(res.headers.get('set-cookie') || '').toContain('vence_ref=abc123')
  })

  it('código inválido → 302 a /embajadores SIN ref ni cookie', async () => {
    mockResolve.mockResolvedValue(null)
    const res = await _GET(req('https://www.vence.es/r/bad'), { params: params('bad') })
    expect(res.status).toBe(302)
    const loc = res.headers.get('location') || ''
    expect(loc).toContain('/embajadores')
    expect(loc).not.toContain('ref=')
    expect(res.headers.get('set-cookie') || '').not.toContain('vence_ref')
  })

  it('el redirect usa el dominio público, NO el host de la request (regresión bug 0.0.0.0 del contenedor)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1' })
    // Simula el host interno del contenedor detrás del ALB.
    const res = await _GET(req('http://0.0.0.0:3000/r/abc'), { params: params('abc') })
    const loc = res.headers.get('location') || ''
    expect(loc).not.toContain('0.0.0.0')
    expect(loc).toContain('/embajadores?ref=abc')
  })

  it('la cookie es httpOnly + lax (funcional, resiste al banner de consentimiento)', async () => {
    mockResolve.mockResolvedValue({ ownerUserId: 'owner-1' })
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
