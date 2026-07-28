/**
 * El panel de impugnar NO puede arrastrar el estado de una pregunta a la siguiente.
 *
 * Qué pasaba: `TestLayout` monta `<QuestionDispute>` **sin `key`**, así que es la misma instancia
 * durante todo el test, y `checkExistingDispute` solo hacía `setExistingDispute(data)` cuando había
 * datos — **sin rama else**. Combinado: una impugnación cargada en una pregunta se quedaba pegada,
 * y al abrir el panel en otra aparecía «Ya impugnaste esta pregunta — Motivo: …» sobre una que el
 * usuario no había impugnado.
 *
 * Lo reportó Rocío el 28/07 con estas palabras: «no he marcado ese titulo» (impugnación
 * `dc236653`). Los logs lo confirman: impugnó la pregunta #13 de su test a las 09:58 y el aviso le
 * reapareció en la #22 a las 10:02, que ella había dejado en blanco.
 *
 * Este test comprueba el contrato observable: al cambiar `questionId`, el panel vuelve a preguntar
 * a la API por ESA pregunta y no enseña lo de la anterior.
 */
import { render, screen, waitFor } from '@testing-library/react'
import QuestionDispute from '@/components/QuestionDispute'

// Sin cabecera de auth el componente ni siquiera consulta a la API (fallback graceful), así que
// para probar el arrastre de estado hay que simular una sesión válida.
jest.mock('@/lib/api/authHeaders', () => ({
  getAuthHeaders: jest.fn(async () => ({ Authorization: 'Bearer test' })),
}))

// El prefijo `mock` no es capricho: Jest solo permite referenciar variables así dentro de la
// factoría de `jest.mock` (protección contra mocks sin inicializar).
const mockEmitir = jest.fn()
jest.mock('@/lib/observability/client', () => ({ emitClientEvent: (...a: unknown[]) => mockEmitir(...a) }))

const user = { id: 'u-1', email: 'test@vence.es' } as never

// La API devuelve impugnación previa SOLO para la pregunta 13.
const respuestaPara = (url: string) => {
  const esLa13 = url.includes('q-13')
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve(
        esLa13
          ? { success: true, data: { id: 'd-1', questionId: 'q-13', disputeType: 'tema_incorrecto', status: 'pending', createdAt: '2026-07-28T09:58:38Z' } }
          : { success: true, data: null },
      ),
  } as Response)
}

describe('QuestionDispute — el estado no sobrevive al cambio de pregunta', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => respuestaPara(String(input))) as unknown as typeof fetch
  })
  // `resetAllMocks` borraría también la implementación del mock de auth y el componente
  // dejaría de consultar a la API: aquí solo interesa limpiar las llamadas.
  afterEach(() => jest.clearAllMocks())

  it('muestra «Ya impugnaste» en la pregunta que sí tiene impugnación', async () => {
    render(<QuestionDispute questionId="q-13" user={user} isOpen />)
    await waitFor(() => expect(screen.getByText(/Ya impugnaste esta pregunta/i)).toBeInTheDocument())
  })

  it('NO lo arrastra a la siguiente pregunta (el bug de Rocío)', async () => {
    const { rerender } = render(<QuestionDispute questionId="q-13" user={user} isOpen />)
    await waitFor(() => expect(screen.getByText(/Ya impugnaste esta pregunta/i)).toBeInTheDocument())

    // Cambia la pregunta: la 22, que ella no impugnó.
    rerender(<QuestionDispute questionId="q-22" user={user} isOpen />)

    await waitFor(() => expect(screen.queryByText(/Ya impugnaste esta pregunta/i)).not.toBeInTheDocument())
  })

  it('vuelve a consultar la API con el questionId NUEVO', async () => {
    const { rerender } = render(<QuestionDispute questionId="q-13" user={user} isOpen />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    rerender(<QuestionDispute questionId="q-22" user={user} isOpen />)
    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('q-22'))).toBe(true)
    })
  })

  it('IGNORA y DEJA RASTRO si la API devuelve la impugnación de otra pregunta', async () => {
    // Segunda capa: aunque el estado se limpie, una respuesta cruzada (carrera entre dos
    // peticiones, caché intermedia) volvería a pintar lo que no toca. La guarda lo hace imposible
    // y lo deja medido en `question_dispute_action`, el mismo evento de los fallos de contexto.
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { id: 'd-1', questionId: 'OTRA-pregunta', disputeType: 'tema_incorrecto', status: 'pending', createdAt: null },
          }),
      } as Response),
    )
    render(<QuestionDispute questionId="q-99" user={user} isOpen />)
    await waitFor(() => expect(mockEmitir).toHaveBeenCalled())
    expect(screen.queryByText(/Ya impugnaste esta pregunta/i)).not.toBeInTheDocument()
    const evento = mockEmitir.mock.calls[0][0] as { eventType: string; severity: string; metadata: Record<string, unknown> }
    expect(evento.eventType).toBe('question_dispute_action')
    expect(evento.severity).toBe('warn')
    expect(evento.metadata.action).toBe('stale_panel_ignored')
  })
})
