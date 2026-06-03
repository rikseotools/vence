// __tests__/security/questionsServed.test.ts
//
// Policy anti-scraping de volumen MULTI-SUJETO (Capa A: usuario/IP + dispositivo).
// El gate dispara si CUALQUIER sujeto supera su umbral. Redis mockeado.

const counters: Record<string, number> = {}
const kv: Record<string, unknown> = {}
jest.mock('@/lib/cache/redis', () => ({
  getCounter: (k: string) => Promise.resolve(counters[k] ?? 0),
  incrementCounterWithTtl: (k: string, _ttl: number, by: number) => {
    counters[k] = (counters[k] ?? 0) + by
    return Promise.resolve(counters[k])
  },
  setCached: (k: string, v: unknown) => {
    kv[k] = v
    return Promise.resolve()
  },
  getCached: (k: string) => Promise.resolve(kv[k] ?? null),
}))

import {
  gateSubjects,
  shouldChallengeForLoad,
  evaluateLoadGate,
  recordServedForSubjects,
} from '@/lib/security/challengePolicy/questionsServed'
import {
  markForcedChallenge,
  anyForcedChallenge,
} from '@/lib/security/challengePolicy/forceChallenge'

const ORIGINAL_ENV = { ...process.env }
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '')

beforeEach(() => {
  for (const k of Object.keys(counters)) delete counters[k]
  for (const k of Object.keys(kv)) delete kv[k]
  process.env = { ...ORIGINAL_ENV }
  delete process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD
  delete process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_ANON
  delete process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_DEVICE
})
afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('gateSubjects', () => {
  it('logueado → usuario(500) + dispositivo(800), SIN IP (oficinas compartidas)', () => {
    const subs = gateSubjects('uuid-1', 'dev-1', '1.2.3.4')
    expect(subs).toEqual([
      { key: 'uuid-1', threshold: 500 },
      { key: 'device:dev-1', threshold: 800 },
    ])
  })

  it('anónimo → ip(300) + dispositivo(800)', () => {
    const subs = gateSubjects(null, 'dev-1', '9.9.9.9')
    expect(subs).toEqual([
      { key: 'ip:9.9.9.9', threshold: 300 },
      { key: 'device:dev-1', threshold: 800 },
    ])
  })

  it('sin huella de dispositivo → solo usuario/IP', () => {
    expect(gateSubjects(null, null, '9.9.9.9')).toEqual([{ key: 'ip:9.9.9.9', threshold: 300 }])
    expect(gateSubjects('u', undefined, null)).toEqual([{ key: 'u', threshold: 500 }])
  })

  it('umbrales configurables por env', () => {
    process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_DEVICE = '1200'
    expect(gateSubjects(null, 'd', '1.1.1.1')[1]).toEqual({ key: 'device:d', threshold: 1200 })
  })
})

describe('shouldChallengeForLoad — dispara si CUALQUIER sujeto supera su umbral', () => {
  it('anónimo bajo todos los umbrales → NO reta', async () => {
    counters[`captcha:served:ip:9.9.9.9:${today()}`] = 299
    counters[`captcha:served:device:d:${today()}`] = 799
    expect(await shouldChallengeForLoad(gateSubjects(null, 'd', '9.9.9.9'))).toBe(false)
  })

  it('IP por debajo PERO dispositivo por encima → reta (rotación de IP cazada)', async () => {
    counters[`captcha:served:ip:9.9.9.9:${today()}`] = 50 // IP rotada, bajo umbral
    counters[`captcha:served:device:d:${today()}`] = 800 // misma máquina acumulada
    expect(await shouldChallengeForLoad(gateSubjects(null, 'd', '9.9.9.9'))).toBe(true)
  })

  it('usuario por encima de su umbral → reta', async () => {
    counters[`captcha:served:uuid-1:${today()}`] = 500
    expect(await shouldChallengeForLoad(gateSubjects('uuid-1', 'd', '1.2.3.4'))).toBe(true)
  })

  it('Redis caído (todo 0) → fail-open, no reta', async () => {
    expect(await shouldChallengeForLoad(gateSubjects(null, 'd', '9.9.9.9'))).toBe(false)
  })
})

describe('recordServedForSubjects — incrementa todos los sujetos', () => {
  it('cuenta en usuario Y dispositivo a la vez', async () => {
    const subs = gateSubjects('uuid-1', 'dev-1', '1.2.3.4')
    await recordServedForSubjects(subs, 25)
    expect(counters[`captcha:served:uuid-1:${today()}`]).toBe(25)
    expect(counters[`captcha:served:device:dev-1:${today()}`]).toBe(25)
  })
})

describe('evaluateLoadGate — detalle para el log forense (Capa D)', () => {
  it('devuelve qué sujeto disparó (tripped)', async () => {
    counters[`captcha:served:ip:9.9.9.9:${today()}`] = 50
    counters[`captcha:served:device:d:${today()}`] = 800
    const r = await evaluateLoadGate(gateSubjects(null, 'd', '9.9.9.9'))
    expect(r.challenge).toBe(true)
    expect(r.details.find((d) => d.key === 'device:d')?.tripped).toBe(true)
    expect(r.details.find((d) => d.key === 'ip:9.9.9.9')?.tripped).toBe(false)
  })
})

describe('forceChallenge — Capa C-fácil (señal de bot)', () => {
  it('marca sujetos y los detecta (reto forzado independiente del volumen)', async () => {
    const subs = gateSubjects('uuid-bot', 'dev-bot', '1.1.1.1')
    expect(await anyForcedChallenge(subs)).toBe(false)
    await markForcedChallenge(['uuid-bot', 'device:dev-bot'])
    expect(await anyForcedChallenge(subs)).toBe(true)
  })

  it('basta con que el DISPOSITIVO esté marcado (caza cuenta nueva en misma máquina)', async () => {
    await markForcedChallenge(['device:dev-bot'])
    // usuario distinto, misma máquina → forzado por el device
    expect(await anyForcedChallenge(gateSubjects('otra-cuenta', 'dev-bot', '2.2.2.2'))).toBe(true)
  })
})
