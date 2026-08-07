/**
 * @jest-environment node
 */
// Guardarraíl del detector de oposiciones cuyo sensor de notas parece vigilar y no vigila
// (T-311). Los casos numéricos son REALES, medidos contra RDS el 06/08/2026.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  clasificarNotasVigilancia,
  UMBRAL_DIAS_STALE,
} = require('@/lib/convocatoria/notasSinVigilancia.cjs')

describe('clasificarNotasVigilancia', () => {
  it('sin documentos en el corpus → ok, no es un hueco de ESTE detector', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 0, notasCount: 0, diasSinVer: null })
    expect(r.severidad).toBe('ok')
  })

  it('caso real auxiliar-administrativo-madrid: corpus=1, notas=0, nunca vista → error', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 1, notasCount: 0, diasSinVer: null })
    expect(r.severidad).toBe('error')
    expect(r.motivo).toContain('0 notas')
  })

  it('caso real celador-sermas-madrid: 1 nota pero congelada 11.5 días → error (stale, no "notas=0")', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 1, notasCount: 1, diasSinVer: 11.5 })
    expect(r.severidad).toBe('error')
    expect(r.motivo).toContain('días')
  })

  it('caso real auxiliar-administrativo-diputacion-avila: 3 notas, 21.5 días congelada → error', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 3, notasCount: 3, diasSinVer: 21.5 })
    expect(r.severidad).toBe('error')
  })

  it('sensor sano (visto hace <1 día, mediana real de las 103/111 oposiciones sanas) → ok', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 2, notasCount: 5, diasSinVer: 0.6 })
    expect(r.severidad).toBe('ok')
  })

  it('justo por debajo del umbral (3.9 días) → ok; justo en el umbral (4.0) → error', () => {
    expect(
      clasificarNotasVigilancia({ docsCorpus: 1, notasCount: 1, diasSinVer: UMBRAL_DIAS_STALE - 0.1 })
        .severidad,
    ).toBe('ok')
    expect(
      clasificarNotasVigilancia({ docsCorpus: 1, notasCount: 1, diasSinVer: UMBRAL_DIAS_STALE })
        .severidad,
    ).toBe('error')
  })

  it('el único caso de la banda 2-4 días medida (single) no dispara: por debajo del umbral', () => {
    const r = clasificarNotasVigilancia({ docsCorpus: 1, notasCount: 1, diasSinVer: 3.6 })
    expect(r.severidad).toBe('ok')
  })
})
