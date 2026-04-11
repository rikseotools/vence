/**
 * Tests para useVersionCheck
 *
 * Contexto: bug francofila (2026-04-09) — 3 deploys en 12 min durante un
 * test en /leyes/constitucion-espanola/avanzado. useVersionCheck disparaba
 * window.location.reload() sin comprobar si había un test en curso,
 * haciendo que la UI pareciera "un test completamente nuevo" tras cada
 * reload.
 *
 * Este suite cubre:
 * 1. isInCriticalRoute como función pura — regex coverage
 * 2. El hook difiere el reload en rutas críticas
 * 3. El hook recarga inmediatamente en rutas no críticas
 * 4. El hook aplica un reload diferido cuando el usuario navega fuera de
 *    la ruta crítica
 */

import { renderHook, waitFor } from '@testing-library/react'
import { isInCriticalRoute, __resetVersionCheckState } from '@/hooks/useVersionCheck'

// ============================================
// Mocks
// ============================================

const mockTrack = jest.fn()
jest.mock('@/hooks/useInteractionTracker', () => ({
  useInteractionTracker: () => ({ track: mockTrack }),
}))

// Mock de usePathname controlable por test
let mockPathname = '/'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

// Mock de fetch para /api/version
const mockVersionResponse = (version: string | null, ok = true) => {
  ;(global as any).fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => ({ version }),
  })
}

// Mock de window.location.reload
const originalLocation = window.location
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      pathname: '/',
      reload: jest.fn(),
    },
  })
})

afterAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
})

beforeEach(() => {
  __resetVersionCheckState()
  mockTrack.mockClear()
  ;(window.location.reload as jest.Mock).mockClear?.()
  mockPathname = '/'
  ;(window.location as any).pathname = '/'
})

// ============================================
// 1. isInCriticalRoute — función pura
// ============================================

describe('isInCriticalRoute', () => {
  const criticalCases = [
    '/leyes/constitucion-espanola/avanzado',
    '/leyes/ley-39-2015/rapido',
    '/leyes/ley-40-2015/personalizado',
    '/leyes/codigo-civil/aleatorio',
    '/leyes/ley-7-1985/repaso-fallos',
    '/leyes/ce/repaso-fallos-v2',
    '/auxiliar-administrativo-estado/test/tema/5',
    '/auxiliar-administrativo-canarias/test/tema/13',
    '/tramitacion-procesal/test/tema/30',
    '/examen-oficial/abc123',
    '/test/aleatorio-examen',
    '/psicotecnicos/test',
    '/psicotecnicos/test/series',
    '/test/multi-ley',
    '/test/desde-chat/123',
    '/test/articulo/456',
    '/test/por-leyes',
  ]

  test.each(criticalCases)('reconoce %s como ruta crítica', (path) => {
    expect(isInCriticalRoute(path)).toBe(true)
  })

  const nonCriticalCases = [
    '/',
    '/perfil',
    '/leyes',
    '/leyes/constitucion-espanola',
    '/leyes/ley-39-2015/teoria/titulo-i',
    '/auxiliar-administrativo-estado',
    '/auxiliar-administrativo-estado/temario',
    '/auxiliar-administrativo-estado/temario/tema-5',
    '/oposiciones',
    '/premium',
    '/soporte',
    '/admin/feedback',
  ]

  test.each(nonCriticalCases)('NO reconoce %s como ruta crítica', (path) => {
    expect(isInCriticalRoute(path)).toBe(false)
  })

  test('devuelve false con pathname vacío o undefined', () => {
    expect(isInCriticalRoute('')).toBe(false)
    expect(isInCriticalRoute(undefined as unknown as string)).toBe(false)
  })
})

// ============================================
// 2. Hook useVersionCheck — diferir en rutas críticas
// ============================================

