import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TopicPrintButton from '@/components/TopicPrintButton'

// Estos tests cubrían antes el comportamiento window.print() + muro in-app. Ese muro
// EXISTÍA porque window.print() no descargaba nada en navegadores embebidos. Desde que el
// PDF se genera en servidor y se descarga como fichero, la descarga funciona también ahí,
// así que el muro se eliminó y estos tests cubren el flujo nuevo.

let mockAuthReturn: { user: any } = { user: { id: 'u1' } }
jest.mock('@/hooks/usePremiumGate', () => ({
  usePremiumGate: () => ({ isPremium: true, gate: (_f: unknown, cb: any) => { if (typeof cb === 'function') cb() }, closeGate: jest.fn(), activeFeature: null, activeContext: null }),
}))
jest.mock('@/components/premium/PremiumFeatureModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}))

jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: jest.fn(),
}))
import { emitClientEvent } from '@/lib/observability/client'
const emitMock = emitClientEvent as jest.Mock

const LOGIN_HREF = '/login?oposicion=auxiliar_administrativo_estado&return_to=/auxiliar-administrativo-estado/temario'

/** Espera a que la acción indicada se haya emitido (el handler es asíncrono). */
const emitted = (action: string) =>
  emitMock.mock.calls.some(([c]) => c?.metadata?.action === action)

let clickedAnchors: HTMLAnchorElement[]

beforeEach(() => {
  emitMock.mockClear()
  mockAuthReturn = { user: { id: 'u1' } }
  window.print = jest.fn()

  // jsdom no implementa descargas: capturamos el <a download> que dispara el componente.
  clickedAnchors = []
  const realClick = HTMLAnchorElement.prototype.click
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clickedAnchors.push(this)
  })
  ;(global as any).URL.createObjectURL = jest.fn(() => 'blob:fake')
  ;(global as any).URL.revokeObjectURL = jest.fn()
  void realClick
})

afterEach(() => jest.restoreAllMocks())

function mockFetch(res: Partial<Response> & { status: number; contentType?: string }) {
  // `headers` va en el mock porque un Response REAL siempre los trae, y desde T-273 el botón los
  // mira para distinguir un PDF de la respuesta «este tema va por partes» (JSON). Un mock sin
  // cabeceras hacía pasar un camino que en producción no existe.
  ;(global as any).fetch = jest.fn().mockResolvedValue({
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? (res.contentType ?? 'application/pdf') : null) },
    blob: async () => new Blob(['%PDF-1.3'], { type: 'application/pdf' }),
    ...res,
  })
}

