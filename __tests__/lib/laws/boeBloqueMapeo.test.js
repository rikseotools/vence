/**
 * @jest-environment node
 */
// Tests del mapeo rúbrica→número de artículo del índice del BOE (T-132/T-133).
//
// Cada caso de aquí viene de una ley que se quedó FUERA de la auditoría de vigencia sin
// que nada avisara, informando "0 hallazgos" tras no comprobar nada:
//   · LOPJ (1985): 713 de 713 bloques en LETRA  → "Artículo primero"
//   · Código Civil (1889): 2.028 bloques ABREVIADOS → "Art 1"
//   · LPRL / LO 3/2018: los "N bis" con dígitos    → "Artículo 32 bis"
// El formato de la rúbrica es dato de entrada, no un detalle: si el mapeo no lo entiende,
// la ley entera desaparece del radar en silencio.

const { mapaBloquesPorArticulo } = require('@/lib/laws/boeBloqueVigente')

const indice = (pares) =>
  '<indice>' +
  pares.map(([id, tit]) => `<bloque><id>${id}</id><titulo>${tit}</titulo></bloque>`).join('') +
  '</indice>'

describe('mapaBloquesPorArticulo — los tres formatos que conviven en el corpus', () => {
  it('dígitos: "Artículo 45" (lo que ya funcionaba)', () => {
    expect(mapaBloquesPorArticulo(indice([['a45', 'Artículo 45']]))['45']).toBe('a45')
  })

  it('abreviado sin punto: "Art 1" (Código Civil, 1889)', () => {
    const m = mapaBloquesPorArticulo(indice([['a1', 'Art 1'], ['a1976', 'Art 1976']]))
    expect(m['1']).toBe('a1')
    expect(m['1976']).toBe('a1976')
  })

  it('abreviado con punto: "Art. 12"', () => {
    expect(mapaBloquesPorArticulo(indice([['a12', 'Art. 12']]))['12']).toBe('a12')
  })

  it('en letra: "Artículo primero" / "Artículo doscientos noventa y cuatro" (LOPJ)', () => {
    const m = mapaBloquesPorArticulo(
      indice([['aprimero', 'Artículo primero'], ['a294', 'Artículo doscientos noventa y cuatro']]),
    )
    expect(m['1']).toBe('aprimero')
    expect(m['294']).toBe('a294')
  })

  it('dígitos con sufijo: "Artículo 32 bis" (LPRL, LO 3/2018)', () => {
    expect(mapaBloquesPorArticulo(indice([['a32bis', 'Artículo 32 bis']]))['32 bis']).toBe('a32bis')
  })
})

describe('mapaBloquesPorArticulo — no mapear de más', () => {
  it('no confunde una rúbrica que empieza por "Art" pero no es un artículo', () => {
    const m = mapaBloquesPorArticulo(indice([['x', 'Artes y oficios'], ['y', 'Artículos derogados']]))
    expect(Object.keys(m)).toEqual([])
  })

  it('ignora títulos, capítulos y disposiciones', () => {
    const m = mapaBloquesPorArticulo(
      indice([['t1', 'TÍTULO PRELIMINAR'], ['c1', 'CAPÍTULO I'], ['da1', 'Disposición adicional primera']]),
    )
    expect(Object.keys(m)).toEqual([])
  })

  it('se queda con el PRIMER bloque de un número repetido (no lo pisa)', () => {
    const m = mapaBloquesPorArticulo(indice([['a5', 'Artículo 5'], ['a5dup', 'Artículo 5']]))
    expect(m['5']).toBe('a5')
  })
})
