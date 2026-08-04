'use strict'
//
// simularBatch — NÚCLEO PURO (sin red ni BD) de la simulación PRE-INSERCIÓN de un batch
// de preguntas generadas. Lo consume `scripts/simular-batch-preinsercion.cjs`, que se
// limita a leer de RDS los artículos y las preguntas vivas y a pasárselos aquí.
//
// POR QUÉ EXISTE (26/07/2026). El pipeline de `generar-preguntas-con-ia.md` solo sabía
// verificar DESPUÉS de insertar: `verificar-batch-generado.cjs` lee de RDS, así que para
// saber si un batch estaba bien había que meterlo en la base primero. Es seguro (el draft
// es invisible por construcción, §2.1) pero deja basura que limpiar en cada iteración de
// reparación y empuja a "insertar para ver".
//
// POR QUÉ ES UN NÚCLEO PURO Y NO UN SCRIPT. Al escribir la primera versión como script
// suelto se llamó a los cinco núcleos existentes asumiendo que todos devolvían `{ok}`,
// cuando `analizarLiteralidad`/`analizarCita` devuelven `{estado}` y `analizarLongitud`
// devuelve `{tell}`. Resultado: 12 de 12 preguntas marcadas como rotas, incluida una que
// era copia VERBATIM del artículo. Un fallo de contrato entre módulos no lo caza leyendo
// el código: lo caza un test. De ahí que la lógica viva aquí, testeada, y el script solo
// haga I/O.
//
// Reparto con el verificador POST-inserción: los MISMOS núcleos → mismo veredicto.
// Lo que añade esta capa es lo que después ya es tarde o caro de arreglar:
//   · la DISTRIBUCIÓN y la SECUENCIA de `correct_option` del lote (§2.2-ter);
//   · el DEDUP contra las preguntas ya vivas de esos artículos y dentro del propio lote
//     (Paso 3 del manual).
//
// ⚠️ LA PARIDAD HAY QUE MANTENERLA A MANO, y ya se rompió una vez. Eran cinco núcleos
// hasta el 26/07/2026, cuando se vio que `citaVsOpcion` y `overclaimExplicacion` solo los
// corría el gate de BD: el lote pasaba la simulación y el aviso aparecía DESPUÉS de
// insertar. Le pasó al art. 39.1 del batch `gen_atc_t224_2026-07-26_s26c`, cuya explicación
// afirmaba "sin excepciones" — un absoluto que el artículo no dice—. **Si añades un núcleo
// al verificador, añádelo aquí**: hay tests que fijan la paridad sobre esos casos reales.

const { resolverMarco } = require('./literalidad.js')
const { analizarLongitud } = require('./tellLongitud.js')
const { analizarSiglas } = require('./siglasSinDesarrollar.js')
const { analizarCita, clausulaEnEnunciado } = require('./citaTruncada.js')
const { analizarCabecera } = require('./cabeceraExplicacion.js')
const { analizarOverclaim } = require('./overclaimExplicacion.js')
const { analizarCitaVsOpcion } = require('./citaVsOpcion.js')
// El criterio de «esto ya está en el banco» vive en UN solo sitio [T-408]: aquí se importa,
// no se reescribe. Una segunda copia del umbral es como nacieron los cinco escritores de T-130.
const { normalizar, solapeDeContenido, UMBRAL_MISMA_CLAVE } = require('../calidad/duplicados.js')

const LETRA = ['A', 'B', 'C', 'D']

/** Palabras significativas normalizadas (sin tildes, sin signos, >3 chars). */
function palabras(t) {
  return new Set(
    String(t || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3),
  )
}

