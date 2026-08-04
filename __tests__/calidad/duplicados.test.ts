// __tests__/calidad/duplicados.test.ts
//
// El criterio de «esta pregunta ya está en el banco». Lo que se fija aquí no es cosmético:
// cada caso viene de una medición del 31/07/2026 en la que el criterio equivocado habría
// borrado preguntas buenas o dejado pasar las repetidas. [T-408 · T-410]

// eslint-disable-next-line @typescript-eslint/no-var-requires
const dup = require('@/lib/calidad/duplicados.js')

describe('normalizar — qué diferencias NO son diferencias', () => {
  it('ignora puntuación, espacios y mayúsculas', () => {
    expect(dup.normalizar('¿Qué palabra sobra?')).toBe(dup.normalizar('que palabra   sobra'))
    // El caso real: las copias del banco solo se diferenciaban en el punto final.
    expect(dup.normalizar('Serio.')).toBe(dup.normalizar('Serio'))
  })

  it('ignora los acentos pero CONSERVA la ñ', () => {
    expect(dup.normalizar('Círculo')).toBe('circulo')
    // Si la ñ se fuera con los acentos, «año» y «ano» serían la misma palabra.
    expect(dup.normalizar('año')).toBe('año')
    expect(dup.normalizar('año')).not.toBe(dup.normalizar('ano'))
  })

  it('quita el HTML, que en este banco es basura de importación', () => {
    expect(dup.normalizar('Indique la palabra<br> sobrante')).toBe(
      dup.normalizar('Indique la palabra sobrante'))
  })

  it('trata null y undefined como cadena vacía en vez de romper', () => {
    expect(dup.normalizar(null)).toBe('')
    expect(dup.normalizar(undefined)).toBe('')
  })
})

describe('claveOpciones — las copias vienen BARAJADAS', () => {
  it('empareja dos copias con las mismas opciones en distinto orden', () => {
    const a = dup.claveOpciones(['Círculo', 'Cubo', 'Circunferencia', 'Triángulo'])
    const b = dup.claveOpciones(['Cubo', 'Triángulo', 'Círculo', 'Circunferencia'])
    expect(a).toBe(b)
  })

  it('NO empareja dos preguntas que cambian una sola opción', () => {
    // El caso de Laura Zurdo: la discrepancia de clave viajaba disfrazada de opción distinta.
    const a = dup.claveOpciones(['65.535', '64.000', '32.767', '16.384'])
    const b = dup.claveOpciones(['65.535', '60.000', '32.767', '16.384'])
    expect(a).not.toBe(b)
  })

  it('descarta las opciones vacías: hay oposiciones de 3 alternativas POR DISEÑO', () => {
    // Policía Nacional: 989 de 991 oficiales con la D nula. Si la D vacía contase, todas
    // esas preguntas compartirían un trozo de clave y se emparejarían entre sí.
    const conD = dup.claveOpciones(['Sí', 'No', 'A veces', null])
    const sinD = dup.claveOpciones(['Sí', 'No', 'A veces'])
    expect(conD).toBe(sinD)
    expect(conD.split('|')).toHaveLength(3)
  })
})

describe('huellaContenido — el 97 % de los falsos positivos vivían aquí', () => {
  it('separa dos psicotécnicas que comparten enunciado genérico pero tienen figura distinta', () => {
    const a = dup.huellaContenido({ imageUrl: 'https://x/serie-1.png', contentData: {} })
    const b = dup.huellaContenido({ imageUrl: 'https://x/serie-2.png', contentData: {} })
    expect(a).not.toBe(b)
  })

  it('separa dos rejillas distintas aunque no haya imagen', () => {
    const a = dup.huellaContenido({ contentData: { tables: [{ rows: [['a', 'b']] }] } })
    const b = dup.huellaContenido({ contentData: { tables: [{ rows: [['a', 'c']] }] } })
    expect(a).not.toBe(b)
  })

  it('empareja el mismo contenido aunque las claves del JSON vengan en otro orden', () => {
    const a = dup.huellaContenido({ contentData: { chart: 'x', total: 3 } })
    const b = dup.huellaContenido({ contentData: { total: 3, chart: 'x' } })
    expect(a).toBe(b)
  })

  it('trata «sin contenido» de forma estable', () => {
    expect(dup.huellaContenido({})).toBe(dup.huellaContenido({ imageUrl: null, contentData: null }))
  })
})

