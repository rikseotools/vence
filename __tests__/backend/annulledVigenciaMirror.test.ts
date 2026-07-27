// Guardarraíl de SYNC: el barrido T-009 del backend lleva un MIRROR INLINE de la lógica pura
// de `lib/laws/boeVigencia.ts` + `lib/laws/annulledProvisions.ts` (el backend es self-contained,
// no importa de ../lib). Si divergen, el cron poblaría vigencia_notes distinto de lo que asume el
// gate de T-048 = bug latente. Este test corre AMBAS versiones sobre el mismo fixture real y exige
// salida idéntica.
import { parseBoeBlock as libParse, getAnnulledFragments as libFrags } from '@/lib/laws/boeVigencia'
import {
  extractTcAnnulments as libExtract,
  parseAnnulledArticles as libArts,
} from '@/lib/laws/annulledProvisions'
import {
  parseBoeBlock as mirParse,
  getAnnulledFragments as mirFrags,
  extractTcAnnulments as mirExtract,
  parseAnnulledArticles as mirArts,
} from '../../backend/src/annulled-vigencia-sweep/vigencia-logic'

// Bloque a58 real de la LO 4/2000 (BOE-A-2000-544) — el mismo fixture que __tests__/laws/boeVigencia.test.ts.
const BLOQUE_REAL = `
  <data>
    <p class="parrafo">6. La devoluci&oacute;n acordada en el p&aacute;rrafo a) del apartado 2 conllevar&aacute; la reiniciaci&oacute;n del c&oacute;mputo del plazo. <strong>Asimismo, toda devoluci&oacute;n acordada en aplicaci&oacute;n del p&aacute;rrafo b) del mismo apartado llevar&aacute; consigo la prohibici&oacute;n de entrada en territorio espa&ntilde;ol por un plazo m&aacute;ximo de tres a&ntilde;os.</strong></p>
    <blockquote>
      <p class="nota_pie">Se modifica el apartado 5 y se a&ntilde;ade el apartado 6 por el art. 1.31 de la Ley Org&aacute;nica 14/2003, de 20 de noviembre. <a class="refPost">Ref. BOE-A-2003-21187</a>.</p>
      <p class="nota_pie_2">Se declara inconstitucional y nulo el inciso destacado del apartado 6 por Sentencia del TC 17/2013, de 31 de enero. <a class="refPost">Ref. BOE-A-2013-2167</a>.</p>
    </blockquote>
  </data>`

const ANALISIS_REAL = {
  data: [
    {
      referencias: {
        posteriores: [
          {
            posterior: [
              {
                id_norma: 'BOE-A-2013-2167',
                relacion: { texto: 'SE DECLARA' },
                texto:
                  'la inconstitucionalidad y nulidad del inciso destacado del art. 58.6, por Sentencia 17/2013, de 31 de enero',
              },
              {
                id_norma: 'BOE-A-2020-1',
                relacion: { texto: 'SE MODIFICA' },
                texto: 'el art. 12 por la Ley Orgánica 2/2020',
              },
            ],
          },
        ],
      },
    },
  ],
}

