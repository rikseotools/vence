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

  it('reconoce el marco por verbos de PREVISIÓN normativa (se prevé, se contempla, se admite)', () => {
    expect(analizarIntruso('¿En cuál de los siguientes momentos NO se prevé que puedan devengarse las tasas?')).toBe(true)
    expect(analizarIntruso('Señale el supuesto que NO se contempla en el artículo:')).toBe(true)
    expect(analizarIntruso('¿Qué medio de pago NO se admite conforme al precepto?')).toBe(true)
  })

  // --- Verbos de ATRIBUCIÓN (26/07/2026) ---
  // El enunciado formula el intruso desde el precepto que reparte funciones.
  // Caso real: batch `gen_lprl_coord_2026-07-26`, art. 10 LPRL — el gate lo daba
  // NO_LITERAL en falso porque "no atribuye" no estaba en el diccionario.
  it('reconoce el marco de ATRIBUCIÓN cuando hay marco de selección explícito', () => {
    expect(
      analizarIntruso(
        'Señale la actuación que el artículo 10 de la Ley 31/1995, de 8 de noviembre, de Prevención de Riesgos Laborales (LPRL), NO atribuye a las Administraciones públicas competentes en materia sanitaria:',
      ),
    ).toBe(true)
    expect(analizarIntruso('¿Cuál de las siguientes competencias NO corresponde al Comité de Seguridad y Salud?')).toBe(true)
    expect(analizarIntruso('Indique la facultad que el precepto NO confiere a los Delegados de Prevención:')).toBe(true)
  })

  it('NO exenta un verbo de atribución SIN marco de selección (evita el falso negativo)', () => {
    // Aquí la correcta sí debe ser cita literal: exentarla dejaría pasar una
    // cita alterada, que es el error caro.
    expect(analizarIntruso('Según la disposición adicional tercera, la Ley no atribuye carácter básico a este precepto, sino que:')).toBe(false)
    expect(analizarIntruso('Conforme al artículo 11, la coordinación no corresponde en exclusiva a una sola Administración porque:')).toBe(false)
  })

  it('NO marca el marco INVERSO "elija la opción correcta" aunque lleve negación', () => {
    expect(analizarIntruso('Señale la opción correcta: el artículo no atribuye esa función a la autoridad sanitaria.')).toBe(false)
    expect(analizarIntruso('Indique la afirmación verdadera sobre lo que la ley no reconoce a las Mutuas.')).toBe(false)
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

// --- resolverMarco: el marco se decide por EVIDENCIA, no por redacción (26/07/2026) ---
//
// `analizarIntruso` mira la forma de la frase y se equivoca en las dos direcciones.
// El caso que obligó a esto: art. 5.1 RDL 1/1993 (batch gen_atc_t223_2026-07-26_s26c).
// El enunciado CITA la negación de la propia ley y pide completarla, así que la pista
// dispara; pero es una pregunta DIRECTA cuya correcta sí es cita literal. Con el marco
// mal elegido el gate (a) exigía literalidad a los distractores inventados → rojo
// absurdo, y (b) daba por buena la cita de la correcta SIN comprobarla.
//
// Endurecer el regex de la pista NO era la salida: medido sobre el banco real (17.468
// preguntas con negación en el enunciado), exigir marco de selección explícito volvía a
// marcar 438 intrusos legítimos, porque las redacciones del banco no siguen plantilla
// ("EUROPOL. Indique cual NO forma parte de sus objetivos").
const { resolverMarco } = require('../../../lib/generacion/literalidad')

describe('resolverMarco — la evidencia desmiente la pista', () => {
  const ART_5_1 =
    'Los bienes y derechos transmitidos quedarán afectos, cualquiera que sea su poseedor, a la responsabilidad del pago de los impuestos que graven tales transmisiones, salvo que aquél resulte ser un tercero protegido por la fe pública registral. No se considerará protegido por la fe pública registral el tercero cuando en el Registro conste expresamente la afección.'

  it('el caso raíz: pista de intruso pero la correcta ES cita → DIRECTA', () => {
    const enunciado =
      'El artículo 5.1 precisa cuándo el tercero deja de estar amparado. Según el precepto, no se considerará protegido por la fe pública registral el tercero:'
    const opciones = [
      'cuando en el Registro conste expresamente la afección', // literal
      'cuando hubiera adquirido los bienes a título gratuito',
      'cuando el impuesto esté pendiente de liquidación',
      'cuando no hubiera inscrito su adquisición en un año',
    ]
    const r = resolverMarco(ART_5_1, opciones, 0, enunciado)
    expect(analizarIntruso(enunciado)).toBe(true) // la pista SÍ dispara…
    expect(r.pista).toBe(true)
    expect(r.marco).toBe('DIRECTA') // …y la evidencia la desmiente
    expect(r.literalidadCorrecta.estado).toBe('LITERAL')
    expect(r.motivo).toMatch(/DESMENTIDA/)
  })

  it('un intruso GENUINO conserva su marco (la correcta es la inventada)', () => {
    const enunciado = '¿Cuál de los siguientes NO figura entre los supuestos del artículo?'
    const opciones = [
      'la responsabilidad del pago de los impuestos que graven tales transmisiones', // literal
      'un tercero protegido por la fe pública registral', // literal
      'cuando en el Registro conste expresamente la afección', // literal
      'la exención de los bienes gananciales inscritos en el Registro Mercantil', // inventada
    ]
    const r = resolverMarco(ART_5_1, opciones, 3, enunciado)
    expect(r.marco).toBe('INTRUSO')
    expect(r.distractoresNoLiterales).toEqual([]) // los tres literales
  })

  it('delata el intruso mal construido: distractores que no son del artículo', () => {
    const enunciado = '¿Cuál de los siguientes NO figura entre los supuestos del artículo?'
    const opciones = [
      'la responsabilidad del pago de los impuestos que graven tales transmisiones', // literal
      'la obligación de aportar aval bancario ante la oficina liquidadora', // inventada
      'el deber de inscribir la escritura en el plazo de treinta días', // inventada
      'la exención de los bienes gananciales', // la "correcta"
    ]
    const r = resolverMarco(ART_5_1, opciones, 3, enunciado)
    expect(r.marco).toBe('INTRUSO')
    expect(r.distractoresNoLiterales).toEqual([1, 2])
  })

  it('sin pista, el marco es DIRECTA y la literalidad de la correcta se reporta', () => {
    const r = resolverMarco(ART_5_1, ['la responsabilidad del pago de los impuestos', 'x', 'y', 'z'], 0,
      'Según el artículo 5.1, los bienes transmitidos quedan afectos a:')
    expect(r.marco).toBe('DIRECTA')
    expect(r.pista).toBe(false)
    expect(r.literalidadCorrecta.estado).toBe('LITERAL')
  })

  it('no revienta con entradas degeneradas', () => {
    expect(resolverMarco('', [], 0, '').marco).toBe('DIRECTA')
    expect(resolverMarco(ART_5_1, null, 0, null).marco).toBe('DIRECTA')
  })
})
