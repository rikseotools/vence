/**
 * Detector de incisos anulados por el TC (annulledProvisions). Datos reales del caso
 * que lo originó: art. 126.2 LBRL / STC 103/2013.
 */
import {
  parseAnnulledArticles,
  parseSentencia,
  extractTcAnnulments,
  articleCarriesVigenciaNote,
  assessLawAnnulments,
  boeBlockRetainsAnnulment,
  annulmentAppliesToOriginalWordingOnly,
} from '@/lib/laws/annulledProvisions'

// texto REAL de la referencia posterior #73 del análisis BOE de la LBRL (BOE-A-1985-5392)
const TEXTO_126 =
  'en el Recurso 1523/2004, la constitucionalidad del art. 130.1.B) y la inconstitucionalidad y ' +
  'nulidad del inciso indicado del art. 126.2, interpretado segun el FJ 5.j), en la redacción dada ' +
  'por la Ley 57/2003, de 16 de diciembre,  por Sentencia 103/2013, de 25 de abril'

// texto REAL de la API BOE datosabiertos para el CP (BOE-A-1995-25444), verificado el
// 06/08/2026 — el FP conocido de T-208.
const TEXTO_335_CP =
  ', en la Cuestión 4246/2001, inconstitucional y nulo, en la redacción original, el art. 335, ' +
  'por Sentencia 101/2012, de 8 de mayo'

describe('parseAnnulledArticles', () => {
  it('extrae el art ANULADO (126) y NO el mantenido (130)', () => {
    const arts = parseAnnulledArticles(TEXTO_126)
    expect(arts).toContain('126')
    expect(arts).not.toContain('130')
  })
  it('no casa "inconstitucional" dentro de "constitucionalidad"', () => {
    expect(parseAnnulledArticles('la constitucionalidad del art. 5')).toEqual([])
  })
  it('capta "art. 57 bis" anulado', () => {
    expect(parseAnnulledArticles('inconstitucional y nulo el art. 57 bis')).toContain('57 bis')
  })
  it('NO cae en la referencia cruzada "art. 1.17 de la Ley 27/2013" (otra norma)', () => {
    const t = 'inconstitucional y nulo el art. 57 bis, en la redacción dada por el art. 1.17 de la Ley 27/2013'
    const arts = parseAnnulledArticles(t)
    expect(arts).toContain('57 bis')
    expect(arts).not.toContain('1') // "art. 1.17 de la Ley 27/2013" es cross-ref, no art 1 de esta ley
  })
})

describe('parseSentencia', () => {
  it('extrae STC 103/2013', () => {
    expect(parseSentencia(TEXTO_126)).toBe('STC 103/2013')
  })
})

describe('extractTcAnnulments', () => {
  const analisis = {
    data: [{
      referencias: {
        posteriores: [{
          posterior: [
            { id_norma: 'BOE-A-2013-5446', relacion: { codigo: '470', texto: 'SE DECLARA' }, texto: TEXTO_126 },
            // "SE DECLARA la constitucionalidad" (mantenido) → NO debe salir
            { id_norma: 'BOE-A-2000-1', relacion: { texto: 'SE DECLARA' }, texto: 'la constitucionalidad del art. 5' },
            // una modificación normal (no TC) → NO debe salir
            { id_norma: 'BOE-A-2003-1', relacion: { texto: 'SE MODIFICA' }, texto: 'el art. 126 por Ley 57/2003' },
          ],
        }],
      },
    }],
  }
  it('devuelve solo la anulación real del art 126 con su sentencia', () => {
    const out = extractTcAnnulments(analisis)
    expect(out).toHaveLength(1)
    expect(out[0].articles).toContain('126')
    expect(out[0].sentencia).toBe('STC 103/2013')
    expect(out[0].idNorma).toBe('BOE-A-2013-5446')
  })
  it('tolera análisis vacío', () => {
    expect(extractTcAnnulments({})).toEqual([])
    expect(extractTcAnnulments(null)).toEqual([])
  })
})