describe('bandaGrupo — se compara el TEXTO de la respuesta, nunca el índice', () => {
  it('marca error cuando las gemelas responden cosas distintas', () => {
    expect(dup.bandaGrupo([
      { textoCorrecta: '65.535' },
      { textoCorrecta: '64.000' },
    ])).toBe('error')
  })

  it('marca warn cuando es la misma respuesta con distinta puntuación', () => {
    // Con los índices, este grupo habría gritado «clave contradictoria»: las opciones estaban
    // barajadas y correct_option valía 1 en una copia y 2 en la otra.
    expect(dup.bandaGrupo([
      { textoCorrecta: 'Serio.' },
      { textoCorrecta: 'Serio' },
    ])).toBe('warn')
  })
})

describe('decidirSuperviviente — quién se queda', () => {
  const base = { oficial: false, expl: 0, servida: 0, alta: '2026-01-01' }

  it('la de examen oficial gana a todo lo demás', () => {
    const [queda] = dup.decidirSuperviviente([
      { ...base, id: 'generada', expl: 900, servida: 500 },
      { ...base, id: 'oficial', oficial: true },
    ])
    expect(queda.id).toBe('oficial')
  })

  it('a igualdad de origen, gana la que tiene explicación', () => {
    const [queda] = dup.decidirSuperviviente([
      { ...base, id: 'sin-expl', servida: 10 },
      { ...base, id: 'con-expl', expl: 300 },
    ])
    expect(queda.id).toBe('con-expl')
  })

  it('a igualdad de explicación, gana la más servida (tiene el historial de respuestas)', () => {
    const [queda, fuera] = dup.decidirSuperviviente([
      { ...base, id: 'poco', expl: 100, servida: 2 },
      { ...base, id: 'mucho', expl: 100, servida: 400 },
    ])
    expect(queda.id).toBe('mucho')
    expect(fuera.map((f: { id: string }) => f.id)).toEqual(['poco'])
  })

  it('devuelve TODAS las sobrantes cuando el grupo tiene más de dos copias', () => {
    const [, fuera] = dup.decidirSuperviviente([
      { ...base, id: 'a' }, { ...base, id: 'b' }, { ...base, id: 'c' }, { ...base, id: 'd' },
    ])
    expect(fuera).toHaveLength(3)
  })
})

describe('unidoSoloPorTildes — no borrar la diferencia que la pregunta pregunta', () => {
  it('avisa cuando lo único que unió al grupo fue quitar la tilde', () => {
    // Caso real del banco (c3e10f4e / a01cda84): «cómo salir» y «como salir». Aquí es una errata,
    // pero en una pregunta de ortografía la tilde ES la respuesta, y entonces fusionar borra
    // justo lo que se examina. Por eso se aparta en vez de aplicarse solo.
    expect(dup.unidoSoloPorTildes([
      ['Situación embarazosa, conflicto del cual no se sabe cómo salir'],
      ['Situación embarazosa, conflicto del cual no se sabe como salir.'],
    ])).toBe(true)
  })

  it('NO avisa cuando la diferencia es solo el punto final o el orden', () => {
    // 13 de los 40 grupos medidos el 31/07 son de este tipo: transcripción, no contenido.
    // Apartarlos también dejaría la herramienta sin nada que hacer.
    expect(dup.unidoSoloPorTildes([
      ['Serio', 'Tolerante', 'Cohibido', 'Zalamero'],
      ['Zalamero.', 'Cohibido.', 'Serio.', 'Tolerante.'],
    ])).toBe(false)
  })

  it('NO avisa cuando las copias son idénticas', () => {
    expect(dup.unidoSoloPorTildes([['Círculo', 'Cubo'], ['Cubo', 'Círculo']])).toBe(false)
  })

  it('la ñ no cuenta como tilde en ninguno de los dos caminos', () => {
    expect(dup.normalizarConTildes('año')).toBe('año')
    expect(dup.unidoSoloPorTildes([['año'], ['año']])).toBe(false)
  })
})

