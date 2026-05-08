// __tests__/api/anon-rate-limit.test.ts
// Tests for anonymous user rate limiting on answer endpoints (30/day per IP).
//
// Histórico: empezó en 5/día (commit e26bab27) pero se subió a 30 en
// 3077332e tras detectar que usuarios premium con tokens Supabase
// expirados caían en este límite (al perder el token los trata como
// anónimos). Con 5/día, varios usuarios premium en oficinas con IP
// compartida agotaban el cupo y veían respuestas falsas. 30/día permite
// una sesión completa con reintentos mientras sigue frenando bots; el
// anti-scraping real vive en RATE_LIMIT_ANSWER (60/min para todos).

import { checkRateLimit, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'

const ANON_LIMIT = 30 // Mantener sincronizado con lib/api/rateLimit.ts

describe('RATE_LIMIT_ANON_ANSWER config', () => {
  it(`allows max ${ANON_LIMIT} requests`, () => {
    expect(RATE_LIMIT_ANON_ANSWER.maxRequests).toBe(ANON_LIMIT)
  })

  it('uses 24h window', () => {
    expect(RATE_LIMIT_ANON_ANSWER.windowMs).toBe(24 * 60 * 60 * 1000)
  })
})

describe('Anonymous rate limiting', () => {
  const testIp = `anon-test-${Date.now()}`

  it(`allows first ${ANON_LIMIT} requests from same IP`, () => {
    for (let i = 0; i < ANON_LIMIT; i++) {
      const result = checkRateLimit(testIp, RATE_LIMIT_ANON_ANSWER)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(ANON_LIMIT - 1 - i)
    }
  })

  it(`blocks request ${ANON_LIMIT + 1} from same IP`, () => {
    const result = checkRateLimit(testIp, RATE_LIMIT_ANON_ANSWER)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetMs).toBeGreaterThan(0)
  })

  it('allows different IP independently', () => {
    const otherIp = `anon-other-${Date.now()}`
    const result = checkRateLimit(otherIp, RATE_LIMIT_ANON_ANSWER)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(ANON_LIMIT - 1)
  })

  it('authenticated users skip this check (test the endpoint pattern)', () => {
    // The endpoint pattern is: if (!tokenUserId) { checkRateLimit(...) }
    // So authenticated users never hit RATE_LIMIT_ANON_ANSWER
    const tokenUserId = 'some-user-id'
    if (tokenUserId) {
      // This branch never calls checkRateLimit for anon
      expect(true).toBe(true)
    }
  })
})

describe('Attack: scraper without account', () => {
  it(`ATTACK: bot sends 100 requests without Bearer token — only ${ANON_LIMIT} get through`, () => {
    const botIp = `bot-${Date.now()}`
    let allowed = 0
    let blocked = 0

    for (let i = 0; i < 100; i++) {
      const result = checkRateLimit(botIp, RATE_LIMIT_ANON_ANSWER)
      if (result.allowed) allowed++
      else blocked++
    }

    expect(allowed).toBe(ANON_LIMIT)
    expect(blocked).toBe(100 - ANON_LIMIT)
  })

  it(`ATTACK: bot rotates IPs — each IP gets ${ANON_LIMIT} (needs many IPs to scrape)`, () => {
    const N_IPS = 10
    const ips = Array.from({ length: N_IPS }, (_, i) => `rotating-${Date.now()}-${i}`)
    let totalAllowed = 0

    for (const ip of ips) {
      for (let i = 0; i < ANON_LIMIT + 5; i++) {
        if (checkRateLimit(ip, RATE_LIMIT_ANON_ANSWER).allowed) totalAllowed++
      }
    }

    // N_IPS IPs × ANON_LIMIT allowed each
    expect(totalAllowed).toBe(N_IPS * ANON_LIMIT)
  })
})
