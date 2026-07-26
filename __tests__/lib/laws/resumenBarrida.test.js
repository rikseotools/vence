// __tests__/lib/laws/resumenBarrida.test.js
// "¿Este resultado significa algo?" — T-121 (26/07/2026).
//
// Nace de un fallo real durante la propia barrida bank-wide: el runner
// `scripts/scope/sim-title-boundary.ts` decía "✅ Sin overflow" en tres casos
// indistinguibles — banco sano, `position_type` con un typo (0 temas), e índices
// del BOE que no se pudieron bajar (el error se tragaba con `catch { continue }`).
// El tercero es el que envenena una barrida de 120 oposiciones: si el BOE limita
// el ritmo a mitad, el resto sale "limpio" y el informe es falso pero convincente.
//
// La regla que fijan estos tests: **silencio no es salud**. Un verde solo se
// puede afirmar si se evaluó algo Y no se perdió nada por el camino.

const { resumenBarrida } = require('@/lib/laws/scopeTitleBoundary')

describe('resumenBarrida — un verde solo cuenta si se evaluó de verdad', () => {
  it('0 temas (typo en el position_type) NO es "limpio"', () => {
    const r = resumenBarrida({ temas: 0, evaluados: 0, fetchFail: 0, flagged: 0 })
    expect(r.veredicto).toBe('sin_temas')
    expect(r.concluyente).toBe(false)
    expect(r.exitCode).not.toBe(0)
  })

  it('temas pero 0 scopes evaluados tampoco es "limpio"', () => {
    // p.ej. todas las leyes sin id del BOE, o sin artículos escopados.
    const r = resumenBarrida({ temas: 40, evaluados: 0, fetchFail: 0, flagged: 0 })
    expect(r.veredicto).toBe('nada_evaluado')
    expect(r.concluyente).toBe(false)
  })

  it('sin hallazgos PERO con índices del BOE sin bajar → INCONCLUYENTE, no limpio', () => {
    // El caso que envenenaría la barrida bank-wide entera.
    const r = resumenBarrida({ temas: 40, evaluados: 51, fetchFail: 7, flagged: 0 })
    expect(r.veredicto).toBe('incompleto')
    expect(r.concluyente).toBe(false)
    expect(r.exitCode).not.toBe(0)
  })

  it('con hallazgos y cobertura incompleta SÍ es concluyente: lo hallado es real', () => {
    // Un hueco de cobertura no invalida un positivo; solo impide afirmar "limpio".
    const r = resumenBarrida({ temas: 40, evaluados: 51, fetchFail: 7, flagged: 3 })
    expect(r.veredicto).toBe('con_hallazgos')
    expect(r.concluyente).toBe(true)
    expect(r.exitCode).toBe(0)
  })

  it('evaluado, sin huecos y sin hallazgos → limpio de verdad', () => {
    const r = resumenBarrida({ temas: 40, evaluados: 51, fetchFail: 0, flagged: 0 })
    expect(r.veredicto).toBe('limpio')
    expect(r.concluyente).toBe(true)
    expect(r.exitCode).toBe(0)
  })

  it('evaluado, sin huecos y con hallazgos → accionable', () => {
    const r = resumenBarrida({ temas: 40, evaluados: 51, fetchFail: 0, flagged: 2 })
    expect(r.veredicto).toBe('con_hallazgos')
    expect(r.concluyente).toBe(true)
  })

  it('sin argumentos no revienta y NO afirma salud', () => {
    const r = resumenBarrida()
    expect(r.concluyente).toBe(false)
  })

  it('los únicos veredictos concluyentes son limpio y con_hallazgos', () => {
    const casos = [
      { temas: 0, evaluados: 0, fetchFail: 0, flagged: 0 },
      { temas: 9, evaluados: 0, fetchFail: 0, flagged: 0 },
      { temas: 9, evaluados: 9, fetchFail: 1, flagged: 0 },
      { temas: 9, evaluados: 9, fetchFail: 0, flagged: 0 },
      { temas: 9, evaluados: 9, fetchFail: 0, flagged: 1 },
    ]
    for (const c of casos) {
      const r = resumenBarrida(c)
      expect(r.concluyente).toBe(['limpio', 'con_hallazgos'].includes(r.veredicto))
    }
  })
})
