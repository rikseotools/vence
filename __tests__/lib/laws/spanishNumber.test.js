/**
 * @jest-environment node
 */
// Tests del núcleo ÚNICO de conversión de números de artículo en letra.
//
// Contexto (T-132, 26/07/2026): esta lógica estaba copiada en cuatro sitios y las copias
// se separaron. La del scraper llegaba solo hasta "trescientos" y por eso la LOPJ —cuyos
// 713 bloques de artículo van en palabras— quedaba ENTERA fuera de las auditorías contra
// el BOE, con el barrido informando "0 hallazgos" sin haber comprobado nada.

const { spanishTextToNumber } = require('@/lib/laws/spanishNumber')

describe('spanishNumber — lo que ya cubría la versión original (no romper consumidores)', () => {
  it('ordinales 1-9', () => {
    expect(spanishTextToNumber('primero')).toBe('1')
    expect(spanishTextToNumber('séptimo')).toBe('7')
    expect(spanishTextToNumber('noveno')).toBe('9')
  })

  it('decenas compuestas y veintitantos', () => {
    expect(spanishTextToNumber('treinta y cuatro')).toBe('34')
    expect(spanishTextToNumber('veintidós')).toBe('22')
  })

  it('centenas bajas y el ejemplo de su propia documentación', () => {
    expect(spanishTextToNumber('ciento uno')).toBe('101')
    expect(spanishTextToNumber('ciento ochenta y siete bis')).toBe('187 bis')
    expect(spanishTextToNumber('trescientos')).toBe('300')
  })

  it('conserva el sufijo y tolera el punto final', () => {
    expect(spanishTextToNumber('cuarto bis')).toBe('4 bis')
    expect(spanishTextToNumber('quinto.')).toBe('5')
  })

  it('devuelve null ante lo que no es número', () => {
    expect(spanishTextToNumber('preliminar')).toBeNull()
    expect(spanishTextToNumber('')).toBeNull()
    expect(spanishTextToNumber(null)).toBeNull()
  })
})

describe('spanishNumber — el hueco que dejaba ciega a la LOPJ (T-132)', () => {
  it('centenas de 400 a 900, que la copia del scraper no tenía', () => {
    expect(spanishTextToNumber('cuatrocientos')).toBe('400')
    expect(spanishTextToNumber('quinientos doce')).toBe('512')
    expect(spanishTextToNumber('seiscientos treinta y uno')).toBe('631')
    expect(spanishTextToNumber('setecientos trece')).toBe('713')
    expect(spanishTextToNumber('ochocientos')).toBe('800')
    expect(spanishTextToNumber('novecientos noventa y nueve')).toBe('999')
  })

  it('"décimo" y "diez" son ambos 10 (las leyes viejas mezclan ordinal y cardinal)', () => {
    expect(spanishTextToNumber('décimo')).toBe('10')
    expect(spanishTextToNumber('diez')).toBe('10')
  })

  it('no inventa cuando la cola de una centena no es un número', () => {
    expect(spanishTextToNumber('doscientos y pico')).toBeNull()
  })
})
