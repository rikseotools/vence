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
      { guardadas: 25, corregidas: 25 },
      { guardadas: 23, corregidas: 23 },
      { guardadas: 24, corregidas: 24 },
      { guardadas: 23, corregidas: 23 },
    ]
    for (const r of reparables) {
      expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, ...r })).toBe('correccion_bloqueada')
    }
  })

  it('el de 14/25 NO se repara aunque sus 14 estén corregidas: eso es irse, no entregar', () => {
    // 13da2e11: 14 respuestas de 25. Sin este corte, cualquier abandono se convertiría en un
    // examen «terminado» con una nota de 6 sobre 14 que nadie quiso sacar.
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, guardadas: 14, corregidas: 14 })).toBe('abandonado')
  })

  it('los TRES sin una sola respuesta: no hay nada que reparar', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: T, guardadas: 0, corregidas: 0 })).toBe('vacio')
  })

  it('sus tres exámenes del 06/08, ya con nota, se quedan como están', () => {
    expect(estadoDeExamen({ isCompleted: true, totalQuestions: T, guardadas: 25, corregidas: 25 })).toBe('ya_completo')
  })
})

describe('el criterio no se puede ablandar sin querer', () => {
  it('si queda ALGO por corregir, no es este fallo: no sabemos qué nota le tocaba', () => {
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, guardadas: 25, corregidas: 24 })).toBe('abandonado')
  })

  it('el umbral deja entregar con alguna en blanco (23/25) pero no a medias (14/25)', () => {
    expect(MINIMO_RESPONDIDO).toBe(0.8)
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, guardadas: 20, corregidas: 20 })).toBe('correccion_bloqueada')
    expect(estadoDeExamen({ isCompleted: false, totalQuestions: 25, guardadas: 19, corregidas: 19 })).toBe('abandonado')
  })

  it('solo una cosa es reparable', () => {
    expect(esReparable('correccion_bloqueada')).toBe(true)
    for (const e of ['ya_completo', 'abandonado', 'vacio'] as const) expect(esReparable(e)).toBe(false)
  })
})