describe('TopicPrintButton — descarga del PDF generado en servidor', () => {
  test('el botón dice "Descargar PDF" (antes decía "Imprimir PDF" y no producía ningún PDF)', () => {
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={7} />)
    expect(screen.getByText('Descargar PDF')).toBeInTheDocument()
    expect(screen.queryByText('Imprimir PDF')).not.toBeInTheDocument()
  })

  // ── PILOTO T-273: el tema no cabe en un PDF y el servidor lo ofrece TROCEADO ──────────────
  // Antes, estos temas devolvían 413 y el botón caía a imprimir: el opositor se quedaba sin
  // material (medido: 5 intentos en 30 días de auxiliar-administrativo-estado T109).
  test('respuesta por PARTES: descarga todas y NO guarda el JSON como si fuera un PDF', async () => {
    // El fallo que este test evita: sin mirar el content-type, `res.blob()` sobre el JSON
    // produciría un fichero .pdf ilegible, que es peor que el 413 que había antes.
    const partes = [
      { parte: 1, total: 2, etiqueta: 'Excel 365 (arts. 10-80)', url: '/api/temario/x/109/pdf?parte=1' },
      { parte: 2, total: 2, etiqueta: 'Excel 365 Escritorio', url: '/api/temario/x/109/pdf?parte=2' },
    ]
    ;(global as any).fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ estado: 'disponible_por_partes', tema: 109, partes }),
      })
      .mockResolvedValue({
        ok: true, status: 200,
        headers: { get: () => 'application/pdf' },
        blob: async () => new Blob(['%PDF-1.3'], { type: 'application/pdf' }),
      })

    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={109} />)
    fireEvent.click(screen.getByText('Descargar PDF'))

    await waitFor(() => expect(emitted('download')).toBe(true), { timeout: 5000 })
    // Una descarga POR PARTE, con el nombre diciendo cuál es.
    expect(clickedAnchors).toHaveLength(2)
    expect(clickedAnchors[0].download).toMatch(/-parte-1-de-2\.pdf$/)
    expect(clickedAnchors[1].download).toMatch(/-parte-2-de-2\.pdf$/)
    // Y NO se cae a la impresión del navegador: eso era el comportamiento del 413.
    expect(window.print).not.toHaveBeenCalled()
  }, 10000)

  test('logueado: pide el PDF a la ruta correcta y dispara la descarga', async () => {
    mockFetch({ status: 200 })
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={7} />)

    fireEvent.click(screen.getByText('Descargar PDF'))

    await waitFor(() => expect(emitted('download')).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/temario/auxiliar_administrativo_estado/7/pdf', expect.anything()
    )
    expect(clickedAnchors).toHaveLength(1)
    expect(clickedAnchors[0].download).toBe('auxiliar_administrativo_estado-tema-7.pdf')
    // Ya NO se usa la impresión del navegador en el camino feliz.
    expect(window.print).not.toHaveBeenCalled()
  })

  test('sin sesión: modal de registro, no descarga nada (lead-gen intacto)', () => {
    mockAuthReturn = { user: null }
    mockFetch({ status: 200 })
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={3} />)

    fireEvent.click(screen.getByText('Descargar PDF'))

    expect(screen.getByText('Descarga el temario en PDF')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(emitted('register_prompt')).toBe(true)
  })

  test('413 (tema demasiado grande): degrada a la impresión del navegador', async () => {
    // Los "artículos-cajón" (T-040) no caben en generación sincrónica. En vez de dejar al
    // usuario sin nada, se vuelve al comportamiento anterior.
    mockFetch({ status: 413 })
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={29} />)

    fireEvent.click(screen.getByText('Descargar PDF'))

    await waitFor(() => expect(window.print).toHaveBeenCalled())
    expect(emitted('download_too_large')).toBe(true)
    expect(clickedAnchors).toHaveLength(0)
  })

  test('error del servidor: avisa al usuario y lo deja registrado', async () => {
    mockFetch({ status: 500 })
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={7} />)

    fireEvent.click(screen.getByText('Descargar PDF'))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo generar el PDF')
    expect(emitMock.mock.calls.some(([c]) => c?.metadata?.action === 'download' && c?.metadata?.ok === false)).toBe(true)
  })

  test('el botón se bloquea mientras genera (evita dobles peticiones)', async () => {
    let resolver: (v: any) => void = () => {}
    ;(global as any).fetch = jest.fn(() => new Promise(r => { resolver = r }))
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={7} />)

    fireEvent.click(screen.getByText('Descargar PDF'))
    await waitFor(() => expect(screen.getByText('Generando PDF…')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Generando/ })).toBeDisabled()

    resolver({ ok: true, status: 200, headers: { get: () => 'application/pdf' }, blob: async () => new Blob(['%PDF']) })
    await waitFor(() => expect(screen.getByText('Descargar PDF')).toBeInTheDocument())
  })

  test('sin slug en el href: degrada a impresión en vez de pedir una URL rota', async () => {
    mockFetch({ status: 200 })
    render(<TopicPrintButton loginHref="/login" topicNumber={7} />)

    fireEvent.click(screen.getByText('Descargar PDF'))

    await waitFor(() => expect(window.print).toHaveBeenCalled())
    expect(global.fetch).not.toHaveBeenCalled()
    expect(emitted('download_fallback_print')).toBe(true)
  })
})
