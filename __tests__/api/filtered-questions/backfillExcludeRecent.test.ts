/**
 * Relleno por déficit de exclude-recent (bug nº de preguntas, CARM/Laura 18/06/2026).
 *
 * BUG: `excludeRecentDays` (toggle del usuario) quita las preguntas respondidas
 * hace poco SIN reponer. Quien practica mucho un tema exprime el pool fresco y
 * recibe tests más cortos de lo pedido (valencia T36: banco 64 → 7 frescas → test
 * de 7 aunque pidiera 9). El cap del configurador NO lo ve, porque la estimación
 * cuenta el banco bruto (no descuenta recientes).
 *
 * FIX: apartar las recientes como `recentReserve` (oldest-first) y, si la
 * selección final no llega a numQuestions, repescar de ahí (backfillFromReserve).
 * El cliente recibe `backfilledRecentCount` y avisa "se completaron con N ya vistas".
 *
 * Estos tests cubren: (1) la función pura de relleno, (2) el aviso adjunto al array
 * (attach/read), y (3) simulaciones de los 3 escenarios reales de los eventos
 * test_size_shortfall. Si alguien rompe el relleno o el orden, fallan.
 */

import { backfillFromReserve } from '@/lib/api/filtered-questions/queries'
import { attachBackfillNotice, readTestNotice } from '@/lib/testFetchers'

type Q = { id: string }
const q = (id: string): Q => ({ id })
const ids = (arr: Q[]) => arr.map(x => x.id)

describe('backfillFromReserve (función pura)', () => {
  test('sin déficit (ya hay suficientes) → no toca nada', () => {
    const selected = [q('a'), q('b'), q('c')]
    const r = backfillFromReserve(selected, [q('x'), q('y')], 3)
    expect(r.backfilledCount).toBe(0)
    expect(ids(r.questions)).toEqual(['a', 'b', 'c'])
  })

  test('selección por encima del target → tampoco rellena', () => {
    const selected = [q('a'), q('b'), q('c'), q('d')]
    const r = backfillFromReserve(selected, [q('x')], 3)
    expect(r.backfilledCount).toBe(0)
    expect(ids(r.questions)).toEqual(['a', 'b', 'c', 'd'])
  })

  test('reserva vacía (banco corto / anónimo) → no rellena', () => {
    const r = backfillFromReserve([q('a')], [], 5)
    expect(r.backfilledCount).toBe(0)
    expect(ids(r.questions)).toEqual(['a'])
  })

  test('déficit → rellena oldest-first hasta el target, al final de la lista', () => {
    const selected = [q('a'), q('b')] // 2
    const reserve = [q('r1'), q('r2'), q('r3'), q('r4')] // oldest-first
    const r = backfillFromReserve(selected, reserve, 5)
    expect(r.backfilledCount).toBe(3)
    // preserva el orden de lo ya elegido; relleno a la cola en orden de reserva
    expect(ids(r.questions)).toEqual(['a', 'b', 'r1', 'r2', 'r3'])
  })

  test('reserva más pequeña que el déficit → rellena lo que puede (sin inventar)', () => {
    const r = backfillFromReserve([q('a')], [q('r1'), q('r2')], 10)
    expect(r.backfilledCount).toBe(2)
    expect(ids(r.questions)).toEqual(['a', 'r1', 'r2'])
  })

  test('dedup: una pregunta ya seleccionada no se repite desde la reserva', () => {
    const selected = [q('a'), q('b')]
    const reserve = [q('b'), q('r1')] // 'b' ya está
    const r = backfillFromReserve(selected, reserve, 4)
    expect(r.backfilledCount).toBe(1)
    expect(ids(r.questions)).toEqual(['a', 'b', 'r1'])
  })

  test('reserva con duplicados internos → no mete la misma dos veces', () => {
    const r = backfillFromReserve([q('a')], [q('r1'), q('r1'), q('r2')], 3)
    expect(r.backfilledCount).toBe(2)
    expect(ids(r.questions)).toEqual(['a', 'r1', 'r2'])
  })

  test('target inválido (NaN) → no rellena (guardarraíl)', () => {
    const r = backfillFromReserve([q('a')], [q('r1')], NaN)
    expect(r.backfilledCount).toBe(0)
    expect(ids(r.questions)).toEqual(['a'])
  })

  test('no muta los arrays de entrada', () => {
    const selected = [q('a')]
    const reserve = [q('r1')]
    backfillFromReserve(selected, reserve, 2)
    expect(ids(selected)).toEqual(['a'])
    expect(ids(reserve)).toEqual(['r1'])
  })
})

