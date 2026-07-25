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
})
