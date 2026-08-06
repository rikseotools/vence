/**
 * @jest-environment node
 */
// Tests del núcleo de SIMULACIÓN PRE-INSERCIÓN de batches generados.
//
// El caso que motiva este fichero (26/07/2026) es el bloque "contrato de los núcleos":
// la primera versión del simulador llamó a los cinco analizadores existentes asumiendo
// que todos devolvían `{ok:boolean}`. En realidad `analizarLiteralidad` y `analizarCita`
// devuelven `{estado}` y `analizarLongitud` devuelve `{tell}`. Como `undefined` es falsy,
// `!res.ok` daba true SIEMPRE → 12 de 12 preguntas marcadas como rotas, incluida una que
// era copia verbatim del artículo. Un fallo de contrato entre módulos no se ve leyendo el
// código; se ve con una pregunta buena que DEBE pasar limpia. Ese es el primer test.

const {
  analizarPregunta,
  analizarLote,
  analizarValidezLote,
  analizarDuplicados,
  claveDe,
  clausulaEnEnunciado,
  normalizarPregunta,
  camposParaInsertar,
  jaccard,
} = require('@/lib/generacion/simularBatch')

// Artículo real (art. 6.b TRLRHL) — se usa como base para construir casos.
const ART_6B =
  'Los tributos que establezcan las entidades locales al amparo de lo dispuesto en el artículo 106.1 de la Ley 7/1985, de 2 de abril, Reguladora de las Bases del Régimen Local, respetarán, en todo caso, los siguientes principios:\n\n' +
  'b) No gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora, ni el ejercicio o la transmisión de bienes, derechos u obligaciones que no hayan nacido ni hubieran de cumplirse en dicho territorio.'

const CORRECTA_6B =
  'No gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora, ni el ejercicio o la transmisión de bienes, derechos u obligaciones que no hayan nacido ni hubieran de cumplirse en dicho territorio.'

/** Pregunta bien formada: correcta literal, 3 distractores de longitud pareja, cabecera coherente. */
function preguntaBuena(overrides = {}) {
  return {
    law_slug: 'rdl-2-2004',
    primary_article_number: '6',
    question_text:
      'Según el artículo 6.b) del texto refundido de la Ley Reguladora de las Haciendas Locales (TRLRHL), los tributos locales respetarán el principio de:',
    option_a: CORRECTA_6B,
    option_b: CORRECTA_6B.replace('fuera del territorio de la Entidad impositora', 'dentro del territorio de la Entidad impositora'),
    option_c: CORRECTA_6B.replace('de la Entidad impositora', 'de la comunidad autónoma'),
    option_d: CORRECTA_6B.replace('que no hayan nacido ni hubieran', 'que hayan nacido o hubieran'),
    correct_option: 0,
    explanation:
      '> **Art. 6.b) TRLRHL**\n> "' + CORRECTA_6B + '"\n\n**Por qué A es correcta:** transcribe la letra b) completa.\n\n**Por qué las demás son incorrectas:**\n- **B)** cambia fuera por dentro.\n- **C)** cambia la entidad por la comunidad autónoma.\n- **D)** invierte el segundo inciso.',
    ...overrides,
  }
}

describe('simularBatch — contrato de los núcleos (regresión del bug de integración)', () => {
  it('una pregunta VERBATIM del artículo y bien construida NO produce ningún error', () => {
    const { errores } = analizarPregunta(preguntaBuena(), ART_6B)
    expect(errores).toEqual([])
  })

  it('tampoco produce avisos de literalidad: la correcta está literal en el artículo', () => {
    const { avisos } = analizarPregunta(preguntaBuena(), ART_6B)
    expect(avisos.filter((a) => a.includes('literalidad'))).toEqual([])
  })
})

// ── PARIDAD DE SEVERIDAD CON EL GATE DE BD (26/07/2026) ──
// `verificar-batch-generado.cjs` trata NO_LITERAL como "defecto duro" (❌) y aquí era un
// AVISO. Ese descuadre vaciaba de sentido al simulador: dio «Limpio para insertar» a
// `gen_atc_t204_2026-07-26_s26c` con 5 NO_LITERAL en amarillo y, ya insertadas las 14 en BD,
// el gate de BD las tumbó (9/14) → 5 preguntas reescritas EN BD en vez de en el borrador.
// El simulador solo sirve si adelanta el MISMO veredicto.
describe('simularBatch — NO_LITERAL bloquea, en paridad con verificar-batch-generado', () => {
  // Condensación fiel del art. 6.b): reordena y resume sin añadir nada ajeno. Es
  // exactamente el caso que antes pasaba en amarillo.
  const CONDENSADA = 'No gravar negocios, actos o hechos realizados fuera del territorio de la Entidad impositora'

  it('una clave que condensa el artículo (sin ser subcadena literal) es ERROR, no aviso', () => {
    const r = analizarPregunta(preguntaBuena({ option_a: CONDENSADA }), ART_6B)
    expect(r.errores.some((e) => /NO_LITERAL/.test(e))).toBe(true)
    expect(r.avisos.some((a) => /NO_LITERAL/.test(a))).toBe(false)
  })

  it('el error dice qué hacer: anclar la clave al texto, no adjudicar', () => {
    const r = analizarPregunta(preguntaBuena({ option_a: CONDENSADA }), ART_6B)
    const e = r.errores.find((x) => /NO_LITERAL/.test(x))
    expect(e).toMatch(/ancla la clave al texto/)
  })

  it('no toca el marco INTRUSO: ahí lo que debe ser literal son los DISTRACTORES', () => {
    // En "¿cuál NO figura?" la correcta es por construcción la inventada, así que su
    // NO_LITERAL no puede bloquear. Regresión del descuadre inverso.
    const intrusa = preguntaBuena({
      question_text: 'Según el artículo 6.b) del TRLRHL, ¿cuál de los siguientes NO figura entre los principios enunciados?',
      option_a: 'Gravar los negocios celebrados fuera del territorio de la Entidad impositora',
      option_b: CORRECTA_6B,
      option_c: 'No gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora',
      option_d: 'ni el ejercicio o la transmisión de bienes, derechos u obligaciones que no hayan nacido ni hubieran de cumplirse en dicho territorio',
      correct_option: 0,
    })
    expect(analizarPregunta(intrusa, ART_6B).errores.some((e) => /NO_LITERAL/.test(e))).toBe(false)
  })
})

