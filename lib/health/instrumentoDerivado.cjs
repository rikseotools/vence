// lib/health/instrumentoDerivado.cjs — núcleo puro del detector `pregunta_instrumento_derivado`:
// preguntas ACTIVAS que piden el CONTENIDO de un instrumento derivado (un Plan, una Estrategia, un
// Informe) colgadas del artículo que se limita a ORDENAR QUE ESE INSTRUMENTO EXISTA.
//
// ## El fallo que detecta
//
// El art. 7 de la Ley 12/2007 andaluza dice, en resumen, «el Consejo de Gobierno aprobará un Plan
// Estratégico para la Igualdad, con periodicidad no inferior a cuatro años». Eso es TODO lo que dice.
// Colgadas de él había nueve preguntas, y seis pedían cosas que solo están DENTRO del Plan de 2022:
// sus ejes básicos, sus objetivos estratégicos, hasta cuándo tiene vigencia, quién publica su memoria
// de evaluación. El opositor abre el artículo desde la pregunta y no hay nada que leer.
//
// ## Por qué NO lo ve el detector hermano (`vinculoArticuloVecino`)
//
// Aquél busca preguntas mal colgadas **teniendo un vecino que sí responde**, y su arreglo es
// re-vincular. Aquí **no responde NINGÚN artículo de la ley**, porque la respuesta no está en la ley:
// está en un documento que la ley manda redactar. Sin vecino al que apuntar, aquel detector se queda
// mudo por construcción. Ese es exactamente el punto ciego que esto cubre, y por eso son hermanos y
// no el mismo: comparten las primitivas de medida, pero la conclusión y el arreglo son distintos.
//
//   · vecino  → el vínculo está mal          → re-vincular al artículo correcto
//   · derivado → el contenido no está en la ley → importar el instrumento, o retirar la pregunta
//
// ## De dónde salió (01/08/2026)
//
// De cinco impugnaciones seguidas de un mismo usuario premium (m.g.espadero) sobre la Ley 12/2007:
// *«Esto no está dentro del artículo en el Temario»*. Tenía razón en las cinco. Y su quinta observación
// fue más lejos que la queja: *«veo que le dais mucha importancia porque sobre él preguntáis bastante
// en este artículo»* — o sea, preguntamos mucho de un documento que no enseñamos. Lo cazó él, no
// nosotros, y ningún detector del barrido podía verlo.
//
// ## Precisión: runner BAJO DEMANDA, NO pinga el badge
//
// Mismo criterio que el hermano y que la frontera de títulos del scope: la señal es buena pero no
// perfecta (una pregunta puede citar el Plan y ser contestable por el artículo — «¿quién lo aprueba?»
// lo es). Con un humano leyendo la salida es precisa; en el panel enseñaría a ignorar el panel.
//
// Runbook: `docs/runbooks/salud-contenido.md`.

// Primitivas COMPARTIDAS con el detector hermano. No se recopian a propósito: una tercera copia de la
// misma medida es como nacieron los cinco escritores de `seguimiento_url` que motivaron el registro de
// herramientas (CLAUDE.md, T-130). Si cambia el recall, cambia para los dos a la vez.
const { norm, words, recall, RE_META } = require('./vinculoArticuloVecino.cjs')

/**
 * Instrumentos derivados: documentos que una norma MANDA elaborar y que tienen contenido propio.
 * La lista es cerrada a propósito — abrirla a cualquier sustantivo dispararía con media ley.
 *
 * `estrategia de <materia>` se añadió el 01/08/2026 tras una SEGUNDA tanda del mismo usuario: la
 * «I Estrategia de Conciliación en Andalucía 2022-2026» («el salario emocional», «la responsabilidad
 * de cuidado») colgaba del art. 39, que habla de centros infantiles en los centros de trabajo. La
 * lista solo cubría `estrategia (nacional|andaluza|estatal|espanola)`, así que un instrumento
 * nombrado por su MATERIA quedaba invisible. Es la tercera vez que una lista cerrada se queda corta:
 * al añadir un tipo nuevo, mirar si la forma de nombrarlo (por ámbito, por materia, por ordinal) ya
 * está cubierta.
 */