describe('aviso adjunto al array (attachBackfillNotice / readTestNotice)', () => {
  test('adjunta el aviso cuando hubo relleno (>0)', () => {
    const arr = attachBackfillNotice([q('a'), q('b')], {
      backfilledRecentCount: 2, requestedCount: 4,
    })
    const notice = readTestNotice(arr)
    expect(notice).toEqual({ type: 'backfilled_recent', backfilledRecentCount: 2, requestedCount: 4 })
  })

  test('no adjunta nada cuando no hubo relleno (0)', () => {
    const arr = attachBackfillNotice([q('a')], { backfilledRecentCount: 0, requestedCount: 1 })
    expect(readTestNotice(arr)).toBeNull()
  })

  test('el aviso es NO enumerable: no rompe length/map/JSON', () => {
    const arr = attachBackfillNotice([q('a'), q('b')], { backfilledRecentCount: 1, requestedCount: 3 })
    expect(arr.length).toBe(2)
    expect(arr.map(x => x.id)).toEqual(['a', 'b'])
    // JSON del array solo serializa los índices, no la prop nombrada no-enumerable
    expect(JSON.parse(JSON.stringify(arr))).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(Object.keys(arr)).toEqual(['0', '1'])
  })

  test('readTestNotice tolera null / objeto adaptativo sin aviso', () => {
    expect(readTestNotice(null)).toBeNull()
    expect(readTestNotice(undefined)).toBeNull()
    expect(readTestNotice({ isAdaptive: true, activeQuestions: [] })).toBeNull()
  })

  test('requestedCount cae a length si la API no lo manda', () => {
    const arr = attachBackfillNotice([q('a'), q('b'), q('c')], { backfilledRecentCount: 1 })
    expect(readTestNotice(arr)?.requestedCount).toBe(3)
  })
})

describe('Simulaciones de los 3 escenarios reales (eventos test_size_shortfall)', () => {
  // Replica del flujo del servidor: fresh = banco - recientes; selección = fresh
  // (slice target); si falta, relleno desde la reserva oldest-first.
  function simulateServer(opts: {
    bank: string[]
    recentOldestFirst: string[] // recientes ordenadas oldest-first (las que excluye)
    target: number
    userId?: string | null
    excludeRecentDays?: number
  }) {
    const { bank, recentOldestFirst, target, userId = 'u1', excludeRecentDays = 15 } = opts
    const recentSet = new Set(recentOldestFirst)
    let fresh = bank.map(q)
    let reserve: Q[] = []
    if (excludeRecentDays > 0 && userId) {
      const rank = new Map(recentOldestFirst.map((id, i) => [id, i]))
      reserve = fresh.filter(x => rank.has(x.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
      fresh = fresh.filter(x => !recentSet.has(x.id))
    }
    const selected = fresh.slice(0, target)
    const filled = backfillFromReserve(selected, reserve, target)
    return { served: filled.questions.length, backfilled: filled.backfilledCount, ids: ids(filled.questions) }
  }

  test('valencia T36 (exclude-recent): banco 64, 57 recientes, pide 9 → sirve 9 (2 repescadas)', () => {
    const bank = Array.from({ length: 64 }, (_, i) => `v${i}`)
    const recent = bank.slice(0, 57) // 57 vistas → 7 frescas
    const r = simulateServer({ bank, recentOldestFirst: recent, target: 9 })
    expect(r.served).toBe(9)        // ANTES del fix: 7 (test corto)
    expect(r.backfilled).toBe(2)    // repescó 2 oldest-first
    // las repescadas son las 2 más antiguas de las recientes
    expect(r.ids.slice(7)).toEqual(['v0', 'v1'])
    expect(new Set(r.ids).size).toBe(9) // sin duplicados
  })

  test('baleares T3 (banco corto, anónimo): banco 13, pide 25 → sirve 13, sin relleno', () => {
    const bank = Array.from({ length: 13 }, (_, i) => `b${i}`)
    const r = simulateServer({ bank, recentOldestFirst: [], target: 25, userId: null, excludeRecentDays: 0 })
    expect(r.served).toBe(13)     // límite real del banco (no se puede inventar)
    expect(r.backfilled).toBe(0)  // no hay reserva
  })

  test('cadiz T12 (filtro de 1 artículo, pool chico): banco-filtrado 5, 1 reciente, pide 5 → sirve 5 (1 repescada)', () => {
    const bank = ['c0', 'c1', 'c2', 'c3', 'c4'] // tras filtrar al artículo
    const r = simulateServer({ bank, recentOldestFirst: ['c0'], target: 5 })
    expect(r.served).toBe(5)      // ANTES: 4
    expect(r.backfilled).toBe(1)
    expect(r.ids).toContain('c0')
  })

  test('usuario que NO ha practicado: pool fresco cubre el target → 0 relleno (no regresión)', () => {
    const bank = Array.from({ length: 40 }, (_, i) => `n${i}`)
    const r = simulateServer({ bank, recentOldestFirst: [], target: 25 })
    expect(r.served).toBe(25)
    expect(r.backfilled).toBe(0)
  })
})