/** Índice de Jaccard entre dos textos, sobre `palabras()`. 0 si alguno va vacío. */
function jaccard(a, b) {
  const A = palabras(a)
  const B = palabras(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter++
  return inter / (A.size + B.size - inter)
}

/**
 * Normaliza una pregunta del borrador a una forma única, aceptando las DOS que circulan.
 *
 * DRIFT REAL (26/07/2026): el manual `generar-preguntas-con-ia.md` documenta en su Paso 2
 * un JSON con `primary_article_id` y `option_a`…`option_d`, pero
 * `scripts/insertar-batch-generado.cjs` lee `primary_article_number` y `options[]`. Un
 * borrador escrito siguiendo el manual al pie de la letra revienta en el INSERT con
 * "UNDEFINED_VALUE: Undefined values are not allowed" — sin decir qué campo falta.
 *
 * Se acepta cualquiera de las dos y se devuelve la unión, para que la simulación pueda
 * avisar ANTES de insertar de que faltan los campos que el inserter necesita.
 *
 * @param {object} q pregunta del borrador, en cualquiera de las dos formas
 * @returns {{question_text:string, options:string[], correct_option:number,
 *            explanation:string, primary_article_id?:string, primary_article_number?:string,
 *            article_label?:string, law_slug?:string}}
 */
/**
 * Rellena con la ley del lote las preguntas que no traen la suya.
 *
 * `insertar-batch-generado.cjs` acepta la ley como argumento de CLI y el manual manda escribir
 * los borradores SIN `law_slug` por pregunta cuando el lote es de una sola ley (el caso normal).
 * El simulador, en cambio, solo sabía resolver el artículo por `law_slug` + número, así que ese
 * mismo borrador simulaba con la ley `undefined` y devolvía "artículo inexistente o inactivo" en
 * TODAS las preguntas — un bloqueante que parece de datos y es de firma (28/07/2026, lote de la
 * Ley 7/1985: 13 de 13). Con esto las dos herramientas del pipeline aceptan el mismo borrador.
 *
 * La ley por defecto solo RELLENA: si la pregunta trae la suya (lotes multi-ley), gana la suya.
 * Devuelve un array nuevo; no muta la entrada.
 */
function aplicarLeyPorDefecto(preguntas, lawSlug) {
  if (!lawSlug) return preguntas.slice()
  return preguntas.map((q) =>
    q.primary_article_id || q.law_slug ? q : { ...q, law_slug: lawSlug },
  )
}

function normalizarPregunta(q) {
  const options = Array.isArray(q.options) && q.options.length === 4
    ? q.options.slice()
    : [q.option_a, q.option_b, q.option_c, q.option_d]
  return {
    ...q,
    options,
    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3],
  }
}

/**
 * ¿Le falta a la pregunta algún campo que `insertar-batch-generado.cjs` exige?
 * Se comprueba aparte de la calidad del contenido: un borrador impecable que el inserter
 * no sepa leer es igual de inútil, y hasta hoy solo se descubría al fallar el INSERT.
 *
 * @param {object} q pregunta YA normalizada
 * @returns {string[]} lista de campos que faltan (vacía si está lista para insertar)
 */
function camposParaInsertar(q) {
  const faltan = []
  if (!q.primary_article_number) faltan.push('primary_article_number (lo exige insertar-batch-generado.cjs)')
  if (!q.law_slug) faltan.push('law_slug (o pásalo como default en la CLI)')
  if (!q.question_text) faltan.push('question_text')
  if (!q.explanation) faltan.push('explanation')
  if (q.options.some((o) => o === undefined || o === null)) faltan.push('alguna de las 4 opciones')
  return faltan
}

/**
 * Analiza UNA pregunta del borrador contra el texto de su artículo.
 *
 * @param {{question_text:string, option_a:string, option_b:string, option_c:string,
 *          option_d:string, correct_option:number, explanation?:string}} q
 * @param {string} articulo `articles.content` del artículo de la pregunta.
 * @returns {{errores:string[], avisos:string[]}}
 *   `errores` bloquean la inserción · `avisos` exigen criterio humano (§2.2 advierte de
 *   que el check de literalidad es un PROXY: un NO_LITERAL puede ser condensación válida).
 */
