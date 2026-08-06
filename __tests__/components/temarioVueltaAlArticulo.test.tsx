/**
 * [T-611] El bucle temario → test → VUELTA AL ARTÍCULO, EJECUTADO (no leído).
 *
 * Los guardarraíles de texto comprueban que las tres piezas están escritas; esto comprueba que
 * al abrir la página con el ancla el usuario ACABA viendo su artículo. Es lo que reportó una
 * usuaria premium y lo que ningún test podía ver antes: las tarjetas viven dentro de una
 * sección PLEGADA (`hidden`), así que un ancla sin desplegar la ley no lleva a ninguna parte y
 * el fallo es MUDO — se cae arriba del tema, que es el estado del que veníamos.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TopicContentView from '@/components/temario/TopicContentView'
import { emitClientEvent } from '@/lib/observability/client'

const emitir = emitClientEvent as unknown as jest.Mock

jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, userProfile: null }) }))
jest.mock('@/contexts/LawSlugContext', () => ({ useLawSlugs: () => ({ getSlug: (s: string) => s.toLowerCase() }) }))
jest.mock('@/lib/observability/client', () => ({ emitClientEvent: jest.fn() }))
jest.mock('@/components/ArticleTTS', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/temario/LawTestCTA', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/TopicPrintButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/TopicVideoCourses', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/TopicNavFooter', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MarkdownContent', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div>{content}</div>,
}))

const articulo = (n: string, extra: Record<string, unknown> = {}) => ({
  id: `id-${n}`,
  articleNumber: n,
  title: null,
  content: `Texto del artículo ${n}`,
  officialQuestionCount: 0,
  questionCount: 3,
  titleNumber: null,
  chapterNumber: null,
  section: null,
  ...extra,
})

const contenido = {
  topicNumber: 2,
  title: 'Tema 2: Las Cortes Generales',
  description: null,
  totalArticles: 3,
  videoCourses: [],
  laws: [
    {
      law: { id: 'ley-ce', shortName: 'CE', name: 'Constitución Española', year: 1978 },
      articles: [articulo('107'), articulo('116')],
    },
    {
      law: { id: 'ley-7-1985', shortName: 'Ley 7/1985', name: 'Bases de Régimen Local', year: 1985 },
      articles: [articulo('116')], // mismo número, OTRA ley: el ancla tiene que distinguirlas
    },
  ],
} as never

/** ¿Está el artículo dentro de una sección plegada? (así es como se oculta: `hidden`) */
function estaOculto(id: string): boolean {
  const el = document.getElementById(id)
  if (!el) throw new Error(`no se ha pintado la tarjeta ${id}`)
  return !!el.closest('.hidden')
}

function pintar(hash: string) {
  window.location.hash = hash
  return render(<TopicContentView content={contenido} oposicion="administrativo-estado" updatedAt="6 de agosto de 2026" />)
}

describe('T-611 · el temario devuelve al artículo del que saliste', () => {
  // jsdom no trae `scrollIntoView`. Se instala como espía para poder afirmar A QUÉ tarjeta se
  // salta; el componente además lo llama de forma opcional, porque un entorno sin él (un
  // navegador in-app antiguo) no puede llevarse por delante la vuelta entera.
  const saltos: string[] = []
  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(Element.prototype as any).scrollIntoView = function () {
      saltos.push((this as Element).id)
    }
  })

  beforeEach(() => {
    emitir.mockClear()
    saltos.length = 0
    window.location.hash = ''
  })

  it('cada artículo se pinta con su ancla, y dos leyes con el MISMO número no colisionan', () => {
    pintar('')
    expect(document.getElementById('art-ce-116')).toBeInTheDocument()
    expect(document.getElementById('art-ley-7-1985-116')).toBeInTheDocument()
    expect(document.getElementById('art-ce-107')).toBeInTheDocument()
  })

  it('SIN ancla las leyes siguen plegadas (comportamiento de siempre)', async () => {
    pintar('')
    expect(estaOculto('art-ce-116')).toBe(true)
    expect(emitir).not.toHaveBeenCalled()
  })

  it('CON ancla despliega SU ley y el artículo queda visible', async () => {
    pintar('#art-ce-116')
    await waitFor(() => expect(estaOculto('art-ce-116')).toBe(false))
    // …y solo la suya: la otra ley del tema sigue plegada
    expect(estaOculto('art-ley-7-1985-116')).toBe(true)
    // …y además se le lleva ahí (no basta con desplegar: el tema mide varias pantallas)
    await waitFor(() => expect(saltos).toEqual(['art-ce-116']))
  })

  it('el ancla de la OTRA ley despliega la otra (no se confunde por el número)', async () => {
    pintar('#art-ley-7-1985-116')
    await waitFor(() => expect(estaOculto('art-ley-7-1985-116')).toBe(false))
    expect(estaOculto('art-ce-116')).toBe(true)
  })

  it('deja rastro de que el bucle se cerró', async () => {
    pintar('#art-ce-116')
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'temario_vuelta_articulo',
        metadata: expect.objectContaining({ resultado: 'articulo', topicNumber: 2 }),
      }),
    )
  })

  it('un ancla que ya no existe no rompe la página, y se DENUNCIA', async () => {
    // El scope del tema cambia con el tiempo: el enlace guardado puede apuntar a un artículo
    // que ya no está. Debe caerse al comportamiento de siempre, no fallar.
    pintar('#art-ce-999')
    await waitFor(() => expect(emitir).toHaveBeenCalled())
    expect(emitir).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ resultado: 'no_encontrado' }),
      }),
    )
    expect(estaOculto('art-ce-116')).toBe(true)
    expect(screen.getByText(/Las Cortes Generales/)).toBeInTheDocument()
  })

  it('el enlace «Hacer test» guarda la vuelta CON el ancla de ESE artículo', async () => {
    pintar('')
    const enlace = screen.getAllByText(/Hacer test Art\. 116/)[0].closest('a')!
    enlace.click()
    expect(sessionStorage.getItem('temario_return_url')).toContain('#art-ce-116')
  })
})