describe('mirror backend ↔ lib (boeVigencia + annulledProvisions) — MISMA salida', () => {
  it('parseBoeBlock coincide (text, notas, fragmentos destacados)', () => {
    expect(mirParse(BLOQUE_REAL)).toEqual(libParse(BLOQUE_REAL))
  })

  it('getAnnulledFragments coincide y aísla el inciso anulado', () => {
    const l = libFrags(libParse(BLOQUE_REAL))
    const m = mirFrags(mirParse(BLOQUE_REAL))
    expect(m).toEqual(l)
    expect(m).toHaveLength(1)
    expect(m[0]).toMatch(/^Asimismo, toda devolución acordada/)
  })

  it('extractTcAnnulments coincide (solo la anulación del TC, no el "SE MODIFICA")', () => {
    const l = libExtract(ANALISIS_REAL)
    const m = mirExtract(ANALISIS_REAL)
    expect(m).toEqual(l)
    expect(m).toHaveLength(1)
    expect(m[0].articles).toContain('58')
    expect(m[0].sentencia).toBe('STC 17/2013')
  })

  it('parseAnnulledArticles coincide y descarta referencias cruzadas', () => {
    const t = 'la inconstitucionalidad del art. 126.2 y del art. 1.17 de la Ley 27/2013'
    expect(mirArts(t)).toEqual(libArts(t))
    // el artículo se captura a nivel de artículo (sin el apartado ".2"); la referencia
    // cruzada "art. 1.17 de la Ley 27/2013" se descarta por lo que viene tras el número.
    expect(mirArts(t)).toEqual(['126'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// T-169 — TERCER espejo: el CLI `scripts/audit-annulled-provisions.cjs`.
//
// El test de arriba vigilaba lib ↔ backend, pero el script CLI —el que emite el kind
// `article_annulled_unmarked` y por tanto el que enciende el badge— lleva su PROPIA copia
// inline y nadie la comparaba con nada. Se quedó atrás y produjo un falso verde: la Ley
// 38/2003 (24 temas) servía los arts. 7 y 16 con anulación del TC sin nota, y el script
// informaba 0 hallazgos. Arreglar el núcleo no habría cambiado nada mientras el CLI
// siguiera con su copia.
describe('espejo CLI ↔ lib — audit-annulled-provisions (T-169)', () => {
  const cli = require('../../scripts/audit-annulled-provisions.cjs')
  const {
    articleCarriesVigenciaNote: libNote,
    boeBlockRetainsAnnulment: libRetains,
  } = require('@/lib/laws/annulledProvisions')

  const BLOQUES: Array<[string, string]> = [
    ['inline tachado (art. 126.2 LBRL)', '<p>… Declarado inconstitucional y nulo por Sentencia del TC 103/2013</p>'],
    [
      'nota al pie / anulación indirecta (art. 16 Ley 38/2003)',
      '<p class="parrafo">1. Texto.</p><blockquote><p class="nota_pie">Se declara la inconstitucionalidad de la disposición final 11 de la Ley 2/2008, que da redacción al título y a los apartados 5 y 6 de este artículo, por Sentencia TC 206/2013. Ref. BOE-A-2014-223.</p></blockquote>',
    ],
    ['"(Anulado)" a secas (art. 7.1 a) Ley 38/2003)', '<p class="parrafo">a) (Anulado)</p>'],
    [
      'nota al pie competencial (STC 68/2021)',
      '<blockquote><p class="nota_pie">Téngase en cuenta que se declara que el apartado 4 no es conforme con el orden constitucional de competencias, por la Sentencia del TC 68/2021. Ref. BOE-A-2021-6614</p></blockquote>',
    ],
    [
      'artículo reformado y limpio (NO es hallazgo)',
      '<p class="parrafo">1. Texto.</p><blockquote><p class="nota_pie">Se modifica por la disposición final 2 del Real Decreto-ley 7/2013. Ref. BOE-A-2013-7062.</p></blockquote>',
    ],
    ['artículo que solo HABLA de nulidad (NO es hallazgo)', '<p>El matrimonio declarado nulo produce efectos civiles.</p>'],
  ]

  it.each(BLOQUES)('boeBlockRetainsAnnulment coincide: %s', (_caso, bloque) => {
    expect(cli.boeBlockRetainsAnnulment(bloque)).toBe(libRetains(bloque))
  })

  const ARTICULOS: Array<[string, string, any]> = [
    ['marcado en la columna', 'Artículo 607. Los que…', { notes: [{ texto: 'Se declara…', esAnulacion: true }] }],
    ['columna con nota competencial', 'Artículo 72.', { notes: [{ texto: 'no conforme…', esCompetencial: true }] }],
    ['columna con nota que no es del TC', 'Artículo 3.', { notes: [{ texto: 'Se modifica por…', esAnulacion: false }] }],
    ['sin columna, content limpio', 'Artículo 5. Las subvenciones se regirán…', null],
    ['sin columna, nota legacy en el content', '… [Nota de vigencia: inciso declarado nulo por STC 103/2013]', null],
  ]

  it.each(ARTICULOS)('articleCarriesVigenciaNote coincide: %s', (_caso, content, col) => {
    expect(cli.articleCarriesVigenciaNote(content, col)).toBe(libNote(content, col))
  })

  it('el CLI no ejecuta nada al importarlo (no abre BD)', () => {
    expect(typeof cli.boeBlockRetainsAnnulment).toBe('function')
    expect(typeof cli.extractTcAnnulments).toBe('function')
  })
})
