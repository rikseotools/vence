// __tests__/lib/api/simulacro/proportionalSampling.test.ts
// Tests del algoritmo Hamilton (largest remainder) y redistribución de déficit

import {
  distributeSlots,
  redistributeShortfall,
} from '@/lib/api/simulacro/proportionalSampling'

describe('distributeSlots — Hamilton largest remainder', () => {
  it('exact integers — sum equals totalSlots', () => {
    const weights = new Map([
      ['a', 50],
      ['b', 30],
      ['c', 20],
    ])
    const result = distributeSlots(weights, 10)
    expect(result.get('a')).toBe(5)
    expect(result.get('b')).toBe(3)
    expect(result.get('c')).toBe(2)
    expect([...result.values()].reduce((s, v) => s + v, 0)).toBe(10)
  })

  it('with fractional parts — largest remainder gets the extra', () => {
    // 3 keys, each weight 1 → exact = 10/3 = 3.33. floors = 3, 3, 3. resto = 1.
    // El 1 va al primer key alfabéticamente (tie-break determinista).
    const weights = new Map([
      ['a', 1],
      ['b', 1],
      ['c', 1],
    ])
    const result = distributeSlots(weights, 10)
    const sum = [...result.values()].reduce((s, v) => s + v, 0)
    expect(sum).toBe(10)
    // Uno tiene 4, los otros 3
    const counts = [...result.values()].sort()
    expect(counts).toEqual([3, 3, 4])
  })

  it('weight zero → zero slots', () => {
    const weights = new Map([
      ['a', 50],
      ['b', 0],
      ['c', 50],
    ])
    const result = distributeSlots(weights, 10)
    expect(result.get('b')).toBe(0)
    expect(result.get('a')).toBe(5)
    expect(result.get('c')).toBe(5)
  })

  it('totalSlots = 0 → all zero', () => {
    const weights = new Map([
      ['a', 50],
      ['b', 30],
    ])
    const result = distributeSlots(weights, 0)
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(0)
  })

  it('all weights zero → fallback uniform distribution', () => {
    const weights = new Map([
      ['a', 0],
      ['b', 0],
      ['c', 0],
    ])
    const result = distributeSlots(weights, 10)
    const sum = [...result.values()].reduce((s, v) => s + v, 0)
    expect(sum).toBe(10)
    const counts = [...result.values()].sort()
    expect(counts).toEqual([3, 3, 4])
  })

  it('realistic simulacro Bloque II case (50 slots, 12 topics)', () => {
    // Pesos reales de la BD para Aux Admin Estado Bloque II
    const weights = new Map([
      ['T106', 37],
      ['T109', 22],
      ['T108', 21],
      ['T112', 19],
      ['T105', 19],
      ['T110', 18],
      ['T111', 17],
      ['T104', 10],
      ['T103', 8],
      ['T102', 7],
      ['T101', 5],
      ['T107', 5],
    ])
    const result = distributeSlots(weights, 50)
    const sum = [...result.values()].reduce((s, v) => s + v, 0)
    expect(sum).toBe(50) // suma EXACTA
    // T106 debería tener bastantes slots (es el peso más grande)
    expect(result.get('T106')!).toBeGreaterThanOrEqual(9)
    expect(result.get('T106')!).toBeLessThanOrEqual(11)
    // T107 (peso 5/188 = 2.7% → 1.3 slots) debería tener 1 o 2
    expect(result.get('T107')!).toBeGreaterThanOrEqual(1)
    expect(result.get('T107')!).toBeLessThanOrEqual(2)
  })

  it('single key → all slots to that key', () => {
    const weights = new Map([['only', 100]])
    const result = distributeSlots(weights, 50)
    expect(result.get('only')).toBe(50)
  })

  it('large slot counts (1000) work', () => {
    const weights = new Map([
      ['a', 70],
      ['b', 30],
    ])
    const result = distributeSlots(weights, 1000)
    expect(result.get('a')).toBe(700)
    expect(result.get('b')).toBe(300)
  })
})

describe('redistributeShortfall — handles catalog deficits', () => {
  it('no deficit → returns initial unchanged', () => {
    const initial = new Map([['a', 5], ['b', 5]])
    const available = new Map([['a', 10], ['b', 10]])
    const weights = new Map([['a', 1], ['b', 1]])
    const result = redistributeShortfall(initial, available, weights)
    expect(result.get('a')).toBe(5)
    expect(result.get('b')).toBe(5)
  })

  it('deficit reassigned to topic with stock proportionally', () => {
    // 'a' pide 10 pero solo hay 3 → déficit 7 va a 'b'
    const initial = new Map([['a', 10], ['b', 5]])
    const available = new Map([['a', 3], ['b', 100]])
    const weights = new Map([['a', 50], ['b', 50]])
    const result = redistributeShortfall(initial, available, weights)
    expect(result.get('a')).toBe(3)
    expect(result.get('b')).toBe(12) // 5 + 7
  })

  it('global catalog insufficient → returns less than initial total', () => {
    // Suma pedida: 15. Suma disponible total: 6 → no se puede llenar.
    const initial = new Map([['a', 10], ['b', 5]])
    const available = new Map([['a', 3], ['b', 3]])
    const weights = new Map([['a', 50], ['b', 50]])
    const result = redistributeShortfall(initial, available, weights)
    const sum = [...result.values()].reduce((s, v) => s + v, 0)
    expect(sum).toBe(6) // todo lo disponible
    expect(result.get('a')).toBe(3)
    expect(result.get('b')).toBe(3)
  })

  it('deficit redistributed proportionally to weights of candidates with stock', () => {
    // 'a' déficit de 10 → 'b' (peso 30) y 'c' (peso 70) tienen stock
    const initial = new Map([['a', 10], ['b', 5], ['c', 5]])
    const available = new Map([['a', 0], ['b', 100], ['c', 100]])
    const weights = new Map([['a', 1], ['b', 30], ['c', 70]])
    const result = redistributeShortfall(initial, available, weights)
    expect(result.get('a')).toBe(0)
    // 10 extra: 30%→3 a b, 70%→7 a c (Hamilton)
    expect(result.get('b')).toBe(8) // 5 + 3
    expect(result.get('c')).toBe(12) // 5 + 7
  })
})
