// __tests__/api/filtered-questions/lawOnlyModeScoping.test.ts
// Tests de regresión — FASE 2 del refactor oposicion-scope.
//
// Demuestra el bug antes de arreglarlo: hoy `isLawOnlyMode` NO valida
// que `selectedLaws` pertenezcan al scope del positionType del usuario.
// Un Aux Estado puede pedir preguntas de "Reglamento Cortes CyL" y recibirlas.
//
// Estos tests fallan hoy porque `filterSelectedLawsByScope` aún no existe —
// se añadirá en FASE 3 junto con su uso real dentro de isLawOnlyMode.
// Ver project_oposicion_scope_refactor.md.

import { filterSelectedLawsByScope } from '@/lib/api/oposicion-scope/queries'

describe('filterSelectedLawsByScope — intersección scope × selectedLaws', () => {
  test('Aux Estado + selectedLaws=[Reglamento Cortes CyL] → empty (bug Mar Vazquez)', () => {
    const result = filterSelectedLawsByScope({
      selectedLaws: ['Reglamento Cortes CyL'],
      allowedLawShortNames: ['CE', 'Ley 40/2015', 'Ley 39/2015', 'TREBEP'],
    })

    expect(result.empty).toBe(true)
    expect(result.allowedLaws).toEqual([])
    expect(result.emptyReason).toMatch(/oposici/i)
  })

  test('Aux CyL + selectedLaws=[Reglamento Cortes CyL] → permite la ley', () => {
    const result = filterSelectedLawsByScope({
      selectedLaws: ['Reglamento Cortes CyL'],
      allowedLawShortNames: ['CE', 'Reglamento Cortes CyL', 'Ley 7/2005 CyL'],
    })

    expect(result.empty).toBe(false)
    expect(result.allowedLaws).toEqual(['Reglamento Cortes CyL'])
  })

  test('selectedLaws mezcladas → devuelve solo las que están en el scope', () => {
    const result = filterSelectedLawsByScope({
      selectedLaws: ['CE', 'Reglamento Cortes CyL', 'Ley 40/2015'],
      allowedLawShortNames: ['CE', 'Ley 40/2015', 'TREBEP'],
    })

    expect(result.empty).toBe(false)
    expect(result.allowedLaws.sort()).toEqual(['CE', 'Ley 40/2015'])
  })

  test('allowedLawShortNames vacío → empty con emptyReason', () => {
    const result = filterSelectedLawsByScope({
      selectedLaws: ['CE'],
      allowedLawShortNames: [],
    })

    expect(result.empty).toBe(true)
    expect(result.emptyReason).toBeTruthy()
  })
})
