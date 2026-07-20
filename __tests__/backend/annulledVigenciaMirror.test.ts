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
