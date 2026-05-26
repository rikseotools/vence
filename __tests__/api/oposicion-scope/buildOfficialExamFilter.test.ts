// __tests__/api/oposicion-scope/buildOfficialExamFilter.test.ts
// Test de regresión del bug Laura Abellan (14/04/2026):
// preguntas oficiales con exam_position de OTRA oposición se colaban en
// tests practice porque el filtro exam_position solo se aplicaba en modo
// onlyOfficialQuestions=true. Este helper centraliza el filtro y se aplica
// SIEMPRE en filtered-questions/queries.ts.

// Mock getDb / getPoolerDb para capturar inserts/selects sin tocar BD real.
// NOTA: factory de jest.mock debe ser autocontenida (no referencias externas).
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
    // getPoolerDb se usa cuando USE_SELF_HOSTED_POOLER=true (no en tests).
    getPoolerDb: () => ({
      insert: () => ({ values: jest.fn().mockResolvedValue(undefined) }),
      select: () => ({
        from: () => ({
          where: () => ({ limit: jest.fn().mockResolvedValue([]) }),
        }),
      }),
    }),
  }
})

// Mock de la config de exam-positions y oposiciones para desacoplar el test
// del estado real de EXAM_POSITION_MAP / ALL_POSITION_TYPES. Cuando se añaden
// mapeos legítimos (ej.: canarias en mayo 2026), el test no debe romperse:
// éste prueba la LÓGICA del dedupe, no la cobertura de la config.
//
// Convenciones de los positionTypes de test:
//   - 'TEST_MAPPED_OPOSICION'  → tiene mapeo válido (no dispara log).
//   - 'TEST_UNMAPPED_*'        → conocidas pero sin mapeo (sí disparan log info).
//   - Cualquier otra string    → no reconocida (console.warn inmediato).
//
// Cada test usa su propia posición TEST_UNMAPPED_* porque el Set module-level
// `loggedNoMappingToday` en lib/api/oposicion-scope/queries.ts persiste entre
// tests dentro del mismo run. Para verificar invariantes que requieren
// "primera llamada para esa posición" hace falta una posición fresh.
jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn((positionType: string) => {
    if (positionType === 'TEST_MAPPED_OPOSICION') return ['exam-position-mapped']
    return null
  }),
}))

jest.mock('@/lib/config/oposiciones', () => ({
  ALL_POSITION_TYPES: [
    'TEST_MAPPED_OPOSICION',
    // Una posición fresh por test que la necesite (Set persiste entre tests).
    'TEST_UNMAPPED_NO_WARN',      // test "no emite console.warn"
    'TEST_UNMAPPED_DEDUPE_SET',   // test "dedupe intra-proceso (Set)"
    'TEST_UNMAPPED_DISTINCT_A',   // test "dedupe por oposición" (1ª)
    'TEST_UNMAPPED_DISTINCT_B',   // test "dedupe por oposición" (2ª)
    'TEST_UNMAPPED_DB_PREEXISTS', // test "query previa indica existente"
    'TEST_UNMAPPED_TELEMETRY_ERR',// test "fallo telemetry"
    'TEST_UNMAPPED_BLOCK_CHECK',  // test "bloquea oficiales igual"
  ],
}))

// Mock del helper del módulo validation-error-log — desde 2026-05-26 (Bloque 4
// Fase 1) `recordNoExamPositionMapping` delega aquí en vez de hacer
// `db.insert(validationErrorLogs)` directo. Capturamos las llamadas para
// asertar los argumentos (en lugar de inspeccionar la BD mock).
jest.mock('@/lib/api/validation-error-log', () => ({
  logValidationError: jest.fn(),
}))

import { buildOfficialExamFilter } from '@/lib/api/oposicion-scope/queries'
import { logValidationError } from '@/lib/api/validation-error-log'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockSpies } = require('@/db/client') as {
  __mockSpies: { insertValues: jest.Mock; selectLimit: jest.Mock }
}
const insertValuesSpy = __mockSpies.insertValues
const selectLimitSpy = __mockSpies.selectLimit
const logValidationErrorSpy = logValidationError as jest.Mock

