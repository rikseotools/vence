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

  it('detecta los verbos de pertenencia añadidos el 25/07 (beneficiarse, gozar, presumirse)', () => {
    expect(analizarIntruso('¿Cuál de los siguientes vehículos NO se beneficia de la presunción del 100 por 100?')).toBe(true)
    expect(analizarIntruso('Señale el supuesto que NO goza de exención:')).toBe(true)
    expect(analizarIntruso('¿Qué bien NO se presume afecto a la actividad?')).toBe(true)
  })

  it('sigue sin marcar una pregunta directa que contenga esos verbos en positivo', () => {
    expect(analizarIntruso('¿Qué vehículos se benefician de la presunción del 100 por 100?')).toBe(false)
    expect(analizarIntruso('¿Qué supuestos gozan de exención según el artículo 71?')).toBe(false)
  })
})

// --- Diferencia solo ORTOGRÁFICA (25/07/2026) ---
// Caso real: art. 44 Ley 20/1991 — el BOE escribe "periodo" y la opción "período".
// Misma palabra, ambas grafías correctas: no es un defecto de literalidad.

describe('analizarLiteralidad — diferencia solo de tildes', () => {
  const ART = 'La renuncia al régimen simplificado tendrá efecto para un periodo mínimo de tres años, en las condiciones que reglamentariamente se establezcan.'

  it('marca ORTOGRAFIA cuando la cita solo difiere en una tilde', () => {
    const cita = 'Tendrá efecto para un período mínimo de tres años, en las condiciones que reglamentariamente se establezcan.'
    expect(analizarLiteralidad(ART, cita).estado).toBe('ORTOGRAFIA')
  })

  it('sigue dando LITERAL cuando la grafía coincide exactamente', () => {
    const cita = 'tendrá efecto para un periodo mínimo de tres años'
    expect(analizarLiteralidad(ART, cita).estado).toBe('LITERAL')
  })

  it('NO enmascara un cambio de contenido disfrazado de tilde', () => {
    // "cinco" por "tres" no es una cuestión de grafía.
    const cita = 'Tendrá efecto para un período mínimo de cinco años'
    expect(analizarLiteralidad(ART, cita).estado).not.toBe('ORTOGRAFIA')
  })
})