describe('articleCarriesVigenciaNote', () => {
  it('TRUE con nuestra nota "[Nota de vigencia: ... STC 103/2013 ...]"', () => {
    const c = '2. Corresponde al Alcalde... [Nota de vigencia: el inciso ... fue declarado inconstitucional y nulo por la STC 103/2013 ...]'
    expect(articleCarriesVigenciaNote(c)).toBe(true)
  })
  it('FALSE con contenido sustantivo que solo MENCIONA constitucionalidad (LOTC)', () => {
    expect(articleCarriesVigenciaNote('El Tribunal podrá declarar inconstitucionales las leyes que...')).toBe(false)
  })
  it('FALSE con "matrimonio declarado nulo" (Código Civil, sin STC)', () => {
    expect(articleCarriesVigenciaNote('El cónyuge de buena fe cuyo matrimonio haya sido declarado nulo...')).toBe(false)
  })
})

describe('boeBlockRetainsAnnulment (v2 — inciso anulado retenido en el consolidado)', () => {
  it('TRUE con el bloque REAL del art 126 (BOE retiene el inciso + nota inline)', () => {
    const bloque = 'Sus derechos económicos y prestaciones sociales serán los de los miembros electivos. ' +
      'Declarado inconstitucional y nulo el inciso destacado del párrafo segundo del apartado 2 por ' +
      'Sentencia del TC 103/2013, de 25 de abril. Ref. BOE-A-2013-5446 . En todo caso, para la válida constitución…'
    expect(boeBlockRetainsAnnulment(bloque)).toBe(true)
  })
  it('FALSE con un artículo reformado (texto limpio, sin nota inline)', () => {
    expect(boeBlockRetainsAnnulment('2. Los efectos del matrimonio se regirán por la ley personal común de los cónyuges…')).toBe(false)
  })
  it('FALSE con contenido sustantivo (LOTC: "podrá declarar inconstitucionales")', () => {
    expect(boeBlockRetainsAnnulment('El Tribunal podrá declarar inconstitucionales por infracción del art. 81 CE las leyes…')).toBe(false)
  })
})

describe('assessLawAnnulments', () => {
  const annul = [{ idNorma: 'BOE-A-2013-5446', sentencia: 'STC 103/2013', articles: ['126'], texto: TEXTO_126 }]
  it('FLAGEA si servimos el art 126 SIN nota', () => {
    const arts = new Map([['126', '2. Corresponde al Alcalde nombrar... a personas que no ostenten la condición de concejales...']])
    const f = assessLawAnnulments(annul, arts)
    expect(f).toHaveLength(1)
    expect(f[0].articleNumber).toBe('126')
    expect(f[0].sentencia).toBe('STC 103/2013')
  })
  it('NO flagea si el art 126 ya lleva la nota', () => {
    const arts = new Map([['126', '2. ... [Nota de vigencia: ... declarado inconstitucional y nulo por la STC 103/2013 ...]']])
    expect(assessLawAnnulments(annul, arts)).toEqual([])
  })
  it('NO flagea si no servimos ese artículo', () => {
    expect(assessLawAnnulments(annul, new Map())).toEqual([])
  })

  // T-208: FP real — art. 335 CP / STC 101/2012, anulación de la "redacción original".
  // Servimos la redacción de la LO 1/2015 (posterior), así que flagearlo era falso positivo.
  it('NO flagea cuando el BOE dice que la anulación fue de la "redacción original" (T-208)', () => {
    const annulRedaccionOriginal = [
      { idNorma: 'BOE-A-2012-7511', sentencia: 'STC 101/2012', articles: ['335'], texto: TEXTO_335_CP },
    ]
    const arts = new Map([['335', 'Será castigado con la pena de multa de ocho a doce meses...']])
    expect(assessLawAnnulments(annulRedaccionOriginal, arts)).toEqual([])
  })
})

