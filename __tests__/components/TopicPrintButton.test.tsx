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

function mockFetch(res: Partial<Response> & { status: number }) {
  ;(global as any).fetch = jest.fn().mockResolvedValue({
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
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

    resolver({ ok: true, status: 200, blob: async () => new Blob(['%PDF']) })
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
