// __tests__/lib/dailyLimitAllowance.test.ts
// Invariante del gate de límite diario (fix incidente 07/07/2026): premium NUNCA
// se bloquea, aunque getDynamicLimit (que lee de otro pool) lo viera como free con
// un límite bajo o un conteo alto. Lú (premium) recibía 403 solo en psicotécnicos
// porque getDailyLimitStatus recomputaba el bloqueo ignorando el is_premium real.
import { computeAllowance } from '@/lib/api/dailyLimit'

describe('computeAllowance', () => {
  it('premium: SIEMPRE allowed aunque el conteo supere el límite del pool stale', () => {
    // Escenario del bug: get_daily_question_status dice premium, pero getDynamicLimit
    // (pool distinto) devolvió dailyLimit=25 y el conteo real es 30.
    const a = computeAllowance(true, 30, 25)
    expect(a.allowed).toBe(true)
    expect(a.isLimitReached).toBe(false)
    expect(a.questionsRemaining).toBe(999)
    expect(a.isPremium).toBe(true)
  })

  it('premium con conteo 0 → allowed (caso normal)', () => {
    expect(computeAllowance(true, 0, 25).allowed).toBe(true)
  })

  it('free bajo el límite → allowed, remaining correcto', () => {
    const a = computeAllowance(false, 10, 25)
    expect(a.allowed).toBe(true)
    expect(a.isLimitReached).toBe(false)
    expect(a.questionsRemaining).toBe(15)
  })

  it('free justo en el límite → bloqueado', () => {
    const a = computeAllowance(false, 25, 25)
    expect(a.allowed).toBe(false)
    expect(a.isLimitReached).toBe(true)
    expect(a.questionsRemaining).toBe(0)
  })

  it('free por encima del límite → bloqueado, remaining no negativo', () => {
    const a = computeAllowance(false, 40, 25)
    expect(a.allowed).toBe(false)
    expect(a.questionsRemaining).toBe(0)
  })

  it('free con límite graduado bajo → respeta el límite', () => {
    expect(computeAllowance(false, 5, 5).allowed).toBe(false)
    expect(computeAllowance(false, 4, 5).allowed).toBe(true)
  })
})