describe('annulmentAppliesToOriginalWordingOnly — T-208', () => {
  it('detecta el marcador real del art. 335 CP (STC 101/2012)', () => {
    expect(annulmentAppliesToOriginalWordingOnly(TEXTO_335_CP)).toBe(true)
  })
  it('NO lo detecta en el caso 126.2 LBRL ("redacción DADA POR", no "original")', () => {
    expect(annulmentAppliesToOriginalWordingOnly(TEXTO_126)).toBe(false)
  })
  it('no revienta con texto vacío', () => {
    expect(annulmentAppliesToOriginalWordingOnly('')).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T-132 (26/07/2026) — el parser era ciego a la abreviatura PLURAL y a las enumeraciones.
//
// El BOE escribe las referencias múltiples como "arts. 46.4, 80.2 y 347.3". La versión
// original casaba `artículo`, `artículos`, `art.` y `art`, pero NO `arts.`: tras "art"
// viene una "s" que no es ni punto ni frontera de palabra. Y aunque hubiera casado el
// primero, los siguientes de la lista no llevan prefijo, así que se perdían igual.
//
// Efecto medido: de la referencia de la STC 68/2021 sobre la LCSP no se extraía NI UN
// artículo — y por eso el kind `article_annulled_unmarked` llevaba 0 findings.
describe('parseAnnulledArticles — abreviatura plural y enumeraciones (T-132)', () => {
  const STC_68_2021 =
    ', en el Recurso 4261/2018, la inconstitucionalidad y nulidad de los incisos indicados de los arts. 46.4, 80.2 y 347.3 y no conforme con el orden constitucional de competencias lo indicado, por Sentencia 68/2021, de 18 de marzo'

  it('extrae TODOS los artículos de "arts. 46.4, 80.2 y 347.3"', () => {
    expect(parseAnnulledArticles(STC_68_2021).sort()).toEqual(['347', '46', '80'])
  })

  it('la forma singular abreviada sigue funcionando', () => {
    expect(parseAnnulledArticles('se declara la inconstitucionalidad y nulidad del inciso del art. 126.2')).toEqual(['126'])
  })

  it('la enumeración NO se traga referencias a otra norma', () => {
    expect(parseAnnulledArticles('la nulidad del art. 5 de la Ley 27/2013')).toEqual([])
  })

  it('no inventa artículos cuando la enumeración no es de artículos', () => {
    // "de 18 de marzo" tras la sentencia no debe colarse como artículo 18.
    expect(parseAnnulledArticles('por Sentencia 68/2021, de 18 de marzo')).toEqual([])
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// T-169 (27/07/2026) — el detector daba FALSO VERDE por dos motivos independientes, los
// dos medidos sobre la Ley 38/2003 General de Subvenciones (la sirven 24 temas):
//
//   1. Miraba la nota SOLO dentro de `content`, mientras la herramienta que marca los
//      artículos (`capturar-vigencia-articulo.cjs`, T-048) escribe en la columna
//      `vigencia_notes` y NO toca el `content` a propósito. Marcar bien un artículo no
//      apagaba el aviso; lo único que lo apagaba era contaminar el `content`.
//   2. El filtro v2 exigía que el BOE retuviera el inciso TACHADO con nota inline, que es
//      como se ve el art. 126.2 LBRL. El BOE tiene al menos dos formas más, y con ellas el
//      hallazgo real se descartaba como "artículo ya reformado".
describe('articleCarriesVigenciaNote — la columna vigencia_notes es la fuente canónica (T-169)', () => {
  const CONTENT_LIMPIO = 'Artículo 607. 1. Los que, con propósito de destruir…'

  it('un artículo marcado en vigencia_notes cuenta como marcado (caso CP art. 607)', () => {
    const col = { notes: [{ texto: 'Se declara la inconstitucionalidad y nulidad…', esAnulacion: true }] }
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO, col)).toBe(true)
  })

  it('también cuando la nota es COMPETENCIAL (no es nulidad, pero está anotado)', () => {
    const col = { notes: [{ texto: 'no es conforme con el orden constitucional de competencias', esCompetencial: true }] }
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO, col)).toBe(true)
  })

  it('una nota que NO es pronunciamiento del TC no marca el artículo', () => {
    const col = { notes: [{ texto: 'Se modifica por el art. 45.1 de la Ley 4/2012.', esAnulacion: false, esCompetencial: false }] }
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO, col)).toBe(false)
  })

  it('sin columna sigue valiendo el formato legacy escrito en el content', () => {
    expect(articleCarriesVigenciaNote('… [Nota de vigencia: el inciso fue declarado nulo…]')).toBe(true)
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO)).toBe(false)
  })

  it('columna vacía o nula no rompe ni marca', () => {
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO, null)).toBe(false)
    expect(articleCarriesVigenciaNote(CONTENT_LIMPIO, { notes: [] })).toBe(false)
  })
})

