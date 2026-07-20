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
} from '@/lib/laws/annulledProvisions'

// texto REAL de la referencia posterior #73 del análisis BOE de la LBRL (BOE-A-1985-5392)
const TEXTO_126 =
  'en el Recurso 1523/2004, la constitucionalidad del art. 130.1.B) y la inconstitucionalidad y ' +
  'nulidad del inciso indicado del art. 126.2, interpretado segun el FJ 5.j), en la redacción dada ' +
  'por la Ley 57/2003, de 16 de diciembre,  por Sentencia 103/2013, de 25 de abril'

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
})
