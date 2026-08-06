const { tieneAbsoluto } = require('@/lib/generacion/absolutosOpcion')

describe('tieneAbsoluto — marcadores de absoluto en el texto de UNA opción', () => {
  it('detecta "únicamente"', () => {
    expect(tieneAbsoluto('cubre únicamente la cláusula principal del documento')).toBe(true)
  })

  it('detecta "solo" como restrictivo ("sólo" con o sin tilde)', () => {
    expect(tieneAbsoluto('solo se exigirá cuando medie autorización previa')).toBe(true)
    expect(tieneAbsoluto('sólo se exigirá cuando medie autorización previa')).toBe(true)
  })

  it('detecta "siempre" pero no "siempre que" (condición, no absoluto)', () => {
    expect(tieneAbsoluto('será siempre parte en el procedimiento')).toBe(true)
    expect(tieneAbsoluto('procederá siempre que concurran los requisitos legales')).toBe(false)
  })

  it('detecta "en exclusiva" y "exclusivamente"', () => {
    expect(tieneAbsoluto('corresponde en exclusiva al órgano competente')).toBe(true)
    expect(tieneAbsoluto('corresponde exclusivamente al órgano competente')).toBe(true)
  })

  it('no marca una opción sin ningún marcador', () => {
    expect(tieneAbsoluto('se tramitará conforme al procedimiento ordinario')).toBe(false)
  })

  it('tolera texto vacío o nulo sin reventar', () => {
    expect(tieneAbsoluto('')).toBe(false)
    expect(tieneAbsoluto(null)).toBe(false)
    expect(tieneAbsoluto(undefined)).toBe(false)
  })
})
