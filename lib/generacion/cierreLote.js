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

module.exports = { estadoCierre, PROVIDER_PASO7, RE_PROVIDER_PASO9 }