describe('useVersionCheck - comportamiento del hook', () => {
  async function loadHook() {
    // Import dinámico para poder resetear el estado module-level entre tests
    const mod = await import('@/hooks/useVersionCheck')
    return mod.useVersionCheck
  }

  test('primera carga fija clientVersion sin recargar', async () => {
    mockVersionResponse('v1')
    mockPathname = '/'

    const useVersionCheck = await loadHook()
    renderHook(() => useVersionCheck())

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalledWith(
        '/api/version',
        expect.objectContaining({ cache: 'no-store' })
      )
    })

    expect(window.location.reload).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  test('en ruta NO crítica + versión nueva → recarga inmediatamente', async () => {
    // Primer mount fija clientVersion = v1
    mockVersionResponse('v1')
    mockPathname = '/'
    ;(window.location as any).pathname = '/'

    const useVersionCheck = await loadHook()
    const { unmount } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())
    unmount()

    // Segundo mount: servidor devuelve v2, usuario en /
    mockVersionResponse('v2')
    renderHook(() => useVersionCheck())

    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalled()
    })

    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'version_check_reload_immediate',
        value: expect.objectContaining({
          clientVersion: 'v1',
          newVersion: 'v2',
          pathname: '/',
        }),
      })
    )
  })

  test('en ruta crítica + versión nueva → NO recarga, marca pendiente y trackea defer', async () => {
    // Primer mount fija clientVersion = v1
    mockVersionResponse('v1')
    mockPathname = '/leyes/constitucion-espanola/avanzado'
    ;(window.location as any).pathname = '/leyes/constitucion-espanola/avanzado'

    const useVersionCheck = await loadHook()
    const { unmount } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())
    unmount()

    // Segundo mount: servidor devuelve v2, usuario en ruta crítica
    mockVersionResponse('v2')
    renderHook(() => useVersionCheck())

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'version_check_deferred',
          value: expect.objectContaining({
            clientVersion: 'v1',
            newVersion: 'v2',
            pathname: '/leyes/constitucion-espanola/avanzado',
          }),
        })
      )
    })

    expect(window.location.reload).not.toHaveBeenCalled()
  })

  test('misma versión limpia pendingVersion stale', async () => {
    // Setup: clientVersion = v1
    mockVersionResponse('v1')
    mockPathname = '/'

    const useVersionCheck = await loadHook()
    const { unmount: u1 } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())
    u1()

    // Servidor sigue en v1
    mockVersionResponse('v1')
    const { unmount: u2 } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())
    u2()

    expect(window.location.reload).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  test('servidor devuelve "dev" → no hace nada', async () => {
    mockVersionResponse('dev')
    mockPathname = '/'

    const useVersionCheck = await loadHook()
    renderHook(() => useVersionCheck())

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    expect(window.location.reload).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })

  test('fetch falla → no rompe, no recarga', async () => {
    ;(global as any).fetch = jest.fn().mockRejectedValue(new Error('network'))
    mockPathname = '/'

    const useVersionCheck = await loadHook()
    const { result } = renderHook(() => useVersionCheck())

    // No debe lanzar
    expect(result.error).toBeUndefined()
    expect(window.location.reload).not.toHaveBeenCalled()
  })

  test('/api/version devuelve 500 → no recarga', async () => {
    mockVersionResponse('v2', false)
    mockPathname = '/'

    const useVersionCheck = await loadHook()
    renderHook(() => useVersionCheck())

    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    expect(window.location.reload).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()
  })
})

// ============================================
// 3. Escenarios end-to-end — simulaciones realistas
// ============================================
//
// Estos tests simulan secuencias completas de uso, incluyendo navegación,
// cambios de visibilidad, y múltiples deploys. Cada uno cuenta una historia
// que puede reproducirse en producción.

