/**
 * @jest-environment node
 */
// Unitarios del modelo del PDF del temario. Importan la función REAL de producción.
// Varios casos vienen de defectos encontrados con datos reales al construirlo (20/07),
// no de escenarios inventados — están marcados donde aplica.
import {
  splitParagraphs, articleHeading, articleLabel, groupArticles, buildLawBlocks,
  pdfFileName, buildTopicPdfModel, countContentChars, fitsSyncPdf, PDF_MAX_CHARS,
} from '@/lib/temario/pdf/topicPdfModel'

const FECHA = new Date('2026-07-20T10:00:00Z')

describe('splitParagraphs', () => {
  it('trocea por saltos de línea y limpia espacios sobrantes', () => {
    expect(splitParagraphs('Uno.\n\n  Dos   con   espacios.\nTres.')).toEqual([
      'Uno.', 'Dos con espacios.', 'Tres.',
    ])
  })
  it('no revienta con contenido vacío o nulo', () => {
    expect(splitParagraphs(null)).toEqual([])
    expect(splitParagraphs('   \n  \n')).toEqual([])
  })
})

describe('articleHeading / articleLabel', () => {
  it('compone "Artículo N. Rúbrica"', () => {
    expect(articleHeading('12', 'Del Pleno')).toBe('Artículo 12. Del Pleno')
  })
  it('respeta identificadores no numéricos (disposiciones, anexos)', () => {
    expect(articleLabel('DD')).toBe('DD')
    expect(articleHeading('decalogo', 'Decálogo')).toBe('decalogo. Decálogo')
  })
  it('no duplica el número si la rúbrica ya lo lleva', () => {
    expect(articleHeading('3', 'Artículo 3. Lealtad')).toBe('Artículo 3. Lealtad')
  })
  it('sin rúbrica, solo el número', () => {
    expect(articleHeading('7', null)).toBe('Artículo 7')
  })
})

describe('groupArticles — defecto real encontrado con el Reglamento del Parlamento', () => {
  // En muchas leyes el campo `title` NO es la rúbrica del artículo sino la RUTA de
  // estructura, idéntica para todo el capítulo. Al maquetar sin agrupar salía:
  //   "Artículo 1. TÍTULO PRELIMINAR. De la sesión constitutiva del Parlamento"
  //   "Artículo 2. TÍTULO PRELIMINAR. De la sesión constitutiva del Parlamento"
  // repetido en cada artículo. Se saca UNA vez como cabecera de grupo.
  it('agrupa artículos consecutivos que comparten rúbrica de estructura', () => {
    const g = groupArticles([
      { articleNumber: '1', title: 'TÍTULO PRELIMINAR. De la sesión constitutiva', body: [{ kind: 'paragraph', spans: [{ text: 'a' }] }] },
      { articleNumber: '2', title: 'TÍTULO PRELIMINAR. De la sesión constitutiva', body: [{ kind: 'paragraph', spans: [{ text: 'b' }] }] },
      { articleNumber: '3', title: 'TÍTULO PRIMERO. De los Diputados', body: [{ kind: 'paragraph', spans: [{ text: 'c' }] }] },
      { articleNumber: '4', title: 'TÍTULO PRIMERO. De los Diputados', body: [{ kind: 'paragraph', spans: [{ text: 'd' }] }] },
    ])
    expect(g).toHaveLength(2)
    expect(g[0].heading).toBe('TÍTULO PRELIMINAR. De la sesión constitutiva')
    expect(g[0].articles.map(a => a.heading)).toEqual(['Artículo 1', 'Artículo 2'])
    expect(g[1].heading).toBe('TÍTULO PRIMERO. De los Diputados')
  })

  it('una rúbrica que NO se repite es del artículo → se fusiona en su encabezado', () => {
    const g = groupArticles([{ articleNumber: '5', title: 'Sentido de la justicia', body: [{ kind: 'paragraph', spans: [{ text: 'x' }] }] }])
    expect(g).toHaveLength(1)
    expect(g[0].heading).toBeNull()
    expect(g[0].articles[0].heading).toBe('Artículo 5. Sentido de la justicia')
  })

  it('artículos sin rúbrica quedan sin cabecera de grupo', () => {
    const g = groupArticles([
      { articleNumber: '1', title: null, body: [{ kind: 'paragraph', spans: [{ text: 'a' }] }] },
      { articleNumber: '2', title: '', body: [{ kind: 'paragraph', spans: [{ text: 'b' }] }] },
    ])
    expect(g.every(x => x.heading === null)).toBe(true)
  })
})