describe('simularBatch — §2.2-bis tell de longitud', () => {
  it('marca el patrón prohibido: correcta larga frente a distractores diminutos', () => {
    const { errores } = analizarPregunta(
      preguntaBuena({ option_b: 'No gravar nada.', option_c: 'Gravar todo.', option_d: 'Depende.' }),
      ART_6B,
    )
    expect(errores.some((e) => e.includes('tell de longitud'))).toBe(true)
  })

  it('no marca nada cuando los cuatro tamaños son comparables', () => {
    const { errores } = analizarPregunta(preguntaBuena(), ART_6B)
    expect(errores.some((e) => e.includes('tell de longitud'))).toBe(false)
  })
})

describe('simularBatch — PAR ESPEJO (T-153)', () => {
  it('avisa cuando un distractor es la inversión exacta de la clave', () => {
    const q = preguntaBuena({
      option_a: 'El plazo se interrumpe por la interposición del recurso ante el órgano competente.',
      option_b: 'El plazo no se interrumpe por la interposición del recurso ante el órgano competente.',
      correct_option: 0,
    })
    const { avisos } = analizarPregunta(q, ART_6B)
    expect(avisos.some((a) => a.includes('PAR ESPEJO'))).toBe(true)
    expect(avisos.find((a) => a.includes('PAR ESPEJO'))).toContain('opción B')
  })

  it('NO avisa cuando ningún distractor es espejo de la clave', () => {
    // OJO: la fixture `preguntaBuena()` por defecto SÍ tiene un espejo real (option_b
    // cambia "fuera"↔"dentro" del territorio, que está en PARES_INVERTIDOS) — es un
    // acierto del check, no un fallo del fixture, así que aquí se usa una pregunta sin
    // ese patrón para probar el caso negativo.
    const q = preguntaBuena({
      option_b: CORRECTA_6B.replace('de la Entidad impositora', 'de la comunidad autónoma'),
      option_c: CORRECTA_6B.replace('que no hayan nacido ni hubieran', 'que hayan nacido o hubieran'),
      option_d: CORRECTA_6B.replace('bienes, derechos u obligaciones', 'bienes, derechos u obligaciones futuras'),
    })
    const { avisos } = analizarPregunta(q, ART_6B)
    expect(avisos.some((a) => a.includes('PAR ESPEJO'))).toBe(false)
  })

  it('el aviso de espejo NO bloquea (va en avisos, no en errores)', () => {
    const q = preguntaBuena({
      option_a: 'El plazo se interrumpe por la interposición del recurso ante el órgano competente.',
      option_b: 'El plazo no se interrumpe por la interposición del recurso ante el órgano competente.',
      correct_option: 0,
    })
    const { errores, avisos } = analizarPregunta(q, ART_6B)
    expect(avisos.some((a) => a.includes('PAR ESPEJO'))).toBe(true)
    expect(errores.some((e) => e.includes('ESPEJO'))).toBe(false)
  })
})

describe('simularBatch — §8.1 cabecera coherente con la clave', () => {
  it('detecta que la cabecera nombra una letra distinta de correct_option', () => {
    // correct_option pasa a B pero la explicación sigue diciendo "Por qué A es correcta"
    const { errores } = analizarPregunta(preguntaBuena({ correct_option: 1 }), ART_6B)
    expect(errores.some((e) => e.includes('cabecera'))).toBe(true)
  })

  it('detecta la explicación sin cabecera', () => {
    const { errores } = analizarPregunta(preguntaBuena({ explanation: 'Es la b) porque sí.' }), ART_6B)
    expect(errores.some((e) => e.includes('cabecera'))).toBe(true)
  })
})

describe('simularBatch — estructura mínima', () => {
  it('rechaza opciones repetidas entre sí', () => {
    const { errores } = analizarPregunta(preguntaBuena({ option_c: CORRECTA_6B }), ART_6B)
    expect(errores.some((e) => e.includes('repetidas'))).toBe(true)
  })

  it('rechaza correct_option fuera de rango sin reventar', () => {
    const { errores } = analizarPregunta(preguntaBuena({ correct_option: 7 }), ART_6B)
    expect(errores.some((e) => e.includes('correct_option inválido'))).toBe(true)
  })

  it('rechaza que no haya artículo contra el que verificar', () => {
    const { errores } = analizarPregunta(preguntaBuena(), '')
    expect(errores.some((e) => e.includes('sin texto de artículo'))).toBe(true)
  })
})

describe('simularBatch — §2.2-ter distribución y secuencia del lote', () => {
  const lote = (posiciones) => posiciones.map((p) => ({ correct_option: p }))

  it('acepta un lote repartido y sin patrón', () => {
    const r = analizarLote(lote([2, 0, 3, 1, 3, 0, 2, 1, 3, 0, 1, 2]))
    expect(r.errores).toEqual([])
    expect(r.secuencia).toBe('CADBDACBDABC')
  })

  it('marca el lote que concentra la clave en una sola letra', () => {
    const r = analizarLote(lote([1, 1, 1, 1, 1, 1, 1, 0, 2, 3]))
    expect(r.errores.some((e) => e.includes('desequilibrada'))).toBe(true)
  })

  it('marca el ciclo regular A,B,C,D aunque la distribución sea perfecta', () => {
    const r = analizarLote(lote([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]))
    expect(r.errores.some((e) => e.includes('ciclo regular'))).toBe(true)
  })

  it('no se pronuncia sobre lotes pequeños (menos de 8)', () => {
    const r = analizarLote(lote([0, 0, 0, 0]))
    expect(r.errores).toEqual([])
  })
})

