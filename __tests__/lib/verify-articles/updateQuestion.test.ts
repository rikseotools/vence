// __tests__/lib/verify-articles/updateQuestion.test.ts
// Garantiza el contrato de invalidación de cache de updateQuestion.
//
// Hook crítico: si esta función edita correct_option o explanation, DEBE
// llamar a invalidateQuestionsCache(). Si no, el cache de answer-and-save
// (TTL 1h) sigue sirviendo la versión vieja → respuesta correcta marcada
// incorrecta para los users que respondan en la siguiente hora.
//
// Tests:
//   1. correctOption modificado → invalida
//   2. explanation modificada → invalida
//   3. ambos a la vez → invalida 1 sola vez
//   4. metadata-only (verifiedAt, verificationStatus, updatedAt) → NO invalida
//      (nada cacheado cambió)

// ============================================
// MOCKS — Jest hoistea jest.mock por encima de los imports, así que la
// factory NO puede referenciar variables externas del archivo.
// Usamos auto-mock con factory inline que define un jest.fn() y lo expone
// para inspección desde los tests vía require('@/lib/cache/questions').
// ============================================

jest.mock('@/lib/cache/questions', () => ({
  invalidateQuestionsCache: jest.fn(),
}))

const mockWhere = jest.fn().mockResolvedValue([])
const mockSet = jest.fn(() => ({ where: mockWhere }))
const mockUpdate = jest.fn(() => ({ set: mockSet }))

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ update: mockUpdate })),
}))

jest.mock('@/db/schema', () => ({
  articles: { id: 'id', lawId: 'law_id' },
  laws: { id: 'id' },
  questions: { id: 'id' },
  aiVerificationResults: { id: 'id' },
  aiVerificationErrors: { id: 'id' },
  aiApiUsage: { id: 'id' },
  aiApiConfig: { id: 'id' },
  articleUpdateLogs: { id: 'id' },
  verificationQueue: { id: 'id' },
  topicScope: { id: 'id' },
  topics: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  desc: jest.fn((...args: unknown[]) => ({ type: 'desc', args })),
  sql: Object.assign(jest.fn((...args: unknown[]) => ({ type: 'sql', args })), {
    as: jest.fn(),
  }),
}))

// ============================================
// IMPORTS (después de los mocks)
// ============================================

import { updateQuestion } from '@/lib/api/verify-articles/queries'
import { invalidateQuestionsCache } from '@/lib/cache/questions'

const mockInvalidate = invalidateQuestionsCache as jest.Mock

// ============================================
// TESTS
// ============================================

describe('updateQuestion (hook de invalidación de cache)', () => {
  beforeEach(() => {
    mockInvalidate.mockReset()
    mockWhere.mockClear()
    mockSet.mockClear()
    mockUpdate.mockClear()
  })

  test('invalida cache cuando se modifica correctOption', async () => {
    await updateQuestion('q-1', { correctOption: 2 })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('invalida cache cuando se modifica explanation', async () => {
    await updateQuestion('q-2', { explanation: 'nueva explicación' })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('invalida cache una sola vez cuando se cambian correctOption y explanation a la vez', async () => {
    await updateQuestion('q-3', {
      correctOption: 1,
      explanation: 'algo',
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('NO invalida cache si solo cambia metadata (verifiedAt / verificationStatus / updatedAt)', async () => {
    await updateQuestion('q-4', {
      verifiedAt: '2026-05-06T00:00:00Z',
      verificationStatus: 'verified',
      updatedAt: '2026-05-06T00:00:00Z',
    })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('NO invalida cache con data vacía', async () => {
    await updateQuestion('q-5', {})

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).not.toHaveBeenCalled()
  })

  test('correctOption=0 sí invalida (caso borde — 0 es válido en correct_option)', async () => {
    // correct_option es 0-indexed (0=A, 1=B, 2=C, 3=D). El check es
    // !== undefined, no truthy — debe invalidar también con 0.
    await updateQuestion('q-6', { correctOption: 0 })

    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('explanation="" (string vacío) sí invalida — !== undefined', async () => {
    await updateQuestion('q-7', { explanation: '' })

    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })
})
