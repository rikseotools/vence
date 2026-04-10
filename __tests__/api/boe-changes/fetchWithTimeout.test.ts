// __tests__/api/boe-changes/fetchWithTimeout.test.ts
//
// Tests del helper fetchWithTimeout — aborta peticiones lentas al BOE
// para que una sola ley colgada no consuma el presupuesto del cron.
//
// Bug histórico (10/04/2026): sin timeout, el cron check-boe-changes
// procesaba 337 leyes en serie y un solo fetch bloqueado podía agotar
// los 300s, dejando 45 leyes sin verificar nunca.

import { fetchWithTimeout, FETCH_TIMEOUT_MS } from '@/lib/api/boe-changes/queries'

// Mock Response sencillo: el código del módulo solo usa .ok, .status,
// .headers.get() y .text(). En el env node de jest Response no es global.
function mockResponse(body: string = 'ok', init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200
  const headers = init.headers ?? {}
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? headers[key] ?? null,
    },
    text: async () => body,
  } as any
}

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

describe('fetchWithTimeout', () => {
  it('devuelve la respuesta normal si el servidor responde a tiempo', async () => {
    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined() // debe haber pasado un AbortSignal
      return Promise.resolve(mockResponse('ok', { status: 200 }))
    }) as any

    const response = await fetchWithTimeout('https://example.com/test', {}, 1000)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('aborta la petición tras el timeout configurado', async () => {
    // Mock fetch que nunca resuelve — tiene que ser cortado por el abort
    global.fetch = jest.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        // Reaccionamos al signal.abort() como lo haría el fetch real
        const signal = init.signal as AbortSignal
        signal.addEventListener('abort', () => {
          const err = new Error('aborted') as any
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as any

    const start = Date.now()
    await expect(fetchWithTimeout('https://example.com/hang', {}, 200)).rejects.toThrow()
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(180)
    expect(elapsed).toBeLessThan(500) // no debe esperar mucho más
  })

  it('no aborta si la respuesta llega antes del timeout', async () => {
    global.fetch = jest.fn().mockImplementation(async () => {
      // Responde en 50ms
      await new Promise(r => setTimeout(r, 50))
      return mockResponse('fast', { status: 200 })
    }) as any

    const response = await fetchWithTimeout('https://example.com/fast', {}, 500)
    expect(response.status).toBe(200)
  })

  it('limpia el setTimeout en el camino de éxito (no deja handles colgando)', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout')
    global.fetch = jest.fn().mockResolvedValue(mockResponse('ok', { status: 200 })) as any

    await fetchWithTimeout('https://example.com/ok', {}, 1000)
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('limpia el setTimeout también en el camino de error', async () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout')
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as any

    await expect(fetchWithTimeout('https://example.com/err', {}, 1000)).rejects.toThrow()
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('usa el timeout por defecto FETCH_TIMEOUT_MS si no se pasa', async () => {
    // Solo verificamos que el valor por defecto está definido y es razonable
    expect(FETCH_TIMEOUT_MS).toBeGreaterThanOrEqual(5000)
    expect(FETCH_TIMEOUT_MS).toBeLessThanOrEqual(30_000)

    global.fetch = jest.fn().mockResolvedValue(mockResponse('ok', { status: 200 })) as any
    // Llamar sin el 3er argumento — usa default
    const response = await fetchWithTimeout('https://example.com/default')
    expect(response.status).toBe(200)
  })

  it('pasa method, headers y body del options al fetch subyacente', async () => {
    const fetchSpy = jest.fn().mockResolvedValue(mockResponse('ok', { status: 200 }))
    global.fetch = fetchSpy as any

    await fetchWithTimeout(
      'https://example.com/resource',
      { method: 'HEAD', headers: { 'X-Custom': 'yes' } },
      1000,
    )

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://example.com/resource')
    expect(init.method).toBe('HEAD')
    expect(init.headers).toEqual({ 'X-Custom': 'yes' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