describe('esJuegoGenerico — solo para el corte parafraseado', () => {
  it('descarta los juegos de cifras sueltas y los de «figura A/B/C/D»', () => {
    expect(dup.esJuegoGenerico('13|14|16|18')).toBe(true)
    expect(dup.esJuegoGenerico('figuraa|figurab|figurac|figurad')).toBe(true)
  })

  it('descarta los juegos demasiado cortos para ser evidencia', () => {
    expect(dup.esJuegoGenerico('si|no|nose')).toBe(true)
  })

  it('acepta un juego de vocabulario, que es donde vive el duplicado parafraseado', () => {
    expect(dup.esJuegoGenerico('coherencia|desequilibrio|desnivel|paridad')).toBe(false)
  })
})

describe('sqlNormalizar — el gemelo en SQL del normalizador', () => {
  it('interpola la columna que se le pasa', () => {
    expect(dup.sqlNormalizar('q.question_text')).toContain('q.question_text')
  })

  it('conserva la ñ también en SQL (no está en la tabla de translate)', () => {
    const sql = dup.sqlNormalizar('x')
    expect(sql).not.toMatch(/translate\([^)]*ñ/)
    expect(sql).toContain('[^a-z0-9ñ]+')
  })
})

// ─── Corte parafraseado del banco LEGISLATIVO [T-425] ───────────────────────────────────
//
// Todos los pares de aquí abajo son REALES: salieron del barrido del 31/07/2026 sobre las
// preguntas activas. Los que están marcados como límite conocido NO son bugs a corregir —
// son la razón por la que este corte solo LISTA y nunca jubila en automático.

describe('compararEnunciados — ratio y palabras distintas son dos medidas, no una', () => {
  it('dos textos idénticos: solape 1 y ninguna palabra distinta', () => {
    const t = 'El plazo de resolución será de tres meses'
    expect(dup.compararEnunciados(t, t)).toEqual({ solape: 1, distintas: 0 })
  })

  it('cuenta las palabras distintas en ABSOLUTO, que es lo que delata al supuesto práctico', () => {
    // Mismo preámbulo largo, pregunta final distinta: el ratio sube, el absoluto NO.
    const preambulo = 'Manuela es una paciente de 73 años diagnosticada de cáncer de colon intervenida quirúrgicamente con metástasis hepáticas ingresada en la unidad'
    const a = `${preambulo} ¿qué posición corporal debe adoptar para la exploración abdominal?`
    const b = `${preambulo} ¿qué tipo de dieta debe pautarse tras la intervención quirúrgica realizada?`
    const m = dup.compararEnunciados(a, b)
    expect(m.solape).toBeGreaterThan(0.75)   // parecidísimos por el preámbulo…
    expect(m.distintas).toBeGreaterThan(10)  // …y aun así, no son gemelas
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: true })).toBe('cola')
  })

  it('ignora el HTML y los acentos, igual que el resto del módulo', () => {
    expect(dup.palabrasComparables('<p>Régimen  jurídico</p>')).toEqual(['regimen', 'juridico'])
  })

  it('no revienta ni con null ni con texto vacío', () => {
    expect(dup.compararEnunciados(null, 'algo').solape).toBe(0)
    expect(dup.compararEnunciados('', '').distintas).toBe(Infinity)
  })
})

