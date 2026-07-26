/**
 * ¿Está el lote realmente CERRADO según el manual `generar-preguntas-con-ia.md`?
 *
 * El manual es explícito en su Paso 9: *«Sin este paso el lote NO se cierra»*. Pero
 * hasta el 26/07/2026 **nada lo comprobaba**, y así fue como se aprobaron 69
 * preguntas de la campaña T-146 saltándose el Paso 9 y el registro en
 * `ai_verification_results`. La re-verificación posterior encontró 15 defectos que
 * las 12 auditorías ciegas del Paso 7 no habían cazado: el paso no era ceremonia.
 *
 * La lección no es «acuérdate mejor», es que **un paso obligatorio que solo vive en
 * un markdown se salta**. Este núcleo puro decide, y lo cablea el comando que el
 * propio manual señala como cierre obligatorio (`npm run batch:servido`), en vez de
 * crear una herramienta nueva que nadie correría.
 *
 * Núcleo PURO: recibe el recuento de verificaciones y decide. No habla con la BD.
 */

/** Proveedores que acreditan cada paso. El Paso 9 admite las iteraciones `_v2`, `_v3`… */
const PROVIDER_PASO7 = 'claude_code'
const RE_PROVIDER_PASO9 = /^claude_code_recheck(_v\d+)?$/

/**
 * @param {Array<{questionId:string, provider:string}>} verificaciones filas de `ai_verification_results`
 * @param {string[]} idsPreguntas todas las preguntas del lote
 * @returns {{cerrado:boolean, sinPaso7:string[], sinPaso9:string[], motivo:string|null}}
 */
function estadoCierre(verificaciones, idsPreguntas) {
  const p7 = new Set()
  const p9 = new Set()
  for (const v of verificaciones || []) {
    if (v.provider === PROVIDER_PASO7) p7.add(v.questionId)
    else if (RE_PROVIDER_PASO9.test(v.provider || '')) p9.add(v.questionId)
  }
  const sinPaso7 = idsPreguntas.filter((id) => !p7.has(id))
  const sinPaso9 = idsPreguntas.filter((id) => !p9.has(id))
  const partes = []
  if (sinPaso7.length) partes.push(`${sinPaso7.length} sin auditoría ciega registrada (Paso 7)`)
  if (sinPaso9.length) partes.push(`${sinPaso9.length} sin re-verificación post-aplicación (Paso 9)`)
  return {
    cerrado: !sinPaso7.length && !sinPaso9.length,
    sinPaso7,
    sinPaso9,
    motivo: partes.length ? partes.join(' · ') : null,
  }
}

// ── LA CONTRAPARTE: VALIDAR LO QUE SE VA A ESCRIBIR ───────────────────────────────────────────
//
// `estadoCierre` DECIDE (solo lectura). Faltaba el camino de ESCRITURA, y ahí estaba la causa de
// fondo de que el Paso 9 se saltara: **no tenía herramienta**. El manual lo documenta como un
// `insert` a mano copiado de un snippet —y encima con el cliente de Supabase, ya obsoleto tras el
// cutover a RDS—, así que registrar el paso costaba más que hacerlo. Medido el 26/07: los 11
// lotes ATC de esta sesión tenían el Paso 7 registrado y **ninguno el Paso 9**, aun habiéndose
// corrido el re-check en siete de ellos. El trabajo se hizo; el registro no existía, así que para
// el sistema no había ocurrido.
//
// Estas guardas viven aquí, y no en el script, por la misma razón por la que `estadoCierre` vive
// aquí: si el registrador definiera por su cuenta qué acredita un Paso 9, habría DOS definiciones
// del mismo concepto y la del guardarraíl dejaría de mandar.

/** Mínimo de caracteres del hallazgo. Mismo criterio que el resumen de `aprobar-batch-generado`. */
const MIN_HALLAZGO = 40

/**
 * ¿Es escribible este conjunto de veredictos de Paso 9?
 *
 * El riesgo que cierra no es teórico: los `batch_id` se componen a mano y ya hubo una colisión
 * entre sesiones (dos lotes bajo el mismo tag), así que un registrador que acepte cualquier
 * `question_id` puede acreditar como auditado el trabajo de otra sesión.
 *
 * @param {Array<{questionId:string, limpia:boolean, hallazgo:string}>} veredictos
 * @param {string[]} idsPreguntas ids del lote (fuente: el tag)
 * @param {Set<string>|string[]} conPaso7 ids que YA tienen el Paso 7 registrado
 * @returns {{ok:boolean, escribibles:Array, errores:string[], faltantes:string[]}}
 */
function validarVeredictosPaso9(veredictos, idsPreguntas, conPaso7) {
  const delLote = new Set(idsPreguntas || [])
  const p7 = conPaso7 instanceof Set ? conPaso7 : new Set(conPaso7 || [])
  const errores = []
  const escribibles = []
  const vistos = new Set()

  for (const v of veredictos || []) {
    const id = v && v.questionId
    if (!id) { errores.push('un veredicto viene sin questionId'); continue }
    // AJENO AL LOTE: la guarda que impide acreditar trabajo de otra sesión.
    if (!delLote.has(id)) { errores.push(`${id.slice(0, 8)}: no pertenece a este lote`); continue }
    if (vistos.has(id)) { errores.push(`${id.slice(0, 8)}: veredicto duplicado`); continue }
    // No se puede RE-verificar lo que nunca se auditó: sin Paso 7 el Paso 9 no significa nada.
    if (!p7.has(id)) { errores.push(`${id.slice(0, 8)}: no tiene Paso 7 registrado`); continue }
    if (typeof v.limpia !== 'boolean') { errores.push(`${id.slice(0, 8)}: falta el veredicto (limpia)`); continue }
    // Registrar un paso que no se hizo tiene que costar mentir por escrito.
    const h = String(v.hallazgo || '').trim()
    if (h.length < MIN_HALLAZGO) {
      errores.push(`${id.slice(0, 8)}: el hallazgo es demasiado corto (${h.length} < ${MIN_HALLAZGO} chars)`)
      continue
    }
    vistos.add(id)
    escribibles.push({ questionId: id, limpia: v.limpia, hallazgo: h })
  }

  return {
    ok: errores.length === 0 && escribibles.length > 0,
    escribibles,
    errores,
    // Registro PARCIAL permitido, pero nunca silencioso: quien lo corra tiene que ver el resto.
    faltantes: (idsPreguntas || []).filter((id) => !vistos.has(id)),
  }
}

module.exports = {
  estadoCierre,
  validarVeredictosPaso9,
  PROVIDER_PASO7,
  RE_PROVIDER_PASO9,
  MIN_HALLAZGO,
}
