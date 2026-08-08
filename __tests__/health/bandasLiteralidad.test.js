// [T-672] Bucketing puro del histograma de `audit-literalidad-clave.cjs`.
const { BANDAS, bandaDe } = require('@/lib/health/bandasLiteralidad.cjs')

describe('bandaDe', () => {
  it('coloca 0% en la primera banda', () => {
    expect(bandaDe(0)).toBe('0-10')
  })

  it('coloca 100% en la última banda', () => {
    expect(bandaDe(100)).toBe('85-100')
  })

  it('el límite superior de una banda NO pertenece a ella (es de la siguiente)', () => {
    expect(bandaDe(10)).toBe('10-25')
    expect(bandaDe(25)).toBe('25-40')
  })

  it('el límite inferior de una banda SÍ pertenece a ella', () => {
    expect(bandaDe(9)).toBe('0-10')
    expect(bandaDe(24)).toBe('10-25')
  })

  it('cubre las 7 bandas declaradas sin huecos ni solapes', () => {
    expect(BANDAS).toHaveLength(7)
    for (let pct = 0; pct <= 100; pct++) {
      expect(bandaDe(pct)).not.toBe('?')
    }
  })

  it('un valor fuera de rango no revienta (devuelve "?")', () => {
    expect(bandaDe(-1)).toBe('?')
    expect(bandaDe(101)).toBe('?')
  })
})