// ─── Tell de FORMA a nivel de LOTE (T-150) ──────────────────────────────────────────────
//
// La clave es la más larga y los absolutos viven en los distractores: dos patrones que solo
// se ven mirando el lote entero, no una pregunta suelta. Los umbrales y los casos de prueba
// están calibrados contra los tres puntos de dato reales del backlog: 13/16 (81%, el lote que
// motiva la ficha) y 7/10 (70%, citado explícitamente como "el nivel que T-150 documenta como
// explotable") SÍ disparan; 6/14 (43%, el caso T204 con márgenes de +3%/+5%/+8%/+11%/+15%/+36%
// que el propio backlog documenta como "alarma falsa" al contarlos en bruto) NO dispara con
// el umbral del 60%.
describe('simularBatch — §2.2-bis tell de FORMA de LOTE (longitud) — T-150', () => {
  // Clave en `correctIdx`, longitud derivada de `margenPct` sobre `maxDist`; los otros tres
  // slots llevan siempre [maxDist, maxDist-5, maxDist-10] EN ORDEN, así que el mayor
  // distractor es siempre `maxDist` sea cual sea la posición de la clave.
  const pregLarga = (margenPct, correctIdx = 0, maxDist = 1000) => {
    const distractorLens = [maxDist, maxDist - 5, maxDist - 10]
    const options = [0, 1, 2, 3].map((i) => {
      if (i === correctIdx) return 'x'.repeat(Math.round(maxDist * (1 + margenPct / 100)))
      return 'x'.repeat(distractorLens[i < correctIdx ? i : i - 1])
    })
    return { options, correct_option: correctIdx }
  }
  const pregCorta = () => ({
    options: ['x'.repeat(500), 'x'.repeat(1000), 'x'.repeat(995), 'x'.repeat(990)],
    correct_option: 0,
  })

  it('NO avisa con el caso real del T204 (6/14 = 43%, márgenes +3/+5/+8/+11/+15/+36%)', () => {
    const preguntas = [
      pregLarga(3), pregLarga(5), pregLarga(8), pregLarga(11), pregLarga(15), pregLarga(36),
      pregCorta(), pregCorta(), pregCorta(), pregCorta(), pregCorta(), pregCorta(), pregCorta(), pregCorta(),
    ]
    const { avisos } = analizarLote(preguntas)
    expect(avisos.some((a) => a.includes('tell de FORMA de lote (longitud)'))).toBe(false)
  })

  it('AVISA con el 70% real (lote LECrim, "el nivel que T-150 documenta como explotable")', () => {
    const preguntas = [
      ...Array.from({ length: 7 }, () => pregLarga(20)), // clave más larga, margen NO explotable (20% < 30%)
      ...Array.from({ length: 3 }, () => pregCorta()),
    ]
    const { avisos } = analizarLote(preguntas)
    const aviso = avisos.find((a) => a.includes('tell de FORMA de lote (longitud)'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('7/10')
    // los 7 tienen margen 20%, por debajo del explotable (30%): el aviso debe decirlo.
    expect(aviso).toContain('0 superan además el margen explotable')
  })

  it('AVISA con el 81% del lote que motiva la ficha (13/16, gen_atc_t208) y cuenta los explotables', () => {
    const preguntas = [
      ...Array.from({ length: 13 }, () => pregLarga(40)), // margen 40% > 30%: explotable
      ...Array.from({ length: 3 }, () => pregCorta()),
    ]
    const { avisos } = analizarLote(preguntas)
    const aviso = avisos.find((a) => a.includes('tell de FORMA de lote (longitud)'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('13/16')
    expect(aviso).toContain('13 superan además el margen explotable')
  })

  it('NO avisa cuando la clave no destaca por longitud en el lote', () => {
    const preguntas = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? pregLarga(10) : pregCorta()))
    const { avisos } = analizarLote(preguntas)
    expect(avisos.some((a) => a.includes('tell de FORMA de lote (longitud)'))).toBe(false)
  })

  it('el aviso de longitud NO bloquea la inserción (va en avisos, no en errores)', () => {
    // correct_option repartido y sin ciclo, para que esta prueba aísle el check de FORMA
    // del check de distribución/ciclo de §2.2-ter (que son otro par de checks distintos).
    const posiciones = [0, 1, 2, 3, 0, 2, 1, 3, 0, 1]
    const preguntas = posiciones.map((p) => pregLarga(40, p))
    const { errores, avisos } = analizarLote(preguntas)
    expect(avisos.some((a) => a.includes('tell de FORMA de lote (longitud)'))).toBe(true)
    expect(errores).toEqual([])
  })
})

describe('simularBatch — §2.2-bis tell de FORMA de LOTE (absolutos en distractores) — T-150', () => {
  // Réplica del caso real gen_atc_t208_2026-07-26_s26c: absolutos en 10/16 preguntas y en
  // 9 de esas 10 SOLO en distractores. La 10ª tiene el absoluto en la CLAVE porque lo dice
  // la propia ley ("en ningún caso") — no debe contar como "solo distractor".
  const conMarcadorSoloEnDistractor = (marcador) => ({
    options: [
      `El órgano competente resolverá conforme al procedimiento ordinario aplicable al caso.`, // clave, sin marcador
      `El órgano competente resolverá ${marcador} tras el trámite de audiencia previsto.`,
      'El órgano competente carece de competencia para resolver sobre la materia planteada.',
      'El órgano competente delega la resolución en el superior jerárquico correspondiente.',
    ],
    correct_option: 0,
  })
  const sinMarcador = () => ({
    options: [
      'El plazo de resolución es de tres meses desde la solicitud.',
      'El plazo de resolución es de un mes desde la solicitud.',
      'El plazo de resolución es de seis meses desde la solicitud.',
      'El plazo de resolución es de quince días desde la solicitud.',
    ],
    correct_option: 0,
  })
  const conMarcadorEnLaClave = () => ({
    options: [
      'En ningún caso procederá la ejecución sin previa notificación al interesado.', // clave, con marcador
      'La ejecución procederá siempre que medie autorización expresa del órgano superior.',
      'La ejecución procederá previa audiencia de las partes interesadas en el expediente.',
      'La ejecución procederá conforme al procedimiento abreviado aplicable.',
    ],
    correct_option: 0,
  })

  it('AVISA con el caso real 9/10 (marcador solo en distractores)', () => {
    const marcadores = ['únicamente', 'exclusivamente', 'solo', 'siempre', 'en exclusiva', 'únicamente', 'exclusivamente', 'solo', 'siempre']
    const preguntas = [...marcadores.map(conMarcadorSoloEnDistractor), conMarcadorEnLaClave()]
    const { avisos } = analizarLote(preguntas)
    const aviso = avisos.find((a) => a.includes('tell de FORMA de lote (absolutos)'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('9/10')
  })

  it('NO avisa si el absoluto se reparte entre clave y distractores', () => {
    const preguntas = [
      conMarcadorSoloEnDistractor('únicamente'),
      conMarcadorEnLaClave(),
      conMarcadorSoloEnDistractor('exclusivamente'),
      conMarcadorEnLaClave(),
      sinMarcador(), sinMarcador(), sinMarcador(), sinMarcador(),
    ]
    const { avisos } = analizarLote(preguntas)
    expect(avisos.some((a) => a.includes('tell de FORMA de lote (absolutos)'))).toBe(false)
  })

  it('NO avisa con menos de 4 preguntas con marcador (ruido de muestra)', () => {
    const preguntas = [
      conMarcadorSoloEnDistractor('únicamente'),
      conMarcadorSoloEnDistractor('exclusivamente'),
      conMarcadorSoloEnDistractor('solo'),
      ...Array.from({ length: 7 }, sinMarcador),
    ]
    const { avisos } = analizarLote(preguntas)
    expect(avisos.some((a) => a.includes('tell de FORMA de lote (absolutos)'))).toBe(false)
  })

  it('no se pronuncia sobre lotes pequeños (menos de 8), igual que el resto de §2.2-ter', () => {
    const preguntas = [conMarcadorSoloEnDistractor('únicamente'), conMarcadorSoloEnDistractor('solo')]
    const { avisos } = analizarLote(preguntas)
    expect(avisos).toEqual([])
  })
})

// ─── Formato CLOZE a nivel de LOTE (T-153) ──────────────────────────────────────────────
describe('simularBatch — formato CLOZE de lote — T-153', () => {
  // Artículo simple y autocontenido para que la cola citada sea inequívoca.
  const ART =
    'Los tributos que establezcan las entidades locales respetarán, en todo caso, los siguientes principios: no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.'

  const preguntaCloze = () => ({
    options: [
      'no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.',
      'gravar libremente cualquier negocio celebrado fuera del término municipal correspondiente.',
      'exigir el tributo con independencia del territorio donde se hubiera celebrado el negocio.',
      'aplicar el tributo únicamente a los negocios celebrados dentro del término municipal.',
    ],
    correct_option: 0,
    question_text:
      'Según el artículo 6.b) del TRLRHL, los tributos que establezcan las entidades locales respetarán, en todo caso, los siguientes principios:',
  })

  const preguntaPregunta = () => ({
    options: [
      'no gravar, como tales, negocios, actos o hechos celebrados o realizados fuera del territorio de la Entidad impositora.',
      'gravar libremente cualquier negocio celebrado fuera del término municipal correspondiente.',
      'exigir el tributo con independencia del territorio donde se hubiera celebrado el negocio.',
      'aplicar el tributo únicamente a los negocios celebrados dentro del término municipal.',
    ],
    correct_option: 0,
    question_text: '¿Qué principio deben respetar los tributos que establezcan las entidades locales según el artículo 6.b) del TRLRHL?',
  })

  it('AVISA cuando más del 50% del lote es CLOZE (relleno de huecos)', () => {
    const preguntas = Array.from({ length: 8 }, (_, i) => (i < 5 ? preguntaCloze() : preguntaPregunta()))
    const articulos = preguntas.map(() => ART)
    const { avisos } = analizarLote(preguntas, articulos)
    const aviso = avisos.find((a) => a.includes('formato CLOZE de lote'))
    expect(aviso).toBeDefined()
    expect(aviso).toContain('5/8')
  })

  it('NO avisa cuando el lote está por debajo del 50% CLOZE', () => {
    const preguntas = Array.from({ length: 8 }, (_, i) => (i < 3 ? preguntaCloze() : preguntaPregunta()))
    const articulos = preguntas.map(() => ART)
    const { avisos } = analizarLote(preguntas, articulos)
    expect(avisos.some((a) => a.includes('formato CLOZE de lote'))).toBe(false)
  })

  it('sin `articulos`, el check simplemente no se pronuncia (degrada, no revienta)', () => {
    const preguntas = Array.from({ length: 8 }, () => preguntaCloze())
    const { avisos } = analizarLote(preguntas) // sin segundo argumento
    expect(avisos.some((a) => a.includes('formato CLOZE de lote'))).toBe(false)
  })

  it('el aviso de CLOZE NO bloquea la inserción (va en avisos, no en errores)', () => {
    const preguntas = Array.from({ length: 8 }, () => preguntaCloze())
    const articulos = preguntas.map(() => ART)
    const { errores, avisos } = analizarLote(preguntas, articulos)
    expect(avisos.some((a) => a.includes('formato CLOZE de lote'))).toBe(true)
    expect(errores.some((e) => e.includes('CLOZE'))).toBe(false)
  })

  it('analizarValidezLote es accesible directamente (paridad de contrato con analizarFormaLote)', () => {
    const preguntas = Array.from({ length: 8 }, () => preguntaCloze())
    const articulos = preguntas.map(() => ART)
    const { avisos } = analizarValidezLote(preguntas, articulos)
    expect(avisos.some((a) => a.includes('formato CLOZE de lote'))).toBe(true)
  })
})

describe('simularBatch — §2.2 truncamiento por cabeza vs condensación válida', () => {
  // Art. 3.4 TRLRHL: el inciso condicionante ("salvo que la legislación de desarrollo de
  // las comunidades autónomas prevea otra cosa") PRECEDE al texto que se cita como
  // correcta. Ponerlo en el enunciado es la forma canónica de §2.2; duplicarlo en las
  // cuatro opciones sería peor. El check mecánico, que solo ve artículo y opción, lo lee
  // como truncamiento por la cabeza.
  const ART_34 =
    'Tendrán también la consideración de ingresos de derecho privado el importe obtenido en la enajenación de bienes integrantes del patrimonio de las entidades locales como consecuencia de su desafectación como bienes de dominio público y posterior venta, aunque hasta entonces estuvieran sujetos a concesión administrativa. En tales casos, salvo que la legislación de desarrollo de las comunidades autónomas prevea otra cosa, quien fuera el último concesionario antes de la desafectación tendrá derecho preferente de adquisición directa de los bienes sin necesidad de subasta pública.'
  const CORRECTA_34 =
    'Quien fuera el último concesionario antes de la desafectación tendrá derecho preferente de adquisición directa de los bienes sin necesidad de subasta pública.'

  const conEnunciado = (question_text) => ({
    law_slug: 'rdl-2-2004',
    primary_article_number: '3',
    question_text,
    option_a: CORRECTA_34,
    option_b: CORRECTA_34.replace('sin necesidad de subasta pública', 'previa subasta pública desierta'),
    option_c: CORRECTA_34.replace('el último concesionario antes de', 'el primer concesionario tras'),
    option_d: CORRECTA_34.replace('derecho preferente de adquisición directa de los bienes', 'derecho de tanteo y retracto sobre los bienes'),
    correct_option: 0,
    explanation: '> **Art. 3.4 TRLRHL**\n> "' + CORRECTA_34 + '"\n\n**Por qué A es correcta:** reproduce el derecho reconocido.\n\n**Por qué las demás son incorrectas:**\n- **B)** exige subasta previa.\n- **C)** cambia el concesionario.\n- **D)** cambia la figura.',
  })

  it('NO bloquea si el enunciado ya recoge la cláusula condicionante', () => {
    const q = conEnunciado(
      'Según el artículo 3.4 del texto refundido de la Ley Reguladora de las Haciendas Locales (TRLRHL), y salvo que la legislación de desarrollo de las comunidades autónomas prevea otra cosa:',
    )
    const { errores, avisos } = analizarPregunta(q, ART_34)
    expect(errores.filter((e) => e.includes('cita truncada'))).toEqual([])
    expect(avisos.some((a) => a.includes('ya aparece en el enunciado'))).toBe(true)
  })

  it('SÍ bloquea si el enunciado se calla la cláusula condicionante', () => {
    const q = conEnunciado('Según el artículo 3.4 del texto refundido de la Ley Reguladora de las Haciendas Locales (TRLRHL):')
    const { errores } = analizarPregunta(q, ART_34)
    expect(errores.some((e) => e.includes('cita truncada'))).toBe(true)
  })

  it('clausulaEnEnunciado exige coincidencia alta, no un par de palabras sueltas', () => {
    expect(clausulaEnEnunciado('salvo que la legislación autonómica prevea otra cosa', 'Según la legislación vigente:')).toBe(false)
  })
})

describe('simularBatch — dedup del Paso 3', () => {
  it('avisa de una pregunta casi idéntica a una que ya está viva', () => {
    const preguntas = [{ question_text: 'Según el artículo 5 TRLRHL, los ingresos patrimoniales no podrán destinarse a gastos corrientes salvo excepciones' }]
    const vivas = ['Según el artículo 5 TRLRHL, los ingresos patrimoniales no podrán destinarse a gastos corrientes salvo excepciones tasadas']
    expect(analizarDuplicados(preguntas, vivas)).toHaveLength(1)
  })

  it('no avisa de preguntas sobre materias distintas', () => {
    const preguntas = [{ question_text: 'Principios de tributación local del artículo 6' }]
    const vivas = ['Plazo de aprobación del presupuesto general de las entidades locales']
    expect(analizarDuplicados(preguntas, vivas)).toEqual([])
  })

  it('detecta duplicados dentro del propio lote', () => {
    const t = 'Los recursos de las entidades locales incluyen las participaciones en tributos del Estado'
    expect(analizarDuplicados([{ question_text: t }, { question_text: t }], [])).toHaveLength(1)
  })

  // 31/07/2026, lote `gen_lopdgdd_t115_2026-07-31`: los 5 avisos intra-lote eran falsos positivos
  // y todos por la misma causa — §2.2-quater obliga a desarrollar el nombre de la ley en CADA
  // enunciado, y ahí ese nombre ocupa 118 caracteres. El Jaccard del enunciado subía a 0,46-0,62
  // mientras el de la CLAVE (el nivel 3 de §2.6, el que dice si dos preguntas evalúan lo mismo)
  // se quedaba entre 0,00 y 0,14. Adjudicarlo exigía un script a mano; ahora viaja en el aviso.
  it('el aviso intra-lote lleva el Jaccard de la CLAVE, que es el que adjudica', () => {
    const ley = 'de la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales'
    const a = {
      question_text: `Según el artículo 61 ${ley}, la salvedad aplicable es:`,
      options: ['Salvo que desarrollase significativamente tratamientos de la misma naturaleza', 'x', 'y', 'z'],
      correct_option: 0,
    }
    const b = {
      question_text: `Según el artículo 62 ${ley}, la autoridad interesada no principal debe:`,
      options: ['Informar a la Agencia cuando el asunto sea remitido al Comité', 'x', 'y', 'z'],
      correct_option: 0,
    }
    const [aviso] = analizarDuplicados([a, b], [])
    expect(aviso.motivo).toMatch(/enunciado 0\.\d+; CLAVE 0\.\d+ → probable falso positivo/)
  })

  it('…y cuando la clave TAMBIÉN solapa, el aviso manda mirarlo', () => {
    const t = 'Los recursos de las entidades locales incluyen las participaciones en tributos del Estado'
    const q = { question_text: t, options: ['Las participaciones en los tributos del Estado y de las comunidades autónomas', 'x', 'y', 'z'], correct_option: 0 }
    const [aviso] = analizarDuplicados([q, { ...q }], [])
    expect(aviso.motivo).toContain('→ MÍRALO')
  })

  it('claveDe resuelve la opción marcada, y no revienta si falta el dato', () => {
    expect(claveDe({ options: ['a', 'b', 'c', 'd'], correct_option: 2 })).toBe('c')
    expect(claveDe({ options: ['a'], correct_option: 7 })).toBe('')
    expect(claveDe({})).toBe('')
    expect(claveDe(null)).toBe('')
  })

  it('jaccard devuelve 0 si algún texto va vacío (no divide por cero)', () => {
    expect(jaccard('', 'algo con palabras largas')).toBe(0)
  })
})

describe('simularBatch — contrato con el INSERTER (drift manual ↔ script)', () => {
  // El manual documenta `option_a`…`option_d`; `insertar-batch-generado.cjs` lee
  // `options[]` y `primary_article_number`. Un borrador escrito según el manual moría en
  // el INSERT con "UNDEFINED_VALUE" sin decir qué campo faltaba. La simulación tiene que
  // cazarlo ANTES, y aceptar las dos formas.
  it('normaliza la forma option_a..option_d a options[]', () => {
    const q = normalizarPregunta({ option_a: 'a', option_b: 'b', option_c: 'c', option_d: 'd' })
    expect(q.options).toEqual(['a', 'b', 'c', 'd'])
  })

  it('normaliza la forma options[] a option_a..option_d', () => {
    const q = normalizarPregunta({ options: ['a', 'b', 'c', 'd'] })
    expect([q.option_a, q.option_b, q.option_c, q.option_d]).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reclama primary_article_number aunque venga primary_article_id (que el inserter no usa)', () => {
    const q = normalizarPregunta({
      law_slug: 'rdl-2-2004',
      primary_article_id: 'b5cb5898-e36b-46aa-8db0-61c794bb82b5',
      question_text: 'x',
      explanation: 'y',
      options: ['a', 'b', 'c', 'd'],
    })
    expect(camposParaInsertar(q).some((f) => f.includes('primary_article_number'))).toBe(true)
  })

  it('no reclama nada cuando el borrador trae todo lo que el inserter necesita', () => {
    const q = normalizarPregunta({
      law_slug: 'rdl-2-2004',
      primary_article_number: '4',
      question_text: 'x',
      explanation: 'y',
      options: ['a', 'b', 'c', 'd'],
    })
    expect(camposParaInsertar(q)).toEqual([])
  })

  it('analizarPregunta bloquea el borrador que el inserter no sabría leer', () => {
    const { errores } = analizarPregunta(
      { question_text: 'x', explanation: 'y', options: ['a', 'b', 'c', 'd'], correct_option: 0 },
      'texto del articulo',
    )
    expect(errores.some((e) => e.includes('primary_article_number'))).toBe(true)
    expect(errores.some((e) => e.includes('law_slug'))).toBe(true)
  })
})

describe('simularBatch — resolución del artículo por las dos vías (T-096)', () => {
  // El simulador resolvía el artículo SOLO por `primary_article_id`, pero el inserter lee
  // `law_slug` + `primary_article_number`. Resultado: un borrador en el formato del
  // INSERTER —el único que se puede insertar— daba "artículo inexistente" en las 10
  // preguntas y no se podía simular. Se descubrió usando el propio simulador en T-096.
  it('normalizarPregunta conserva ambas referencias al artículo', () => {
    const q = normalizarPregunta({
      law_slug: 'reglamento-852-2004-higiene-alimentaria',
      primary_article_number: '5',
      question_text: 'x',
      explanation: 'y',
      options: ['a', 'b', 'c', 'd'],
      correct_option: 0,
    })
    expect(q.law_slug).toBe('reglamento-852-2004-higiene-alimentaria')
    expect(q.primary_article_number).toBe('5')
    expect(camposParaInsertar(q)).toEqual([])
  })

  it('una pregunta con law_slug + número NO puede ser rechazada por falta de campos', () => {
    // Regresión directa: antes pasaba camposParaInsertar pero moría luego al buscar el
    // texto del artículo, que es un fallo de la capa de I/O, no del borrador.
    const q = normalizarPregunta({
      law_slug: 'ley-x',
      primary_article_number: '12',
      question_text: 'x',
      explanation: 'y',
      options: ['a', 'b', 'c', 'd'],
      correct_option: 0,
    })
    expect(camposParaInsertar(q).some((f) => f.includes('primary_article_number'))).toBe(false)
  })
})

// --- Paridad de marco con el verificador POST-inserción (26/07/2026) ---
// Los dos gates del pipeline comparten núcleos para dar el MISMO veredicto. El marco
// INTRUSO era una excepción: `verificar-batch-generado.cjs` lo conocía y este simulador
// no, así que avisaba de NO_LITERAL en intrusos impecables y no revisaba nunca los
// distractores de un intruso mal construido.
describe('analizarPregunta — marco INTRUSO (paridad con el verificador de BD)', () => {
  const ART =
    'Se considerarán piedras preciosas, a los efectos de este artículo, el zafiro, la esmeralda, la aguamarina, el diamante y el rubí.'

  it('no avisa de literalidad en un intruso bien construido', () => {
    const r = analizarPregunta(
      {
        question_text: '¿Cuál de las siguientes NO figura entre las piedras preciosas del artículo?',
        options: ['el zafiro', 'la esmeralda', 'el rubí', 'el jade'],
        correct_option: 3,
        explanation: '**Por qué D es correcta:** el artículo no menciona el jade.\n\n> «el zafiro, la esmeralda, la aguamarina, el diamante y el rubí»\n\n**Por qué las demás son incorrectas:**\n- **A)** sí figura.\n- **B)** sí figura.\n- **C)** sí figura.',
        primary_article_number: '30',
        law_slug: 'ley-20-1991',
      },
      ART,
    )
    expect(r.avisos.filter((a) => /NO_LITERAL|INTRUSO/.test(a))).toEqual([])
  })

  it('avisa cuando los distractores de un intruso NO son del artículo', () => {
    const r = analizarPregunta(
      {
        question_text: '¿Cuál de las siguientes NO figura entre las piedras preciosas del artículo?',
        options: ['el zafiro', 'el cuarzo rosa', 'la turmalina verde', 'el jade'],
        correct_option: 3,
        explanation: '**Por qué D es correcta:** x.\n\n> «cita»\n\n**Por qué las demás son incorrectas:**\n- **A)** a.\n- **B)** b.\n- **C)** c.',
        primary_article_number: '30',
        law_slug: 'ley-20-1991',
      },
      ART,
    )
    expect(r.avisos.some((a) => /INTRUSO: 2 de los 3 distractores/.test(a))).toBe(true)
  })

  it('avisa de MARCO AMBIGUO cuando la correcta SÍ es del artículo (posible clave mal)', () => {
    const r = analizarPregunta(
      {
        question_text: '¿Cuál de las siguientes NO figura entre las piedras preciosas del artículo?',
        options: ['el ámbar báltico', 'la perla cultivada', 'el ópalo de fuego', 'la aguamarina'],
        correct_option: 3, // ¡la aguamarina SÍ está en el artículo!
        explanation: '**Por qué D es correcta:** x.\n\n> «cita»\n\n**Por qué las demás son incorrectas:**\n- **A)** a.\n- **B)** b.\n- **C)** c.',
        primary_article_number: '30',
        law_slug: 'ley-20-1991',
      },
      ART,
    )
    expect(r.avisos.some((a) => /MARCO AMBIGUO/.test(a))).toBe(true)
  })
})

// --- PARIDAD de núcleos con el verificador POST-inserción (26/07/2026) ---
//
// Los dos gates del pipeline deben dar el MISMO veredicto, pero la paridad se mantiene a
// mano y se rompió: `citaVsOpcion` y `overclaimExplicacion` solo los corría el gate de BD,
// así que un lote pasaba la simulación y el aviso salía DESPUÉS de insertar. Estos tests
// se anclan a los dos casos REALES que lo delataron, para que quitar el cableado ponga algo
// en rojo en vez de degradar el gate en silencio.
describe('analizarPregunta — paridad de núcleos con verificar-batch-generado.cjs', () => {
  it('avisa de OVERCLAIM (caso real: art. 39.1 RDL 1/1993, batch gen_atc_t224)', () => {
    // La explicación afirmaba "sin excepciones" y el artículo no dice ese absoluto.
    const ART = 'El pago del impuesto en la expedición de los documentos mercantiles cubre todas las cláusulas en ellos contenidas, en cuanto a su tributación por este concepto.'
    const r = analizarPregunta(
      {
        question_text: 'Según el artículo 39.1, el pago del impuesto en la expedición de los documentos mercantiles:',
        options: [
          'cubre todas las cláusulas en ellos contenidas, en cuanto a su tributación por este concepto',
          'cubre únicamente la cláusula principal del documento mercantil expedido',
          'no exime de tributar por las cláusulas añadidas despues de su emisión',
          'cubre las cláusulas salvo las que constituyan actos independientes',
        ],
        correct_option: 0,
        explanation: '**Por qué A es correcta:** el artículo 39.1 extiende el efecto del pago a todas las cláusulas del documento, sin excepciones.\n\n> «cubre todas las cláusulas en ellos contenidas»\n\n**Por qué las demás son incorrectas:**\n- **B)** x.\n- **C)** y.\n- **D)** z.',
        primary_article_number: '39',
        law_slug: 'rdl-1-1993-itpajd',
      },
      ART,
    )
    expect(r.avisos.some((a) => /OVERCLAIM/.test(a))).toBe(true)
  })

  it('avisa de CORRECTA PARCIAL (caso real: art. 2.2 RDL 1/1993, batch gen_atc_t223)', () => {
    // La opción paraba en "hasta que ésta se cumpla" y la ley añade un deber registral
    // sobre la MISMA liquidación, que el enunciado no menciona.
    const ART = 'En los actos o contratos en que medie alguna condición, su calificación se hará con arreglo a las prescripciones contenidas en el Código Civil. Si fuere suspensiva no se liquidará el impuesto hasta que ésta se cumpla, haciéndose constar el aplazamiento de la liquidación en la inscripción de bienes en el registro público correspondiente.'
    const r = analizarPregunta(
      {
        question_text: 'Conforme al artículo 2.2, cuando en un acto o contrato medie una condición SUSPENSIVA:',
        options: [
          'no se liquidará el impuesto hasta que ésta se cumpla',
          'se exigirá el impuesto desde luego, a reserva de la oportuna devolución',
          'se practicará una liquidación provisional a cuenta de la definitiva',
          'se liquidará el impuesto por la mitad de la cuota que corresponda',
        ],
        correct_option: 0,
        explanation: '**Por qué A es correcta:** el artículo 2.2 aplaza la liquidación.\n\n> «Si fuere suspensiva **no se liquidará el impuesto hasta que ésta se cumpla**, haciéndose constar el aplazamiento de la liquidación en la inscripción de bienes en el registro público correspondiente.»\n\n**Por qué las demás son incorrectas:**\n- **B)** x.\n- **C)** y.\n- **D)** z.',
        primary_article_number: '2',
        law_slug: 'rdl-1-1993-itpajd',
      },
      ART,
    )
    expect(r.avisos.some((a) => /CORRECTA PARCIAL/.test(a))).toBe(true)
  })

  it('NO avisa de CORRECTA PARCIAL si la cola ya está en el enunciado (art. 21 Ley 19/1991)', () => {
    const ART = 'Las concesiones administrativas para la explotación de servicios o bienes de dominio o titularidad pública, cualquiera que sea su duración, se valorarán con arreglo a los criterios señalados en el Impuesto sobre Transmisiones Patrimoniales y Actos Jurídicos Documentados.'
    const r = analizarPregunta(
      {
        question_text: 'Según el artículo 21 de la Ley 19/1991, las concesiones administrativas para la explotación de servicios o bienes de dominio o titularidad pública se valoran con arreglo a los criterios del Impuesto sobre Transmisiones Patrimoniales y Actos Jurídicos Documentados:',
        options: [
          'solo si excede de diez años',
          'cualquiera que sea su duración',
          'salvo si son de duración inferior a un año',
          'siempre que su duración sea determinada',
        ],
        correct_option: 1,
        explanation: '**Por qué B es correcta:** el artículo 21 aplica la regla con independencia de la duración.\n\n> «Las concesiones administrativas para la explotación de servicios o bienes de dominio o titularidad pública, **cualquiera que sea su duración**, se valorarán con arreglo a los criterios señalados en el Impuesto sobre Transmisiones Patrimoniales y Actos Jurídicos Documentados.»\n\n**Por qué las demás son incorrectas:**\n- **A)** x.\n- **C)** y.\n- **D)** z.',
        primary_article_number: '21',
        law_slug: 'ley-19-1991-patrimonio',
      },
      ART,
    )
    expect(r.avisos.some((a) => /CORRECTA PARCIAL/.test(a))).toBe(false)
  })
})

describe('simularBatch — no anclar a un artículo que no se sirve (T-139)', () => {
  // Un artículo INACTIVO no se sirve: una pregunta anclada a él nace invisible. Paso
  // durante OCHO MESES con la ley virtual "Excel 365", cuyos artículos 1-6 nacieron
  // inactivos el 29/10/2025 y nunca se activaron: se les fueron anclando preguntas hasta
  // acumular 10 invisibles, 4 de ellas duplicados exactos de las que sí vivían.
  //
  // La capa de I/O del simulador solo resuelve artículos con `is_active = true`, así que
  // uno inactivo llega aquí como "sin contenido" y el núcleo lo BLOQUEA. Este test fija
  // ese comportamiento para que nadie lo relaje pensando que es un caso degenerado.
  it('sin artículo servible → bloquea, no avisa', () => {
    const { errores } = analizarPregunta(
      {
        law_slug: 'excel-365',
        primary_article_number: '4',
        question_text: '¿Qué símbolo inicia una fórmula en Excel 365?',
        explanation: '> **Art**\n> "..."\n\n**Por qué A es correcta:** x\n\n**Por qué las demás son incorrectas:**\n- **B)** y\n- **C)** z\n- **D)** w',
        options: ['=', '+', '-', '*'],
        correct_option: 0,
      },
      '', // el artículo inactivo no se resuelve → sin contenido
    )
    expect(errores.some((e) => e.includes('sin texto de artículo'))).toBe(true)
  })
})

// ─── El dedup contra las VIVAS mira también la CLAVE [T-519] ────────────────────────────
//
// El agujero por el que el art. 2 de la LGSS acumuló once preguntas sobre la misma frase:
// enunciado distinto (no dispara el Jaccard) y misma respuesta (nadie la miraba).
describe('analizarDuplicados · misma respuesta que una viva', () => {
  const nueva = {
    question_text: 'A tenor de lo establecido en el artículo 2 del texto refundido de la Ley General de la Seguridad Social, el sistema de la seguridad social se fundamenta en los principios de:',
    options: ['Universalidad, concentración, solidaridad e igualdad.', 'Universalidad, unidad, solidaridad e igualdad.', 'c', 'd'],
    correct_option: 1,
  }
  const viva = {
    question_text: 'Según el artículo 2 del Real Decreto Legislativo 8/2015 el sistema de la Seguridad Social, configurado por la acción protectora en sus modalidades contributiva y no contributiva, se fundamenta en los principios de:',
    clave: 'Universalidad, unidad, solidaridad e igualdad.',
  }

  it('avisa aunque el ENUNCIADO no se parezca lo bastante para el Jaccard', () => {
    const avisos = analizarDuplicados([nueva], [viva])
    expect(avisos.some((a) => /MISMA RESPUESTA/.test(a.motivo))).toBe(true)
  })

  it('no avisa si la respuesta correcta es otra', () => {
    const otra = { ...viva, clave: 'Universalidad, jerarquía, solidaridad e igualdad.' }
    expect(analizarDuplicados([nueva], [otra]).some((a) => /MISMA RESPUESTA/.test(a.motivo))).toBe(false)
  })

  it('compara el TEXTO de la clave, no su índice', () => {
    // La misma respuesta colocada en otra letra tiene que emparejar igual.
    const barajada = { ...nueva, options: ['Universalidad, unidad, solidaridad e igualdad.', 'x', 'y', 'z'], correct_option: 0 }
    expect(analizarDuplicados([barajada], [viva]).some((a) => /MISMA RESPUESTA/.test(a.motivo))).toBe(true)
  })

  it('con el formato ANTIGUO (solo el enunciado) no inventa el aviso', () => {
    // Degradar es correcto: sin la clave no se puede afirmar nada sobre ella.
    const avisos = analizarDuplicados([nueva], [viva.question_text])
    expect(avisos.some((a) => /MISMA RESPUESTA/.test(a.motivo))).toBe(false)
  })

  it('una viva sin clave resuelta no empareja con una nueva sin clave resoluble', () => {
    const sinClave = { question_text: nueva.question_text, options: [], correct_option: 0 }
    expect(analizarDuplicados([sinClave], [{ question_text: viva.question_text, clave: '' }])).toEqual([])
  })
})
