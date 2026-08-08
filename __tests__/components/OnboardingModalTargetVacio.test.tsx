/**
 * [T-339] El worker que cerró la segunda/tercera/cuarta puerta de escritura de
 * `target_oposicion` no pudo verificarlo en navegador (no puede autenticarse como usuario, ver
 * `docs/runbooks/vence-sim.md` §Identidad — necesita `SIM_AUTH_SECRET`/SSM, que este rol no
 * tiene). Este test cierra esa parte del hueco al nivel que SÍ es alcanzable sin auth real: que
 * `OnboardingModal` no se TRAGUE el 409 en silencio.
 *
 * Antes de T-339, `handleSelectCustom`/`handleCreateCustom` pintaban la selección de forma
 * OPTIMISTA y guardaban en segundo plano sin mirar la respuesta — el usuario creía haber elegido
 * su oposición y el servidor la rechazaba sin que se enterase (el mismo vacío que motivó la
 * ficha, un paso antes). El fix hace que las dos rutas ESPEREN la respuesta de `save-field` y,
 * si viene bloqueada (409, `ERROR_PERSONALIZADA_SIN_TEMARIO`), llamen a `setError(...)` con el
 * motivo real en vez de fingir que se guardó.
 *
 * Lo que este test demuestra, con fetch real interceptado (no una función a medias probada por
 * fuera): (1) el mensaje del servidor SÍ llega al DOM, no una versión genérica; (2) la oposición
 * rechazada NO se pinta como seleccionada; (3) cuando el servidor SÍ acepta, no aparece ningún
 * error y la selección se pinta.
 *
 * Lo que NO sustituye: una pasada visual real en navegador (estilos, responsive, journey
 * completo con sesión real) — eso sigue pendiente y así se documenta en la ficha.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingModal from '@/components/OnboardingModal'
import { ERROR_PERSONALIZADA_SIN_TEMARIO } from '@/lib/oposicion/objetivoPersonalizado'

jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: jest.fn().mockResolvedValue({}),
}))

// Se mockea el hook entero (no solo su fetch) para no arrastrar su caché de módulo/localStorage
// y su propio endpoint (/api/oposiciones/catalog) — este test es sobre el flujo CUSTOM, no sobre
// el catálogo oficial.
jest.mock('@/lib/hooks/useOposicionesCatalog', () => ({
  useOposicionesCatalog: () => [],
}))

const CUSTOM_OPOSICION = {
  id: 'a1b2c3d4-personalizada',
  nombre: 'Subalterno',
  categoria: 'C2',
  administracion: 'Ayuntamiento',
}

function mockFetchSecuencia({ saveFieldStatus, saveFieldBody }: { saveFieldStatus: number; saveFieldBody?: unknown }) {
  return jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()

    if (url.includes('/api/v2/onboarding/status')) {
      return Promise.resolve({ ok: true, json: async () => ({ profile: null }) } as Response)
    }
    if (url.includes('ipapi.co')) {
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response)
    }
    if (url.includes('/api/v2/custom-oposiciones/popular')) {
      return Promise.resolve({ ok: true, json: async () => ({ items: [CUSTOM_OPOSICION] }) } as Response)
    }
    if (url.includes('/api/v2/onboarding/save-field') && init?.method === 'POST') {
      const body = init.body ? JSON.parse(init.body as string) : null
      if (body?.field === 'target_oposicion') {
        return Promise.resolve({
          ok: saveFieldStatus < 400,
          status: saveFieldStatus,
          json: async () => saveFieldBody ?? {},
        } as Response)
      }
      // otros campos (age/gender/…): guardado de fondo, siempre ok en este test
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response)
    }
    return Promise.reject(new Error(`fetch no interceptado en el test: ${url}`))
  })
}

const USER = { id: 'user-test-onboarding', email: 'test@example.com' }

describe('OnboardingModal — el 409 de target_oposicion no se traga en silencio (T-339)', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('CASO REAL: personalizada sin temario → el mensaje del servidor llega al DOM y NO se pinta como seleccionada', async () => {
    global.fetch = mockFetchSecuencia({
      saveFieldStatus: 409,
      saveFieldBody: ERROR_PERSONALIZADA_SIN_TEMARIO,
    }) as unknown as typeof fetch

    render(<OnboardingModal isOpen onComplete={() => {}} onSkip={() => {}} user={USER} />)

    const boton = await screen.findByRole('button', { name: /Subalterno/i })
    await userEvent.click(boton)

    // El mensaje real del servidor (no uno genérico) tiene que aparecer en el DOM.
    await waitFor(() => {
      expect(screen.getByText(ERROR_PERSONALIZADA_SIN_TEMARIO.message)).toBeInTheDocument()
    })

    // Y la oposición rechazada NO se pinta como "seleccionada" (el bug de fondo: pintarla antes
    // de saber si el servidor la aceptaba).
    expect(screen.queryByText(/✓ Subalterno/)).not.toBeInTheDocument()
  })

  test('control: cuando el servidor SÍ acepta, no aparece ningún error y se pinta la selección', async () => {
    global.fetch = mockFetchSecuencia({ saveFieldStatus: 200 }) as unknown as typeof fetch

    render(<OnboardingModal isOpen onComplete={() => {}} onSkip={() => {}} user={USER} />)

    const boton = await screen.findByRole('button', { name: /Subalterno/i })
    await userEvent.click(boton)

    await waitFor(() => {
      expect(screen.getByText(/✓ Subalterno/)).toBeInTheDocument()
    })
    expect(screen.queryByText(ERROR_PERSONALIZADA_SIN_TEMARIO.message)).not.toBeInTheDocument()
  })
})
