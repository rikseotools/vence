// __tests__/lib/cache/verifyStats.test.ts
// Tests del helper invalidateVerifyStatsCache (Phase 4d).

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

import { revalidateTag } from 'next/cache'
import { invalidateVerifyStatsCache } from '@/lib/cache/verify-stats'

const mockRevalidate = revalidateTag as jest.Mock

describe('invalidateVerifyStatsCache', () => {
  beforeEach(() => {
    mockRevalidate.mockReset()
  })

  test('llama a revalidateTag con "verify-stats" y mode "max"', () => {
    invalidateVerifyStatsCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('verify-stats', 'max')
  })

  test('no propaga excepciones de revalidateTag', () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error('outside Next runtime')
    })
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => invalidateVerifyStatsCache()).not.toThrow()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[invalidateVerifyStatsCache]'),
      expect.any(Error),
    )

    consoleWarn.mockRestore()
  })
})
