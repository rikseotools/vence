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

  it('marca RGC sin desarrollar y la acepta con el nombre completo o el RD (T-278, 06/08/2026)', () => {
    expect(analizarSiglas('Según el artículo 45 del RGC, todo conductor...').faltan).toEqual(['RGC'])
    expect(
      analizarSiglas('Según el artículo 45 del Reglamento General de Circulación (RGC), todo conductor...').faltan
    ).toEqual([])
    expect(
      analizarSiglas('Según el artículo 45 del Real Decreto 1428/2003, todo conductor...').faltan
    ).toEqual([])
  })

  // Se coló en el lote de Guardia Civil T17 (T-679) y NINGUNA de las dos auditorías la vio: la
  // explicación decía «los declara la CETIC según el artículo 10» sin desarrollarla antes en esa
  // misma pregunta. El gate falló por partida doble — no estaba catalogada, Y el llamante no le
  // pasaba el campo `explanation`. Por eso el tercer caso de aquí mira la EXPLICACIÓN, no solo el
  // enunciado: catalogarla sin ejercitar esa vía dejaría medio agujero abierto.
  it('marca CETIC sin desarrollar, también cuando aparece solo en la explicación (T-679, 08/08/2026)', () => {
    expect(analizarSiglas('Según el artículo 10, ¿qué declara la CETIC?').faltan).toEqual(['CETIC'])
    expect(
      analizarSiglas('Según el artículo 10, ¿qué declara la Comisión de Estrategia TIC (CETIC)?').faltan
    ).toEqual([])
    // La sigla NO está en el enunciado: solo en la explicación. Es el caso real de T-679.
    expect(
      analizarSiglas('Según el artículo 8, ¿qué determina la Estrategia TIC?',
        'Los proyectos de interés prioritario los declara la CETIC según el artículo 10.').faltan
    ).toEqual(['CETIC'])
    expect(
      analizarSiglas('Según el artículo 8, ¿qué determina la Estrategia TIC?',
        'Los proyectos los declara la Comisión de Estrategia TIC (CETIC) según el artículo 10.').faltan
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

// ── La sigla también cuenta si vive SOLO en las opciones (26/07/2026) ──────────
// Antes solo se miraba el enunciado y se colaron 2 preguntas del lote gen_regage
// con "REG-AGE" únicamente en las opciones (la correcta incluida): ilegibles
// servidas sueltas y barajadas. Lo cazó una auditoría LLM, no el gate.
describe('siglas que solo aparecen en las opciones', () => {
  it('marca la sigla presente solo en las opciones', () => {
    const r = analizarSiglas(
      'Entre los contenidos exigidos al Punto de Acceso General figura:',
      '',
      ['Información de los trámites que anotan en el REG-AGE', 'Otra cosa', 'Otra', 'Otra']
    )
    expect(r.faltan).toContain('REG-AGE')
  })

  it('no la marca si alguna opción o el enunciado la desarrollan', () => {
    expect(
      analizarSiglas('Sobre el Registro Electrónico General de la Administración General del Estado (REG-AGE):', '', [
        'Información de los trámites que anotan en el REG-AGE',
      ]).faltan
    ).toEqual([])
  })

  it('mantiene la excepción: si la respuesta ES la norma, no exige desarrollarla en el enunciado', () => {
    const r = analizarSiglas('¿Qué norma regula el régimen sancionador de los tributos locales?', '', [
      'La Ley General Tributaria',
      'El Código Civil',
      'La Ley 39/2015',
      'La Ley 40/2015',
    ])
    expect(r.faltan).toEqual([])
  })
})
