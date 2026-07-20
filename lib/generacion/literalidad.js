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
 */

const norm = (t) => String(t).replace(/[«»""'']/g, '"').replace(/\s+/g, ' ').trim().toLowerCase()
const strip = (t) => norm(t).replace(/[.,;:]/g, '')

/**
 * @param {string} articulo `articles.content`.
 * @param {string} cita opción marcada como correcta.
 * @returns {{estado:'LITERAL'|'ENUMERACION'|'NO_LITERAL', fragmentosNoHallados?:string[]}}
 */
function analizarLiteralidad(articulo, cita) {
  const artS = strip(articulo)
  const citaS = strip(cita)
  if (citaS && artS.indexOf(citaS) >= 0) return { estado: 'LITERAL' }

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

module.exports = { analizarLiteralidad }
