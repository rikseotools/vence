// __tests__/hooks/useAnswerWatchdog.test.ts
// Tests del hook useAnswerWatchdog (refactor 31/05/2026 — Page Visibility-aware).
//
// Cubre:
//   - Dispara onReset tras WATCHDOG_TIMEOUT_MS de tiempo visible
//   - NO dispara cuando isProcessing pasa a false antes del threshold
//   - NO dispara cuando la pestaña está en background (tiempo NO suma)
//   - Reanuda contador al volver visible (sin contar el tiempo en background)
//   - Reinicia el contador al pasar isProcessing false → true
//   - Cleanup en unmount
//   - Reporta visibleMs en el log (no wall clock)

/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react'
import { useAnswerWatchdog } from '../../hooks/useAnswerWatchdog'

// Mock fetch para que el log no falle en JSDOM.
const fetchMock = jest.fn(() =>
  Promise.resolve({ ok: true } as unknown as Response),
)
beforeAll(() => {
  ;(globalThis as { fetch: typeof fetch }).fetch =
    fetchMock as unknown as typeof fetch
})

beforeEach(() => {
  fetchMock.mockClear()
  jest.useFakeTimers()
  // Default = visible. Cada test que necesite hidden la cambia.
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  })
})

afterEach(() => {
  jest.useRealTimers()
})

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useAnswerWatchdog', () => {
  it('dispara onReset tras 12 s de tiempo visible', () => {
    const onReset = jest.fn()
    renderHook(() =>
      useAnswerWatchdog({
        isProcessing: true,
        onReset,
        component: 'ExamLayout',
      }),
    )

    act(() => {
      jest.advanceTimersByTime(11_500)
    })
    expect(onReset).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('NO dispara si isProcessing pasa a false antes del threshold', () => {
    const onReset = jest.fn()
    const { rerender } = renderHook(
      ({ isProcessing }: { isProcessing: boolean }) =>
        useAnswerWatchdog({
          isProcessing,
          onReset,
          component: 'ExamLayout',
        }),
      { initialProps: { isProcessing: true } },
    )

    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    rerender({ isProcessing: false })

    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    expect(onReset).not.toHaveBeenCalled()
  })

  it('NO suma tiempo cuando la pestaña está hidden', () => {
    const onReset = jest.fn()
    renderHook(() =>
      useAnswerWatchdog({
        isProcessing: true,
        onReset,
        component: 'ExamLayout',
      }),
    )

    // 5 s visible
    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    // Hidden 5 min — wall clock muy alto, visible debería seguir en ~5 s
    act(() => {
      setVisibility('hidden')
      jest.advanceTimersByTime(5 * 60 * 1000)
    })
    // Aún no debería disparar (visible ≈ 5 s < 12 s)
    expect(onReset).not.toHaveBeenCalled()

    // Vuelve visible, otros 6 s
    act(() => {
      setVisibility('visible')
      jest.advanceTimersByTime(6_000)
    })
    // Visible total ≈ 11 s < 12 s → sigue sin disparar
    expect(onReset).not.toHaveBeenCalled()

    // +2 s más → 13 s visible → dispara
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('cuando dispara, reporta visibleMs en el body — no wall clock', () => {
    const onReset = jest.fn()
    renderHook(() =>
      useAnswerWatchdog({
        isProcessing: true,
        onReset,
        component: 'ExamLayout',
        userId: 'user-1',
      }),
    )

    // 5 s visible
    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    // 30 min hidden — wall clock muy alto
    act(() => {
      setVisibility('hidden')
      jest.advanceTimersByTime(30 * 60 * 1000)
    })
    // 8 s visible más → total visible 13 s → dispara
    act(() => {
      setVisibility('visible')
      jest.advanceTimersByTime(8_000)
    })

    expect(onReset).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(call[1].body as string) as {
      durationMs: number
      errorMessage: string
    }
    // durationMs debe estar cerca de 13 s (visible), NO 30+ min (wall)
    expect(body.durationMs).toBeGreaterThanOrEqual(12_000)
    expect(body.durationMs).toBeLessThan(20_000)
    expect(body.errorMessage).toContain('UI congelada')
  })

  it('reinicia el contador al pasar isProcessing false → true', () => {
    const onReset = jest.fn()
    const { rerender } = renderHook(
      ({ isProcessing }: { isProcessing: boolean }) =>
        useAnswerWatchdog({
          isProcessing,
          onReset,
          component: 'ExamLayout',
        }),
      { initialProps: { isProcessing: true } },
    )

    act(() => {
      jest.advanceTimersByTime(10_000)
    })
    rerender({ isProcessing: false })
    rerender({ isProcessing: true })

    // Como reinició, después de 11 s NO debería disparar
    act(() => {
      jest.advanceTimersByTime(11_000)
    })
    expect(onReset).not.toHaveBeenCalled()

    // Con +2 s más (total 13 s en la nueva pasada) sí
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('cleanup en unmount cancela el interval', () => {
    const onReset = jest.fn()
    const { unmount } = renderHook(() =>
      useAnswerWatchdog({
        isProcessing: true,
        onReset,
        component: 'ExamLayout',
      }),
    )

    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    unmount()

    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(onReset).not.toHaveBeenCalled()
  })

  it('NO dispara dos veces aunque siga corriendo el interval por race', () => {
    const onReset = jest.fn()
    renderHook(() =>
      useAnswerWatchdog({
        isProcessing: true,
        onReset,
        component: 'ExamLayout',
      }),
    )

    act(() => {
      jest.advanceTimersByTime(13_000)
    })
    act(() => {
      jest.advanceTimersByTime(5_000)
    })
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
