import {
  questionsWithinSelection,
  recoveredFromBlip,
  retriesAreBounded,
  mixedInclusionIsWarned,
  requestIsScopedTo,
  failureWasObserved,
  type Selection,
} from '@/lib/sim/invariants'

const SEL: Selection = {
  laws: ['Ley 39/2015', 'Ley 40/2015'],
  articlesByLaw: { 'Ley 40/2015': ['32', '33', '34', '35', '36'] },
}

describe('questionsWithinSelection', () => {
  it('OK: todas dentro (40/2015 en 32-36, 39/2015 entera)', () => {
    const r = questionsWithinSelection(
      [{ law: 'Ley 40/2015', article: '33' }, { law: 'Ley 39/2015', article: '13' }],
      SEL,
    )
    expect(r.ok).toBe(true)
  })
  it('FALLA: 40/2015 en un artículo FUERA de 32-36 (bug Alfonso)', () => {
    const r = questionsWithinSelection([{ law: 'Ley 40/2015', article: '55' }], SEL)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/55.*fuera/)
  })
  it('FALLA: pregunta de una ley NO seleccionada', () => {
    const r = questionsWithinSelection([{ law: 'CE', article: '1' }], SEL)
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/no seleccionada/)
  })
  it('ley entera (sin artículos): cualquier artículo suyo vale', () => {
    const r = questionsWithinSelection([{ law: 'Ley 39/2015', article: '99' }], SEL)
    expect(r.ok).toBe(true)
  })
  it('sin preguntas → trivialmente ok', () => {
    expect(questionsWithinSelection([], SEL).ok).toBe(true)
  })
})

describe('recoveredFromBlip', () => {
  it('OK: reintentó y renderizó sin error', () => {
    expect(recoveredFromBlip({ attempts: 2, errorShown: false, contentRendered: true }).ok).toBe(true)
  })
  it('FALLA: no reintentó', () => {
    expect(recoveredFromBlip({ attempts: 1, errorShown: false, contentRendered: true }).ok).toBe(false)
  })
  it('FALLA: mostró error pese al reintento', () => {
    expect(recoveredFromBlip({ attempts: 3, errorShown: true, contentRendered: false }).ok).toBe(false)
  })
})

describe('retriesAreBounded', () => {
  it('OK: 3 intentos exactos + error controlado', () => {
    expect(retriesAreBounded({ attempts: 3, expected: 3, errorShownOnSustained: true }).ok).toBe(true)
  })
  it('FALLA: número de intentos inesperado', () => {
    expect(retriesAreBounded({ attempts: 7, expected: 3, errorShownOnSustained: true }).ok).toBe(false)
  })
  it('FALLA: caída sostenida sin error (posible cuelgue)', () => {
    expect(retriesAreBounded({ attempts: 3, expected: 3, errorShownOnSustained: false }).ok).toBe(false)
  })
})

describe('mixedInclusionIsWarned', () => {
  it('OK: mixto y avisado', () => {
    expect(mixedInclusionIsWarned({ hasNarrowed: true, hasWhole: true, warningShown: true }).ok).toBe(true)
  })
  it('FALLA: mixto SIN aviso (bug de visibilidad)', () => {
    expect(mixedInclusionIsWarned({ hasNarrowed: true, hasWhole: true, warningShown: false }).ok).toBe(false)
  })
  it('FALLA: aviso sin estado mixto (falso positivo)', () => {
    expect(mixedInclusionIsWarned({ hasNarrowed: false, hasWhole: true, warningShown: true }).ok).toBe(false)
  })
  it('OK: no mixto y sin aviso', () => {
    expect(mixedInclusionIsWarned({ hasNarrowed: false, hasWhole: true, warningShown: false }).ok).toBe(true)
  })
})

describe('requestIsScopedTo', () => {
  it('OK: url scoped a la oposición', () => {
    expect(requestIsScopedTo('/api/laws-configurator?positionType=celador_murcia', 'celador_murcia').ok).toBe(true)
  })
  it('FALLA: url anónima (sin positionType)', () => {
    expect(requestIsScopedTo('/api/laws-configurator', 'celador_murcia').ok).toBe(false)
  })
  it('FALLA: ninguna llamada', () => {
    expect(requestIsScopedTo(null, 'celador_murcia').ok).toBe(false)
  })
})

describe('failureWasObserved (meta-bug / punto ciego)', () => {
  it('FALLA: fallo visible con CERO eventos (caso Alfonso #1)', () => {
    const r = failureWasObserved({ userVisibleFailure: true, observedEventCount: 0 })
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/punto ciego/)
  })
  it('OK: fallo visible pero observado', () => {
    expect(failureWasObserved({ userVisibleFailure: true, observedEventCount: 3 }).ok).toBe(true)
  })
  it('OK: sin fallo', () => {
    expect(failureWasObserved({ userVisibleFailure: false, observedEventCount: 0 }).ok).toBe(true)
  })
})
