/**
 * @jest-environment jsdom
 */
// SIMULACIÓN de comportamiento (capa memoria feedback_feature_multiples_capas_seguridad)
// del gate `profileSettled` de /test/por-leyes. Monta la PÁGINA REAL (no una copia) con
// useAuth/fetch/router mockeados y prueba el flujo:
//   A) usuario logueado + perfil aún null → spinner, NO se cargan leyes (evita el flash).
//   B) llega el perfil con oposición → carga leyes ACOTADAS (?positionType=…) a la primera.
//   C) el perfil no llega → tras el TECHO de 4s, carga leyes igualmente (sin acotar).
//   D) sin usuario (deslogueado) → resuelve ya, carga todas las leyes.
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import TestConfiguradorPage from '@/app/test/por-leyes/page'

// useAuth mutable (prefijo mock* para el hoisting de jest.mock)
const mockAuthState: { user: unknown; userProfile: unknown; loading: boolean } = {
  user: null, userProfile: null, loading: true,
}
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
// Stub del configurador para no arrastrar su árbol; marca que la lista ya se renderiza
jest.mock('@/components/TestConfigurator', () => ({
  __esModule: true,
  default: () => <div data-testid="configurator">configurador</div>,
}))

function mockFetchLaws() {
  const fn = jest.fn(async () => ({
    json: async () => ({ success: true, data: [
      { lawShortName: 'CE', lawName: 'Constitución', articlesWithQuestions: 10, totalQuestions: 100 },
    ] }),
  }))
  // @ts-expect-error jsdom global
  global.fetch = fn
  return fn
}

beforeEach(() => {
  mockAuthState.user = null; mockAuthState.userProfile = null; mockAuthState.loading = true
  jest.clearAllMocks()
})

describe('SIMULACIÓN /test/por-leyes — gate profileSettled (real component)', () => {
  it('A) user logueado + perfil null → spinner y NO carga leyes (sin flash sin acotar)', async () => {
    const fetchFn = mockFetchLaws()
    mockAuthState.user = { id: 'u1' }; mockAuthState.userProfile = null; mockAuthState.loading = false
    render(<TestConfiguradorPage />)
    // deja correr los efectos
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText(/Cargando tu configuración/i)).toBeInTheDocument()
    expect(fetchFn).not.toHaveBeenCalled() // clave: NO cargó leyes con el perfil a medias
  })

  it('B) llega el perfil con oposición → carga leyes ACOTADAS (?positionType=…) a la primera', async () => {
    const fetchFn = mockFetchLaws()
    mockAuthState.user = { id: 'u1' }; mockAuthState.userProfile = null; mockAuthState.loading = false
    const { rerender } = render(<TestConfiguradorPage />)
    await act(async () => { await Promise.resolve() })
    expect(fetchFn).not.toHaveBeenCalled()
    // el perfil resuelve con su oposición
    mockAuthState.userProfile = { target_oposicion: 'auxiliar_administrativo_estado' }
    rerender(<TestConfiguradorPage />)
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const url = (fetchFn.mock.calls[0]?.[0] as string) || ''
    expect(url).toContain('positionType=auxiliar_administrativo_estado') // acotado a la PRIMERA
  })

  it('C) el perfil NO llega → tras el techo de 4s carga leyes igualmente', async () => {
    jest.useFakeTimers()
    try {
      const fetchFn = mockFetchLaws()
      mockAuthState.user = { id: 'u1' }; mockAuthState.userProfile = null; mockAuthState.loading = false
      render(<TestConfiguradorPage />)
      await act(async () => { await Promise.resolve() })
      expect(fetchFn).not.toHaveBeenCalled()
      // dispara el techo de 4s
      await act(async () => { jest.advanceTimersByTime(4000); await Promise.resolve() })
      expect(fetchFn).toHaveBeenCalled() // no se queda colgado: carga sin acotar
    } finally {
      jest.useRealTimers()
    }
  })

  it('D) sin usuario (deslogueado) → resuelve ya y carga todas las leyes', async () => {
    const fetchFn = mockFetchLaws()
    mockAuthState.user = null; mockAuthState.userProfile = null; mockAuthState.loading = false
    render(<TestConfiguradorPage />)
    await waitFor(() => expect(fetchFn).toHaveBeenCalled())
    const url = (fetchFn.mock.calls[0]?.[0] as string) || ''
    expect(url).not.toContain('positionType=') // sin oposición → todas las leyes
  })
})
