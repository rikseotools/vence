// __tests__/lib/db/timeout.test.ts
// Tests del helper withDbTimeout + DbTimeoutError (Phase 3 — quick-fail).

import { withDbTimeout, DbTimeoutError, isDbTimeoutError } from '@/lib/db/timeout'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: unknown) => void
} {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('withDbTimeout', () => {
  test('resuelve con el valor de fn si termina antes del timeout', async () => {
    const result = await withDbTimeout(async () => 'ok', 1000)
    expect(result).toBe('ok')
  })

  test('rechaza con DbTimeoutError si fn excede el timeout', async () => {
    const d = deferred<string>()
    const promise = withDbTimeout(() => d.promise, 50)

    await expect(promise).rejects.toBeInstanceOf(DbTimeoutError)
    await expect(promise).rejects.toMatchObject({
      name: 'DbTimeoutError',
      timeoutMs: 50,
    })

    // Cleanup: resolver para que la promesa abandonada no quede colgando
    // en el event loop más allá del test.
    d.resolve('late')
  })

  test('propaga errores de fn sin envolverlos', async () => {
    const customErr = new Error('connection refused')
    const promise = withDbTimeout(async () => {
      throw customErr
    }, 1000)

    await expect(promise).rejects.toBe(customErr)
  })

  test('limpia el timer si fn resuelve antes (no deja handle colgado)', async () => {
    // Spy en clearTimeout para verificar que se llama
    const clearSpy = jest.spyOn(global, 'clearTimeout')

    await withDbTimeout(async () => 'fast', 5000)

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  test('limpia el timer si fn rechaza antes', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout')

    await expect(
      withDbTimeout(async () => {
        throw new Error('fast fail')
      }, 5000),
    ).rejects.toThrow('fast fail')

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  test('default timeout es 8000ms', async () => {
    // Verificar via mensaje del error que el default se aplica
    const d = deferred<string>()

    // Usamos jest fake timers para no esperar 8s reales
    jest.useFakeTimers()
    try {
      const promise = withDbTimeout(() => d.promise)
      jest.advanceTimersByTime(8001)
      await expect(promise).rejects.toMatchObject({ timeoutMs: 8000 })
    } finally {
      jest.useRealTimers()
      d.resolve('late')
    }
  })

  test('timeout configurable mediante segundo argumento', async () => {
    const d = deferred<string>()

    jest.useFakeTimers()
    try {
      const promise = withDbTimeout(() => d.promise, 250)
      jest.advanceTimersByTime(251)
      await expect(promise).rejects.toMatchObject({ timeoutMs: 250 })
    } finally {
      jest.useRealTimers()
      d.resolve('late')
    }
  })
})

describe('DbTimeoutError', () => {
  test('expone timeoutMs y name correctos', () => {
    const err = new DbTimeoutError(8000)
    expect(err.name).toBe('DbTimeoutError')
    expect(err.timeoutMs).toBe(8000)
    expect(err.message).toContain('8000ms')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('isDbTimeoutError', () => {
  test('true para DbTimeoutError', () => {
    expect(isDbTimeoutError(new DbTimeoutError(1000))).toBe(true)
  })

  test('false para otros Error', () => {
    expect(isDbTimeoutError(new Error('boom'))).toBe(false)
    expect(isDbTimeoutError(new TypeError('bad'))).toBe(false)
  })

  test('false para non-Error', () => {
    expect(isDbTimeoutError(null)).toBe(false)
    expect(isDbTimeoutError(undefined)).toBe(false)
    expect(isDbTimeoutError('timeout')).toBe(false)
    expect(isDbTimeoutError({ name: 'DbTimeoutError', timeoutMs: 1000 })).toBe(false)
  })

  test('detecta cross-realm (objeto que parece DbTimeoutError pero no es instanceof)', () => {
    // Simular un Error de otro realm que tiene mismo name + timeoutMs
    const fake = new Error('fake')
    fake.name = 'DbTimeoutError'
    // Cast a `any` para esquivar el readonly de DbTimeoutError.timeoutMs —
    // estamos simulando un error de otro realm cuyas props no son readonly.
    ;(fake as unknown as { timeoutMs: number }).timeoutMs = 5000

    // El guard usa instanceof Error + name + timeoutMs check.
    // Como Error es global, fake SÍ es instanceof Error.
    expect(isDbTimeoutError(fake)).toBe(true)
  })
})
