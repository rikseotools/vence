// __tests__/api/filtered-questions/lawOnlyModeScoping.test.ts
// Tests del helper filterSelectedLawsByScope (intersección scope × selectedLaws).
//
// Nota (post-16/04/2026, caso M daluamva): en `isLawOnlyMode` este helper
// ya NO se aplica para bloquear — el usuario ha entrado a /leyes/[slug]
// explícitamente, debe poder estudiar cualquier ley aunque no esté en su
// scope. El filtro de preguntas OFICIALES (buildOfficialExamFilter — caso
// Laura) sigue aplicándose por separado, por lo que no se cuelan oficiales
// de otras oposiciones.
//
// El helper sigue activo y testeado aquí porque otros módulos lo pueden
// usar (ej: cálculos de cobertura, auditorías). Los tests validan su
// comportamiento como función pura.

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
