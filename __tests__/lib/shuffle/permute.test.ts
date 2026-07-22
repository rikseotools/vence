// Guardarraíl del módulo de permutación (barajar-opciones Fase 1).
//
// Lo crítico: (a) `order` es SIEMPRE una permutación válida (nada se pierde ni se
// duplica), (b) el mapeo posición-mostrada→original es el inverso exacto de aplicar
// el orden (si no, la validación server-side marcaría mal la clave), (c) es
// reproducible por (questionId,nonce) y VARÍA al cambiar el nonce (repetición
// reordena). Ver docs/roadmap/barajar-opciones-fase1-spec.md §3.

import {
  permutationFor,
  applyOrder,
  displayedToOriginal,
  isValidOrder,
} from '@/lib/shuffle/permute'

describe('permutationFor — permutación válida y reproducible', () => {
  test.each([2, 3, 4, 5])('order es permutación de [0..n-1] para n=%i', (n) => {
    const order = permutationFor('q-abc', 'nonce-1', n)
    expect(order).toHaveLength(n)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i))
  })

  test('n<=1 devuelve identidad', () => {
    expect(permutationFor('q', 'n', 0)).toEqual([])
    expect(permutationFor('q', 'n', 1)).toEqual([0])
  })

  test('es reproducible: mismos (questionId,nonce,n) → mismo order', () => {
    const a = permutationFor('q-xyz', 'nonce-42', 4)
    const b = permutationFor('q-xyz', 'nonce-42', 4)
    expect(a).toEqual(b)
  })

  test('varía por exposición: distinto nonce suele reordenar', () => {
    // No garantizamos que SIEMPRE cambie (una permutación puede repetirse por azar),
    // pero sobre muchos nonces la mayoría deben diferir del orden natural.
    const natural = [0, 1, 2, 3]
    let differentFromNatural = 0
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) {
      const order = permutationFor('q-fixed', `nonce-${i}`, 4)
      seen.add(order.join(','))
      if (order.join(',') !== natural.join(',')) differentFromNatural++
    }
    // Con 50 nonces esperamos varias permutaciones distintas y que la mayoría no sean
    // el orden natural (24 permutaciones posibles).
    expect(seen.size).toBeGreaterThan(5)
    expect(differentFromNatural).toBeGreaterThan(35)
  })

  test('distinto questionId → orden independiente', () => {
    const a = permutationFor('q-1', 'same-nonce', 4)
    const b = permutationFor('q-2', 'same-nonce', 4)
    // Ambas válidas; con altísima probabilidad no idénticas.
    expect(isValidOrder(a, 4)).toBe(true)
    expect(isValidOrder(b, 4)).toBe(true)
  })
})

describe('applyOrder / displayedToOriginal — inversos exactos', () => {
  test('applyOrder reordena: resultado[i] = items[order[i]]', () => {
    const items = ['A', 'B', 'C', 'D']
    const order = [2, 0, 3, 1]
    expect(applyOrder(items, order)).toEqual(['C', 'A', 'D', 'B'])
  })

  test('displayedToOriginal deshace applyOrder para CUALQUIER permutación', () => {
    const items = ['optA', 'optB', 'optC', 'optD']
    for (let seed = 0; seed < 30; seed++) {
      const order = permutationFor('q', `s${seed}`, items.length)
      const shown = applyOrder(items, order)
      // Para cada posición mostrada, mapear a original y comprobar que recupera el item.
      shown.forEach((shownItem, displayedIdx) => {
        const originalIdx = displayedToOriginal(order, displayedIdx)
        expect(items[originalIdx]).toBe(shownItem)
      })
    }
  })

  test('la respuesta correcta se preserva a través del barajado', () => {
    // Simula el camino completo: BD tiene correct_option=2 (C). Barajamos, el usuario
    // pincha la posición donde AHORA está C, y el server la mapea de vuelta a 2.
    const dbCorrect = 2
    for (let seed = 0; seed < 30; seed++) {
      const order = permutationFor('q', `s${seed}`, 4)
      const displayedOfCorrect = order.indexOf(dbCorrect) // dónde se muestra C
      const back = displayedToOriginal(order, displayedOfCorrect)
      expect(back).toBe(dbCorrect)
    }
  })

  test('order null/undefined → identidad (histórico retrocompatible)', () => {
    expect(displayedToOriginal(null, 3)).toBe(3)
    expect(displayedToOriginal(undefined, 1)).toBe(1)
  })

  test('displayedIdx fuera de rango → identidad (defensivo)', () => {
    expect(displayedToOriginal([1, 0], 5)).toBe(5)
  })
})

describe('isValidOrder — guardarraíl anti order corrupto', () => {
  test('acepta permutaciones válidas', () => {
    expect(isValidOrder([0, 1, 2, 3], 4)).toBe(true)
    expect(isValidOrder([2, 0, 1], 3)).toBe(true)
  })

  test('rechaza longitud incorrecta', () => {
    expect(isValidOrder([0, 1, 2], 4)).toBe(false)
  })

  test('rechaza duplicados', () => {
    expect(isValidOrder([0, 1, 1, 2], 4)).toBe(false)
  })

  test('rechaza índices fuera de rango o no enteros', () => {
    expect(isValidOrder([0, 1, 2, 4], 4)).toBe(false)
    expect(isValidOrder([0, 1, 2, -1], 4)).toBe(false)
    expect(isValidOrder([0, 1, 2, 1.5], 4)).toBe(false)
  })

  test('rechaza no-arrays', () => {
    expect(isValidOrder(null, 4)).toBe(false)
    expect(isValidOrder('0,1,2,3', 4)).toBe(false)
  })
})