describe('pdfFileName', () => {
  it('produce un nombre seguro y reconocible', () => {
    expect(pdfFileName('subalterno-parlamento-andalucia', 4))
      .toBe('subalterno-parlamento-andalucia-tema-4.pdf')
  })
  it('sanea slugs con caracteres raros', () => {
    expect(pdfFileName('Aux. Admin/Estado', 2)).toBe('aux-admin-estado-tema-2.pdf')
  })
})

describe('buildTopicPdfModel', () => {
  const content: any = {
    topicNumber: 12, title: 'El Parlamento (II)', description: 'Composición y órganos',
    oposicion: 'x', oposicionName: 'Subalternos del Parlamento de Andalucía',
    laws: [{
      law: { id: 'l1', name: 'Reglamento del Parlamento de Andalucía', shortName: 'RPA' },
      articles: [
        { id: 'a1', articleNumber: '1', title: 'CAP I. Constitución', content: 'Uno.' },
        { id: 'a2', articleNumber: '2', title: 'CAP I. Constitución', content: 'Dos.' },
        { id: 'a3', articleNumber: '3', title: null, content: '   ' },  // sin texto útil
      ],
    }],
    totalArticles: 3,
  }

  it('descarta artículos sin texto (no aportan nada al PDF)', () => {
    const m = buildTopicPdfModel(content, FECHA)
    expect(m.totalArticles).toBe(2)
  })

  it('compone título, pie y secciones', () => {
    const m = buildTopicPdfModel(content, FECHA)
    expect(m.title).toBe('Tema 12. El Parlamento (II)')
    expect(m.subtitle).toBe('Composición y órganos')
    expect(m.sections[0].lawName).toBe('Reglamento del Parlamento de Andalucía')
    expect(m.footer).toContain('Subalternos del Parlamento de Andalucía')
    expect(m.footer).toContain('20 de julio de 2026')
  })

  it('es determinista: la fecha se inyecta, no se lee el reloj', () => {
    const a = buildTopicPdfModel(content, FECHA)
    const b = buildTopicPdfModel(content, FECHA)
    expect(a).toEqual(b)
  })

  it('una ley entera sin artículos con texto no genera sección vacía', () => {
    const vacio: any = { ...content, laws: [{ law: content.laws[0].law, articles: [{ id: 'z', articleNumber: '1', title: null, content: null }] }] }
    expect(buildTopicPdfModel(vacio, FECHA).sections).toEqual([])
  })
})

describe('guardarraíl de tamaño — medido con datos reales', () => {
  // El tema más gordo vivo (1.369k chars ≈ 760 págs) no baja de 3 minutos de render →
  // timeout seguro. 300k rinde en ~7 s. El corte en 400k cubre ~96% de los 3.325 temas.
  it('acepta el tamaño típico y rechaza los "artículos-cajón"', () => {
    expect(fitsSyncPdf(150_000)).toBe(true)   // 87% de los temas
    expect(fitsSyncPdf(300_000)).toBe(true)   // p95, ~7 s medidos
    expect(fitsSyncPdf(PDF_MAX_CHARS)).toBe(true)
    expect(fitsSyncPdf(1_369_000)).toBe(false) // el peor tema real
  })

  it('countContentChars suma el texto de todas las leyes del tema', () => {
    expect(countContentChars({
      laws: [
        { articles: [{ content: '12345' }, { content: null }] },
        { articles: [{ content: '123' }] },
      ],
    })).toBe(8)
    expect(countContentChars({})).toBe(0)
  })
})

