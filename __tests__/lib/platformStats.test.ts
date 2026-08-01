/**
 * @jest-environment node
 */
// Núcleo puro de las cifras de volumen [T-460].
//
// Lo que se fija aquí es la regla que evita el daño: **nunca prometer de más**. La cifra que
// enseñamos al usuario tiene que ser una que podamos sostener si alguien la cuenta.
import { formatVolumen, MINIMOS_GARANTIZADOS } from '../../lib/api/platform-stats/shared'

describe('formatVolumen — redondeo SIEMPRE a la baja', () => {
  it('nunca devuelve una cifra mayor que la real', () => {
    // La propiedad que de verdad importa, comprobada sobre un barrido amplio.
    for (let n = 100; n < 300000; n += 137) {
      const txt = formatVolumen(n)
      const valor = Number(txt.replace(/[+.]/g, ''))
      expect(valor).toBeLessThanOrEqual(n)
    }
  })

  it('redondea al millar a partir de 10.000', () => {
    expect(formatVolumen(145206)).toBe('+145.000')
    expect(formatVolumen(138108)).toBe('+138.000')
  })

  it('redondea al centenar por debajo de 10.000', () => {
    // OJO con el separador: en español los números de CUATRO cifras no lo llevan («7000»), y a
    // partir de cinco sí («145.000»). Es la regla `minimumGroupingDigits=2` del CLDR español, que
    // `toLocaleString('es-ES')` aplica sola. La primera versión de este test esperaba «+7.000» y el
    // equivocado era el test, no el código.
    expect(formatVolumen(7098)).toBe('+7000')
    expect(formatVolumen(1720)).toBe('+1700')
  })

  it('las cifras pequeñas se dan tal cual: «+100» sonaría a redondeo inventado', () => {
    expect(formatVolumen(99)).toBe('99')
    expect(formatVolumen(24)).toBe('24')
  })

  it('no se queda corto de forma absurda: pierde menos de un paso de redondeo', () => {
    const n = 145206
    const valor = Number(formatVolumen(n).replace(/[+.]/g, ''))
    expect(n - valor).toBeLessThan(1000)
  })
})

describe('mínimos garantizados', () => {
  it('son DEFENSIVAMENTE BAJOS: si la BD falla, no prometemos de más', () => {
    // Medido el 01/08/2026: 145.206 preguntas · 124 oposiciones. Los mínimos quedan por debajo a
    // propósito, para que un fallo de consulta jamás produzca una cifra que no podamos sostener.
    expect(MINIMOS_GARANTIZADOS.preguntas).toBeLessThan(145206)
    expect(MINIMOS_GARANTIZADOS.oposiciones).toBeLessThan(124)
    expect(MINIMOS_GARANTIZADOS.leyes).toBeLessThan(200)
  })

  it('pero no ridículos: siguen siendo ciertos y presentables', () => {
    expect(MINIMOS_GARANTIZADOS.preguntas).toBeGreaterThanOrEqual(100000)
    expect(MINIMOS_GARANTIZADOS.oposiciones).toBeGreaterThanOrEqual(100)
  })
})
