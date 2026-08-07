/**
 * T-419 (07/08/2026): un 401 de `/api/v2/disputes/notifications` no se arregla reintentando —
 * la sesión no va a volver sola. Antes el sondeo de 60s seguía pidiendo el mismo endpoint
 * indefinidamente: medido, una sola pestaña generó 308 peticiones en 308 minutos contra la
 * misma sesión ya inválida (otra estuvo así 22h). El circuito se corta en el primer 401 y no
 * se reintenta hasta que `user` cambia de verdad (una sesión NUEVA).
 *
 * MEDIDO contra RDS (07/08) antes de tocar el código: las rachas con intervalo EXACTO ~60000ms
 * —la firma del bucle— aparecen SIEMPRE con un `user_id` real, nunca con sesiones anónimas
 * (esas dan eventos sueltos y espaciados, sin patrón). Confirma que el defecto es "sesión
 * logueada que dejó de ser válida", no "arranca el sondeo sin usuario" — la hipótesis que
 * apuntaba la ficha y que NO se sostuvo al medir.
 */
import { renderHook, waitFor, act } from '@testing-library/react'
import { useDisputeNotifications } from '@/hooks/useDisputeNotifications'

let mockUser: { id: string } | null = { id: 'user-1' }
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
}))

// UN solo jest.fn() para toda la vida del test: cambiar de status con `mockFetchResponse` solo
// cambia el `mockResolvedValueOnce`/implementación, nunca sustituye la función — si no, cada
// cambio de respuesta "olvidaría" las llamadas previas y las aserciones de count mentirían.
const fetchMock = jest.fn()
function mockFetchResponse(status: number, body: unknown = { disputes: [], psychoDisputes: [] }) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockUser = { id: 'user-1' }
  fetchMock.mockClear()
  ;(global as any).fetch = fetchMock
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe('useDisputeNotifications — el sondeo se para en el primer 401 (T-419)', () => {
  test('EL CASO REAL: un 401 sostenido ya NO genera una petición por minuto indefinidamente', async () => {
    mockFetchResponse(401)
    renderHook(() => useDisputeNotifications())

    // Carga inicial: 1 petición, 401.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    // Antes del fix, cada uno de estos 60s habría disparado OTRA petición (308 en 308 min).
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(60_000)
      })
    }

    // El circuito se cortó en la primera: sigue en 1, no en 11.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('volver a la pestaña (visibilitychange) tampoco reintenta tras un 401', async () => {
    mockFetchResponse(401)
    renderHook(() => useDisputeNotifications())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('una sesión NUEVA (user cambia) se gana su propio intento, no hereda el bloqueo', async () => {
    mockFetchResponse(401)
    const { rerender } = renderHook(() => useDisputeNotifications())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1) // seguía cortado

    // Login real con OTRO usuario: el efecto vuelve a arrancar.
    mockFetchResponse(200)
    mockUser = { id: 'user-2' }
    rerender()

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    // Y ahora SÍ vuelve a sondear con normalidad.
    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  test('un 500 (no 401) SÍ se sigue reintentando — solo el 401 corta el circuito', async () => {
    mockFetchResponse(500)
    renderHook(() => useDisputeNotifications())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  test('sondeo normal (200) sigue funcionando sin cambios', async () => {
    mockFetchResponse(200)
    renderHook(() => useDisputeNotifications())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      jest.advanceTimersByTime(60_000)
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  })

  test('sin usuario, no arranca ningún sondeo (comportamiento previo, sin cambios)', async () => {
    mockUser = null
    mockFetchResponse(200)
    renderHook(() => useDisputeNotifications())

    await act(async () => {
      jest.advanceTimersByTime(120_000)
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