/**
 * ⚠️ CUARTA ampliación (04/08/2026) — y por eso ésta va por FAMILIAS, no por palabras.
 *
 * El aviso de arriba («es la tercera vez que una lista cerrada se queda corta») volvió a cumplirse:
 * Manolo García impugnó TRES preguntas seguidas de la Ley 13/2007 andaluza y el detector daba **0**
 * sobre esa ley. Su art. 57 bis manda establecer una **ventanilla única** y el 60 promover
 * **protocolos de actuación**; las preguntas pedían cuándo se creó la ventanilla (está en el
 * Decreto 96/2021), quién la dirige, y qué dice el protocolo de respuesta pública. Ninguna de esas
 * palabras estaba en la lista, así que las cuatro preguntas malas eran invisibles.
 *
 * Lo que se añade no son tres palabras sino los TIPOS de instrumento que una norma manda crear y
 * que tienen contenido propio: protocolos, ventanillas/sistemas únicos, registros, observatorios y
 * catálogos. Sigue siendo cerrada —abrirla a cualquier sustantivo dispararía con media ley— pero ya
 * no se queda corta por la forma de nombrarlo. Y la mitad que sostiene la precisión no cambia:
 * `RE_CONTENIDO_PROPIO` exige que la pregunta pida algo que solo existe DENTRO del documento.
 */
const RE_INSTRUMENTO =
  /\b(plan(es)? (estrategico|estrategicos|de igualdad|nacional|director|de accion)|estrategia (nacional|andaluza|estatal|espanola|de [a-z]+)|informe de evaluacion de impacto|protocolos? (de actuacion|de respuesta|para una intervencion|de intervencion|de coordinacion)|ventanilla unica|sistema unico|registro (unico|andaluz|estatal|nacional|de [a-z]+)|observatorio (andaluz|estatal|nacional|de [a-z]+)|catalogo (de|unico))/

/**
 * Marcas de que la pregunta va del CONTENIDO del instrumento y no de la previsión legal que lo crea.
 *
 * Es la mitad que sostiene la precisión. «¿Quién aprueba el Plan Estratégico?» cita el instrumento
 * pero se responde con el artículo; «¿cuáles son sus ejes básicos?» no. La diferencia está en que la
 * segunda pide algo que solo existe DENTRO del documento: su articulado interno, su vigencia, su
 * estructura, o un año concreto que la ley nunca fija.
 */
const RE_CONTENIDO_PROPIO =
  /\b(eje|ejes|objetivo estrategico|objetivos estrategicos|vigencia|vigente hasta|hasta el ano|estructura|se articula|memoria|evaluacion intermedia|linea de actuacion|lineas de actuacion|medida|se aprobo|primer plan|\b(19|20)\d{2}\b)/

/** Umbral de «este texto responde a esta opción». Heredado del hermano para no tener dos varas. */
const UMBRAL_RESPONDE = 0.5

/**
 * Mínimo de palabras significativas para que un recall alto SIGNIFIQUE algo.
 *
 * Lo enseñó el caso más fino de los cinco: *«¿Quién publicará la memoria de la evaluación intermedia
 * y final del Plan?»* con clave «El Instituto Andaluz de la Mujer». Son TRES palabras, y las tres
 * están en el art. 7 — pero están porque el artículo dice que el IAM **asesora** y que le **remiten**
 * los planes, no que publique memoria alguna. El recall daba 1,0 sobre una respuesta que el artículo
 * no da. El usuario lo vio y la medida no.
 *
 * Un recall calculado sobre tres palabras no es una medida, es una coincidencia de nombres. Por
 * debajo de este umbral la comparación se declara NO CONCLUYENTE y el caso sale a que lo lea una
 * persona, en vez de darlo por bueno en silencio — que es el modo de fallo caro.
 */
const MIN_PALABRAS_FIABLES = 4

/**
 * Palabras de más de 3 letras que NO aportan contenido. El filtro `words()` compartido solo corta por
 * longitud, así que preposiciones como «para» cuentan como significativas y **inflan el solape**.
 *
 * Lo enseñó la única de las cinco impugnaciones que el detector fallaba: clave «En 2010 para el
 * periodo 2010-2013». Sus cuatro palabras eran `2010`, `para`, `periodo`, `2013` — dos cifras y una
 * preposición. Con eso alcanzó recall 0,5 contra un artículo cualquiera de la ley y el caso se cedió
 * al detector hermano por un parecido que no significaba nada.
 *
 * ⚠️ Se aplica SOLO al contar si la clave es medible, NUNCA dentro de `recall`: esa función la
 * comparte el detector hermano, que está calibrado con ella tal cual. Cambiarla movería su precisión
 * medida sin que nadie lo pidiera.
 */
const PALABRAS_FUNCIONALES = new Set([
  'para', 'como', 'cuando', 'donde', 'desde', 'hasta', 'sobre', 'entre', 'segun', 'esta', 'este',
  'esto', 'esos', 'esas', 'aquel', 'todos', 'todas', 'cada', 'sera', 'seran', 'sido', 'haber',
  'tener', 'debe', 'deben', 'podra', 'podran', 'ello', 'ellos', 'ellas', 'dicha', 'dicho',
])