describe('bandaParafraseada — dónde está la frontera y por qué', () => {
  it('GEMELA: el mismo enunciado con una versión de más («Excel 365» / «Excel»)', () => {
    const a = 'En una hoja Excel 365 la celda A1 contiene el texto "Referencia 01" y la celda A2 contiene la fórmula "=EXTRAE(A1;12;2)". ¿Qué resultado obtenemos en la celda A2?'
    const b = 'En una hoja Excel la celda A1 contiene el texto "Referencia 01" y la celda A2 contiene la fórmula "=EXTRAE(A1;12;2)". ¿Qué resultado obtenemos en la celda A2?'
    const m = dup.compararEnunciados(a, b)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: dup.mismaRespuesta('01', '01') })).toBe('gemela')
  })

  it('GEMELA: mismas palabras en otro orden («¿cuántos hosts…?» al principio o al final)', () => {
    const a = '¿Cuántos hosts pueden direccionarse si se utilizan 5 bits en el protocolo IP para identificar los hosts de una subred?'
    const b = 'Si se utilizan 5 bits en el protocolo IP para identificar los hosts de una subred, ¿cuántos hosts pueden direccionarse?'
    const m = dup.compararEnunciados(a, b)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: true })).toBe('gemela')
  })

  it('NO gemela si responden cosas distintas, por calcado que esté el enunciado', () => {
    // «polvorín semienterrado» / «superficial»: 50.000 kg contra 25.000 kg.
    const a = 'Reglamento de Explosivos. La capacidad máxima de almacenamiento de cada polvorín semienterrado será de:'
    const b = 'Reglamento de Explosivos. La capacidad máxima de almacenamiento de cada polvorín superficial será de:'
    const m = dup.compararEnunciados(a, b)
    expect(dup.mismaRespuesta('50.000 kilogramos netos', '25.000 kilogramos netos')).toBe(false)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: false })).toBe('cola')
  })

  it('el par que originó la ficha cae en la COLA, no en la banda alta', () => {
    // 373bed31 / 6f9e4831 — autonomía municipal, CE 137. Son gemelas de verdad, pero un
    // umbral estrecho no llega a ellas: por eso la cola se revisa y no se descarta.
    const a = 'La Constitución garantiza el principio de autonomía de los municipios para la gestión de sus respectivos intereses en su artículo:'
    const b = 'La Constitución garantiza el principio de autonomía de los municipios y provincias en su artículo:'
    const m = dup.compararEnunciados(a, b)
    expect(m.solape).toBeGreaterThan(0.70)
    expect(m.distintas).toBeGreaterThan(dup.UMBRAL_GEMELA.distintas)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: true })).toBe('cola')
  })

  it('LÍMITE CONOCIDO: una palabra de contenido cambiada pasa el umbral — por eso no se aplica solo', () => {
    // «prevención secundaria» / «terciaria»: son preguntas DISTINTAS y la banda las da por gemelas.
    // Este test fija el límite a propósito: si alguien lo «arregla» bajando el umbral, que sea
    // una decisión consciente y no un descuido.
    const a = 'En los pacientes con enfermedad coronaria establecida, la prevención secundaria puede disminuir la probabilidad de eventos coronarios agudos. ¿Qué medida NO forma parte de esa prevención secundaria?'
    const b = 'En los pacientes con enfermedad coronaria establecida, la prevención terciaria puede disminuir la probabilidad de eventos coronarios agudos. ¿Qué medida NO forma parte de esa prevención terciaria?'
    const m = dup.compararEnunciados(a, b)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: true })).toBe('gemela')
  })

  it('descarta lo que no se parece en nada aunque comparta el juego de opciones', () => {
    const m = dup.compararEnunciados('I have two pencils. Do you want this one or the ___ one?',
                                     'Please give me ___ chance.')
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: false })).toBeNull()
  })
})

describe('mismaRespuesta — el texto de la correcta, nunca su índice', () => {
  it('el punto final y el símbolo de grado no son una respuesta distinta', () => {
    expect(dup.mismaRespuesta('2 senadores cada una de ellas', '2 senadores cada una de ellas.')).toBe(true)
    expect(dup.mismaRespuesta('1º orientación', '1° orientación')).toBe(true)
  })

  it('dos cifras distintas sí lo son', () => {
    expect(dup.mismaRespuesta('20', '10')).toBe(false)
  })

  it('sin texto de respuesta no afirma que coincidan', () => {
    expect(dup.mismaRespuesta(null, null)).toBe(false)
    expect(dup.mismaRespuesta('', '')).toBe(false)
  })
})

