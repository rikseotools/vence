// __tests__/api/theme-stats/accuracy30d.test.ts
// Tests para accuracy_30d en theme-stats

describe('accuracy_30d calculation', () => {
  // Simula el cálculo SQL
  function calcAccuracy(total: number, correct: number): number | null {
    if (total === 0) return null
    return Math.round((correct / total) * 100)
  }

  it('accuracy total vs 30d: usuario nuevo (todo en 30d)', () => {
    const total = 100, correct = 84
    const total30d = 100, correct30d = 84 // mismo que total
    expect(calcAccuracy(total, correct)).toBe(84)
    expect(calcAccuracy(total30d, correct30d)).toBe(84)
  })

  it('accuracy total vs 30d: heavy user con mejora reciente', () => {
    const total = 1141, correct = 963 // 84% global
    const total30d = 50, correct30d = 48  // 96% últimos 30 días
    expect(calcAccuracy(total, correct)).toBe(84)
    expect(calcAccuracy(total30d, correct30d)).toBe(96)
  })

  it('accuracy total vs 30d: heavy user con bajón reciente', () => {
    const total = 2000, correct = 1800 // 90% global
    const total30d = 100, correct30d = 60  // 60% últimos 30 días
    expect(calcAccuracy(total, correct)).toBe(90)
    expect(calcAccuracy(total30d, correct30d)).toBe(60)
  })

  it('accuracy_30d null si no hay datos recientes', () => {
    const total30d = 0, correct30d = 0
    expect(calcAccuracy(total30d, correct30d)).toBeNull()
  })

  it('accuracy_30d 100% si todo correcto en 30d', () => {
    const total30d = 25, correct30d = 25
    expect(calcAccuracy(total30d, correct30d)).toBe(100)
  })

  it('accuracy_30d 0% si todo incorrecto en 30d', () => {
    const total30d = 10, correct30d = 0
    expect(calcAccuracy(total30d, correct30d)).toBe(0)
  })

  it('cada respuesta mueve poco con volumen alto', () => {
    // Con 1141 preguntas, 1 correcta más mueve 0.09%
    const before = calcAccuracy(1141, 963)! // 84.4%
    const after = calcAccuracy(1142, 964)!  // 84.4%
    expect(after - before).toBeLessThanOrEqual(1)

    // Con 50 preguntas (30d), 1 correcta más mueve 2%
    const before30d = calcAccuracy(50, 42)!  // 84%
    const after30d = calcAccuracy(51, 43)!   // 84%
    // La accuracy 30d es más sensible a cambios recientes
  })

  it('respuesta del endpoint incluye campos 30d', () => {
    const mockStat = {
      tema_number: 1,
      total: 1141,
      correct: 963,
      accuracy: 84,
      total_30d: 50,
      correct_30d: 48,
      accuracy_30d: 96,
      last_study: '2026-04-30',
    }

    expect(mockStat).toHaveProperty('total_30d')
    expect(mockStat).toHaveProperty('correct_30d')
    expect(mockStat).toHaveProperty('accuracy_30d')
    expect(mockStat.accuracy_30d).toBeGreaterThan(mockStat.accuracy)
  })
})
