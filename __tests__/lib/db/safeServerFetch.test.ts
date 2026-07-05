// __tests__/lib/db/safeServerFetch.test.ts
// Tests del helper safeServerFetch usado en SSR pages para evitar lambdas
// colgadas a 300s en blips de pool.

const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...args: unknown[]) => mockEmit(...args),
  emit: (...args: unknown[]) => mockEmit(...args),
}))

import { safeServerFetch } from '@/lib/db/safeServerFetch'

describe('safeServerFetch', () => {
  beforeEach(() => {
    mockEmit.mockReset()
  })

  it('devuelve el valor cuando la query termina antes del timeout', async () => {
    const result = await safeServerFetch(async () => 'data', 1000, 'test')
    expect(result).toBe('data')
  })

  it('devuelve null cuando timeoutea (NO propaga error)', async () => {
    jest.useFakeTimers()
    try {
      const promise = safeServerFetch(
        () => new Promise(() => {}), // pending forever
        100,
        'test',
      )
      await jest.advanceTimersByTimeAsync(101)
      const result = await promise
      expect(result).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('devuelve null cuando hay error no-timeout (NO propaga)', async () => {
    const result = await safeServerFetch(
      async () => { throw new Error('connection refused') },
      1000,
      'test',
    )
    expect(result).toBeNull()
  })

  it('devuelve null para errores de runtime arbitrarios', async () => {
    const result = await safeServerFetch(
      async () => { throw new TypeError('bad call') },
      1000,
      'test',
    )
    expect(result).toBeNull()
  })

  it('preserva el tipo genérico del valor', async () => {
    const result = await safeServerFetch<{ x: number }>(
      async () => ({ x: 42 }),
      1000,
      'test',
    )
    expect(result).toEqual({ x: 42 })
  })

  it('label se incluye en el log warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.useFakeTimers()
    try {
      const promise = safeServerFetch(
        () => new Promise(() => {}),
        100,
        'landing-data',
      )
      await jest.advanceTimersByTimeAsync(101)
      await promise

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('landing-data'),
      )
    } finally {
      jest.useRealTimers()
      warnSpy.mockRestore()
    }
  })

  it('null fetch result se devuelve igual (no se confunde con timeout)', async () => {
    const result = await safeServerFetch<unknown>(async () => null, 1000, 'test')
    expect(result).toBeNull()
  })

  it('emite a observabilidad in-house (vía withDbTimeout en timeout)', async () => {
    jest.useFakeTimers()
    try {
      const promise = safeServerFetch(
        () => new Promise(() => {}),
        100,
        'test',
      )
      await jest.advanceTimersByTimeAsync(101)
      await promise
      // withDbTimeout emite http_timeout; safeServerFetch lo deja pasar
      expect(mockEmit).toHaveBeenCalled()
    } finally {
      jest.useRealTimers()
    }
  })
})
