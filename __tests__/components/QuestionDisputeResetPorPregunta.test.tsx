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
import { respuestaConImpugnacion } from '../helpers/disputeResponse'

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

// Ids reales: el esquema exige UUID, así que usar 'q-13' haría fallar el parse — y eso es el
// contrato trabajando, no un estorbo.
const P13 = '00000000-0000-4000-8000-000000000013'
const P22 = '00000000-0000-4000-8000-000000000022'
const OTRA = '00000000-0000-4000-8000-000000000999'

// La API responde «ya impugnada» SOLO para la pregunta 13; para el resto, limpia. Así se reproduce
// el arrastre sin depender del dato concreto: lo que se prueba es que el panel no herede nada.
const respuestaPara = (url: string) =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve(
        url.includes(P13) ? respuestaConImpugnacion({ questionId: P13 }) : { success: true, dispute: null },
      ),
  } as Response)

describe('QuestionDispute — el estado no sobrevive al cambio de pregunta', () => {
  beforeEach(() => {
    global.fetch = jest.fn((input: RequestInfo | URL) => respuestaPara(String(input))) as unknown as typeof fetch
  })
  // `resetAllMocks` borraría también la implementación del mock de auth y el componente
  // dejaría de consultar a la API: aquí solo interesa limpiar las llamadas.
  afterEach(() => jest.clearAllMocks())

  it('muestra «Ya impugnaste» en la pregunta que sí tiene impugnación', async () => {
    render(<QuestionDispute questionId={P13} user={user} isOpen />)
    await waitFor(() => expect(screen.getByText(/Ya impugnaste esta pregunta/i)).toBeInTheDocument())
  })

  it('NO lo arrastra a la siguiente pregunta (el bug de Rocío)', async () => {
    const { rerender } = render(<QuestionDispute questionId={P13} user={user} isOpen />)
    await waitFor(() => expect(screen.getByText(/Ya impugnaste esta pregunta/i)).toBeInTheDocument())

    // Cambia la pregunta: la 22, que ella no impugnó.
    rerender(<QuestionDispute questionId={P22} user={user} isOpen />)

    await waitFor(() => expect(screen.queryByText(/Ya impugnaste esta pregunta/i)).not.toBeInTheDocument())
  })

  it('vuelve a consultar la API con el questionId NUEVO', async () => {
    const { rerender } = render(<QuestionDispute questionId={P13} user={user} isOpen />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    rerender(<QuestionDispute questionId={P22} user={user} isOpen />)
    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes(P22))).toBe(true)
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
            ...respuestaConImpugnacion({ questionId: OTRA }),
          }),
      } as Response),
    )
    render(<QuestionDispute questionId={P22} user={user} isOpen />)
    await waitFor(() => expect(mockEmitir).toHaveBeenCalled())
    expect(screen.queryByText(/Ya impugnaste esta pregunta/i)).not.toBeInTheDocument()
    const evento = mockEmitir.mock.calls[0][0] as { eventType: string; severity: string; metadata: Record<string, unknown> }
    expect(evento.eventType).toBe('question_dispute_action')
    expect(evento.severity).toBe('warn')
    expect(evento.metadata.action).toBe('stale_panel_ignored')
  })
})

// ── El bug que de verdad llevaba desde marzo: leer un campo que el endpoint no devuelve ──────
//
// `/api/v2/dispute` responde `{success, dispute}` desde el refactor `c361fd9a5` (18/03/2026) y el
// componente leía `result.data`. `data` era siempre undefined, así que el aviso «Ya impugnaste esta
// pregunta» NO se le mostró a nadie durante meses: quien volvía a una pregunta ya impugnada veía el
// formulario limpio y, al enviarlo, chocaba contra el índice único. Medidos 44 choques en los 24
// días que retiene `validation_error_logs`.
//
// Un desajuste de contrato no se ve: no hay excepción, no hay log, la pantalla queda "normal". Por
// eso ahora la respuesta se valida y la divergencia se emite como evento.
describe('desajuste de contrato: se detecta y se deja rastro', () => {
  it('una respuesta con la forma VIEJA (data) no se pinta y se emite el aviso', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        // Forma pre-refactor: lo que el componente creía recibir.
        json: () => Promise.resolve({ success: true, data: { id: 'x', disputeType: 'otro' } }),
      } as Response),
    )
    render(<QuestionDispute questionId={P13} user={user} isOpen />)
    await waitFor(() => expect(mockEmitir).toHaveBeenCalled())
    const evento = mockEmitir.mock.calls[0][0] as { metadata: Record<string, unknown>; severity: string }
    expect(evento.metadata.action).toBe('contract_mismatch')
    expect(evento.severity).toBe('warn')
    expect(screen.queryByText(/Ya impugnaste esta pregunta/i)).not.toBeInTheDocument()
  })
})
