// Servir 3 opciones donde el examen tiene 3 (T-267, feedback de Pilar).
//
// Lo que se protege: que la correcta nunca desaparezca, que no se recorte una pregunta
// cuyas opciones se refieren al conjunto, y que la validación acepte subconjuntos — con
// la versión estricta, un orden de 3 sobre 4 se tomaría por corrupto y la respuesta se
// corregiría contra la clave equivocada, que es el bug que marcó 56 aciertos como fallo.
import {
  subsetOrderFor,
  isValidDisplayOrder,
  tieneOpcionQueDependeDelConjunto,
  opcionesDeExamen,
  isValidExposureOrder,
} from '@/lib/shuffle/subsetOrder'

const Q = 'bf225577-d43e-4582-80dd-7482a0814682'

describe('subsetOrderFor', () => {
  it('devuelve exactamente `target` opciones', () => {
    for (let correcta = 0; correcta < 4; correcta++) {
      const order = subsetOrderFor(Q, 'n1', 4, 3, correcta)
      expect(order).toHaveLength(3)
    }
  })

  it('SIEMPRE incluye la correcta (servir una pregunta sin respuesta válida es peor que no recortar)', () => {
    for (let correcta = 0; correcta < 4; correcta++) {
      for (const nonce of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const order = subsetOrderFor(Q, nonce, 4, 3, correcta)!
        expect(order).toContain(correcta)
      }
    }
  })

  it('no repite opciones y todas están en rango', () => {
    for (const nonce of ['x', 'y', 'z']) {
      const order = subsetOrderFor(Q, nonce, 4, 3, 1)!
      expect(new Set(order).size).toBe(order.length)
      order.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(4) })
    }
  })

  it('es reproducible con el mismo nonce y cambia con otro', () => {
    expect(subsetOrderFor(Q, 'mismo', 4, 3, 2)).toEqual(subsetOrderFor(Q, 'mismo', 4, 3, 2))
    const distintos = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(subsetOrderFor(Q, `n${i}`, 4, 3, 2))),
    )
    expect(distintos.size).toBeGreaterThan(1)
  })

  it('la correcta NO cae siempre en la misma posición (si no, se aprende el sitio, no la materia)', () => {
    const posiciones = new Set(
      Array.from({ length: 40 }, (_, i) => subsetOrderFor(Q, `p${i}`, 4, 3, 0)!.indexOf(0)),
    )
    expect(posiciones.size).toBeGreaterThan(1)
  })

  it('reparte los distractores en vez de quedarse siempre con los mismos', () => {
    const usados = new Set<number>()
    for (let i = 0; i < 40; i++) subsetOrderFor(Q, `d${i}`, 4, 3, 0)!.forEach((v) => usados.add(v))
    // Con 3 de 4 y suficientes exposiciones, los tres distractores deben aparecer.
    expect(usados.has(1) && usados.has(2) && usados.has(3)).toBe(true)
  })

  it('devuelve null cuando no se puede reducir con seguridad (el llamador sirve natural)', () => {
    expect(subsetOrderFor(Q, 'n', 4, 4, 0)).toBeNull() // no reduce
    expect(subsetOrderFor(Q, 'n', 4, 5, 0)).toBeNull() // pide más de las que hay
    expect(subsetOrderFor(Q, 'n', 4, 1, 0)).toBeNull() // 1 opción no es una pregunta
    expect(subsetOrderFor(Q, 'n', 4, 3, 9)).toBeNull() // correcta fuera de rango
    expect(subsetOrderFor(Q, 'n', 2, 3, 0)).toBeNull()
  })

  it('sirve para 5→3 y 4→2, no solo para el caso de Madrid', () => {
    expect(subsetOrderFor(Q, 'n', 5, 3, 4)).toHaveLength(3)
    expect(subsetOrderFor(Q, 'n', 5, 3, 4)).toContain(4)
    expect(subsetOrderFor(Q, 'n', 4, 2, 3)).toHaveLength(2)
    expect(subsetOrderFor(Q, 'n', 4, 2, 3)).toContain(3)
  })
})

describe('isValidDisplayOrder', () => {
  it('acepta la permutación completa (lo de siempre)', () => {
    expect(isValidDisplayOrder([2, 3, 0, 1], 4)).toBe(true)
  })

  it('acepta un SUBCONJUNTO — con la validación estricta se corregiría contra la clave equivocada', () => {
    expect(isValidDisplayOrder([2, 0, 3], 4)).toBe(true)
    expect(isValidDisplayOrder([1, 3], 4)).toBe(true)
  })

  it('sigue rechazando lo corrupto', () => {
    expect(isValidDisplayOrder([0, 0, 1], 4)).toBe(false) // repetido
    expect(isValidDisplayOrder([0, 1, 9], 4)).toBe(false) // fuera de rango
    expect(isValidDisplayOrder([0, 1, -1], 4)).toBe(false)
    expect(isValidDisplayOrder([], 4)).toBe(false) // vacío
    expect(isValidDisplayOrder([0, 1, 2, 3, 0], 4)).toBe(false) // más largo que n
    expect(isValidDisplayOrder(null, 4)).toBe(false)
    expect(isValidDisplayOrder('0,1,2', 4)).toBe(false)
  })
})

