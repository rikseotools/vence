// __tests__/lib/cache/testConfig.test.ts
// Tests del helper invalidateTestConfigCache (Fase 4).
//
// Garantiza:
//   1. Llama a revalidateTag con ('test-config', 'max').
//   2. Tragar errores: si revalidateTag lanza fuera de Next runtime, no
//      propaga la excepción.
//   3. Es idempotente bajo llamadas repetidas.

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

import { revalidateTag } from 'next/cache'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'

const mockRevalidate = revalidateTag as jest.Mock

describe('invalidateTestConfigCache', () => {
  beforeEach(() => {
    mockRevalidate.mockReset()
  })

  test('llama a revalidateTag con "test-config" y mode "max"', () => {
    invalidateTestConfigCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(1)
    expect(mockRevalidate).toHaveBeenCalledWith('test-config', 'max')
  })

  test('no propaga excepciones de revalidateTag', () => {
    mockRevalidate.mockImplementationOnce(() => {
      throw new Error('outside Next runtime')
    })
    const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => invalidateTestConfigCache()).not.toThrow()
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[invalidateTestConfigCache]'),
      expect.any(Error),
    )

    consoleWarn.mockRestore()
  })

  test('es idempotente — llamadas repetidas no rompen', () => {
    invalidateTestConfigCache()
    invalidateTestConfigCache()
    invalidateTestConfigCache()

    expect(mockRevalidate).toHaveBeenCalledTimes(3)
    expect(mockRevalidate).toHaveBeenCalledWith('test-config', 'max')
  })
})