describe('corteAcumulado — convertir «319 grupos» en «empieza por estos 87»', () => {
  it('devuelve cuántos elementos juntan la fracción pedida', () => {
    // 80 de 100: el primero solo llega a 0,50; hacen falta dos.
    expect(dup.corteAcumulado([50, 30, 10, 10], 0.8)).toBe(2)
  })

  it('una cola larga de ceros no engorda el corte', () => {
    // Los 122 grupos que no se han servido nunca no son trabajo prioritario.
    expect(dup.corteAcumulado([100, 0, 0, 0, 0], 0.8)).toBe(1)
  })

  it('sin exposición no hay «el 80%»: devuelve 0, no la lista entera', () => {
    // Si esto devolviera length, una tanda que no ha visto NADIE se presentaría como
    // trabajo urgente al completo, que es justo lo contrario de para qué sirve el corte.
    expect(dup.corteAcumulado([0, 0, 0], 0.8)).toBe(0)
    expect(dup.corteAcumulado([], 0.8)).toBe(0)
  })

  it('si todo está repartido por igual, el corte es proporcional a la fracción', () => {
    expect(dup.corteAcumulado([1, 1, 1, 1, 1], 0.8)).toBe(4)
  })
})

// ─── La guarda del ORDEN [T-439] ────────────────────────────────────────────────────────
//
// El test de arriba fija que una palabra de contenido cambiada pasa el umbral. Este fija la
// SEGUNDA señal que sí lo ve, y sobre todo el caso que el criterio por conjunto no puede ver
// ni en principio: cuando las dos palabras intercambiadas YA salen antes en la frase.

describe('mismoOrdenDeContenido — lo que el conjunto de palabras no puede ver', () => {
  const A = 'El artículo 81 de la Ley 39/2015 prevé solicitar con carácter preceptivo informes y dictámenes en los procedimientos de responsabilidad patrimonial. ¿Cuántos dictámenes se solicitan?'
  const B = 'El artículo 81 de la Ley 39/2015 prevé solicitar con carácter preceptivo informes y dictámenes en los procedimientos de responsabilidad patrimonial. ¿Cuántos informes se solicitan?'

  it('el punto ciego es REAL: mismo conjunto de palabras, solape 1 y cero distintas', () => {
    const m = dup.compararEnunciados(A, B)
    expect(m.solape).toBe(1)
    expect(m.distintas).toBe(0)
    expect(dup.bandaParafraseada({ ...m, mismaRespuesta: true })).toBe('gemela')
  })

  it('y la secuencia SÍ lo ve — no era irreducible, era que se miraba el conjunto', () => {
    expect(dup.mismoOrdenDeContenido(A, B)).toBe(false)
  })

  it('caza el otro par real del barrido: «cita en evento» / «evento en una cita»', () => {
    // Grupo #60 de los 87 más expuestos. Preguntan lo contrario y usan las mismas palabras.
    expect(dup.mismoOrdenDeContenido(
      '¿Podemos convertir una cita en evento en el calendario de Outlook?',
      '¿Podemos convertir un evento en una cita en el calendario de Outlook?')).toBe(false)
  })

  it('no se altera por la forma de citar la norma, que es lo único que debe ignorar', () => {
    expect(dup.mismoOrdenDeContenido(
      'De acuerdo con el art. 53.2 CE, ¿qué derechos son susceptibles de amparo?',
      'De acuerdo con el artículo 53.2 de la Constitución, ¿qué derechos son susceptibles de amparo?')).toBe(true)
  })

  it('«no» y «correcta» NO son ruido: negar la pregunta la invierte', () => {
    // Estaban en la lista de ruido en la primera pasada y eso clasificó mal tres grupos.
    expect(dup.RUIDO_DE_CITA.has('no')).toBe(false)
    expect(dup.RUIDO_DE_CITA.has('correcta')).toBe(false)
    expect(dup.mismoOrdenDeContenido(
      'Señale la respuesta correcta sobre el silencio administrativo',
      'Señale la respuesta no correcta sobre el silencio administrativo')).toBe(false)
  })

  it('ninguna cifra es ruido: puede ser el artículo por el que se pregunta', () => {
    expect(dup.secuenciaDeContenido('el artículo 12 de la Ley 39/2015')).toContain('12')
    expect(dup.mismoOrdenDeContenido('Según el artículo 12 de la Ley 39/2015',
                                     'Según el artículo 13 de la Ley 39/2015')).toBe(false)
  })
})