/** Palabras con contenido real: ni funcionales ni cifras sueltas. */
const palabrasFuertes = (s) =>
  [...words(s)].filter((w) => !PALABRAS_FUNCIONALES.has(w) && !/^\d+$/.test(w))


/**
 * Años que identifican a un instrumento CONCRETO: «I Plan de Igualdad … 2023-2027», «Plan
 * Estratégico 2022-2028». Cuando la pregunta nombra uno así, está preguntando por ESE documento.
 */
const RE_ANIOS = /\b(19|20)\d{2}\b/g

/**
 * ¿El artículo habla del MISMO instrumento fechado por el que pregunta el enunciado?
 *
 * Es la guarda que sostiene la medida cuando el artículo comparte vocabulario con la clave sin decir
 * nada del documento. El caso que la motivó: el art. 32 de la Ley 12/2007 se titula «Planes de
 * igualdad en el empleo en la Administración pública», así que contra una clave que dice «marcar las
 * prioridades de la Administración General de la Junta de Andalucía…» el recall subía a 0,63 —
 * puro solape de vocabulario— y el detector daba por respondida una pregunta sobre el I Plan
 * 2023-2027, que ese artículo no menciona. Lo cazó el usuario, no la medida.
 *
 * Regla: si el enunciado fecha el instrumento y el artículo no trae NINGUNO de esos años, el recall
 * deja de ser prueba de que responde.
 */
function articuloHablaDelMismoInstrumento(enunciado, articulo) {
  // Antes de mirar los años hay que QUITAR la cita de la norma. «Ley 12/2007, de 26 de noviembre»
  // trae un año que NO fecha al instrumento sino a la ley que se está citando, y el cuerpo de un
  // artículo no repite la fecha de su propia ley — así que sin esto la guarda marcaba como sospechosa
  // cualquier pregunta que citara su norma por el nombre completo. Medido: producía 4 falsos
  // positivos en la Ley 12/2007, y los cuatro sobre preguntas verificadas a mano como LEGÍTIMAS
  // («¿quién aprueba el Plan Estratégico?» está literal en el art. 7).
  // OJO: se opera sobre el texto YA NORMALIZADO, donde `norm()` ha convertido «Ley 12/2007» en
  // «ley 12 2007» — la barra desaparece. Buscar la forma con barra no casa nunca.
  const sinCita = norm(enunciado)
    .replace(/\b(ley organica|ley|real decreto legislativo|real decreto ley|real decreto|decreto legislativo|decreto|reglamento|orden|rd|rdl)\s+\d+\s+(19|20)\d{2}/g, ' ')
    .replace(/\bde\s+\d{1,2}\s+de\s+[a-z]+\s+de\s+(19|20)\d{2}/g, ' ')
  const anios = sinCita.match(RE_ANIOS)
  if (!anios || !anios.length) return true // sin fecha no se puede discriminar: no se opina
  const texto = norm(articulo || '')
  return anios.some((a) => texto.includes(a))
}

/**
 * ¿La pregunta pide el contenido de un instrumento derivado?
 * Exige las DOS marcas: nombrar el instrumento Y pedir algo propio de él.
 */
function pideContenidoDeInstrumento(enunciado, opcionCorrecta = '') {
  const t = norm(enunciado) + ' ' + norm(opcionCorrecta)
  return RE_INSTRUMENTO.test(t) && RE_CONTENIDO_PROPIO.test(t)
}

/**
 * ¿Algún artículo de la ley responde la opción correcta?
 * Éste es EL discriminante frente al detector hermano: si alguno responde, esto no es un instrumento
 * derivado sino un vínculo mal puesto, y el caso pertenece a `vinculoArticuloVecino`.
 */
function mejorRecallDeLaLey(opcionCorrecta, articulosDeLaLey) {
  let mejor = 0
  let idMejor = null
  for (const a of articulosDeLaLey || []) {
    const r = recall(opcionCorrecta, a.content)
    if (r > mejor) {
      mejor = r
      idMejor = a.id ?? a.article_number ?? null
    }
  }
  return { mejor, idMejor }
}

/**
 * Clasifica UNA pregunta.
 *
 * @returns {{hallazgo:boolean, motivo:string, banda:('error'|'warn'|null), recallPropio:number,
 *            mejorDeLaLey:number, articuloQueResponde:*}}
 */