function analizarPregunta(qRaw, articulo) {
  const errores = []
  const avisos = []
  const q = normalizarPregunta(qRaw)
  const ops = q.options

  // Contrato con el INSERTER, antes que la calidad del contenido.
  camposParaInsertar(q).forEach((f) => errores.push(`falta ${f}`))

  if (![0, 1, 2, 3].includes(q.correct_option)) {
    errores.push(`correct_option inválido: ${q.correct_option}`)
    return { errores, avisos }
  }
  if (ops.some((o) => !o || !String(o).trim())) errores.push('alguna opción va vacía')
  if (new Set(ops.map((o) => String(o).trim().toLowerCase())).size !== 4)
    errores.push('hay opciones repetidas entre sí')
  if (!articulo || !String(articulo).trim()) {
    errores.push('sin texto de artículo contra el que verificar')
    return { errores, avisos }
  }

  const correcta = ops[q.correct_option]

  // §2.2 — literalidad. PROXY, nunca veredicto: solo avisa.
  //
  // El marco se resuelve como en `verificar-batch-generado.cjs` —mismo pipeline, mismo
  // criterio— para que los dos gates no discrepen: en una pregunta INTRUSO ("¿cuál NO
  // figura?") la correcta es por construcción la inventada, y lo que hay que exigir es
  // que los tres DISTRACTORES sean del artículo. Antes este simulador no conocía el
  // marco: avisaba de NO_LITERAL en intrusos impecables y, al revés, no comprobaba
  // nunca los distractores de un intruso mal construido.
  const marco = resolverMarco(articulo, ops, q.correct_option, q.question_text)
  if (marco.marco === 'INTRUSO') {
    if (marco.distractoresNoLiterales.length) {
      avisos.push(
        `INTRUSO: ${marco.distractoresNoLiterales.length} de los 3 distractores no son del artículo ` +
        '(en este marco los distractores SÍ deben ser literales) → revisa cuál es de verdad la intrusa',
      )
    }
  } else {
    if (marco.pista && marco.distractoresNoLiterales.length === 3) {
      avisos.push(
        'MARCO AMBIGUO: el enunciado suena a "¿cuál NO figura?" pero la correcta SÍ es del artículo ' +
        `(${marco.literalidadCorrecta.estado}) → si de verdad es un intruso, la CLAVE está mal`,
      )
    }
    const lit = marco.literalidadCorrecta
    if (lit.estado === 'NO_LITERAL') {
      const frags = lit.fragmentosNoHallados && lit.fragmentosNoHallados.length
        ? ` (no hallado: ${lit.fragmentosNoHallados.slice(0, 3).join(' · ')})`
        : ''
      // BLOQUEA, en PARIDAD con `verificar-batch-generado.cjs`, que trata NO_LITERAL como
      // "defecto duro". Aquí fue un AVISO hasta el 26/07/2026, y ese descuadre de severidad
      // vaciaba de sentido al simulador: su trabajo es no dejar entrar lo que el gate de BD
      // va a rechazar después. Medido en el lote `gen_atc_t204_2026-07-26_s26c`: la
      // simulación dijo «Limpio para insertar» con 5 NO_LITERAL en amarillo y, ya insertadas
      // las 14, el gate de BD las tumbó (9/14) → hubo que reescribir 5 preguntas EN BD en vez
      // de en el borrador. El comentario del marco (arriba) ya declaraba la intención de que
      // «los dos gates no discrepen»; la severidad se había quedado fuera de esa paridad.
      //
      // Y el criterio de fondo: la adjudicación «puede ser condensación válida» nació para
      // RECLASIFICAR preguntas que YA estaban en el banco (cola de literalidad del 25/07).
      // En un borrador que se está escribiendo no aplica: la clave se ancla al literal y sale
      // mejor pregunta. Las 5 del T204 se reescribieron así y ganaron precisión.
      errores.push(`literalidad NO_LITERAL${frags} → ancla la clave al texto del artículo` +
        ' (el gate de BD lo rechaza como defecto duro; no es adjudicable en un borrador nuevo)')
    }
  }

  // §2.2 — cita truncada: la cita corta antes de una cláusula que la condiciona. Bloquea…
  // …SALVO que esa cláusula ya esté en el ENUNCIADO. `analizarCita` solo recibe artículo y
  // opción, así que no puede saberlo; aquí sí tenemos el enunciado. El propio §2.2 lo
  // recoge como condensación VÁLIDA ("cláusula ya presente en el enunciado, omitida en la
  // opción → no es defecto"). Sin esta salvedad, el patrón correcto de poner el inciso
  // condicionante en la pregunta ("Salvo que la legislación autonómica prevea otra cosa,
  // …") se marcaría como error y empujaría a duplicar la cláusula en las cuatro opciones.
  const cita = analizarCita(articulo, correcta)
  if (cita.estado === 'TRUNCADA') {
    const msg = `cita truncada por la ${cita.lado}: "${cita.cola}"`
    if (cita.lado === 'cabeza' && clausulaEnEnunciado(cita.cola, q.question_text)) {
      avisos.push(`${msg} → pero la cláusula ya aparece en el enunciado (condensación válida §2.2); confírmalo`)
    } else {
      errores.push(msg)
    }
  }

  // §2.2-bis — tell de longitud. Bloquea.
  const len = analizarLongitud(ops, q.correct_option)
  if (len.tell) errores.push(`tell de longitud: ${len.motivo}`)

  // §2.2-quater — siglas sin desarrollar. `faltan` bloquea, `candidatas` avisa.
  const sig = analizarSiglas(q.question_text, q.explanation || '', ops)
  if (sig.faltan.length) errores.push(`siglas sin desarrollar: ${sig.faltan.join(', ')}`)
  if (sig.candidatas.length) avisos.push(`mayúsculas no catalogadas (¿sigla?): ${sig.candidatas.join(', ')}`)

  // §8.1 — la cabecera de la explicación debe nombrar la letra de la clave. Bloquea.
  const cab = analizarCabecera(q.explanation || '', q.correct_option)
  if (!cab.ok) errores.push(`cabecera de la explicación: ${cab.motivo}`)

  // OVERCLAIM — la explicación afirma un absoluto ("sin excepción", "en todo caso")
  // que el artículo no dice. AVISO: hay glosas absolutas correctas.
  const over = analizarOverclaim(q.explanation || '', articulo)
  for (const o of over.avisos) {
    avisos.push(`OVERCLAIM ("${o.termino}"): «${String(o.frase).slice(0, 110)}» — el artículo no dice ese absoluto`)
  }

  // CORRECTA PARCIAL — el blockquote que se aporta como prueba dice MÁS que la opción
  // marcada correcta. Se le pasa el enunciado: si la cola ya está ahí, es condensación
  // válida y no avisa.
  const parcial = analizarCitaVsOpcion(q.explanation || '', correcta, q.question_text)
  if (parcial.aviso) {
    avisos.push(`CORRECTA PARCIAL: la cita continúa con «${String(parcial.cola).slice(0, 110)}» y la opción no lo recoge — acota el enunciado o completa la opción`)
  }

  return { errores, avisos }
}

