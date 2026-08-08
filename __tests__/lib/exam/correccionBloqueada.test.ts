import { estadoDeExamen, esReparable, MINIMO_RESPONDIDO } from '@/lib/exam/correccionBloqueada'

/**
 * [T-671] — los ocho exámenes de `rbsc87` el 07/08/2026, con sus cifras REALES de la BD. Cinco
 * son reparables y tres no, y la diferencia entre acertar y no acertar es que a tres personas
 * no se les invente una nota que nunca sacaron.
 */
describe('estadoDeExamen — los ocho exámenes reales de rbsc87', () => {
  const T = 25

  it('los CINCO que sí se pueden reparar: respondió y solo faltó cerrar', () => {
    // fc5396cf 25/25 · 6630b007 23/23 · 8c6a03d0 24/24 · 4a3f5076 23/23
    const reparables = [
      { respondidas: 25, corregidas: 25 },
      { respondidas: 23, corregidas: 23 },
      { respondidas: 24, corregidas: 24 },
      { respondidas: 23, corregidas: 23 },
    ]
    for (const r of reparables) {
      expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, ...r })).toBe('correccion_bloqueada')
    }
  })

  it('el de 14/25 NO se repara aunque sus 14 estén corregidas: eso es irse, no entregar', () => {
    // 13da2e11: 14 respuestas de 25. Sin este corte, cualquier abandono se convertiría en un
    // examen «terminado» con una nota de 6 sobre 14 que nadie quiso sacar.
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, respondidas: 14, corregidas: 14 })).toBe('abandonado')
  })

  it('los TRES sin una sola respuesta: no hay nada que reparar', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, respondidas: 0, corregidas: 0 })).toBe('vacio')
  })

  it('sus tres exámenes del 06/08, ya con nota, se quedan como están', () => {
    expect(estadoDeExamen({ isCompleted: true, totalQuestions: T, respondidas: 25, corregidas: 25 })).toBe('ya_completo')
  })
})

describe('REGRESIÓN: el examen que NADIE contestó (08/08/2026, fallo de la 1ª versión)', () => {
  // Al abrir un examen se pre-crean las filas con `user_answer = ''` e `is_correct = false`.
  // La primera versión medía «filas guardadas», así que un examen intacto salía como 73
  // respondidas y 73 corregidas → reparable. Se marcaron 8 exámenes como terminados con un 0
  // sobre 73, 97 y 80 a gente que solo los había abierto (`gicamarc`, 5 de ellos).
  it('73 filas pre-creadas y CERO respuestas reales = vacío, no reparable', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 73, respondidas: 0, corregidas: 0 })).toBe('vacio')
  })

  it('una sola respuesta de 73 tampoco: abrir no es entregar', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 73, respondidas: 1, corregidas: 1 })).toBe('abandonado')
  })

  it('el caso de sara_yop: 7 respondidas de 15 se queda fuera', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 15, respondidas: 7, corregidas: 7 })).toBe('abandonado')
  })
})

describe('el criterio no se puede ablandar sin querer', () => {
  it('si queda ALGO por corregir, no es este fallo: no sabemos qué nota le tocaba', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, respondidas: 25, corregidas: 24 })).toBe('abandonado')
  })

  it('el umbral deja entregar con alguna en blanco (23/25) pero no a medias (14/25)', () => {
    expect(MINIMO_RESPONDIDO).toBe(0.8)
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, respondidas: 20, corregidas: 20 })).toBe('correccion_bloqueada')
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, respondidas: 19, corregidas: 19 })).toBe('abandonado')
  })

  it('solo una cosa es reparable', () => {
    expect(esReparable('correccion_bloqueada')).toBe(true)
    for (const e of ['ya_completo', 'abandonado', 'vacio'] as const) expect(esReparable(e)).toBe(false)
  })
})
