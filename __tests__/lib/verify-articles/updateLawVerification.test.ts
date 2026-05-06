// __tests__/lib/verify-articles/updateLawVerification.test.ts
// Garantiza que updateLawVerification (Phase 4d) invalida verify-stats
// cache tras el UPDATE. Cualquier caller, runtime o futuro, hereda el
// hook automáticamente.

jest.mock('@/lib/cache/verify-stats', () => ({
  invalidateVerifyStatsCache: jest.fn(),
}))

// updateQuestion también está en este archivo y depende de invalidateQuestionsCache
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
  laws: { id: 'id', shortName: 'short_name', lastChecked: 'last_checked', verificationStatus: 'verification_status', lastVerificationSummary: 'last_verification_summary' },
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

jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => fn),
}))

import { updateLawVerification } from '@/lib/api/verify-articles/queries'
import { invalidateVerifyStatsCache } from '@/lib/cache/verify-stats'

const mockInvalidate = invalidateVerifyStatsCache as jest.Mock

describe('updateLawVerification (hook de invalidación verify-stats)', () => {
  beforeEach(() => {
    mockInvalidate.mockReset()
    mockWhere.mockClear()
    mockSet.mockClear()
    mockUpdate.mockClear()
  })

  test('invalida cache verify-stats tras UPDATE', async () => {
    await updateLawVerification('law-1', { boe_count: 10, db_count: 10, is_ok: true })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('invalida con cualquier summary, incluido vacío', async () => {
    await updateLawVerification('law-2', {})

    expect(mockInvalidate).toHaveBeenCalledTimes(1)
  })

  test('llamadas múltiples disparan invalidación múltiple (cada UPDATE invalida)', async () => {
    await updateLawVerification('law-1', { is_ok: true })
    await updateLawVerification('law-2', { is_ok: false })
    await updateLawVerification('law-3', { is_ok: true })

    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockInvalidate).toHaveBeenCalledTimes(3)
  })
})
