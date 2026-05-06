// __tests__/lib/cache/lawStats.test.ts
// Tests del helper invalidateLawStatsCache (Phase 4c).

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

import { revalidateTag } from 'next/cache'
import { invalidateLawStatsCache } from '@/lib/cache/law-stats'

const mockRevalidate = revalidateTag as jest.Mock

describe('invalidateLawStatsCache', () => {
  beforeEach(() => {
    mockRevalidate.mockReset()
  })

  test('llama a revalidateTag con "law-stats" y mode "max"', () => {
    invalidateLawStatsCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('law-stats', 'max')
  })

  test('no propaga excepciones de revalidateTag', () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error('outside Next runtime')
    })
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => invalidateLawStatsCache()).not.toThrow()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[invalidateLawStatsCache]'),
      expect.any(Error),
    )

    consoleWarn.mockRestore()
  })
})
