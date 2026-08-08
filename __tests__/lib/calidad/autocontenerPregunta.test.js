/**
 * T-732 — al anteponer la norma de la que sale la clave, el enunciado tiene que quedar legible.
 * Los casos son reales: salieron reparando las preguntas de residuos sanitarios del banco.
 */
const { componer } = require('../../../scripts/calidad/autocontener-pregunta.cjs')

describe('componer', () => {
  it('quita la coletilla vaga: sin eso el enunciado se contradice consigo mismo', () => {
    const r = componer(
      'Según el Decreto 83/1999 de la Comunidad de Madrid',
      'Los residuos de tipo VI como los citostáticos, ¿en qué tipo de contenedores se recogen, según la normativa vigente?',
    )
    expect(r).toBe('Según el Decreto 83/1999 de la Comunidad de Madrid, los residuos de tipo VI como los citostáticos, ¿en qué tipo de contenedores se recogen?')
    expect(r).not.toMatch(/normativa vigente/)
  })

  it('baja la mayúscula inicial de una palabra corriente', () => {
    expect(componer('Según la normativa de Andalucía', 'Los residuos se recogerán:'))
      .toBe('Según la normativa de Andalucía, los residuos se recogerán:')
  })

  it('NO toca una sigla ni un nombre propio al empezar', () => {
    expect(componer('Según el Decreto X', 'SERMAS aprobará el presupuesto:'))
      .toBe('Según el Decreto X, SERMAS aprobará el presupuesto:')
  })

  it('tolera que el prefijo venga con coma y no la duplica', () => {
    expect(componer('Según el Decreto X,', 'El plazo será:')).toBe('Según el Decreto X, el plazo será:')
  })

  it('no deja espacio suelto antes del signo de cierre', () => {
    expect(componer('Según X', 'El plazo es , conforme a la normativa vigente ?')).not.toMatch(/\s[?]/)
  })
})

describe('arranques vagos: el prefijo los SUSTITUYE, no se acumula', () => {
  it('«Según la norma para el tratamiento de residuos sanitarios,» desaparece', () => {
    const r = componer(
      'Según el Decreto 83/1999 de la Comunidad de Madrid',
      'Según la norma para el tratamiento de residuos sanitarios, los envases de color azul se utilizan para recoger:',
    )
    expect(r).toBe('Según el Decreto 83/1999 de la Comunidad de Madrid, los envases de color azul se utilizan para recoger:')
    expect(r.match(/[Ss]egún/g)).toHaveLength(1)
  })

  it('pero NO se come una norma concreta ya citada', () => {
    const r = componer('Según X', 'Según el artículo 35.2 de la Ley 31/1995, los delegados serán designados por:')
    expect(r).toMatch(/artículo 35\.2/)
  })
})
