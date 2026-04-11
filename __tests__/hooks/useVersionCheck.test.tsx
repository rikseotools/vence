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