function clasificarInstrumentoDerivado({
  enunciado,
  opcionCorrecta,
  articuloVinculado,
  articulosDeLaLey = [],
  esOficial = false,
}) {
  const no = (motivo) => ({
    hallazgo: false,
    motivo,
    banda: null,
    recallPropio: 0,
    mejorDeLaLey: 0,
    articuloQueResponde: null,
  })

  // Las preguntas de examen OFICIAL no se tocan (CLAUDE.md): cayeron en un examen real, así que el
  // hueco es de nuestro temario, no de la pregunta. Se informan aparte, no como defecto a reparar.
  if (esOficial) return no('oficial_no_se_toca')
  // ⚠️ AQUÍ NO se excluye la NEGACIÓN, y es la diferencia de fondo con el detector hermano.
  //
  // Allí la exclusión es correcta: en un «señale la INCORRECTA» la opción correcta cita otro artículo
  // A PROPÓSITO, así que el desajuste es de diseño. Pero la pregunta que se hace aquí es otra —
  // ¿existe esta respuesta en ALGÚN artículo de la ley?— y eso no depende de la polaridad del
  // enunciado: una pregunta negativa sobre el contenido de un Plan sigue siendo igual de
  // inestudiable.
  //
  // La primera versión heredó la guarda por parentesco, sin razonarla, y se tragó TRES de las cuatro
  // impugnaciones que el mismo usuario mandó cuatro horas después sobre el I Plan de Igualdad de la
  // Junta 2023-2027 (art. 32). Están abajo como tests de regresión.
  //
  // La meta-opción SÍ se mantiene: «todas son correctas» tiene recall cero contra cualquier texto, y
  // eso sí es un límite de la MEDIDA, no un criterio prestado.
  if (RE_META.test(norm(opcionCorrecta))) return no('meta_opcion')
  if (!pideContenidoDeInstrumento(enunciado, opcionCorrecta)) return no('no_pide_instrumento')

  // ¿Da la opción suficiente materia para que comparar palabras signifique algo?
  const medible = palabrasFuertes(opcionCorrecta).length >= MIN_PALABRAS_FIABLES

  const recallPropio = recall(opcionCorrecta, articuloVinculado?.content || '')
  const mismoInstrumento = articuloHablaDelMismoInstrumento(enunciado, articuloVinculado?.content)
  if (medible && recallPropio >= UMBRAL_RESPONDE && mismoInstrumento) {
    return { ...no('el_articulo_si_responde'), recallPropio }
  }
  if (medible && recallPropio >= UMBRAL_RESPONDE && !mismoInstrumento) {
    // El artículo se PARECE a la clave pero no menciona el instrumento fechado por el que se
    // pregunta: el solape es de vocabulario, no de contenido.
    return {
      hallazgo: true,
      motivo: 'solape_de_vocabulario_no_menciona_el_instrumento',
      banda: 'error',
      recallPropio,
      mejorDeLaLey: 0,
      articuloQueResponde: null,
    }
  }
  if (!medible) {
    // Clave demasiado corta (típicamente el nombre de un órgano). No se puede afirmar ni que el
    // artículo responda ni que no: se manda a leer, que es lo único honesto.
    return {
      hallazgo: true,
      motivo: 'clave_corta_recall_no_concluyente',
      banda: 'warn',
      recallPropio,
      mejorDeLaLey: 0,
      articuloQueResponde: null,
    }
  }

  const { mejor, idMejor } = mejorRecallDeLaLey(opcionCorrecta, articulosDeLaLey)
  if (mejor >= UMBRAL_RESPONDE) {
    // Alguien de la misma ley SÍ responde → es un vínculo mal puesto. Se cede al detector hermano en
    // vez de reportarlo aquí: dos detectores diciendo lo mismo con arreglos distintos confunden más
    // de lo que ayudan.
    return {
      ...no('lo_responde_un_vecino_cede_a_vinculo_vecino'),
      recallPropio,
      mejorDeLaLey: mejor,
      articuloQueResponde: idMejor,
    }
  }

  // Nadie responde. La banda la marca si el artículo vinculado al menos NOMBRA el instrumento: si lo
  // nombra, está probado que la ley solo lo manda crear (el caso limpio); si no lo nombra siquiera,
  // el vínculo puede estar además equivocado y merece más lectura antes de tocar nada.
  const nombraElInstrumento = RE_INSTRUMENTO.test(norm(articuloVinculado?.content || ''))
  return {
    hallazgo: true,
    motivo: nombraElInstrumento ? 'articulo_solo_ordena_el_instrumento' : 'ningun_articulo_lo_contiene',
    banda: nombraElInstrumento ? 'error' : 'warn',
    recallPropio,
    mejorDeLaLey: mejor,
    articuloQueResponde: null,
  }
}

module.exports = {
  RE_INSTRUMENTO,
  RE_CONTENIDO_PROPIO,
  UMBRAL_RESPONDE,
  MIN_PALABRAS_FIABLES,
  PALABRAS_FUNCIONALES,
  palabrasFuertes,
  pideContenidoDeInstrumento,
  articuloHablaDelMismoInstrumento,
  mejorRecallDeLaLey,
  clasificarInstrumentoDerivado,
  norm,
  words,
  recall,
}