describe('boeBlockRetainsAnnulment — las TRES marcas del BOE, no solo el tachado (T-169)', () => {
  // (1) La que ya funcionaba: inciso tachado + nota inline (art. 126.2 LBRL / STC 103/2013).
  const INLINE = '<p>… <span class="tachado">podrá nombrar…</span> Declarado inconstitucional y nulo por Sentencia del TC 103/2013</p>'

  // (2) Nota al pie: la anulación INDIRECTA del art. 16 de la Ley 38/2003 — lo anulado es la
  //     DF 11ª de la Ley 2/2008, que dio redacción al artículo, así que el cuerpo está limpio.
  const NOTA_PIE = `<p class="parrafo">1. La resolución se dictará…</p>
    <blockquote><p class="nota_pie">Se declara la inconstitucionalidad de la disposición final 11 de la Ley 2/2008, de 23 de diciembre, que da redacción al título y a los apartados 5 y 6 de este artículo, con los efectos establecidos en el fundamento jurídico 3.j), por Sentencia TC 206/2013, de 5 de diciembre. Ref. BOE-A-2014-223.</p></blockquote>`

  // (3) "(Anulado)" a secas: art. 7.1 a) de la Ley 38/2003 / STC 70/2016.
  const ANULADO_SECO = '<p class="parrafo">a) (Anulado)</p><p class="parrafo">b) En los casos distintos…</p>'

  it('caza el inciso tachado con nota inline', () => {
    expect(boeBlockRetainsAnnulment(INLINE)).toBe(true)
  })

  it('caza la anulación declarada en NOTA AL PIE (indirecta, vía norma modificadora)', () => {
    expect(boeBlockRetainsAnnulment(NOTA_PIE)).toBe(true)
  })

  it('caza el apartado sustituido por "(Anulado)"', () => {
    expect(boeBlockRetainsAnnulment(ANULADO_SECO)).toBe(true)
  })

  it('NO marca un artículo reformado y limpio — que es lo que v2 vino a evitar', () => {
    const REFORMADO = `<p class="parrafo">1. Las subvenciones se regirán por esta ley.</p>
      <blockquote><p class="nota_pie">Se modifica por la disposición final 2 del Real Decreto-ley 7/2013, de 28 de junio. Ref. BOE-A-2013-7062.</p></blockquote>`
    expect(boeBlockRetainsAnnulment(REFORMADO)).toBe(false)
  })

  it('NO marca un artículo que solo HABLA de nulidad (LOTC, Código Civil…)', () => {
    expect(boeBlockRetainsAnnulment('<p>El Tribunal podrá declarar inconstitucionales las leyes.</p>')).toBe(false)
    expect(boeBlockRetainsAnnulment('<p>El matrimonio declarado nulo produce efectos civiles.</p>')).toBe(false)
  })

  it('no confunde la palabra "anulado" en prosa con la marca "(Anulado)"', () => {
    expect(boeBlockRetainsAnnulment('<p>El acto anulado no produce efectos.</p>')).toBe(false)
  })
})