describe('validarAdjudicacion — la puerta antes de una escritura TERMINAL', () => {
  const vivos = (arr: any[]) => new Map(arr.map((r) => [r.id, r]))

  it('deja pasar lo que se adjudicó y no ha cambiado', () => {
    const plan = [{ quedaId: 'A', jubilar: [{ id: 'B', estado: 'approved' }] }]
    expect(dup.validarAdjudicacion(plan, vivos([
      { id: 'B', is_official_exam: false, lifecycle_state: 'approved' }]))).toEqual([])
  })

  it('rehúsa jubilar una pregunta de examen OFICIAL', () => {
    const plan = [{ quedaId: 'A', jubilar: [{ id: 'B', estado: 'approved' }] }]
    const p = dup.validarAdjudicacion(plan, vivos([
      { id: 'B', is_official_exam: true, lifecycle_state: 'approved' }]))
    expect(p).toHaveLength(1)
    expect(p[0].causa).toBe('examen_oficial')
  })

  it('rehúsa si el estado cambió entre adjudicar y aplicar', () => {
    // Entre leer los grupos y escribir puede pasar una hora, y otra sesión o un cron haber
    // movido la pregunta. Aplicar con el estado viejo es escribir sobre lo que ya no se vio.
    const plan = [{ quedaId: 'A', jubilar: [{ id: 'B', estado: 'approved' }] }]
    const p = dup.validarAdjudicacion(plan, vivos([
      { id: 'B', is_official_exam: false, lifecycle_state: 'needs_human' }]))
    expect(p[0]).toMatchObject({ causa: 'estado_cambiado', esperado: 'approved', actual: 'needs_human' })
  })

  it('rehúsa un id que no existe (se copió mal a mano)', () => {
    const plan = [{ quedaId: 'A', jubilar: [{ id: 'ZZ', estado: 'approved' }] }]
    expect(dup.validarAdjudicacion(plan, vivos([]))[0]?.causa).toBe('no_existe')
  })

  it('rehúsa jubilar al propio superviviente', () => {
    // Un despiste al escribir el plan dejaría el grupo ENTERO fuera del banco.
    const plan = [{ quedaId: 'B', jubilar: [{ id: 'B', estado: 'approved' }] }]
    const causas = dup.validarAdjudicacion(plan, vivos([
      { id: 'B', is_official_exam: false, lifecycle_state: 'approved' }])).map((x: any) => x.causa)
    expect(causas).toContain('se_jubila_al_superviviente')
  })

  it('un solo problema para el plan ENTERO, no solo su grupo', () => {
    const plan = [
      { quedaId: 'A', jubilar: [{ id: 'B', estado: 'approved' }] },
      { quedaId: 'C', jubilar: [{ id: 'D', estado: 'approved' }] },
    ]
    const p = dup.validarAdjudicacion(plan, vivos([
      { id: 'B', is_official_exam: false, lifecycle_state: 'approved' },
      { id: 'D', is_official_exam: true, lifecycle_state: 'approved' }]))
    expect(p).toHaveLength(1)  // el runner aborta entero con que haya uno
  })
})

