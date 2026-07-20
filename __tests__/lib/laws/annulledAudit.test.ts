// __tests__/lib/laws/annulledAudit.test.ts
//
// Orquestación del audit de incisos anulados (T-009): que auditOneLaw combine
// bien la lógica pura (annulledProvisions) con la red (mock de los fetch BOE),
// en v1 y v2. La lógica de PARSEO ya está cubierta en annulledProvisions.test.

import { auditOneLaw, type LawToAudit } from '@/lib/laws/annulledAudit'

const LAW: LawToAudit = {
  id: 'law-1',
  short_name: 'Ley 7/1985 LBRL',
  boe_url: 'https://www.boe.es/eli/es/l/1985/04/02/7/con  BOE-A-1985-5392',
}

// Análisis BOE con una anulación real del TC sobre el art. 126.2.
const analisisConAnulacion = {
  data: [
    {
      referencias: {
        posteriores: [
          {
            posterior: [
              {
                id_norma: 'BOE-A-2013-XXXX',
                relacion: { texto: 'SE DECLARA' },
                texto:
                  'la inconstitucionalidad y nulidad del inciso indicado del art. 126.2, por Sentencia 103/2013, de 25 de abril',
              },
            ],
          },
        ],
      },
    },
  ],
}

const analisisSinAnulacion = { data: [{ referencias: { posteriores: [] } }] }

function depsFor({
  analisis,
  blockText,
  blockMap = new Map([['126', 'a126']]),
}: {
  analisis: any
  blockText?: string | null
  blockMap?: Map<string, string> | null
}) {
  return {
    fetchAnalisis: jest.fn(async () => analisis),
    fetchArticleBlockMap: jest.fn(async () => blockMap),
    fetchBlockText: jest.fn(async () => blockText ?? null),
  }
}

describe('auditOneLaw', () => {
  it('sin boe_url → no analiza', async () => {
    const res = await auditOneLaw({ ...LAW, boe_url: null }, new Map(), {
      deps: depsFor({ analisis: null }),
    })
    expect(res).toEqual({ analysed: false, hasAnnulment: false, findings: [] })
  })

  it('análisis sin anulación → analizada, sin hallazgos', async () => {
    const res = await auditOneLaw(LAW, new Map([['126', 'texto']]), {
      deps: depsFor({ analisis: analisisSinAnulacion }),
    })
    expect(res.analysed).toBe(true)
    expect(res.hasAnnulment).toBe(false)
    expect(res.findings).toHaveLength(0)
  })

  it('no servimos el artículo anulado → sin hallazgo', async () => {
    const res = await auditOneLaw(LAW, new Map([['5', 'otro artículo']]), {
      v2: false,
      deps: depsFor({ analisis: analisisConAnulacion }),
    })
    expect(res.hasAnnulment).toBe(true)
    expect(res.findings).toHaveLength(0)
  })

  it('v1: servimos el artículo sin nota de vigencia → hallazgo', async () => {
    const res = await auditOneLaw(
      LAW,
      new Map([['126', 'Los concejales serán responsables...']]),
      { v2: false, deps: depsFor({ analisis: analisisConAnulacion }) },
    )
    expect(res.findings).toHaveLength(1)
    expect(res.findings[0].article).toBe('126')
    expect(res.findings[0].law_id).toBe('law-1')
    expect(res.findings[0].sentencia).toBe('STC 103/2013')
  })

  it('ya tiene nota de vigencia → NO flaguea', async () => {
    const res = await auditOneLaw(
      LAW,
      new Map([
        [
          '126',
          'Texto... [Nota de vigencia: inciso declarado inconstitucional y nulo por STC 103/2013]',
        ],
      ]),
      { v2: false, deps: depsFor({ analisis: analisisConAnulacion }) },
    )
    expect(res.findings).toHaveLength(0)
  })

  it('v2: el BOE RETIENE el inciso anulado (nota inline) → hallazgo', async () => {
    const res = await auditOneLaw(LAW, new Map([['126', 'texto limpio']]), {
      v2: true,
      deps: depsFor({
        analisis: analisisConAnulacion,
        blockText:
          '<p>...declarado inconstitucional y nulo el inciso ... por Sentencia del Tribunal Constitucional 103/2013</p>',
      }),
    })
    expect(res.findings).toHaveLength(1)
  })

  it('v2: el artículo se reformó (bloque limpio) → falsa alarma, NO flaguea', async () => {
    const res = await auditOneLaw(LAW, new Map([['126', 'texto limpio']]), {
      v2: true,
      deps: depsFor({
        analisis: analisisConAnulacion,
        blockText: '<p>Los concejales serán responsables de los acuerdos...</p>',
      }),
    })
    expect(res.findings).toHaveLength(0)
  })

  it('v2: sin mapa de bloques → conservador, no flaguea', async () => {
    const res = await auditOneLaw(LAW, new Map([['126', 'texto']]), {
      v2: true,
      deps: depsFor({ analisis: analisisConAnulacion, blockMap: null }),
    })
    expect(res.findings).toHaveLength(0)
  })
})
