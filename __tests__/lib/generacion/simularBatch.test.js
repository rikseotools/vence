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
  analizarDuplicados,
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
