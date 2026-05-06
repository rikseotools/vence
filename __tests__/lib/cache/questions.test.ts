// __tests__/lib/cache/questions.test.ts
// Unit tests para lib/cache/questions.ts (invalidateQuestionsCache).
//
// Garantiza:
//   1. Llama a revalidateTag('questions', 'max') exactamente 1 vez.
//   2. Tragar errores: si revalidateTag lanza (p.ej. fuera de Next runtime),
//      no propaga la excepción al caller — solo loggea.
//   3. Es idempotente bajo llamadas repetidas (no estado interno).

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

import { revalidateTag } from 'next/cache'
import { invalidateQuestionsCache } from '@/lib/cache/questions'

const mockRevalidate = revalidateTag as jest.Mock

describe('invalidateQuestionsCache', () => {
  beforeEach(() => {
    mockRevalidate.mockReset()
  })

  test('llama a revalidateTag con "questions" y mode "max"', () => {
    invalidateQuestionsCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('questions', 'max')
  })

  test('no propaga excepciones de revalidateTag', () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error('outside Next runtime')
    })
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => invalidateQuestionsCache()).not.toThrow()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[invalidateQuestionsCache]'),
      expect.any(Error),
    )

    consoleWarn.mockRestore()
  })

  test('es idempotente — varias llamadas seguidas no rompen estado', () => {
    invalidateQuestionsCache()
    invalidateQuestionsCache()
    invalidateQuestionsCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(3)
    expect(mockRevalidate).toHaveBeenNthCalledWith(1, 'questions', 'max')
    expect(mockRevalidate).toHaveBeenNthCalledWith(2, 'questions', 'max')
    expect(mockRevalidate).toHaveBeenNthCalledWith(3, 'questions', 'max')
  })
})