describe('splitParagraphs — sanea glifos decorativos de import (fix "PPPP")', () => {
  it('elimina líneas de box-drawing (═) — la fuente PDF las pintaba como "P"', () => {
    // CE art 0 traía "…(art. 1.2).\n\n═══════════\n\nESTRUCTURA COMPLETA…"
    const r = splitParagraphs('Texto legal.\n\n═══════════════════\n\nSiguiente apartado.')
    expect(r).toEqual(['Texto legal.', 'Siguiente apartado.'])
  })
  it('quita viñetas/líneas decorativas (─ │ ■ ●) sin tocar el texto legítimo', () => {
    expect(splitParagraphs('a) ● Primero ─ con guía │ y más')).toEqual(['a) Primero con guía y más'])
  })
  it('no toca acentos, ñ, «», §, º ni €', () => {
    expect(splitParagraphs('El artículo 3.º «señala» el 5 % —según la Ley— y el símbolo §.')).toEqual([
      'El artículo 3.º «señala» el 5 % —según la Ley— y el símbolo §.',
    ])
  })
})

describe('buildLawBlocks — cabeceras de estructura Título/Capítulo/Sección', () => {
  const art = (n: string, o: Partial<{ title: string | null; titleNumber: string | null; chapterNumber: string | null; section: string | null }> = {}) =>
    ({ articleNumber: n, title: o.title ?? `Rúbrica ${n}`, titleNumber: o.titleNumber ?? null, chapterNumber: o.chapterNumber ?? null, section: o.section ?? null, body: [{ kind: "paragraph", spans: [{ text: `Cuerpo del ${n}.` }] }] })

  it('emite Título y Capítulo cuando cambian, una sola vez, con el nombre de law_sections', () => {
    const blocks = buildLawBlocks(
      [
        art('14', { titleNumber: 'I', chapterNumber: 'II' }),
        art('15', { titleNumber: 'I', chapterNumber: 'II' }),
        art('16', { titleNumber: 'I', chapterNumber: 'III' }),
      ],
      { titulo: { I: 'Título I. De los derechos y deberes fundamentales' }, capitulo: {} }
    )
    const headings = blocks.filter(b => b.kind === 'heading') as Array<{ level: string; text: string }>
    expect(headings).toEqual([
      { kind: 'heading', level: 'titulo', text: 'Título I. De los derechos y deberes fundamentales' },
      { kind: 'heading', level: 'capitulo', text: 'Capítulo II' },
      { kind: 'heading', level: 'capitulo', text: 'Capítulo III' },
    ])
    // 3 artículos, el Título no se repite entre el cap II y III.
    expect(blocks.filter(b => b.kind === 'article')).toHaveLength(3)
  })

  it('cae al numeral "Título I" si no hay nombre en law_sections', () => {
    const blocks = buildLawBlocks([art('1', { titleNumber: 'I' })])
    expect(blocks[0]).toEqual({ kind: 'heading', level: 'titulo', text: 'Título I' })
  })

  it('emite cabecera de Sección', () => {
    const blocks = buildLawBlocks([art('1', { titleNumber: 'I', section: '1ª' })])
    expect(blocks.some(b => b.kind === 'heading' && (b as any).level === 'seccion' && (b as any).text === 'Sección 1ª')).toBe(true)
  })

  it('un artículo con title_number null (p.ej. el "Art. 0/Estructura") no arrastra cabecera', () => {
    const blocks = buildLawBlocks([art('0', { title: 'Estructura', titleNumber: null })])
    expect(blocks.filter(b => b.kind === 'heading')).toHaveLength(0)
    expect(blocks[0]).toMatchObject({ kind: 'article' })
  })

  it('FALLBACK: ley SIN metadatos de estructura usa la heurística de rúbrica repetida', () => {
    const blocks = buildLawBlocks([
      art('1', { title: 'CAP I. Constitución', titleNumber: null }),
      art('2', { title: 'CAP I. Constitución', titleNumber: null }),
    ])
    // rúbrica compartida en 2 artículos → cabecera de grupo una vez
    expect(blocks.filter(b => b.kind === 'heading')).toEqual([
      { kind: 'heading', level: 'titulo', text: 'CAP I. Constitución' },
    ])
    expect(blocks.filter(b => b.kind === 'article')).toHaveLength(2)
  })
})
