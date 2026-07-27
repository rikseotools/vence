// Tests del núcleo puro que extrae un artículo del CONSOLIDADO de EUR-Lex.
//
// Cada caso corresponde a un error REAL cometido el 27/07/2026 al medir el RGPD (T-184). Los tres
// primeros inflaban la divergencia: el primero llegó a dar **0 de 99** artículos coincidentes, lo
// que casi lleva a reescribir la ley entera desde la fuente equivocada.

const {
  articuloDeEurLex,
  esIdEurLex,
  esCelexNoConsolidado,
  urlEurLex,
  limpiar,
} = require('../../../lib/laws/eurlexConsolidado')

// Fragmento con la MISMA forma que sirve EUR-Lex: anclaje `id="art_N"`, rúbrica en un <p>,
// sub-anclajes con punto, marcas de consolidación y un `n.<sup>o</sup>`.
const HTML = `
<div class="eli-subdivision" id="art_1">
  <p class="title-article-norm">Artículo&nbsp;1</p>
  <div class="eli-title" id="art_1.tit_1"><p class="stitle-article-norm">Objeto</p></div>
  <p class="norm">1. El presente Reglamento establece las normas.</p>
  <p class="norm">▼B 2. El Reglamento (CE) n.<sup>o</sup> 45/2001 es de aplicación.</p>
  <p class="norm">3. El Reglamento (CE) n.<span class="superscript">o</span>&nbsp;1049/2001 también.</p>
</div>
<div class="eli-subdivision" id="art_2">
  <p class="title-article-norm">Artículo&nbsp;2</p>
  <div class="eli-title" id="art_2.tit_1"><p class="stitle-article-norm">Ámbito</p></div>
  <p class="norm">1. Texto del segundo.</p>
</div>`

describe('articuloDeEurLex — las tres trampas que dieron números falsos', () => {
  it('poda la rúbrica «Artículo N» + título: en la BD eso vive en `title`, no en `content`', () => {
    const a = articuloDeEurLex(HTML, 1, 'Objeto')
    expect(a.texto.startsWith('1. El presente Reglamento')).toBe(true)
    expect(a.texto).not.toMatch(/Art[íi]culo/)
    expect(a.texto).not.toMatch(/^Objeto/)
  })

  it('no arrastra la etiqueta a medio cerrar del artículo siguiente', () => {
    // El troceo corta en el índice de `id="art_2"`, que cae DENTRO de `<div class="eli-subdivision`.
    const a = articuloDeEurLex(HTML, 1, 'Objeto')
    expect(a.texto).not.toMatch(/eli-subdivision|<div|class=/)
    expect(a.texto.endsWith('también.')).toBe(true) // último párrafo del art. 1, nada del art. 2
  })

  it('desenvuelve `n.<sup>o</sup>` → «n.o», no «n. o»', () => {
    const a = articuloDeEurLex(HTML, 1, 'Objeto')
    expect(a.texto).toContain('n.o 45/2001')
    expect(a.texto).not.toContain('n. o 45/2001')
    // EUR-Lex NO usa <sup> sino <span class="superscript">: dar por hecha la otra forma produjo
    // una divergencia FALSA en el art. 2 del RGPD.
    expect(a.texto).toContain('n.o 1049/2001')
    expect(a.texto).not.toContain('n. o 1049/2001')
  })

  it('borra las marcas de consolidación (▼B, ▼M1, ►C1)', () => {
    expect(articuloDeEurLex(HTML, 1, 'Objeto').texto).not.toMatch(/[▼►]/)
    expect(limpiar('▼M1 texto ►C1 más')).toBe('texto más')
  })

  it('no confunde el artículo con su sub-anclaje (`art_1.tit_1`)', () => {
    // Si el corte se hiciera en el primer `id="art_1…"` posterior, el cuerpo saldría vacío.
    expect(articuloDeEurLex(HTML, 1, 'Objeto').texto.length).toBeGreaterThan(40)
  })

  it('extrae el artículo siguiente sin llevarse el anterior', () => {
    const a = articuloDeEurLex(HTML, 2, 'Ámbito')
    expect(a.texto).toBe('1. Texto del segundo.')
  })

  it('devuelve null si el artículo no está', () => {
    expect(articuloDeEurLex(HTML, 99, 'X')).toBeNull()
  })

  it('sin rúbrica conocida no rompe (solo poda el «Artículo N»)', () => {
    expect(articuloDeEurLex(HTML, 2).texto.startsWith('Ámbito')).toBe(true)
  })
})

describe('identificación del id de fuente', () => {
  it('reconoce el CELEX consolidado, con y sin prefijo', () => {
    expect(esIdEurLex('CELEX:02016R0679-20160504')).toBe(true)
    expect(esIdEurLex('02016R0679-20160504')).toBe(true)
    expect(esIdEurLex('32016R0679')).toBe(true)
  })

  it('NO reconoce un id del BOE', () => {
    expect(esIdEurLex('DOUE-L-2016-80807')).toBe(false)
    expect(esIdEurLex('BOE-A-1995-24292')).toBe(false)
  })

  // El sector 3 es el acto tal como se publicó: para el RGPD, el que trae la errata
  // «las orientación sexuales». El 0 es el consolidado, que incorpora las correcciones.
  it('distingue el acto ORIGINAL (3…) del CONSOLIDADO (0…)', () => {
    expect(esCelexNoConsolidado('32016R0679')).toBe(true)
    expect(esCelexNoConsolidado('CELEX:02016R0679-20160504')).toBe(false)
  })

  it('construye la URL de EUR-Lex en español', () => {
    expect(urlEurLex('CELEX:02016R0679-20160504')).toBe(
      'https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:02016R0679-20160504',
    )
    expect(urlEurLex('02016R0679-20160504')).toContain('CELEX:02016R0679-20160504')
  })
})
