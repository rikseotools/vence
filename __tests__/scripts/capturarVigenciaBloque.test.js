/**
 * Guardarraíl de la selección de BLOQUE en `capturar-vigencia-articulo.cjs` (T-169).
 *
 * El script escribe `articles.vigencia_notes` a partir del bloque que el BOE devuelve para
 * un artículo. Elegir el bloque equivocado no da error: escribe la nota de OTRO precepto y
 * el dato queda mal para siempre, con apariencia de éxito.
 *
 * Caso real que lo motivó: se probaba `a<N>` ANTES que el mapa de rúbricas, y en el Código
 * Civil el bloque `a9` es el «Artículo 94 bis» — el art. 9 vive en `art9`, porque el CC
 * rotula «Art 9». Se iba a capturar sobre el art. 9 (34 preguntas activas) la nota de otro
 * artículo. Se detectó ANTES de escribir, comparando el id del mapa con el del fallback.
 */
const { seleccionarBloque, esDelArticulo } = require('../../scripts/capturar-vigencia-articulo.cjs')

// Índice recortado del Código Civil (BOE-A-1889-4763), con los ids reales.
const BLOQUES_CC = [
  { id: 'a1', tit: 'Art 1' },
  { id: 'art9', tit: 'Art 9' },
  { id: 'a9', tit: 'Artículo 94 bis' }, // ← la trampa
  { id: 'art92', tit: 'Art 92' },
]
const MAPA_CC = { 1: 'a1', 9: 'art9', 92: 'art92', '94 bis': 'a9' }

describe('seleccionarBloque — el mapa manda, a<N> es el último recurso', () => {
  it('elige el bloque del artículo pedido aunque exista un a<N> que es OTRO artículo', () => {
    const { bloque, via } = seleccionarBloque(BLOQUES_CC, MAPA_CC, '9')
    expect(bloque.id).toBe('art9')
    expect(via).toBe('mapa')
    expect(bloque.id).not.toBe('a9') // el fallback viejo: «Artículo 94 bis»
  })

  it('sigue funcionando cuando el id SÍ es a<N> (la mayoría de leyes)', () => {
    const bloques = [{ id: 'a7', tit: 'Artículo 7. Responsabilidad financiera' }]
    expect(seleccionarBloque(bloques, { 7: 'a7' }, '7').bloque.id).toBe('a7')
  })

  it('cae a la rúbrica cuando el mapa no trae el artículo', () => {
    expect(seleccionarBloque(BLOQUES_CC, {}, '92').bloque.id).toBe('art92')
  })

  it('devuelve null si no hay nada que se le parezca', () => {
    expect(seleccionarBloque(BLOQUES_CC, {}, '404').bloque).toBeNull()
  })

  it('resuelve los sufijos con espacio como los numera nuestra BD ("504 bis")', () => {
    const bloques = [{ id: 'a504', tit: 'Artículo 504' }, { id: 'a504bis', tit: 'Artículo 504 bis' }]
    expect(seleccionarBloque(bloques, { '504 bis': 'a504bis' }, '504 bis').bloque.id).toBe('a504bis')
    // y sin mapa, por rúbrica, sin confundirse con el 504 a secas
    expect(seleccionarBloque(bloques, {}, '504 bis').bloque.id).toBe('a504bis')
  })
})

describe('esDelArticulo — la guarda que impide escribir la nota de otro precepto', () => {
  it('acepta las dos rúbricas que usa el BOE', () => {
    expect(esDelArticulo({ tit: 'Artículo 16. Convenio de colaboración.' }, '16')).toBe(true)
    expect(esDelArticulo({ tit: 'Art 92' }, '92')).toBe(true)
  })

  it('rechaza el artículo VECINO aunque empiece igual', () => {
    expect(esDelArticulo({ tit: 'Artículo 94 bis' }, '9')).toBe(false)
    expect(esDelArticulo({ tit: 'Artículo 160' }, '16')).toBe(false)
  })

  it('rechaza una rúbrica que no es un artículo', () => {
    expect(esDelArticulo({ tit: 'CAPÍTULO II. De las subvenciones' }, '9')).toBe(false)
    expect(esDelArticulo({ tit: '' }, '9')).toBe(false)
  })
  // Las leyes antiguas numeran en LETRA y el mapa ya las resuelve; exigir además que la
  // rúbrica lleve el dígito abortaba capturas correctas (8 de 42: LOFCS art. 8 con 24
  // preguntas activas, LOREG art. 197…). Por eso la guarda de rúbrica NO se aplica al mapa.
  it('confía en el mapa cuando la rúbrica va en letra ("Artículo octavo" = art. 8)', () => {
    const bloques = [{ id: 'aoctavo', tit: 'Artículo octavo' }]
    const r = seleccionarBloque(bloques, { 8: 'aoctavo' }, '8')
    expect(r.bloque.id).toBe('aoctavo')
    expect(r.via).toBe('mapa')
    expect(esDelArticulo(r.bloque, '8')).toBe(false) // la rúbrica NO lleva el dígito
  })
})