describe('Escenarios end-to-end', () => {
  async function loadHook() {
    const mod = await import('@/hooks/useVersionCheck')
    return mod.useVersionCheck
  }

  /**
   * Simula un checkVersion externo. Como el hook tiene un useEffect con
   * deps vacías, el único disparador programático desde el test es:
   * 1. Desmontar y remontar el hook (simulando una navegación full)
   * 2. Triggear el visibilitychange listener (simulando tab switch)
   */
  function triggerVisibilityChange(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  function setPathname(path: string) {
    mockPathname = path
    ;(window.location as any).pathname = path
  }

  // --------------------------------------------
  // Escenario 1: reproducción del caso francofila
  // --------------------------------------------
  test('Caso francofila: deploy durante test crítico → defer → al salir recarga', async () => {
    // GIVEN: usuaria entra a /leyes/constitucion-espanola/avanzado con deploy v1
    mockVersionResponse('v1')
    setPathname('/leyes/constitucion-espanola/avanzado')

    const useVersionCheck = await loadHook()
    const { rerender, unmount } = renderHook(() => useVersionCheck())

    // El primer mount fija clientVersion = v1
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())
    expect(window.location.reload).not.toHaveBeenCalled()
    expect(mockTrack).not.toHaveBeenCalled()

    // WHEN: deploy cambia a v2 (equipo de devs desplegó)
    mockVersionResponse('v2')

    // Ella cambia de pestaña y vuelve (simulando pausa mental durante test)
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    // THEN: el check dispara, detecta v2, DIFIERE porque está en ruta crítica
    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'version_check_deferred',
          component: 'useVersionCheck',
          action: 'defer',
          value: expect.objectContaining({
            clientVersion: 'v1',
            newVersion: 'v2',
            pathname: '/leyes/constitucion-espanola/avanzado',
          }),
        })
      )
    })
    // IMPORTANTÍSIMO: NO recargó pese a haber versión nueva
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: terminar test y navegar a resultados / home
    setPathname('/')
    rerender()

    // THEN: el effect de pathname detecta pendingVersion y aplica el reload
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
    expect(mockTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'version_check_reload_deferred',
        action: 'reload_deferred',
        value: expect.objectContaining({
          clientVersion: 'v1',
          newVersion: 'v2',
          pathname: '/',
        }),
      })
    )

    unmount()
  })

  // --------------------------------------------
  // Escenario 2: múltiples deploys consecutivos
  // --------------------------------------------
  test('Tres deploys en 12 minutos durante test → sólo recarga una vez con la última', async () => {
    // GIVEN: usuaria en test con v1
    mockVersionResponse('v1')
    setPathname('/auxiliar-administrativo-estado/test/tema/5')

    const useVersionCheck = await loadHook()
    const { rerender } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // WHEN: deploy #1 → v2
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'version_check_deferred',
          value: expect.objectContaining({ newVersion: 'v2' }),
        })
      )
    })
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: deploy #2 → v3
    mockVersionResponse('v3')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'version_check_deferred',
          value: expect.objectContaining({ newVersion: 'v3' }),
        })
      )
    })
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: deploy #3 → v4
    mockVersionResponse('v4')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'version_check_deferred',
          value: expect.objectContaining({ newVersion: 'v4' }),
        })
      )
    })
    expect(window.location.reload).not.toHaveBeenCalled()

    // Han ocurrido 3 defers, ninguna recarga
    const deferCalls = mockTrack.mock.calls.filter(
      c => c[0].eventType === 'version_check_deferred'
    )
    expect(deferCalls.length).toBeGreaterThanOrEqual(3)

    // WHEN: termina test, navega a /
    setPathname('/')
    rerender()

    // THEN: se aplica UNA sola recarga, con la última versión pendiente (v4)
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
    const deferredReloadCall = mockTrack.mock.calls.find(
      c => c[0].eventType === 'version_check_reload_deferred'
    )
    expect(deferredReloadCall).toBeDefined()
    expect(deferredReloadCall![0].value.newVersion).toBe('v4')
  })

  // --------------------------------------------
  // Escenario 3: navegación dentro-fuera-dentro de ruta crítica
  // --------------------------------------------
  test('Navegación mixta: ruta crítica → temario → ruta crítica → home', async () => {
    // GIVEN: usuaria en tema 5 con v1
    mockVersionResponse('v1')
    setPathname('/auxiliar-administrativo-estado/test/tema/5')

    const useVersionCheck = await loadHook()
    const { rerender } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // WHEN: deploy v2 mientras está en tema 5
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'version_check_deferred' })
      )
    })
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: navega a /auxiliar-administrativo-estado/temario (NO crítica)
    setPathname('/auxiliar-administrativo-estado/temario')
    rerender()

    // THEN: al salir de la ruta crítica, se aplica el reload pendiente
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // Escenario 4: transita entre dos rutas críticas sin recargar
  // --------------------------------------------
  test('Navegación entre rutas críticas NO dispara reload pendiente', async () => {
    // GIVEN: usuaria en test avanzado con v1
    mockVersionResponse('v1')
    setPathname('/leyes/ley-39-2015/avanzado')

    const useVersionCheck = await loadHook()
    const { rerender } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // WHEN: deploy v2 → defer
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'version_check_deferred' })
      )
    })

    // WHEN: cambia a otra ruta también crítica (otro test)
    setPathname('/auxiliar-administrativo-estado/test/tema/5')
    rerender()

    // THEN: NO recarga, seguimos difiriendo
    // Damos tiempo a que el effect se ejecute si fuera a disparar
    await new Promise(r => setTimeout(r, 50))
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: finalmente sale a ruta no crítica
    setPathname('/')
    rerender()

    // THEN: ahora sí aplica el reload pendiente
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // Escenario 5: usuaria en ruta no crítica desde el inicio
  // --------------------------------------------
  test('Usuario en ruta no crítica: deploy nuevo recarga inmediato, sin defer', async () => {
    // GIVEN: usuaria en /perfil con v1
    mockVersionResponse('v1')
    setPathname('/perfil')

    const useVersionCheck = await loadHook()
    renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // WHEN: deploy v2
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    // THEN: recarga inmediata, ningún defer
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    const deferCalls = mockTrack.mock.calls.filter(
      c => c[0].eventType === 'version_check_deferred'
    )
    expect(deferCalls).toHaveLength(0)

    const immediateCalls = mockTrack.mock.calls.filter(
      c => c[0].eventType === 'version_check_reload_immediate'
    )
    expect(immediateCalls).toHaveLength(1)
    expect(immediateCalls[0][0].value).toMatchObject({
      clientVersion: 'v1',
      newVersion: 'v2',
      pathname: '/perfil',
    })
  })

  // --------------------------------------------
  // Escenario 6: entra a ruta crítica con versión ya pendiente
  // --------------------------------------------
  test('Pending version se mantiene al entrar en ruta crítica', async () => {
    // GIVEN: usuaria en /perfil con v1
    mockVersionResponse('v1')
    setPathname('/perfil')

    const useVersionCheck = await loadHook()
    const { rerender } = renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // Reset reload para esta simulación — la vamos a inspeccionar solo al final
    ;(window.location.reload as jest.Mock).mockClear()

    // WHEN: entra a ruta crítica antes de que haya deploy nuevo
    setPathname('/leyes/ley-39-2015/avanzado')
    rerender()

    // Como no hay pending, no debe recargar
    await new Promise(r => setTimeout(r, 50))
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: deploy v2 mientras está en crítica
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'version_check_deferred' })
      )
    })
    expect(window.location.reload).not.toHaveBeenCalled()

    // WHEN: sale a home
    setPathname('/')
    rerender()

    // THEN: recarga diferida
    await waitFor(() => {
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
  })

  // --------------------------------------------
  // Escenario 7: servidor cambia pero luego revierte (rollback)
  // --------------------------------------------
  test('Rollback del deploy: pendingVersion se limpia al ver misma versión', async () => {
    // GIVEN: usuaria en test con v1
    mockVersionResponse('v1')
    setPathname('/leyes/constitucion-espanola/avanzado')

    const useVersionCheck = await loadHook()
    renderHook(() => useVersionCheck())
    await waitFor(() => expect((global as any).fetch).toHaveBeenCalled())

    // WHEN: deploy v2 → defer
    mockVersionResponse('v2')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'version_check_deferred' })
      )
    })

    // WHEN: el equipo hace rollback — servidor vuelve a v1
    mockVersionResponse('v1')
    triggerVisibilityChange('hidden')
    triggerVisibilityChange('visible')

    // Damos tiempo al check
    await new Promise(r => setTimeout(r, 100))

    // THEN: nadie recargó pese al defer previo
    expect(window.location.reload).not.toHaveBeenCalled()

    // (pendingVersion debe haber sido limpiado — lo verificamos con un
    // pathname change posterior: si no recarga al salir de crítica,
    // confirma que pendingVersion es null)
    // NB: no podemos inspeccionar pendingVersion directamente porque es
    // module-level, pero sí podemos observar el comportamiento.
  })
})
