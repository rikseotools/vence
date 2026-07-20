import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TopicPrintButton from '@/components/TopicPrintButton'

// useAuth mockeable por test (logueado / anónimo)
let mockAuthReturn: { user: any } = { user: { id: 'u1' } }
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthReturn,
}))

// Observabilidad: espiamos los eventos que emite el botón
jest.mock('@/lib/observability/client', () => ({
  emitClientEvent: jest.fn(),
}))
import { emitClientEvent } from '@/lib/observability/client'
const emitMock = emitClientEvent as jest.Mock

// NOTA: isInAppBrowser NO se mockea — usamos el detector real contra el UA de jsdom.

const GSA_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/329.0 Mobile/15E148 Safari/604.1'
const SAFARI_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

const LOGIN_HREF = '/login?oposicion=auxiliar_administrativo_estado&return_to=/auxiliar-administrativo-estado/temario'

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

beforeEach(() => {
  emitMock.mockClear()
  mockAuthReturn = { user: { id: 'u1' } }
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
  window.print = jest.fn()
})

describe('TopicPrintButton — comportamiento por contexto', () => {
  test('logueado + navegador in-app (GSA): muestra aviso, NO imprime, emite inapp_blocked', async () => {
    setUA(GSA_UA)
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={7} />)

    fireEvent.click(screen.getByText('Imprimir PDF'))

    expect(screen.getByText('Ábrelo en tu navegador para descargar el PDF')).toBeInTheDocument()
    expect(window.print).not.toHaveBeenCalled()
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'temario_print_action',
        metadata: expect.objectContaining({ action: 'inapp_blocked', slug: 'auxiliar_administrativo_estado', topic: 7 }),
      })
    )

    // "Copiar enlace" copia al portapapeles y confirma
    fireEvent.click(screen.getByText('Copiar enlace'))
    await waitFor(() => expect(screen.getByText('✓ Enlace copiado')).toBeInTheDocument())
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: 'copy_link', ok: true }) })
    )
  })

  test('logueado + navegador normal (Safari escritorio): imprime y emite print', () => {
    setUA(SAFARI_DESKTOP)
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={3} />)

    fireEvent.click(screen.getByText('Imprimir PDF'))

    expect(window.print).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Ábrelo en tu navegador para descargar el PDF')).not.toBeInTheDocument()
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: 'print' }) })
    )
  })

  test('in-app + portapapeles FALLA (writeText rechaza): no crashea, emite copy_link ok:false, no confirma', async () => {
    setUA(GSA_UA)
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('denied'))
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={5} />)

    fireEvent.click(screen.getByText('Imprimir PDF'))
    fireEvent.click(screen.getByText('Copiar enlace'))

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ action: 'copy_link', ok: false }) })
      )
    )
    // no debe mostrar el estado de éxito
    expect(screen.queryByText('✓ Enlace copiado')).not.toBeInTheDocument()
    // el modal sigue abierto y usable (botón "Copiar enlace" presente)
    expect(screen.getByText('Copiar enlace')).toBeInTheDocument()
  })

  test('in-app + clipboard API AUSENTE (http/webview viejo): no crashea, emite copy_link ok:false', async () => {
    setUA(GSA_UA)
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={5} />)

    fireEvent.click(screen.getByText('Imprimir PDF'))
    fireEvent.click(screen.getByText('Copiar enlace'))

    await waitFor(() =>
      expect(emitMock).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ action: 'copy_link', ok: false }) })
      )
    )
    expect(screen.queryByText('✓ Enlace copiado')).not.toBeInTheDocument()
  })

  test('sin sesión: muestra modal de registro (lead-gen), NO imprime', () => {
    setUA(SAFARI_DESKTOP)
    mockAuthReturn = { user: null }
    render(<TopicPrintButton loginHref={LOGIN_HREF} topicNumber={1} />)

    fireEvent.click(screen.getByText('Imprimir PDF'))

    expect(screen.getByText('Descarga el temario en PDF')).toBeInTheDocument()
    expect(window.print).not.toHaveBeenCalled()
    // el CTA lleva el href de login recibido por prop
    expect(screen.getByText('Registrarse gratis').closest('a')).toHaveAttribute('href', LOGIN_HREF)
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ action: 'register_prompt' }) })
    )
  })
})
