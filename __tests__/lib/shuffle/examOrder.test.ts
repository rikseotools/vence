import {
  buildOptionOrders,
  optionOrdersFromMetadata,
  orderForQuestion,
  displayedLetterToOriginal,
  originalLetterToDisplayed,
} from '@/lib/shuffle/examOrder'

describe('buildOptionOrders — extraer el orden de las preguntas servidas al crear el examen', () => {
  it('solo incluye las que se barajaron de verdad', () => {
    const out = buildOptionOrders([
      { id: 'q1', option_order: [2, 0, 1, 3] },
      { id: 'q2', option_order: null },
      { id: 'q3' },
    ])
    expect(out).toEqual({ q1: [2, 0, 1, 3] })
  })

  it('un examen entero sin shuffle produce {} (el caso normal, la mayoría de oposiciones)', () => {
    expect(buildOptionOrders([{ id: 'q1' }, { id: 'q2', option_order: null }])).toEqual({})
  })

  it('ignora preguntas sin id (no se podría indexar por questionId)', () => {
    expect(buildOptionOrders([{ option_order: [1, 0] }])).toEqual({})
  })

  it('un array vacío no cuenta como orden (nada que traducir)', () => {
    expect(buildOptionOrders([{ id: 'q1', option_order: [] }])).toEqual({})
  })
})

describe('optionOrdersFromMetadata — leer de tests.questions_metadata sin poder reventar', () => {
  it('lee el caso normal', () => {
    expect(optionOrdersFromMetadata({ option_orders: { q1: [1, 0, 2] } })).toEqual({ q1: [1, 0, 2] })
  })

  it('metadata sin la clave (examen histórico, pre-T-277) → {}, no un error', () => {
    expect(optionOrdersFromMetadata({ question_ids: ['q1', 'q2'] })).toEqual({})
  })

  it('metadata null/undefined/no-objeto → {}', () => {
    expect(optionOrdersFromMetadata(null)).toEqual({})
    expect(optionOrdersFromMetadata(undefined)).toEqual({})
    expect(optionOrdersFromMetadata('corrupto')).toEqual({})
    expect(optionOrdersFromMetadata(42)).toEqual({})
  })

  it('descarta entradas corruptas (no-array, con valores no enteros) SIN tirar las demás', () => {
    expect(
      optionOrdersFromMetadata({
        option_orders: { q1: [1, 0], q2: 'no es un array', q3: [1, 'x', 2], q4: [2, 1, 0] },
      })
    ).toEqual({ q1: [1, 0], q4: [2, 1, 0] })
  })
})

describe('orderForQuestion — el orden de UNA pregunta, con guarda anti-corrupción', () => {
  it('devuelve el orden si existe', () => {
    expect(orderForQuestion({ q1: [2, 0, 1] }, 'q1')).toEqual([2, 0, 1])
  })

  it('null si la pregunta no está en el mapa (no se barajó)', () => {
    expect(orderForQuestion({ q1: [2, 0, 1] }, 'q2')).toBeNull()
  })

  it('null si el orden guardado NO es una permutación válida (dato corrupto → identidad segura)', () => {
    // repetido: 0 aparece dos veces
    expect(orderForQuestion({ q1: [0, 0, 1] }, 'q1')).toBeNull()
  })

  it('null si excede MAX_OPCIONES_BANCO (5) — no se puede fabricar un orden así de verdad, pero si apareciera no se usa', () => {
    expect(orderForQuestion({ q1: [0, 1, 2, 3, 4, 5] }, 'q1')).toBeNull()
  })
})

describe('displayedLetterToOriginal — lo que el usuario clicó → coordenadas del banco', () => {
  it('sin orden (examen sin barajar): identidad, retrocompatible al 100%', () => {
    expect(displayedLetterToOriginal(null, 'b')).toBe('b')
  })

  it('con orden: traduce la posición mostrada al índice original', () => {
    // order[i] = índice original en la posición i. order=[2,0,1,3]:
    // posición 0 (mostrada 'a') → original 2 ('c'); posición 1 ('b') → original 0 ('a')
    expect(displayedLetterToOriginal([2, 0, 1, 3], 'a')).toBe('c')
    expect(displayedLetterToOriginal([2, 0, 1, 3], 'b')).toBe('a')
  })

  it('respuesta en blanco (null) se queda en blanco', () => {
    expect(displayedLetterToOriginal([2, 0, 1, 3], null)).toBeNull()
    expect(displayedLetterToOriginal([2, 0, 1, 3], '')).toBe('')
  })

  it('es la inversa exacta de originalLetterToDisplayed (round-trip)', () => {
    const order = [2, 0, 3, 1]
    for (const letra of ['a', 'b', 'c', 'd']) {
      const original = displayedLetterToOriginal(order, letra)
      expect(originalLetterToDisplayed(order, original)).toBe(letra)
    }
  })
})

describe('originalLetterToDisplayed — reconstruir savedAnswers al REANUDAR', () => {
  it('sin orden: identidad', () => {
    expect(originalLetterToDisplayed(null, 'c')).toBe('c')
  })

  it('con orden: la letra ORIGINAL guardada en BD → dónde está AHORA en pantalla', () => {
    // order=[2,0,1,3]: el original 2 ('c') está en la posición 0 ('a')
    expect(originalLetterToDisplayed([2, 0, 1, 3], 'c')).toBe('a')
    expect(originalLetterToDisplayed([2, 0, 1, 3], 'a')).toBe('b')
  })

  it('si el original ya no está en el orden (subconjunto recortado, T-267 style): se queda igual en vez de reventar', () => {
    // subconjunto de 3 sobre un banco de 4: falta el índice 3
    expect(originalLetterToDisplayed([2, 0, 1], 'd')).toBe('d')
  })
})

describe('escenario end-to-end (lo que este módulo existe para proteger): servir → responder → reanudar', () => {
  it('el examen reanudado ve las MISMAS opciones y la respuesta previa cae en el sitio correcto', () => {
    // 1) Se sirve el examen: la pregunta q1 se baraja con este orden.
    const servido = buildOptionOrders([{ id: 'q1', option_order: [3, 1, 0, 2] }])
    expect(servido).toEqual({ q1: [3, 1, 0, 2] })

    // 2) Eso se persiste en questions_metadata (simulado) y se relee más tarde.
    const metadataPersistida = { question_ids: ['q1'], option_orders: servido }
    const orders = optionOrdersFromMetadata(metadataPersistida)

    // 3) El usuario respondió 'b' (2ª opción mostrada) ANTES de dejar el examen a medias.
    //    order=[3,1,0,2] → posición 1 ('b') muestra el original 1 ('b'), así que se
    //    guarda en test_questions como 'b' (coincide, pero por construcción no por casualidad:
    //    ver el caso de 'a' más abajo, que SÍ cambia).
    const order = orderForQuestion(orders, 'q1')
    const original = displayedLetterToOriginal(order, 'b')
    expect(original).toBe('b') // order[1] = 1 → 'b'
    expect(displayedLetterToOriginal(order, 'a')).toBe('d') // order[0] = 3 → 'd'

    // 4) Al REANUDAR, se relee el MISMO orden (no uno nuevo) y se reconstruye qué vio:
    const orderEnResume = orderForQuestion(optionOrdersFromMetadata(metadataPersistida), 'q1')
    expect(orderEnResume).toEqual([3, 1, 0, 2]) // idéntico al servido — el examen NO se corrompió
    const mostradaDeNuevo = originalLetterToDisplayed(orderEnResume, original)
    expect(mostradaDeNuevo).toBe('b') // vuelve a ver su propia respuesta en el mismo sitio
  })
})
