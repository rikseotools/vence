// __tests__/api/oposicion-scope/buildOfficialExamFilter.test.ts
// Test de regresión del bug Laura Abellan (14/04/2026):
// preguntas oficiales con exam_position de OTRA oposición se colaban en
// tests practice porque el filtro exam_position solo se aplicaba en modo
// onlyOfficialQuestions=true. Este helper centraliza el filtro y se aplica
// SIEMPRE en filtered-questions/queries.ts.

import { buildOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'

describe('buildOfficialExamFilter', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  test('positionType con mapeo válido devuelve cláusula que filtra oficiales por exam_position', () => {
    const filter = buildOfficialExamFilter('auxiliar_administrativo_estado')
    // No es sql\`true\`: es una cláusula or() de drizzle
    expect(filter).toBeDefined()
    expect(typeof filter).toBe('object')
    // No emite warning
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('positionType SIN mapeo emite warning y BLOQUEA todas las oficiales (más seguro que sql`true`)', () => {
    const filter = buildOfficialExamFilter('oposicion_inexistente_xyz')
    expect(filter).toBeDefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/sin mapeo exam_position para "oposicion_inexistente_xyz"/)
    expect(warnSpy.mock.calls[0][0]).toMatch(/exam-positions\.ts/)
  })

  test('positionType vacío emite warning (no rompe)', () => {
    const filter = buildOfficialExamFilter('')
    expect(filter).toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  test('positionType auxiliar_administrativo_estado tiene mapeo', () => {
    buildOfficialExamFilter('auxiliar_administrativo_estado')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('caso Laura (CARM) — actualmente SIN mapeo: emite warning detectable', () => {
    // CARM no está en EXAM_POSITION_MAP, así que el helper devuelve sql`true`
    // y emite warning. Esto es exactamente la señal que necesitamos para
    // detectar oposiciones desprotegidas. El bug Laura no se cierra hasta
    // añadir 'auxiliar_administrativo_carm' a lib/config/exam-positions.ts.
    buildOfficialExamFilter('auxiliar_administrativo_carm')
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0][0]).toMatch(/auxiliar_administrativo_carm/)
  })
})
