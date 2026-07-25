/**
 * @jest-environment node
 *
 * node (no jsdom): next-auth `encode` usa `jose` (webcrypto) y bajo jsdom el TextEncoder
 * produce un Uint8Array de otro realm que jose rechaza ("plaintext must be an instance of
 * Uint8Array"). En node nativo el round-trip cifra/descifra igual que en producción.
 */
import { verdictOf, type StepOutcome, type InvariantResult, type SimResult } from '@/lib/sim/types'
import { mintOwnAuthCookie, readOwnAuthCookie, sessionTokenPayload, AUTHJS_SESSION_COOKIE, cookieForPlaywright } from '@/lib/sim/session'
import { faults, faultHandler, type AbstractRoute } from '@/lib/sim/faults'
import { toObservabilityEvent, eventSeverityFor, oneLineSummary, suiteSummary } from '@/lib/sim/report'

describe('verdictOf', () => {
  const okStep: StepOutcome = { step: 'a', ok: true }
  const okInv: InvariantResult = { name: 'i', ok: true }
  it('passed cuando todo ok', () => {
    expect(verdictOf([okStep], [okInv])).toEqual({ passed: true })
  })
  it('falla por error de ejecución (prioritario)', () => {
    const v = verdictOf([okStep], [okInv], 'boom')
    expect(v.passed).toBe(false); expect(v.firstFailure).toMatch(/error: boom/)
  })
  it('falla por step (antes que invariante)', () => {
    const v = verdictOf([{ step: 'x', ok: false, detail: 'timeout' }], [{ name: 'i', ok: false }])
    expect(v.firstFailure).toMatch(/step "x": timeout/)
  })
  it('falla por invariante', () => {
    const v = verdictOf([okStep], [{ name: 'sel', ok: false, detail: 'fuera' }])
    expect(v.firstFailure).toMatch(/invariante "sel": fuera/)
  })
})

describe('session (auth propia, sin Supabase)', () => {
  const SECRET = 'test-secret-0123456789-abcdefghij'
  it('sessionTokenPayload lleva appUserId+email+exp', () => {
    const p = sessionTokenPayload({ userId: 'u1', email: 'a@b.c' }, 1000, 60)
    expect(p).toMatchObject({ appUserId: 'u1', email: 'a@b.c', sub: 'u1', iat: 1000, exp: 1060 })
  })
  it('mint + read round-trip devuelve el mismo sujeto', async () => {
    const val = await mintOwnAuthCookie({ userId: 'u1', email: 'a@b.c' }, SECRET, { nowSec: 1000, ttlSec: 600 })
    expect(typeof val).toBe('string')
    const back = await readOwnAuthCookie(val, SECRET)
    expect(back?.appUserId).toBe('u1')
    expect(back?.email).toBe('a@b.c')
  })
  it('read con secreto equivocado NO descifra', async () => {
    const val = await mintOwnAuthCookie({ userId: 'u1', email: 'a@b.c' }, SECRET, { nowSec: 1000 })
    await expect(readOwnAuthCookie(val, 'otro-secreto-que-no-coincide-xxxx')).rejects.toBeDefined()
  })
  it('sin secreto → lanza', async () => {
    await expect(mintOwnAuthCookie({ userId: 'u', email: 'e' }, '', { nowSec: 1 })).rejects.toThrow(/AUTH_SECRET/)
  })
  it('cookieForPlaywright usa la cookie __Secure- y flags seguros', () => {
    const c = cookieForPlaywright('v')
    expect(c.name).toBe(AUTHJS_SESSION_COOKIE)
    expect(c).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' })
  })
})

describe('faults (fault injection)', () => {
  function mkRoute() {
    const calls: string[] = []
    const route: AbstractRoute = {
      abort: () => { calls.push('abort') },
      fulfill: ({ status }) => { calls.push('fulfill:' + status) },
      continue: () => { calls.push('continue') },
    }
    return { route, calls }
  }
  it('network_abort: aborta las N primeras, luego pasa', async () => {
    const h = faultHandler(faults.networkAbort('**/x', 1))
    const { route, calls } = mkRoute()
    expect(await h(route)).toBe('aborted')
    expect(await h(route)).toBe('passed')
    expect(calls).toEqual(['abort', 'continue'])
  })
  it('network_down: aborta siempre', async () => {
    const h = faultHandler(faults.networkDown('**/x'))
    const { route } = mkRoute()
    expect(await h(route)).toBe('aborted')
    expect(await h(route)).toBe('aborted')
  })
  it('http_500: fulfilla 500 las N primeras', async () => {
    const h = faultHandler(faults.http500('**/x', 2))
    const { route, calls } = mkRoute()
    await h(route); await h(route); await h(route)
    expect(calls).toEqual(['fulfill:500', 'fulfill:500', 'continue'])
  })
  it('latency: espera y continúa (sleep inyectado)', async () => {
    let slept = 0
    const h = faultHandler(faults.latency('**/x', 300), async ms => { slept += ms })
    const { route, calls } = mkRoute()
    expect(await h(route)).toBe('delayed')
    expect(slept).toBe(300)
    expect(calls).toEqual(['continue'])
  })
})

describe('report → observabilidad', () => {
  const base: SimResult = {
    journey: 'por-leyes', severity: 'high', identity: null,
    startedAt: 'x', finishedAt: 'y', durationMs: 1234, steps: [{ step: 's', ok: true }],
    invariants: [{ name: 'a', ok: true }, { name: 'b', ok: true }], passed: true,
  }
  it('severity: passed=info', () => {
    expect(eventSeverityFor(base)).toBe('info')
  })
  it('severity: fallo en journey high/critical=error', () => {
    expect(eventSeverityFor({ ...base, passed: false, severity: 'high' })).toBe('error')
    expect(eventSeverityFor({ ...base, passed: false, severity: 'medium' })).toBe('warn')
  })
  it('toObservabilityEvent registra journey + invariantes fallidas', () => {
    const ev = toObservabilityEvent({ ...base, passed: false, firstFailure: 'x', invariants: [{ name: 'a', ok: false }] })
    expect(ev.eventType).toBe('sim_journey_result')
    expect(ev.endpoint).toBe('/sim/por-leyes')
    expect(ev.metadata.failedInvariants).toEqual(['a'])
    expect(ev.severity).toBe('error')
  })
  it('suiteSummary agrega y detecta fallos', () => {
    const s = suiteSummary([base, { ...base, journey: 'x', passed: false, firstFailure: 'roto' }])
    expect(s).toMatchObject({ total: 2, passed: 1, failed: 1, ok: false })
    expect(s.failures[0]).toMatchObject({ journey: 'x', reason: 'roto' })
  })
  it('oneLineSummary legible', () => {
    expect(oneLineSummary(base)).toMatch(/✅ \[high\] por-leyes/)
  })
})
