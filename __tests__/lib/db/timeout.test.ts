// __tests__/lib/db/timeout.test.ts
// Tests del helper withDbTimeout + DbTimeoutError (Phase 3 — quick-fail).

// Mock @sentry/nextjs antes de importar el módulo bajo test.
const mockSentryCapture = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockSentryCapture(...args),
}))

import {
  withDbTimeout,
  DbTimeoutError,
  isDbTimeoutError,
  isConnectTimeoutError,
  withConnectRetry,
} from '@/lib/db/timeout'

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

describe('withDbTimeout — Sentry capture (Bug #3 fix)', () => {
  beforeEach(() => {
    mockSentryCapture.mockReset()
  })

  test('Sentry.captureException se llama cuando dispara el timeout', async () => {
    const d = deferred<string>()
    jest.useFakeTimers()
    try {
      const promise = withDbTimeout(() => d.promise, 100).catch(e => e)
      await jest.advanceTimersByTimeAsync(101)
      const err = await promise

      expect(err).toBeInstanceOf(DbTimeoutError)
      expect(mockSentryCapture).toHaveBeenCalledTimes(1)
      const [capturedErr, ctx] = mockSentryCapture.mock.calls[0] as [unknown, Record<string, unknown>]
      expect(capturedErr).toBe(err)
      expect(ctx).toMatchObject({
        level: 'warning',
        tags: { quick_fail: 'db_timeout', component: 'db_timeout' },
        extra: { timeoutMs: 100 },
      })
    } finally {
      jest.useRealTimers()
      d.resolve('late')
    }
  })

  test('Sentry NO se llama si fn resuelve antes del timeout', async () => {
    await withDbTimeout(async () => 'fast', 5000)
    expect(mockSentryCapture).not.toHaveBeenCalled()
  })

  test('Sentry NO se llama si fn rechaza antes del timeout', async () => {
    await expect(
      withDbTimeout(async () => {
        throw new Error('connection refused')
      }, 5000),
    ).rejects.toThrow('connection refused')
    expect(mockSentryCapture).not.toHaveBeenCalled()
  })

  test('Si Sentry.captureException lanza, el reject sigue propagando (no rompe el flow)', async () => {
    mockSentryCapture.mockImplementation(() => {
      throw new Error('Sentry init failed')
    })
    const d = deferred<string>()
    jest.useFakeTimers()
    try {
      const promise = withDbTimeout(() => d.promise, 100).catch(e => e)
      await jest.advanceTimersByTimeAsync(101)
      const err = await promise

      // El error original (DbTimeoutError) debe llegar al caller
      expect(err).toBeInstanceOf(DbTimeoutError)
      expect((err as DbTimeoutError).timeoutMs).toBe(100)
    } finally {
      jest.useRealTimers()
      d.resolve('late')
    }
  })

  test('timeoutMs específico llega correctamente al extra de Sentry', async () => {
    const d = deferred<string>()
    jest.useFakeTimers()
    try {
      const promise = withDbTimeout(() => d.promise, 12345).catch(() => {})
      await jest.advanceTimersByTimeAsync(12346)
      await promise

      const ctx = mockSentryCapture.mock.calls[0]?.[1] as Record<string, unknown>
      expect((ctx?.extra as Record<string, unknown>)?.timeoutMs).toBe(12345)
    } finally {
      jest.useRealTimers()
      d.resolve('late')
    }
  })
})

describe('isConnectTimeoutError', () => {
  test('true si .code === "CONNECT_TIMEOUT" en un Error', () => {
    const err = Object.assign(new Error('write CONNECT_TIMEOUT host:6543'), {
      code: 'CONNECT_TIMEOUT',
    })
    expect(isConnectTimeoutError(err)).toBe(true)
  })

  test('true si .code === "CONNECTION_DESTROYED"', () => {
    const err = Object.assign(new Error('connection lost'), {
      code: 'CONNECTION_DESTROYED',
    })
    expect(isConnectTimeoutError(err)).toBe(true)
  })

  test('true si el mensaje contiene CONNECT_TIMEOUT (fallback sin .code)', () => {
    const err = new Error('write CONNECT_TIMEOUT aws-0-eu-west-2.pooler.supabase.com:6543')
    expect(isConnectTimeoutError(err)).toBe(true)
  })

  test('match en mensaje es case-insensitive', () => {
    const err = new Error('connect_timeout')
    expect(isConnectTimeoutError(err)).toBe(true)
  })

  test('false para errores sin .code y sin mensaje matching', () => {
    expect(isConnectTimeoutError(new Error('boom'))).toBe(false)
    expect(isConnectTimeoutError(new Error('connection refused'))).toBe(false)
  })

  test('false para non-Error', () => {
    expect(isConnectTimeoutError(null)).toBe(false)
    expect(isConnectTimeoutError(undefined)).toBe(false)
    expect(isConnectTimeoutError('CONNECT_TIMEOUT')).toBe(false)
    expect(isConnectTimeoutError({ code: 'CONNECT_TIMEOUT' })).toBe(false)
  })
})

describe('withConnectRetry', () => {
  test('retorna el valor en el primer intento exitoso (no reintenta)', async () => {
    const fn = jest.fn(async () => 'ok')
    const r = await withConnectRetry(fn)
    expect(r).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('reintenta una vez si el primer intento lanza CONNECT_TIMEOUT', async () => {
    let calls = 0
    const fn = jest.fn(async () => {
      calls++
      if (calls === 1) {
        throw Object.assign(new Error('write CONNECT_TIMEOUT host:6543'), {
          code: 'CONNECT_TIMEOUT',
        })
      }
      return 'recovered'
    })

    const r = await withConnectRetry(fn, 0)  // backoff 0 para test rápido
    expect(r).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('si el segundo intento también falla CONNECT_TIMEOUT, propaga el error', async () => {
    const fn = jest.fn(async () => {
      throw Object.assign(new Error('write CONNECT_TIMEOUT host:6543'), {
        code: 'CONNECT_TIMEOUT',
      })
    })

    await expect(withConnectRetry(fn, 0)).rejects.toMatchObject({
      code: 'CONNECT_TIMEOUT',
    })
    expect(fn).toHaveBeenCalledTimes(2)
  })

  test('NO reintenta si el error no es CONNECT_TIMEOUT', async () => {
    const sqlErr = new Error('relation "x" does not exist')
    const fn = jest.fn(async () => {
      throw sqlErr
    })

    await expect(withConnectRetry(fn, 0)).rejects.toBe(sqlErr)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test('respeta el backoffMs entre intentos', async () => {
    let firstAttemptTime = 0
    let secondAttemptTime = 0
    let calls = 0

    const fn = jest.fn(async () => {
      calls++
      if (calls === 1) {
        firstAttemptTime = Date.now()
        throw Object.assign(new Error('CONNECT_TIMEOUT'), { code: 'CONNECT_TIMEOUT' })
      }
      secondAttemptTime = Date.now()
      return 'ok'
    })

    await withConnectRetry(fn, 50)
    expect(secondAttemptTime - firstAttemptTime).toBeGreaterThanOrEqual(45)
  })
})