/**
 * Comprueba el LOTE completo: distribución y secuencia de `correct_option` (§2.2-ter).
 * Solo se pronuncia con lotes de 8+ preguntas; por debajo el ruido estadístico manda.
 *
 * @param {Array<{correct_option:number}>} preguntas
 * @returns {{errores:string[], distribucion:number[], distribucionTexto:string, secuencia:string}}
 */
function analizarLote(preguntas) {
  const errores = []
  const dist = [0, 0, 0, 0]
  for (const q of preguntas) if (dist[q.correct_option] != null) dist[q.correct_option]++
  const n = preguntas.length
  const pct = dist.map((d) => (n ? (100 * d) / n : 0))
  const distribucionTexto = dist.map((d, k) => `${LETRA[k]} ${d} (${pct[k].toFixed(0)}%)`).join(' · ')
  const secuencia = preguntas.map((q) => LETRA[q.correct_option] || '?').join('')

  if (n >= 8 && (Math.max(...pct) > 40 || Math.min(...pct) < 10)) {
    errores.push(`distribución de correct_option desequilibrada: ${distribucionTexto}`)
  }
  // Ciclo regular de periodo 4 (A,B,C,D,A,B,C,D…): pasa el check de distribución pero es
  // un patrón predecible. Ver §2.2-ter, batch gen_dec19_2011_b3.
  if (n >= 8 && preguntas.every((q, k) => k < 4 || q.correct_option === preguntas[k - 4].correct_option)) {
    errores.push(`la secuencia de correct_option describe un ciclo regular de periodo 4: ${secuencia}`)
  }

  return { errores, distribucion: dist, distribucionTexto, secuencia }
}

/** Texto de la opción marcada como correcta, o '' si no se puede resolver. */
function claveDe(q) {
  const opts = Array.isArray(q && q.options) ? q.options : []
  const i = Number(q && q.correct_option)
  return Number.isInteger(i) && opts[i] != null ? String(opts[i]) : ''
}

