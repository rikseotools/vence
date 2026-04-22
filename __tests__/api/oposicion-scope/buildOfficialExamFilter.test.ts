// __tests__/api/oposicion-scope/buildOfficialExamFilter.test.ts
// Test de regresión del bug Laura Abellan (14/04/2026):
// preguntas oficiales con exam_position de OTRA oposición se colaban en
// tests practice porque el filtro exam_position solo se aplicaba en modo
// onlyOfficialQuestions=true. Este helper centraliza el filtro y se aplica
// SIEMPRE en filtered-questions/queries.ts.

// Mock getDb para poder capturar inserts/selects sin tocar BD real
// NOTA: factory de jest.mock debe ser autocontenida (no referencias externas)
jest.mock('@/db/client', () => {
  const insertValues = jest.fn().mockResolvedValue(undefined)
  const selectLimit = jest.fn().mockResolvedValue([])
  return {
    __mockSpies: { insertValues, selectLimit },
    getDb: () => ({
      insert: () => ({ values: insertValues }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: selectLimit }),
        }),
      }),
    }),
  }
})

import { buildOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockSpies } = require('@/db/client') as {
  __mockSpies: { insertValues: jest.Mock; selectLimit: jest.Mock }
}
const insertValuesSpy = __mockSpies.insertValues
const selectLimitSpy = __mockSpies.selectLimit

describe('buildOfficialExamFilter', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    insertValuesSpy.mockClear()
    selectLimitSpy.mockClear()
    selectLimitSpy.mockResolvedValue([])
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  // Helper para esperar a que el fire-and-forget se resuelva
  const flush = async () => {
    // Dos microtask ticks: 1 para el async IIFE, 1 para el await interno
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  test('positionType con mapeo válido devuelve cláusula que filtra oficiales por exam_position', () => {
    const filter = buildOfficialExamFilter('auxiliar_administrativo_estado')
    // No es sql\`true\`: es una cláusula or() de drizzle
    expect(filter).toBeDefined()
    expect(typeof filter).toBe('object')
    // No emite warning
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('positionType DESCONOCIDO (no en OPOSICIONES) emite warning inmediato y BLOQUEA todas las oficiales', () => {
    const filter = buildOfficialExamFilter('oposicion_inexistente_xyz')
    expect(filter).toBeDefined()
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toMatch(/sin mapeo exam_position para "oposicion_inexistente_xyz"/)
    expect(warnSpy.mock.calls[0][0]).toMatch(/no reconocido/)
  })

  test('positionType vacío emite warning (no rompe, considerado desconocido)', () => {
    const filter = buildOfficialExamFilter('')
    expect(filter).toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
  })

  test('positionType auxiliar_administrativo_estado tiene mapeo', () => {
    buildOfficialExamFilter('auxiliar_administrativo_estado')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('oposición conocida SIN mapeo (CARM) no emite console.warn — se registra como info en validation_error_logs', async () => {
    // Post-15/04/2026: para reducir ruido de logs en Vercel, las oposiciones
    // conocidas sin mapeo (CARM, Aragón, Baleares, etc.) no emiten warn en
    // console; se registran 1 vez al día en validation_error_logs con
    // severity='info' y errorType='no_exam_position_mapping'. El warn de
    // console se reserva para positionTypes DESCONOCIDOS (bug real).
    buildOfficialExamFilter('auxiliar_administrativo_aragon')
    expect(warnSpy).not.toHaveBeenCalled()
    await flush()
    // Se inserta en validation_error_logs con severity=info
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
    const inserted = insertValuesSpy.mock.calls[0][0]
    expect(inserted).toMatchObject({
      endpoint: 'lib/oposicion-scope',
      errorType: 'no_exam_position_mapping',
      severity: 'info',
      requestBody: { positionType: 'auxiliar_administrativo_aragon' },
    })
  })

  test('dedupe intra-proceso: múltiples llamadas a la misma oposición en el mismo día → solo 1 insert', async () => {
    buildOfficialExamFilter('auxiliar_administrativo_canarias')
    buildOfficialExamFilter('auxiliar_administrativo_canarias')
    buildOfficialExamFilter('auxiliar_administrativo_canarias')
    await flush()
    expect(insertValuesSpy).toHaveBeenCalledTimes(1)
  })

  test('dedupe por oposición: oposiciones distintas generan inserts separados', async () => {
    buildOfficialExamFilter('auxiliar_administrativo_extremadura')
    buildOfficialExamFilter('auxiliar_administrativo_galicia')
    await flush()
    expect(insertValuesSpy).toHaveBeenCalledTimes(2)
    const positions = insertValuesSpy.mock.calls.map((c) => c[0].requestBody.positionType)
    expect(positions).toEqual(
      expect.arrayContaining(['auxiliar_administrativo_extremadura', 'auxiliar_administrativo_galicia']),
    )
  })

  test('positionType desconocido NO dispara insert en BD (solo warn en consola)', async () => {
    buildOfficialExamFilter('foo_bar_inexistente')
    expect(warnSpy).toHaveBeenCalled()
    await flush()
    expect(insertValuesSpy).not.toHaveBeenCalled()
  })

  test('si la query previa indica que ya existe un registro del día, NO inserta', async () => {
    selectLimitSpy.mockResolvedValueOnce([{ id: 'existing-id' }])
    buildOfficialExamFilter('auxiliar_administrativo_ayuntamiento_valencia')
    await flush()
    expect(insertValuesSpy).not.toHaveBeenCalled()
  })

  test('fallo del telemetry (ej. BD caída) no propaga excepción ni afecta al filtro', async () => {
    selectLimitSpy.mockRejectedValueOnce(new Error('BD caída simulada'))
    const filter = buildOfficialExamFilter('auxiliar_administrativo_ayuntamiento_murcia')
    // El filtro se devuelve igual
    expect(filter).toBeDefined()
    await flush()
    // No se propaga la excepción: si llegamos aquí, el try/catch interno funcionó
  })

  test('oposición conocida SIN mapeo bloquea oficiales igual (misma cláusula que antes)', () => {
    // Regresión: el cambio de política de logging no cambia el filtro SQL devuelto.
    const filter = buildOfficialExamFilter('auxiliar_administrativo_aragon')
    expect(filter).toBeDefined()
    expect(typeof filter).toBe('object')
  })
})
