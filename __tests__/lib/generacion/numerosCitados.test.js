const { numerosCitados } = require('../../../scripts/auditar-batch-input.cjs')

describe('numerosCitados — artículos que cita una explicación (Paso 7)', () => {
  it('reconoce "artículo N" y "art. N"', () => {
    expect(numerosCitados('conforme al artículo 21 de este texto')).toEqual(['21'])
    expect(numerosCitados('es el supuesto del art. 120')).toEqual(['120'])
  })

  it('se queda con el artículo, no con el apartado', () => {
    expect(numerosCitados('el artículo 21.4 lo impone')).toEqual(['21'])
    expect(numerosCitados('previsto en el art. 101.3.b')).toEqual(['101'])
  })

  it('desglosa las enumeraciones ("arts. 16 y 17", "arts. 120, 134 e 135")', () => {
    expect(numerosCitados('los arts. 16 y 17 del texto').sort()).toEqual(['16', '17'])
    expect(numerosCitados('arts. 120, 134 e 135').sort()).toEqual(['120', '134', '135'])
  })

  it('acepta la grafía sin tilde y el plural', () => {
    expect(numerosCitados('el articulo 24 y los articulos 30, 31')).toEqual(['24', '30', '31'])
  })

  it('no duplica el mismo artículo citado varias veces', () => {
    expect(numerosCitados('el artículo 14 dice… y el art. 14 añade…')).toEqual(['14'])
  })

  it('no inventa citas donde solo hay números sueltos', () => {
    expect(numerosCitados('el 50 por 100 de la cuota devengada en 2026')).toEqual([])
    expect(numerosCitados('')).toEqual([])
    expect(numerosCitados(undefined)).toEqual([])
  })

  it('descarta la cita que nombra OTRA norma a continuación', () => {
    expect(numerosCitados('los definidos conforme al apartado 2 del artículo 4 de la Ley 10/2010, de prevención del blanqueo')).toEqual([])
    expect(numerosCitados('el artículo 21 de la Ley Orgánica 8/1980, de Financiación de las CCAA')).toEqual([])
  })

  it('conserva la cita al MISMO cuerpo legal ("de esta ley", "de este Texto Refundido")', () => {
    expect(numerosCitados('la memoria del artículo 17 de este Texto Refundido')).toEqual(['17'])
    expect(numerosCitados('las entidades del artículo 35.4 de esta ley')).toEqual(['35'])
    expect(numerosCitados('conforme al artículo 21.4, el órgano gestor remitirá')).toEqual(['21'])
  })
})
