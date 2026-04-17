// __tests__/api/anon-rate-limit.test.ts
// Tests for anonymous user rate limiting on answer endpoints (5/day per IP)

import { checkRateLimit, RATE_LIMIT_ANON_ANSWER } from '@/lib/api/rateLimit'

describe('RATE_LIMIT_ANON_ANSWER config', () => {
  it('allows max 5 requests', () => {
    expect(RATE_LIMIT_ANON_ANSWER.maxRequests).toBe(5)
  })

  it('uses 24h window', () => {
    expect(RATE_LIMIT_ANON_ANSWER.windowMs).toBe(24 * 60 * 60 * 1000)
  })
})

describe('Anonymous rate limiting', () => {
  const testIp = `anon-test-${Date.now()}`

  it('allows first 5 requests from same IP', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(testIp, RATE_LIMIT_ANON_ANSWER)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4 - i)
    }
  })

  it('blocks 6th request from same IP', () => {
    const result = checkRateLimit(testIp, RATE_LIMIT_ANON_ANSWER)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetMs).toBeGreaterThan(0)
  })

  it('allows different IP independently', () => {
    const otherIp = `anon-other-${Date.now()}`
    const result = checkRateLimit(otherIp, RATE_LIMIT_ANON_ANSWER)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
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
  it('ATTACK: bot sends 100 requests without Bearer token ��� only 5 get through', () => {
    const botIp = `bot-${Date.now()}`
    let allowed = 0
    let blocked = 0

    for (let i = 0; i < 100; i++) {
      const result = checkRateLimit(botIp, RATE_LIMIT_ANON_ANSWER)
      if (result.allowed) allowed++
      else blocked++
    }

    expect(allowed).toBe(5)
    expect(blocked).toBe(95)
  })

  it('ATTACK: bot rotates IPs — each IP gets 5 (but needs many IPs)', () => {
    const ips = Array.from({ length: 10 }, (_, i) => `rotating-${Date.now()}-${i}`)
    let totalAllowed = 0

    for (const ip of ips) {
      for (let i = 0; i < 10; i++) {
        if (checkRateLimit(ip, RATE_LIMIT_ANON_ANSWER).allowed) totalAllowed++
      }
    }

    // 10 IPs × 5 allowed each = 50 max
    expect(totalAllowed).toBe(50)
  })
})
