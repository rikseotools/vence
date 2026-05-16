// __tests__/components/test/hubSorting.test.ts
//
// Tests del helper sortTopics() que arregla el bug de Aila: el botón
// "Ordenar por" del hub de tests cambiaba de estilo pero no reordenaba.

import { sortTopics, type SortOption, type SortableStats } from '@/components/test/hubSorting'

type T = { topicNumber: number }

const topics: T[] = [{ topicNumber: 1 }, { topicNumber: 2 }, { topicNumber: 3 }, { topicNumber: 4 }, { topicNumber: 5 }]

// Helper para crear stats compactas
function makeStats(rec: Record<number, { acc: number; total: number; date?: string }>): Record<number, SortableStats> {
  const out: Record<number, SortableStats> = {}
  for (const [k, v] of Object.entries(rec)) {
    out[Number(k)] = {
      total: v.total,
      accuracy: v.acc,
      lastStudy: v.date ? new Date(v.date) : null,
    }
  }
  return out
}

describe('sortTopics — tema (orden numérico)', () => {
  it('respeta el orden numérico siempre', () => {
    const stats = makeStats({ 1: { acc: 50, total: 10 }, 2: { acc: 80, total: 20 } })
    const result = sortTopics(topics, 'tema', stats).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('input desordenado → salida ordenada por número', () => {
    const shuffled: T[] = [{ topicNumber: 3 }, { topicNumber: 1 }, { topicNumber: 5 }, { topicNumber: 2 }]
    const result = sortTopics(shuffled, 'tema', {}).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2, 3, 5])
  })

  it('no muta el array original', () => {
    const original: T[] = [{ topicNumber: 3 }, { topicNumber: 1 }]
    sortTopics(original, 'tema', {})
    expect(original.map((t) => t.topicNumber)).toEqual([3, 1])
  })
})

describe('sortTopics — accuracy_asc (% Más Bajo)', () => {
  it('peor accuracy primero, no-practicados al final', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10 },
      2: { acc: 80, total: 20 },
      4: { acc: 20, total: 5 },
      5: { acc: 100, total: 100 },
    })
    const result = sortTopics(topics, 'accuracy_asc', stats).map((t) => t.topicNumber)
    expect(result).toEqual([4, 1, 2, 5, 3])
  })

  it('total=0 trata como no practicado → va al final', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10 },
      2: { acc: 99, total: 0 }, // accuracy alto pero total=0 → no práctica real
    })
    const result = sortTopics([{ topicNumber: 1 }, { topicNumber: 2 }], 'accuracy_asc', stats).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2])
  })

  it('empate de accuracy → desempate por topicNumber ASC', () => {
    const stats = makeStats({
      1: { acc: 60, total: 10 },
      2: { acc: 60, total: 10 },
      3: { acc: 60, total: 10 },
    })
    const result = sortTopics(
      [{ topicNumber: 3 }, { topicNumber: 1 }, { topicNumber: 2 }],
      'accuracy_asc',
      stats,
    ).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2, 3])
  })
})

describe('sortTopics — accuracy_desc (% Más Alto)', () => {
  it('mejor accuracy primero, no-practicados al final', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10 },
      2: { acc: 80, total: 20 },
      4: { acc: 20, total: 5 },
      5: { acc: 100, total: 100 },
    })
    const result = sortTopics(topics, 'accuracy_desc', stats).map((t) => t.topicNumber)
    expect(result).toEqual([5, 2, 1, 4, 3])
  })
})

describe('sortTopics — last_study_new (Más Reciente)', () => {
  it('estudio más reciente primero, nunca-estudiados al final', () => {
    const stats = makeStats({
      1: { acc: 0, total: 5, date: '2026-05-01' },
      2: { acc: 0, total: 5, date: '2026-05-15' }, // más reciente
      4: { acc: 0, total: 5, date: '2026-04-20' },
      5: { acc: 0, total: 5, date: '2026-05-10' },
    })
    const result = sortTopics(topics, 'last_study_new', stats).map((t) => t.topicNumber)
    expect(result).toEqual([2, 5, 1, 4, 3])
  })

  it('lastStudy null → al final', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10, date: '2026-05-01' },
      2: { acc: 50, total: 10 }, // sin date
    })
    const result = sortTopics([{ topicNumber: 1 }, { topicNumber: 2 }], 'last_study_new', stats).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2])
  })

  it('todos sin date → orden numérico', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10 },
      2: { acc: 80, total: 20 },
      3: { acc: 30, total: 5 },
    })
    const input: T[] = [{ topicNumber: 3 }, { topicNumber: 1 }, { topicNumber: 2 }]
    const result = sortTopics(input, 'last_study_new', stats).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2, 3])
  })
})

describe('sortTopics — last_study_old (Más Antiguo)', () => {
  it('estudio más antiguo primero, nunca-estudiados al final', () => {
    const stats = makeStats({
      1: { acc: 0, total: 5, date: '2026-05-01' },
      2: { acc: 0, total: 5, date: '2026-05-15' },
      4: { acc: 0, total: 5, date: '2026-04-20' }, // más antiguo
      5: { acc: 0, total: 5, date: '2026-05-10' },
    })
    const result = sortTopics(topics, 'last_study_old', stats).map((t) => t.topicNumber)
    expect(result).toEqual([4, 1, 5, 2, 3])
  })
})

describe('sortTopics — escenarios extremos', () => {
  it('lista vacía → vacía', () => {
    expect(sortTopics([], 'accuracy_desc', {})).toEqual([])
  })

  it('un solo topic → mismo topic', () => {
    expect(sortTopics([{ topicNumber: 7 }], 'accuracy_desc', {})).toEqual([{ topicNumber: 7 }])
  })

  it('todos sin stats → orden numérico (modo accuracy)', () => {
    const result = sortTopics(
      [{ topicNumber: 5 }, { topicNumber: 1 }, { topicNumber: 3 }],
      'accuracy_desc',
      {},
    ).map((t) => t.topicNumber)
    expect(result).toEqual([1, 3, 5])
  })

  it('mantiene tipo genérico — preserva props extras', () => {
    type Topic = { topicNumber: number; title: string }
    const items: Topic[] = [
      { topicNumber: 2, title: 'B' },
      { topicNumber: 1, title: 'A' },
    ]
    const result = sortTopics(items, 'tema', {})
    expect(result[0].title).toBe('A')
    expect(result[1].title).toBe('B')
  })

  it('estabilidad: mismo input + mismo sortBy → misma salida', () => {
    const stats = makeStats({
      1: { acc: 50, total: 10 },
      2: { acc: 50, total: 10 },
      3: { acc: 50, total: 10 },
    })
    const r1 = sortTopics(topics, 'accuracy_asc', stats).map((t) => t.topicNumber)
    const r2 = sortTopics(topics, 'accuracy_asc', stats).map((t) => t.topicNumber)
    expect(r1).toEqual(r2)
  })
})

describe('sortTopics — fallback de SortOption desconocido', () => {
  it('valor inválido → orden numérico (defensivo)', () => {
    const result = sortTopics(
      [{ topicNumber: 3 }, { topicNumber: 1 }, { topicNumber: 2 }],
      'invalid_option' as SortOption,
      {},
    ).map((t) => t.topicNumber)
    expect(result).toEqual([1, 2, 3])
  })
})