/**
 * Dedup del Paso 3: contra las preguntas YA VIVAS de esos artículos y dentro del lote.
 *
 * El aviso intra-lote lleva DOS números, y el segundo es el que decide:
 *
 *   · Jaccard del ENUNCIADO — el que dispara el aviso. Se infla solo, porque §2.2-quater obliga
 *     a desarrollar el nombre completo de la ley en CADA enunciado y ese bloque idéntico puede
 *     pesar más que la materia. Medido el 31/07/2026 en `gen_lopdgdd_t115_2026-07-31`, cuyo
 *     nombre de ley ocupa 118 caracteres: los 5 avisos del lote bajaban de 0,46-0,62 a 0,26-0,50
 *     con solo quitar ese nombre. Las dos reglas del manual tiran en direcciones opuestas.
 *   · Jaccard de la CLAVE — el nivel 3 del dedup de §2.6, que es el que dice si dos preguntas
 *     evalúan lo mismo. En ese mismo lote iba de 0,00 a 0,14: ninguna era duplicado.
 *
 * Se dan los dos en vez de subir el umbral o descontar el nombre de la ley: descontarlo exigiría
 * adivinar qué parte del enunciado es el nombre, y subir el umbral escondería duplicados reales.
 * El aviso sigue sin bloquear — pide criterio, y ahora lo pide con el dato que hace falta.
 *
 * ## Contra las VIVAS se mira también la CLAVE [T-519]
 *
 * Hasta el 03/08/2026 la rama de las vivas comparaba SOLO el enunciado, y la de la clave existía
 * únicamente intra-lote. Por ahí entra la clase entera de duplicados que ninguna herramienta veía:
 * una pregunta nueva, redactada de otra forma y con otros distractores, cuya respuesta correcta ya
 * está viva en ese artículo. Así acumuló el art. 2 de la LGSS **once preguntas activas sobre la
 * misma frase** (impugnación 9e0d7418: la usuaria pidió un test de ese artículo y ocho de las diez
 * preguntas examinaban lo mismo). El enunciado no las delata — es justo lo que cambia.
 *
 * Cuando la clave coincide se emite SIEMPRE, con independencia del enunciado: en este corte la
 * respuesta idéntica en el mismo artículo es la evidencia, y el solape de contenido solo gradúa
 * cuánta atención merece (banda `gemela`/`cola` de `lib/calidad/duplicados`, calibrada allí).
 *
 * @param {Array<{question_text:string, options?:string[], correct_option?:number}>} preguntas
 * @param {Array<string|{question_text:string, clave?:string}>} vivas preguntas activas de los
 *        mismos artículos. Admite el formato antiguo (solo el enunciado): entonces no se puede
 *        comparar la clave y ese aviso no sale — degradar es correcto, inventarla no.
 * @param {number} [umbral=0.5]
 * @returns {Array<{i:number, motivo:string}>} avisos, nunca bloqueantes (exigen criterio)
 */
function analizarDuplicados(preguntas, vivas, umbral = 0.5) {
  const out = []
  preguntas.forEach((q, i) => {
    for (const viva of vivas || []) {
      const v = typeof viva === 'string' ? viva : String((viva && viva.question_text) || '')
      const claveViva = typeof viva === 'string' ? '' : String((viva && viva.clave) || '')
      const j = jaccard(q.question_text, v)
      if (j >= umbral) out.push({ i, motivo: `posible duplicado de una viva (Jaccard ${j.toFixed(2)}): "${String(v).slice(0, 80)}…"` })
      if (claveViva && normalizar(claveDe(q)) === normalizar(claveViva) && normalizar(claveViva) !== '') {
        const solape = solapeDeContenido(q.question_text, v)
        const banda = solape >= UMBRAL_MISMA_CLAVE.gemela ? 'MÍRALO' : 'revísalo'
        out.push({
          i,
          motivo: `MISMA RESPUESTA que una viva del artículo (contenido ${solape.toFixed(2)} → ${banda}): "${String(v).slice(0, 80)}…"`,
        })
      }
    }
    for (let k = i + 1; k < preguntas.length; k++) {
      const j = jaccard(q.question_text, preguntas[k].question_text)
      if (j < umbral) continue
      const jc = jaccard(claveDe(q), claveDe(preguntas[k]))
      const veredicto = jc >= umbral ? 'MÍRALO' : 'probable falso positivo'
      out.push({
        i,
        motivo: `posible duplicado intra-lote con Q${k + 1} (enunciado ${j.toFixed(2)}; CLAVE ${jc.toFixed(2)} → ${veredicto})`,
      })
    }
  })
  return out
}

module.exports = {
  analizarPregunta,
  claveDe,
  aplicarLeyPorDefecto,
  normalizarPregunta,
  camposParaInsertar,
  analizarLote,
  analizarDuplicados,
  clausulaEnEnunciado,
  jaccard,
  palabras,
  LETRA,
}
