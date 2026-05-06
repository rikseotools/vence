// __tests__/lib/api/v2/answer-and-save/markActiveStudentIfFirst.test.ts
// Garantiza que la función markActiveStudentIfFirst, ejecutada en after()
// background, usa el pool dedicado getTraceDb() y NO el pool del hot path
// getDb() (max:1 compartido).
//
// Razón crítica: este callback hace SELECT + UPDATE conditional en
// userProfiles. Si usara getDb(), bloquearía la única conexión que la
// siguiente request entrante a la misma lambda necesita — head-of-line
// blocking auto-inducido. Documentado en docs/ARCHITECTURE_ROADMAP.md
// (TRAMPA HISTÓRICA del pool max:1, incidente 27/04).
//
// Tests:
//   1. usa getTraceDb (no getDb)
//   2. SELECT siempre se hace
//   3. UPDATE solo si isActiveStudent es false (idempotente)
//   4. UPDATE NO se hace si ya es active
//   5. invalidateProfileCache se llama tras UPDATE OK
//   6. errores de DB se tragan (no bubble) — el cron del usuario no falla

// ============================================
// MOCKS — Jest hoistea jest.mock por encima de los imports, así que la
// factory no puede referenciar variables externas. Definimos los jest.fn()
// inline y los recuperamos después con jest.requireMock.
// ============================================

jest.mock('@/db/client', () => ({
  getDb: jest.fn(),
  getTraceDb: jest.fn(),
}))

jest.mock('@/lib/api/profile', () => ({
  invalidateProfileCache: jest.fn(),
}))

jest.mock('@/db/schema', () => ({
  userProfiles: { id: 'id', isActiveStudent: 'is_active_student', firstTestCompletedAt: 'first_test_completed_at' },
  tests: { id: 'id' },
  questions: { id: 'id' },
  articles: { id: 'id' },
  laws: { id: 'id' },
  psychometricQuestions: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
}))

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => fn),
}))

jest.mock('@/lib/api/test-answers', () => ({ insertTestAnswer: jest.fn() }))
jest.mock('@/lib/api/tema-resolver/queries', () => ({ resolveTemaByQuestionIdFast: jest.fn() }))
jest.mock('@/lib/config/oposiciones', () => ({ ALL_OPOSICION_IDS: ['auxiliar_administrativo_estado'] }))

// ============================================
// IMPORTS (después de mocks)
// ============================================

import { markActiveStudentIfFirst } from '@/lib/api/v2/answer-and-save/queries'
import { invalidateProfileCache } from '@/lib/api/profile'
import { getDb, getTraceDb } from '@/db/client'

const mockInvalidate = invalidateProfileCache as jest.Mock
const mockGetDb = getDb as jest.Mock
const mockGetTraceDb = getTraceDb as jest.Mock

// ============================================
// HELPER: construye un mock de Drizzle DB con SELECT+UPDATE encadenados
// ============================================

function buildDbMock(currentIsActive: boolean | null) {
  const selectResult = currentIsActive === null
    ? []
    : [{ isActiveStudent: currentIsActive }]

  const updateWhere = jest.fn().mockResolvedValue([])
  const updateSet = jest.fn(() => ({ where: updateWhere }))
  const update = jest.fn(() => ({ set: updateSet }))

  const selectLimit = jest.fn().mockResolvedValue(selectResult)
  const selectWhere = jest.fn(() => ({ limit: selectLimit }))
  const selectFrom = jest.fn(() => ({ where: selectWhere }))
  const select = jest.fn(() => ({ from: selectFrom }))

  return {
    db: { select, update },
    update,
    updateSet,
    updateWhere,
    select,
  }
}

// ============================================
// TESTS
// ============================================

describe('markActiveStudentIfFirst (Fase 0.3 — pool separado para after())', () => {
  beforeEach(() => {
    mockGetDb.mockReset()
    mockGetTraceDb.mockReset()
    mockInvalidate.mockReset()
  })

  test('usa getTraceDb (pool dedicado), NO getDb (pool del hot path)', async () => {
    const { db } = buildDbMock(false)
    mockGetTraceDb.mockReturnValue(db)

    await markActiveStudentIfFirst('user-123')

    expect(mockGetTraceDb).toHaveBeenCalledTimes(1)
    expect(mockGetDb).not.toHaveBeenCalled()
  })

  test('UPDATE + invalidate cuando user no es active student', async () => {
    const { db, update } = buildDbMock(false)
    mockGetTraceDb.mockReturnValue(db)

    await markActiveStudentIfFirst('user-123')

    expect(update).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('NO UPDATE ni invalidate cuando user ya es active student (idempotente)', async () => {
    const { db, update } = buildDbMock(true)
    mockGetTraceDb.mockReturnValue(db)

    await markActiveStudentIfFirst('user-123')

    expect(update).not.toHaveBeenCalled()
    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('NO UPDATE cuando user no existe (SELECT vacío)', async () => {
    const { db, update } = buildDbMock(null)
    mockGetTraceDb.mockReturnValue(db)

    await markActiveStudentIfFirst('user-noexiste')

    expect(update).not.toHaveBeenCalled()
    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('errores de DB no se propagan (after() no debe romper la siguiente request)', async () => {
    mockGetTraceDb.mockImplementation(() => {
      throw new Error('pooler unreachable')
    })
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(markActiveStudentIfFirst('user-123')).resolves.toBeUndefined()
    expect(consoleWarn).toHaveBeenCalled()

    consoleWarn.mockRestore()
  })
})