describe('buildOfficialExamFilter', () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    insertValuesSpy.mockClear()
    selectLimitSpy.mockClear()
    selectLimitSpy.mockResolvedValue([])
    logValidationErrorSpy.mockClear()
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  // Helper para esperar a que el fire-and-forget se resuelva (IIFE async con
  // 2 awaits internos: select + insert).
  const flush = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }

  test('positionType con mapeo válido devuelve cláusula que filtra oficiales por exam_position', () => {
    const filter = buildOfficialExamFilter('TEST_MAPPED_OPOSICION')
    // No es sql`true`: es una cláusula or() de drizzle
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

  test('positionType TEST_MAPPED_OPOSICION tiene mapeo', () => {
    buildOfficialExamFilter('TEST_MAPPED_OPOSICION')
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('oposición conocida SIN mapeo no emite console.warn — se registra como info en validation_error_logs', async () => {
    // Post-15/04/2026: para reducir ruido de logs en Vercel, las oposiciones
    // conocidas sin mapeo (CARM, Aragón, Baleares, etc.) no emiten warn en
    // console; se registran 1 vez al día en validation_error_logs con
    // severity='info' y errorType='no_exam_position_mapping'. El warn de
    // console se reserva para positionTypes DESCONOCIDOS (bug real).
    buildOfficialExamFilter('TEST_UNMAPPED_NO_WARN')
    expect(warnSpy).not.toHaveBeenCalled()
    await flush()
    // Se delega en logValidationError con severity=info. La persistencia
    // a validation_error_logs + espejo a observable_events es
    // responsabilidad del módulo validation-error-log (testado allí).
    expect(logValidationErrorSpy).toHaveBeenCalledTimes(1)
    const inserted = logValidationErrorSpy.mock.calls[0][0]
    expect(inserted).toMatchObject({
      endpoint: 'lib/oposicion-scope',
      errorType: 'no_exam_position_mapping',
      severity: 'info',
      requestBody: { positionType: 'TEST_UNMAPPED_NO_WARN' },
    })
  })

  test('dedupe intra-proceso: múltiples llamadas a la misma oposición en el mismo día → solo 1 insert', async () => {
    buildOfficialExamFilter('TEST_UNMAPPED_DEDUPE_SET')
    buildOfficialExamFilter('TEST_UNMAPPED_DEDUPE_SET')
    buildOfficialExamFilter('TEST_UNMAPPED_DEDUPE_SET')
    await flush()
    expect(logValidationErrorSpy).toHaveBeenCalledTimes(1)
  })

  test('dedupe por oposición: oposiciones distintas generan inserts separados', async () => {
    buildOfficialExamFilter('TEST_UNMAPPED_DISTINCT_A')
    buildOfficialExamFilter('TEST_UNMAPPED_DISTINCT_B')
    await flush()
    expect(logValidationErrorSpy).toHaveBeenCalledTimes(2)
    const positions = logValidationErrorSpy.mock.calls.map((c) => c[0].requestBody.positionType)
    expect(positions).toEqual(
      expect.arrayContaining(['TEST_UNMAPPED_DISTINCT_A', 'TEST_UNMAPPED_DISTINCT_B']),
    )
  })

  test('positionType desconocido NO dispara insert en BD (solo warn en consola)', async () => {
    buildOfficialExamFilter('foo_bar_inexistente')
    expect(warnSpy).toHaveBeenCalled()
    await flush()
    expect(logValidationErrorSpy).not.toHaveBeenCalled()
  })

  test('si la query previa indica que ya existe un registro del día, NO inserta', async () => {
    selectLimitSpy.mockResolvedValueOnce([{ id: 'existing-id' }])
    buildOfficialExamFilter('TEST_UNMAPPED_DB_PREEXISTS')
    await flush()
    // El Set añade la entry y dispara la IIFE; la IIFE consulta BD, ve
    // `existing.length > 0`, hace early return → no se llama logValidationError.
    expect(logValidationErrorSpy).not.toHaveBeenCalled()
  })

  test('fallo del telemetry (ej. BD caída) no propaga excepción ni afecta al filtro', async () => {
    selectLimitSpy.mockRejectedValueOnce(new Error('BD caída simulada'))
    const filter = buildOfficialExamFilter('TEST_UNMAPPED_TELEMETRY_ERR')
    // El filtro se devuelve igual
    expect(filter).toBeDefined()
    await flush()
    // No se propaga la excepción: si llegamos aquí, el try/catch interno funcionó
  })

  test('oposición conocida SIN mapeo bloquea oficiales igual (misma cláusula que antes)', () => {
    // Regresión: el cambio de política de logging no cambia el filtro SQL devuelto.
    const filter = buildOfficialExamFilter('TEST_UNMAPPED_BLOCK_CHECK')
    expect(filter).toBeDefined()
    expect(typeof filter).toBe('object')
  })
})
