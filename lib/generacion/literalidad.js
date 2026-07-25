/**
 * Verificación de literalidad de la opción correcta contra el artículo
 * (§2.2 del manual `generar-preguntas-con-ia.md`).
 *
 * Tres resultados:
 *   - LITERAL     : la cita es subcadena contigua del artículo (tolerando
 *                   puntuación y comillas). El caso normal.
 *   - ENUMERACION : la cita NO es contigua, pero es una lista aplanada cuyos
 *                   fragmentos (separados por comas / "y" / "e") aparecen TODOS
 *                   como subcadenas del artículo. Forma de respuesta legítima
 *                   ("¿qué figuras modifican el crédito?" → "Transferencias,
 *                   generaciones, ampliaciones…"), que un check de subcadena
 *                   a secas rechaza en falso. (Caso real: art. 53 Ley 11/2006,
 *                   batch gen_t10presup.)
 *   - NO_LITERAL  : ni contigua ni enumeración fiel → algún fragmento no está
 *                   en el artículo. Defecto real.
 *
 * OJO: ENUMERACION garantiza que ningún fragmento fue inventado, pero NO
 * garantiza COMPLETITUD (que estén todos los ítems de la lista y ninguno de
 * más). Eso no es mecanizable con fiabilidad y queda para la auditoría LLM.
 * Por eso ENUMERACION es un pase BLANDO: no es un fallo duro, pero se marca
 * para que el auditor lo mire.
 *
 * LÍMITE CONOCIDO — preguntas "INTRUSO" (25/07/2026). En el formato "¿cuál de
 * las siguientes NO figura…?" la opción correcta es, por construcción, la
 * INVENTADA: las tres literales son los distractores. Un check de literalidad
 * sobre la correcta la marca siempre NO_LITERAL, y es un falso positivo.
 * `analizarIntruso` detecta el marco desde el enunciado para que el llamante
 * pueda invertir el criterio: en esas preguntas hay que exigir literalidad a
 * los DISTRACTORES, no a la correcta.
 * Caso que lo motivó: art. 30 Ley 20/1991, "¿cuál NO figura entre las piedras
 * preciosas?" → correcta "El jade" (el artículo enumera zafiro, esmeralda,
 * aguamarina, diamante y rubí, y el jade no está). Pregunta impecable, gate en
 * rojo.
 */

const norm = (t) => String(t).replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const strip = (t) => norm(t).replace(/[.,;:]/g, '')

/**
 * Como `strip` pero además sin tildes. Sirve para distinguir una diferencia
 * ORTOGRÁFICA de una de contenido: los textos del BOE alternan grafías que la
 * RAE admite por igual ("periodo"/"período"), y una cita que solo difiere en eso
 * es fiel. Marcarla en rojo es ruido; ignorarla del todo también sería malo,
 * porque puede delatar un error de transcripción del artículo importado.
 * Caso que lo motivó: art. 44 Ley 20/1991 — el artículo dice "periodo mínimo de
 * tres años" y la opción "período mínimo de tres años".
 */
const stripTildes = (t) => strip(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * @param {string} articulo `articles.content`.
 * @param {string} cita opción marcada como correcta.
 * @returns {{estado:'LITERAL'|'ORTOGRAFIA'|'ENUMERACION'|'NO_LITERAL', fragmentosNoHallados?:string[]}}
 */
function analizarLiteralidad(articulo, cita) {
  const artS = strip(articulo)
  const citaS = strip(cita)
  if (citaS && artS.indexOf(citaS) >= 0) return { estado: 'LITERAL' }

  // Contigua salvo tildes: la cita es fiel, la grafía difiere. Pase blando.
  if (citaS && stripTildes(articulo).indexOf(stripTildes(cita)) >= 0) {
    return { estado: 'ORTOGRAFIA' }
  }

  // ¿Enumeración? Partir por separadores de lista y exigir que cada fragmento
  // sustantivo (>3 chars, para descartar conectores sueltos) esté en el artículo.
  const fragmentos = norm(cita)
    .split(/\s*,\s*|\s+y\s+|\s+e\s+|\s+o\s+/)
    // Una conjunción puede quedar al INICIO de un fragmento tras partir por coma
    // ("…, e incorporaciones" → "e incorporaciones"); se elimina antes de comparar.
    .map((f) => strip(f).replace(/^(?:y|e|o)\s+/, ''))
    .filter((f) => f.length > 3)
  if (fragmentos.length >= 2) {
    const noHallados = fragmentos.filter((f) => artS.indexOf(f) < 0)
    if (noHallados.length === 0) return { estado: 'ENUMERACION' }
    return { estado: 'NO_LITERAL', fragmentosNoHallados: noHallados }
  }

  return { estado: 'NO_LITERAL' }
}

/**
 * ¿El enunciado plantea el marco "intruso" (la correcta es la que NO está)?
 * Deliberadamente conservador: exige una negación explícita ligada a la
 * pertenencia a una lista, no cualquier "no" del enunciado.
 * @param {string} enunciado `questions.question_text`.
 * @returns {boolean}
 */
function analizarIntruso(enunciado) {
  const t = norm(enunciado)
  // OJO con el \b de cierre: en JS \b se define sobre [A-Za-z0-9_], así que una
  // vocal acentuada NO cuenta como carácter de palabra y "no está " nunca casaría
  // (entre "á" y el espacio no hay frontera). Se ancla solo por delante.
  return /\bno\s+(figura|figuran|se considera|se consideran|está|están|esta|estan|forma parte|forman parte|se incluye|se incluyen|aparece|aparecen)/.test(t)
}

module.exports = { analizarLiteralidad, analizarIntruso }
