// __tests__/teoria/encabezadoArticulo.test.ts — qué se lee en la línea de un artículo del temario.
//
// POR QUÉ EXISTE (T-596, 05/08/2026). El encabezado colgaba de `article.title`, un campo que
// **13.952 artículos activos (23% del banco) tienen a NULL teniendo el texto guardado**. Esas
// tarjetas se servían con el número y nada más. Lo destapó un premium estudiando: *«no aparece el
// Título V, saltáis del artículo 107 al 117»* — y el 116, con 1.898 caracteres en BD, salía mudo.
//
// Lo que se fija aquí es la regla completa, incluido el caso que motivó el bug (sin título, con
// contenido) y el único en el que es legítimo no pintar nada (sin título y sin contenido).

import {
  encabezadoArticulo,
  articuloSinTextoVisible,
  LARGO_EXTRACTO,
} from '@/lib/teoria/encabezadoArticulo'

describe('encabezadoArticulo — la rúbrica manda, el texto rescata', () => {
  it('con título, se usa el título tal cual', () => {
    expect(encabezadoArticulo({ title: 'Policía judicial', content: 'Lo que sea' })).toBe('Policía judicial')
  })

  it('SIN título pero con contenido, saca un extracto (el bug que motivó T-596)', () => {
    // art. 109 CE, que se servía mudo teniendo esto guardado.
    const a = { title: null, content: 'Las Cámaras y sus Comisiones podrán recabar la información y ayuda que precisen del Gobierno y de sus Departamentos.' }
    const r = encabezadoArticulo(a)
    expect(r).not.toBeNull()
    expect(r).toMatch(/^Las Cámaras y sus Comisiones/)
    expect(articuloSinTextoVisible(a)).toBe(false)
  })

  it('un título en blanco NO cuenta como título (cae al contenido)', () => {
    expect(encabezadoArticulo({ title: '   ', content: 'Texto del artículo' })).toBe('Texto del artículo')
    expect(encabezadoArticulo({ title: '', content: 'Texto del artículo' })).toBe('Texto del artículo')
  })

  it('sin título y sin contenido devuelve null (no hay nada que enseñar, y es honesto)', () => {
    expect(encabezadoArticulo({ title: null, content: null })).toBeNull()
    expect(encabezadoArticulo({ title: null, content: '   ' })).toBeNull()
    expect(articuloSinTextoVisible({ title: null, content: null })).toBe(true)
  })

  it('tolera null/undefined sin reventar (lo llaman 131 vistas)', () => {
    expect(encabezadoArticulo(null)).toBeNull()
    expect(encabezadoArticulo(undefined)).toBeNull()
    expect(encabezadoArticulo({})).toBeNull()
  })
})

describe('encabezadoArticulo — el extracto se lee, no se pega', () => {
  it('limpia el marcado (el contenido es markdown y se pinta con MarkdownContent)', () => {
    const r = encabezadoArticulo({ title: null, content: '## Artículo 116\n\n**1.** El estado de *alarma* será declarado por el [Gobierno](https://x.es).' })
    expect(r).not.toMatch(/[*#]/)
    expect(r).not.toContain('https://')
    expect(r).toContain('Gobierno') // el texto del enlace SÍ se conserva
  })

  it('recorta por palabra y solo entonces pone puntos suspensivos', () => {
    const largo = 'palabra '.repeat(60).trim()
    const r = encabezadoArticulo({ title: null, content: largo })!
    expect(r.length).toBeLessThanOrEqual(LARGO_EXTRACTO + 1) // +1 por el «…»
    expect(r.endsWith('…')).toBe(true)
    expect(r).not.toMatch(/pala…$/) // no corta a mitad de palabra
  })

  it('lo que ya cabe NO lleva «…» (decir que hay más cuando no lo hay es mentir)', () => {
    const r = encabezadoArticulo({ title: null, content: 'Artículo breve.' })
    expect(r).toBe('Artículo breve.')
    expect(r!.endsWith('…')).toBe(false)
  })

  it('el título largo NO se recorta aquí: lo trunca el CSS de la tarjeta', () => {
    const t = 'Rúbrica oficial larguísima '.repeat(10).trim()
    expect(encabezadoArticulo({ title: t })).toBe(t)
  })
})

describe('articuloSinTextoVisible — detector y render comparten criterio', () => {
  it('responde exactamente a «encabezadoArticulo devuelve null»', () => {
    const casos = [
      { title: 'x', content: null },
      { title: null, content: 'y' },
      { title: null, content: null },
      { title: '  ', content: '  ' },
    ]
    // Si alguien cambia uno de los dos, esto se pone rojo: es lo que impide que el detector
    // mida una cosa y la página pinte otra.
    for (const c of casos) expect(articuloSinTextoVisible(c)).toBe(encabezadoArticulo(c) === null)
  })
})
