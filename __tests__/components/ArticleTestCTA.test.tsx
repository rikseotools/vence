// __tests__/components/ArticleTestCTA.test.tsx
//
// Superficie de RENDER del CTA "Hacer test de este artículo" (cliente). Es la
// superficie que FALLABA en el bug de manuel izquierdo (la página no pintaba el
// botón). Renderiza el componente REAL, mockeando solo la oposición (contexto) y
// el fetch al endpoint SSOT. Verifica: aparece ⟺ el endpoint dice count>0; nunca
// parpadea mientras carga; art 0 no consulta; errores no rompen.
import { render, screen, waitFor } from '@testing-library/react'
import ArticleTestCTA from '@/app/teoria/[law]/[articleNumber]/ArticleTestCTA'

jest.mock('@/contexts/OposicionContext', () => ({
  useOposicion: () => ({ oposicionId: null }), // sin oposición → default estado
}))

describe('ArticleTestCTA (cliente, superficie de render)', () => {
  const realFetch = global.fetch
  afterEach(() => {
    global.fetch = realFetch
    jest.clearAllMocks()
  })
  const mockCount = (count: number) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ count }) }) as never
  }

  it('count>0 → botón con nº + enlace correcto, y consulta el endpoint con la oposición por defecto', async () => {
    mockCount(3)
    render(<ArticleTestCTA lawSlug="decreto-42-2019-condiciones-trabajo-gva" articleNumber={10} />)
    const link = await screen.findByRole('link', { name: /hacer test de este artículo/i })
    expect(link).toHaveAttribute(
      'href',
      '/leyes/decreto-42-2019-condiciones-trabajo-gva?selected_articles=10&source=teoria',
    )
    expect(link).toHaveTextContent('(3 preguntas)')
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/teoria/decreto-42-2019-condiciones-trabajo-gva/10/test-count?positionType=auxiliar_administrativo_estado',
    )
  })

  it('count=0 → NO renderiza nada (sin dead-end)', async () => {
    mockCount(0)
    const { container } = render(<ArticleTestCTA lawSlug="ce" articleNumber={1} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('mientras carga (fetch pendiente) → nada (no parpadea el botón)', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as never
    const { container } = render(<ArticleTestCTA lawSlug="ce" articleNumber={5} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('art 0 → ni consulta el endpoint ni pinta botón (rompería "Volver al artículo")', () => {
    global.fetch = jest.fn() as never
    const { container } = render(<ArticleTestCTA lawSlug="ce" articleNumber={0} />)
    expect(container).toBeEmptyDOMElement()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('fetch falla → sin botón, sin crash', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network')) as never
    const { container } = render(<ArticleTestCTA lawSlug="ce" articleNumber={5} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('singular: "1 pregunta" (no "1 preguntas")', async () => {
    mockCount(1)
    render(<ArticleTestCTA lawSlug="ce" articleNumber={14} />)
    const link = await screen.findByRole('link')
    expect(link).toHaveTextContent('(1 pregunta)')
    expect(link).not.toHaveTextContent('preguntas')
  })
})
