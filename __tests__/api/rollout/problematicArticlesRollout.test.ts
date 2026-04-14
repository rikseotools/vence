// __tests__/api/rollout/problematicArticlesRollout.test.ts
// Tests del canary rollout (FASE 5 refactor oposicion-scope).

import {
  isInProblematicArticlesRollout,
  getProblematicArticlesRolloutPct,
} from '@/lib/api/rollout/problematic-articles'

describe('isInProblematicArticlesRollout', () => {
  test('pct=0 → ningún userId entra', () => {
    for (const id of ['a', 'b', 'c', 'd', 'user-xyz', '9d2587b1-c799-476d-9797-b7a498a487b1']) {
      expect(isInProblematicArticlesRollout(id, 0)).toBe(false)
    }
  })

  test('pct=100 → todos entran', () => {
    for (const id of ['a', 'b', 'c', 'user-xyz']) {
      expect(isInProblematicArticlesRollout(id, 100)).toBe(true)
    }
  })

  test('es determinista: mismo userId → mismo resultado', () => {
    const id = '9d2587b1-c799-476d-9797-b7a498a487b1'
    const r1 = isInProblematicArticlesRollout(id, 50)
    const r2 = isInProblematicArticlesRollout(id, 50)
    const r3 = isInProblematicArticlesRollout(id, 50)
    expect(r1).toBe(r2)
    expect(r2).toBe(r3)
  })

  test('monotónico: si entra con pct=10, entra con pct≥10', () => {
    const id = 'test-user-monotonic'
    for (let pct = 1; pct <= 100; pct++) {
      if (isInProblematicArticlesRollout(id, pct)) {
        for (let p = pct; p <= 100; p++) {
          expect(isInProblematicArticlesRollout(id, p)).toBe(true)
        }
        return
      }
    }
  })

  test('distribución razonable: pct=10 → ~10% de 1000 userIds entran', () => {
    let inCount = 0
    for (let i = 0; i < 1000; i++) {
      if (isInProblematicArticlesRollout(`user-${i}`, 10)) inCount++
    }
    // Tolerancia amplia: entre 5% y 15%
    expect(inCount).toBeGreaterThan(50)
    expect(inCount).toBeLessThan(150)
  })

  test('userId vacío → false (conservador)', () => {
    expect(isInProblematicArticlesRollout('', 100)).toBe(false)
  })
})

describe('getProblematicArticlesRolloutPct', () => {
  const origEnv = process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT

  afterEach(() => {
    if (origEnv === undefined) delete process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT
    else process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT = origEnv
  })

  test('sin env → 0', () => {
    delete process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT
    expect(getProblematicArticlesRolloutPct()).toBe(0)
  })

  test('valor inválido → 0', () => {
    process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT = 'abc'
    expect(getProblematicArticlesRolloutPct()).toBe(0)
  })

  test('valor > 100 → cap a 100', () => {
    process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT = '150'
    expect(getProblematicArticlesRolloutPct()).toBe(100)
  })

  test('valor < 0 → 0', () => {
    process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT = '-10'
    expect(getProblematicArticlesRolloutPct()).toBe(0)
  })

  test('valor válido → lo devuelve', () => {
    process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT = '25'
    expect(getProblematicArticlesRolloutPct()).toBe(25)
  })
})