describe('tieneOpcionQueDependeDelConjunto', () => {
  it('detecta las que se rompen al quitar una opción', () => {
    expect(tieneOpcionQueDependeDelConjunto(['Madrid', 'Todas las anteriores son correctas', 'Nada'])).toBe(true)
    expect(tieneOpcionQueDependeDelConjunto(['a', 'b', 'Ninguna de las anteriores'])).toBe(true)
    expect(tieneOpcionQueDependeDelConjunto(['a', 'Las respuestas A y B son correctas', 'c'])).toBe(true)
    expect(tieneOpcionQueDependeDelConjunto(['a', 'b', 'Ninguna es correcta'])).toBe(true)
  })

  it('no marca las opciones normales', () => {
    expect(tieneOpcionQueDependeDelConjunto(['El Congreso', 'El Senado', 'El Rey', 'El Gobierno'])).toBe(false)
    expect(tieneOpcionQueDependeDelConjunto(['15 días', '1 mes', '3 meses'])).toBe(false)
  })
})

describe('opcionesDeExamen', () => {
  it('lee el número de la raíz (Ayuntamiento de Madrid)', () => {
    expect(opcionesDeExamen({ opciones: 3, tipo: 'test' })).toBe(3)
    expect(opcionesDeExamen({ opciones: 4 })).toBe(4)
  })

  it('lo lee de las partes cuando todas coinciden (Policía Municipal)', () => {
    expect(opcionesDeExamen({ partes: [{ opciones: 3 }, { opciones: 3 }] })).toBe(3)
  })

  it('si las partes discrepan NO reduce (mejor servir como siempre que recortar con el número de la otra mitad)', () => {
    expect(opcionesDeExamen({ partes: [{ opciones: 3 }, { opciones: 4 }] })).toBeNull()
  })

  it('sin dato, null (la inmensa mayoría de oposiciones)', () => {
    expect(opcionesDeExamen({})).toBeNull()
    expect(opcionesDeExamen(null)).toBeNull()
    expect(opcionesDeExamen({ partes: [{ preguntas: 60 }] })).toBeNull()
    expect(opcionesDeExamen({ opciones: 'tres' })).toBeNull()
    expect(opcionesDeExamen({ opciones: 99 })).toBeNull()
  })
})

describe('isValidExposureOrder (la que se usa al RESPONDER)', () => {
  it('acepta la permutación completa: 4 mostradas, índices 0-3', () => {
    expect(isValidExposureOrder([2, 3, 0, 1], 4)).toBe(true)
  })

  it('acepta 3 mostradas con índices del banco de 4 — el caso de Madrid', () => {
    // Con la validación vieja esto era "corrupto": length(3) !== n(3) pero el índice 3
    // quedaba fuera de rango → identidad → corrección contra la clave equivocada.
    expect(isValidExposureOrder([2, 0, 3], 3)).toBe(true)
    expect(isValidExposureOrder([3, 1, 0], 3)).toBe(true)
  })

  it('exige que la longitud coincida con lo que el usuario VIO', () => {
    expect(isValidExposureOrder([2, 0, 3], 4)).toBe(false) // dijo ver 4 y manda 3
    expect(isValidExposureOrder([2, 3, 0, 1], 3)).toBe(false)
  })

  it('sigue rechazando índices imposibles y repetidos', () => {
    expect(isValidExposureOrder([0, 0, 1], 3)).toBe(false)
    expect(isValidExposureOrder([0, 1, 9], 3)).toBe(false)
    expect(isValidExposureOrder([0, 1, -1], 3)).toBe(false)
    expect(isValidExposureOrder(null, 3)).toBe(false)
    expect(isValidExposureOrder('0,1,2', 3)).toBe(false)
  })
})

// ── Integración con la explicación estructurada ──────────────────────────────
// Un subconjunto no solo cambia qué opciones se ven: la explicación se compone desde la
// estructura y tiene que hablar SOLO de las servidas, con sus letras reales.
import { renderStructuredExplanation } from '@/lib/shuffle/structuredExplanation'

describe('explicación estructurada con subconjunto (3 de 4)', () => {
  const data = {
    intro: 'Vamos allá.',
    options: { '0': 'razón de la A', '1': 'razón de la B', '2': 'razón de la C', '3': 'razón de la D' },
  } as Parameters<typeof renderStructuredExplanation>[0]

  it('solo menciona las opciones servidas y con la letra que vio el usuario', () => {
    // Se sirvieron 3 de 4: originales C(2), A(0) y D(3). La correcta es la A (0) y quedó
    // en la posición 1 → para el usuario es la "B".
    const texto = renderStructuredExplanation(data, {
      correctOption: 0,
      optionOrder: [2, 0, 3],
      nOptions: 3,
    })
    expect(texto).toContain('**Por qué B es correcta:** razón de la A')
    // Las otras dos servidas, con su letra mostrada
    expect(texto).toContain('**A)** razón de la C')
    expect(texto).toContain('**C)** razón de la D')
    // La opción que NO se sirvió (original 1, "razón de la B") no puede aparecer
    expect(texto).not.toContain('razón de la B')
    // Y no puede inventarse una D) que el usuario no vio
    expect(texto).not.toContain('**D)**')
  })

  it('sin subconjunto sigue comportándose igual que siempre', () => {
    const texto = renderStructuredExplanation(data, {
      correctOption: 0,
      optionOrder: [2, 3, 0, 1],
      nOptions: 4,
    })
    expect(texto).toContain('**Por qué C es correcta:** razón de la A')
    expect(texto).toContain('**D)** razón de la B')
  })
})
