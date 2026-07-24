/**
 * Reintento de RED en fetchWithChallenge (fix 24/07/2026).
 *
 * Un `Failed to fetch` transitorio en la ruta crítica de generar test se
 * convertía en dead-end. Ahora el wrapper reintenta SOLO ante error de red
 * (TypeError), con backoff acotado, sin reintentar AbortError ni duplicar
 * (todos los callers son lecturas idempotentes de /api/questions/filtered).
 * Emite observabilidad `network_retry` (recovered/exhausted).
 */
import { fetchWithChallenge, NETWORK_RETRIES } from '@/lib/api/fetchWithChallenge'
import { emitClientEvent } from '@/lib/observability/client'

jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))
const emitMock = emitClientEvent as jest.MockedFunction<typeof emitClientEvent>

const okResponse = () => new Response(JSON.stringify({ success: true }), { status: 200 })

describe('fetchWithChallenge — reintento de red', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    emitMock.mockClear()
    jest.useFakeTimers()
  })
  afterEach(() => {
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('reintenta un blip de red (TypeError) y acaba devolviendo la respuesta', async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // 1er intento: blip
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // 2º intento: blip
      .mockResolvedValueOnce(okResponse())                      // 3er intento: OK
    global.fetch = fetchMock as unknown as typeof global.fetch

    const p = fetchWithChallenge('/api/questions/filtered', { method: 'POST' })
    await jest.runAllTimersAsync()
    const res = await p

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + NETWORK_RETRIES
    expect(NETWORK_RETRIES).toBe(2)
    // Observabilidad: emite 'recovered' con el nº de intentos.
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'network_retry',
        metadata: expect.objectContaining({ outcome: 'recovered', attempts: 3 }),
      }),
    )
  })

  it('caso feliz (sin blips) NO emite observabilidad ni reintenta', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse())
    global.fetch = fetchMock as unknown as typeof global.fetch

    const res = await fetchWithChallenge('/api/questions/filtered')
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(emitMock).not.toHaveBeenCalled() // cero ruido en el caso común
  })

  it('NO reintenta un AbortError (navegación/cancelación del usuario)', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const fetchMock = jest.fn().mockRejectedValue(abort)
    global.fetch = fetchMock as unknown as typeof global.fetch

    const p = fetchWithChallenge('/api/questions/filtered')
    await expect(p).rejects.toBe(abort)
    expect(fetchMock).toHaveBeenCalledTimes(1) // sin reintentos
    expect(emitMock).not.toHaveBeenCalled()    // AbortError no es red → no traza
  })

  it('propaga el error de red tras agotar los reintentos y emite exhausted', async () => {
    const netErr = new TypeError('Failed to fetch')
    const fetchMock = jest.fn().mockRejectedValue(netErr)
    global.fetch = fetchMock as unknown as typeof global.fetch

    const p = fetchWithChallenge('/api/questions/filtered')
    const assertion = expect(p).rejects.toBe(netErr)
    await jest.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(NETWORK_RETRIES + 1) // 3 intentos
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'network_retry',
        severity: 'warn',
        metadata: expect.objectContaining({ outcome: 'exhausted' }),
      }),
    )
  })
})