// ─── Corte MISMA CLAVE [T-519] ──────────────────────────────────────────────────────────
//
// Los números de estas pruebas NO son inventados: son los casos reales sobre los que se
// calibró el umbral el 03/08/2026 (impugnación 9e0d7418). Si alguien mueve el umbral, aquí
// se entera de a costa de qué.
describe('duplicados · misma respuesta en el mismo artículo con otros distractores', () => {
  // Caso cierto: las dos preguntan «¿en qué principios se fundamenta la Seguridad Social?»
  const MARTA_A = 'A tenor de lo establecido en el artículo 2 del texto refundido de la Ley General de la Seguridad Social aprobado por Real Decreto Legislativo 8/2015, de 30 de octubre, el sistema de la seguridad social se fundamenta en los principios de:'
  const MARTA_B = 'Según el artículo 2 del Real Decreto Legislativo 8/2015 el sistema de la Seguridad Social, configurado por la acción protectora en sus modalidades contributiva y no contributiva, se fundamenta en los principios de:'
  // Falso positivo conocido: dos subhechos DISTINTOS del art. 5 LOFCS que comparten la
  // etiqueta «Relaciones con la comunidad» como respuesta.
  const LOFCS_A = '¿Cuál de los principios básicos de actuación se refiere a la utilización de armas de fuego?'
  const LOFCS_B = 'Los principios básicos de actuación contemplan “impedir, en el ejercicio de su actuación profesional, cualquier práctica abusiva, arbitraria o discriminatoria”. ¿A cuál corresponde?'

  it('el caso que originó la ficha queda POR ENCIMA del corte', () => {
    expect(dup.solapeDeContenido(MARTA_A, MARTA_B)).toBeGreaterThanOrEqual(dup.UMBRAL_MISMA_CLAVE.cola)
  })

  it('el falso positivo conocido queda POR DEBAJO del corte', () => {
    // Medido: 0,12–0,27. Si esto sube, el badge se llena de subhechos legítimos.
    expect(dup.solapeDeContenido(LOFCS_A, LOFCS_B)).toBeLessThan(dup.UMBRAL_MISMA_CLAVE.cola)
  })

  it('descarta la pareja cuando las OPCIONES también coinciden (ya la ven los otros dos cortes)', () => {
    expect(dup.bandaMismaClave({ solape: 1, mismasOpciones: true })).toBeNull()
  })

  it('gradúa: gemela por encima de 0,85, cola por encima de 0,55, nada por debajo', () => {
    expect(dup.bandaMismaClave({ solape: 0.9, mismasOpciones: false })).toBe('gemela')
    expect(dup.bandaMismaClave({ solape: 0.6, mismasOpciones: false })).toBe('cola')
    expect(dup.bandaMismaClave({ solape: 0.3, mismasOpciones: false })).toBeNull()
  })

  it('empareja por el TEXTO de la respuesta, nunca por su índice (las copias vienen barajadas)', () => {
    const a = { question_text: MARTA_A, opciones: ['X larga y distinta', 'Universalidad, unidad, solidaridad e igualdad.', 'Y', 'Z'], correctOption: 1 }
    const b = { question_text: MARTA_B, opciones: ['Universalidad, unidad, solidaridad e igualdad.', 'P', 'Q', 'R'], correctOption: 0 }
    expect(dup.parejaMismaClave(a, b)).not.toBeNull()
  })

  it('no empareja si la respuesta correcta es OTRA, por parecidos que sean los enunciados', () => {
    const a = { question_text: MARTA_A, opciones: ['Universalidad, unidad, solidaridad e igualdad.', 'b', 'c', 'd'], correctOption: 0 }
    const b = { question_text: MARTA_A, opciones: ['Universalidad, jerarquía, solidaridad e igualdad.', 'b', 'c', 'd'], correctOption: 0 }
    expect(dup.parejaMismaClave(a, b)).toBeNull()
  })

  it('una respuesta vacía no empareja con otra vacía', () => {
    const q = (t: string) => ({ question_text: t, opciones: ['', 'b', 'c', 'd'], correctOption: 0 })
    expect(dup.parejaMismaClave(q(MARTA_A), q(MARTA_B))).toBeNull()
  })
})
