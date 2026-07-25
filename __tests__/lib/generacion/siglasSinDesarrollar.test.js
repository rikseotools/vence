const { analizarSiglas } = require('../../../lib/generacion/siglasSinDesarrollar')

describe('analizarSiglas (§2.2-quater: pregunta autocontenida)', () => {
  it('marca la sigla del diccionario usada sin desarrollar', () => {
    const r = analizarSiglas('A efectos del IGIC, ¿qué se entiende por entrega de bienes?')
    expect(r.faltan).toEqual(['IGIC'])
  })

  it('no marca la sigla si el enunciado la desarrolla', () => {
    const r = analizarSiglas('A efectos del Impuesto General Indirecto Canario (IGIC), ¿qué...?')
    expect(r.faltan).toEqual([])
  })

  it('acepta el desarrollo en la explicación (también es texto visible)', () => {
    const r = analizarSiglas(
      'A efectos del IGIC, ¿qué...?',
      'El Impuesto General Indirecto Canario grava las entregas de bienes.'
    )
    expect(r.faltan).toEqual([])
  })

  it('marca LPRL sin desarrollar y la acepta con el nombre completo (lote gen_lprl, 26/07/2026)', () => {
    expect(analizarSiglas('Según el artículo 39 de la LPRL, el Comité...').faltan).toEqual(['LPRL'])
    expect(
      analizarSiglas('Según el artículo 39 de la Ley 31/1995, de Prevención de Riesgos Laborales (LPRL), el Comité...').faltan
    ).toEqual([])
  })

  it('acepta el número de la norma como desarrollo (Ley 58/2003 ≡ LGT)', () => {
    const r = analizarSiglas('Según el artículo 1 de la Ley 58/2003, la LGT establece que...')
    expect(r.faltan).toEqual([])
  })

  it('no marca las siglas universales de la allowlist', () => {
    const r = analizarSiglas('El artículo 31 de la CE y el TFUE consagran que...')
    expect(r.faltan).toEqual([])
  })

  it('excepción: no exige desarrollar cuando la respuesta ES la propia norma', () => {
    const r = analizarSiglas(
      '¿Qué norma regula el IGIC?',
      '',
      ['La Ley 20/1991 del Impuesto General Indirecto Canario.', 'El Código Civil.', 'La Ley 58/2003.', 'El Estatuto de Autonomía.']
    )
    expect(r.faltan).toEqual([])
  })

  it('detecta varias siglas a la vez', () => {
    const r = analizarSiglas('El AIEM y el IGIC se liquidan conforme a la LGT.')
    expect(r.faltan.sort()).toEqual(['AIEM', 'IGIC', 'LGT'])
  })

  it('propone como candidata la sigla desconocida que va tras artículo', () => {
    const r = analizarSiglas('Según el artículo 3 de la Ley reguladora del ISD, la base imponible...')
    expect(r.candidatas).toContain('ISD')
    expect(r.faltan).toEqual([])
  })

  it('NO confunde las mayúsculas enfáticas con siglas (no van tras artículo)', () => {
    const r = analizarSiglas('Señale cuál NO es una infracción MUY GRAVE conforme a la Ley 58/2003:')
    expect(r.candidatas).toEqual([])
    expect(r.faltan).toEqual([])
  })

  it('no duplica una candidata repetida', () => {
    const r = analizarSiglas('El ISD y del ISD y al ISD.')
    expect(r.candidatas).toEqual(['ISD'])
  })

  it('tolera entradas vacías', () => {
    expect(analizarSiglas('')).toEqual({ faltan: [], candidatas: [] })
    expect(analizarSiglas(undefined, undefined, undefined)).toEqual({ faltan: [], candidatas: [] })
  })
})
