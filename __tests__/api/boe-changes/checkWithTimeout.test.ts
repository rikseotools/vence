// __tests__/api/boe-changes/checkWithTimeout.test.ts
//
// Tests de integración ligeros: verificar que las funciones check*
// ejercitan fetchWithTimeout correctamente en los caminos de éxito.
//
// Los caminos de timeout real del abort se testan directamente en
// fetchWithTimeout.test.ts — aquí nos centramos en que las funciones
// hagan el parseo correcto de la respuesta y devuelvan el shape esperado.

import {
  checkWithContentLength,
  checkWithPartialDownload,
  checkWithFullDownload,
} from '@/lib/api/boe-changes/queries'

function mockResponse(
  body: string = '',
  init: { status?: number; headers?: Record<string, string> } = {},
) {
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

describe('checkWithContentLength — ruta de éxito', () => {
  it('devuelve unchanged=true cuando el Content-Length coincide con el caché', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse('', {
        status: 200,
        headers: { 'content-length': '1000' },
      }),
    ) as any

    const result = await checkWithContentLength('https://example.com/ok', 1000)

    expect(result.success).toBe(true)
    expect((result as any).unchanged).toBe(true)
    expect(result.contentLength).toBe(1000)
  })

  it('devuelve size_changed cuando el tamaño cambia más de SIZE_TOLERANCE_BYTES', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse('', {
        status: 200,
        headers: { 'content-length': '2000' },
      }),
    ) as any

    const result = await checkWithContentLength('https://example.com/changed', 1000)

    expect(result.success).toBe(false)
    expect((result as any).reason).toBe('size_changed')
    expect((result as any).sizeChange).toBe(1000)
  })

  it('devuelve no_cache si no hay length cacheado', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse('', {
        status: 200,
        headers: { 'content-length': '500' },
      }),
    ) as any

    const result = await checkWithContentLength('https://example.com/first', null)

    expect(result.success).toBe(false)
    expect((result as any).reason).toBe('no_cache')
    expect(result.contentLength).toBe(500)
  })

  it('devuelve fetch_error si la llamada subyacente rechaza (red)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any

    const result = await checkWithContentLength('https://example.com/down', 1000)

    expect(result.success).toBe(false)
    expect((result as any).reason).toBe('fetch_error')
  })
})

describe('checkWithPartialDownload — ruta de éxito', () => {
  it('extrae la fecha del rango cacheado cuando existe', async () => {
    const htmlSnippet =
      'Última actualización publicada el 14/03/2026'
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse(htmlSnippet, { status: 206 })) as any

    const result = await checkWithPartialDownload('https://example.com/law', 5000)

    expect(result.success).toBe(true)
    expect((result as any).method).toBe('cached_offset')
    expect((result as any).lastUpdateBOE).toBe('14/03/2026')
  })

  it('devuelve date_not_in_partial si ningún rango progresivo contiene la fecha', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse('<html>no date here</html>', { status: 206 })) as any

    // sin cachedOffset → fuerza los rangos progresivos
    const result = await checkWithPartialDownload('https://example.com/nodate', null)

    expect(result.success).toBe(false)
    expect((result as any).reason).toBe('date_not_in_partial')
  })
})

describe('checkWithFullDownload — ruta de éxito', () => {
  it('extrae la fecha de la descarga completa', async () => {
    const html = '<html>Texto consolidado actualización publicada el 01/04/2026</html>'
    global.fetch = jest.fn().mockResolvedValue(mockResponse(html, { status: 200 })) as any

    const result = await checkWithFullDownload('https://example.com/full')

    expect(result.success).toBe(true)
    expect((result as any).method).toBe('full')
    expect((result as any).lastUpdateBOE).toBe('01/04/2026')
  })

  it('devuelve fetch_error si la descarga falla a nivel red', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT')) as any

    const result = await checkWithFullDownload('https://example.com/down')

    expect(result.success).toBe(false)
    expect((result as any).reason).toBe('fetch_error')
  })
})
