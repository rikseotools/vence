// __tests__/lib/api/v2/tests/testsSchemaPositionType.test.ts
//
// Guarda la CAUSA RAÍZ del incidente 05/07/2026: la columna tests.position_type
// EXISTÍA en la BD pero NO estaba mapeada en el schema Drizzle (`tests`), así que
// `db.insert(tests).values({ positionType })` la descartaba silenciosamente y el
// typecheck ni se enteraba. resolveTestPositionType podía devolver el valor
// correcto y aun así persistir NULL (comprobado en la investigación).
//
// Este test NO necesita BD: inspecciona el objeto de tabla Drizzle. Corre en el
// job `unit` (siempre), a diferencia del test de integración (BD escribible).
// Si alguien vuelve a quitar el mapeo, este test se pone rojo antes de desplegar.

import { tests } from '@/db/schema'

describe('schema Drizzle tests — mapeo de position_type (anti-regresión b4ef6fc9)', () => {
  test('la tabla `tests` mapea la columna position_type', () => {
    expect(tests.positionType).toBeDefined()
    expect(tests.positionType.name).toBe('position_type')
  })

  test('la columna es escribible en un insert (no es generated/hidden)', () => {
    // Si fuera GENERATED (como is_active) Drizzle no dejaría escribirla; aquí debe
    // ser una columna normal para que el INSERT de createTestSession la persista.
    const col = tests.positionType as unknown as { generated?: unknown; generatedIdentity?: unknown }
    expect(col.generated ?? null).toBeNull()
    expect(col.generatedIdentity ?? null).toBeNull()
  })
})
