const { analizarLiteralidad } = require('../../../lib/generacion/literalidad')

describe('analizarLiteralidad', () => {
  const art53 =
    '1. La cuantía y finalidad de los créditos... sólo podrán ser modificadas... mediante: ' +
    'a) Transferencias. b) Generaciones. c) Ampliaciones. ' +
    'd) Créditos extraordinarios y suplementos de crédito. e) Incorporaciones.'

  it('reconoce una cita contigua como LITERAL', () => {
    expect(analizarLiteralidad(art53, 'sólo podrán ser modificadas').estado).toBe('LITERAL')
  })

  it('reconoce una enumeración fiel de la lista como ENUMERACION (caso art. 53)', () => {
    const cita = 'Transferencias, generaciones, ampliaciones, créditos extraordinarios y suplementos de crédito, e incorporaciones.'
    expect(analizarLiteralidad(art53, cita).estado).toBe('ENUMERACION')
  })

  it('marca NO_LITERAL una enumeración con un ítem inventado', () => {
    const cita = 'Transferencias, generaciones, ampliaciones, reasignaciones estructurales, e incorporaciones.'
    const r = analizarLiteralidad(art53, cita)
    expect(r.estado).toBe('NO_LITERAL')
    expect(r.fragmentosNoHallados.some((f) => f.includes('reasignaciones'))).toBe(true)
  })

  it('tolera la puntuación (punto final que falta en el content)', () => {
    expect(analizarLiteralidad('las Transferencias entre créditos', 'las Transferencias entre créditos.').estado).toBe('LITERAL')
  })

  it('marca NO_LITERAL una cita simple que no está en el artículo', () => {
    expect(analizarLiteralidad('El devengo se produce el 31 de diciembre', 'El devengo se produce el 30 de junio').estado).toBe('NO_LITERAL')
  })
})

// --- Marco INTRUSO (25/07/2026) ---
// En "¿cuál NO figura…?" la correcta es la INVENTADA, así que exigirle
// literalidad es un falso positivo garantizado. Caso real: art. 30 Ley 20/1991.
const { analizarIntruso } = require('../../../lib/generacion/literalidad')

describe('analizarIntruso — detección del marco "cuál NO figura"', () => {
  it('detecta el caso real del art. 30 (piedras preciosas)', () => {
    expect(analizarIntruso('A efectos de las exclusiones del derecho a deducir, el artículo 30 enumera qué se consideran piedras preciosas. ¿Cuál de las siguientes NO figura en esa relación?')).toBe(true)
  })

  it('detecta las variantes habituales del marco', () => {
    expect(analizarIntruso('¿Cuál de los siguientes NO se considera documento notarial?')).toBe(true)
    expect(analizarIntruso('Señale la opción que NO forma parte de la enumeración del artículo.')).toBe(true)
    expect(analizarIntruso('¿Cuál de estos derechos NO está entre los que prescriben a los cuatro años?')).toBe(true)
  })

  it('NO marca una pregunta directa aunque su enunciado contenga "no"', () => {
    // El "no" pertenece al supuesto legal, no al marco de la pregunta.
    expect(analizarIntruso('Según el artículo 165.2, el procedimiento se suspenderá cuando el interesado demuestre que la deuda no ha sido ingresada:')).toBe(false)
    expect(analizarIntruso('Conforme al artículo 14, ¿en qué términos se prohíbe la analogía?')).toBe(false)
  })

  it('NO marca enunciados sin negación alguna', () => {
    expect(analizarIntruso('Según el artículo 27.1, ¿qué son los tributos?')).toBe(false)
  })
})
