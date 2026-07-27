'use strict'
/**
 * epigrafeApply.js — GUARDA del escritor de epígrafes (`verify:epigrafe apply`).
 *
 * PURO (sin BD, sin IO) → testeable. Decide si una reescritura de epígrafes puede
 * escribirse en `topics`, aplicando las tres reglas que hasta ahora vivían en un
 * markdown y ya se incumplieron en producción:
 *
 *  1. **LOS 4 CAMPOS.** `title`, `epigrafe`, `description` y `descripcion_corta` se
 *     tocan JUNTOS. El fallo del 08/07/2026 (Cantabria) fue exactamente este: se
 *     reescribieron tres y se olvidó `descripcion_corta`, que además quedó desplazada
 *     — en BD parecía correcto y solo se veía en la página LIVE. La checklist estaba
 *     escrita en `verificar-epigrafe-topic-scope.md`; no bastó. Ahora es física.
 *
 *  2. **EL EPÍGRAFE DEBE SER EL LITERAL OFICIAL.** El texto propuesto tiene que
 *     coincidir (normalizado) con el del boletín. Es la regla nuclear del proyecto
 *     —NUNCA inventar temario— convertida en invariante del escritor: por esta puerta
 *     no puede entrar un epígrafe que no esté en la fuente. Caso que lo motiva, medido
 *     el 27/07/2026: los 7 temas de informática de Cantabria SÍ tenían la versión
 *     correcta (el re-scope de julio acertó) pero estaban escritos "a ojo", y por eso
 *     les faltaban materias que el programa vigente sí exige (los navegadores Chrome
 *     y Edge, la herramienta Recortes, Snap Layouts…). Una paráfrasis fiel en el tono
 *     es indistinguible de una infiel en el alcance: por eso se exige literalidad.
 *
 *  3. **COHERENCIA DE VERSIÓN/APP** entre los 4 campos, con la MISMA definición que
 *     usa el detector nocturno (`lib/temario/displayDrift.js`). El escritor no puede
 *     introducir el drift que el auditor caza después.
 *
 * Filosofía, igual que `scope-classifier.cjs`: CONSERVADOR. Cualquier duda → error y
 * no se escribe. Rechazar de más cuesta una revisión; escribir de menos cuesta un
 * temario equivocado sirviéndose a gente que paga.
 */

const { detectDrift } = require('./displayDrift.js')

/** Campos que forman la identidad visible de un tema. Se escriben juntos o no se escriben. */
const CAMPOS = ['title', 'epigrafe', 'description', 'descripcion_corta']

/**
 * Normalización para comparar literalidad: unifica NBSP, comillas tipográficas,
 * guiones largos y espacios. NO toca acentos ni mayúsculas del contenido más allá
 * del case-fold — dos textos que solo difieren en el ancho de un espacio SON el
 * mismo texto del boletín; dos que difieren en una palabra NO lo son.
 */
function normalizarLiteral(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(/[«»“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** ¿El texto propuesto es el literal oficial? */
function esLiteral(propuesto, oficial) {
  if (!oficial) return false
  return normalizarLiteral(propuesto) === normalizarLiteral(oficial)
}

/**
 * Valida un plan de reescritura de epígrafes.
 *
 * @param {Object<string, {title?:string, epigrafe?:string, description?:string, descripcion_corta?:string}>} plan
 * @param {Object<string, string>} oficiales  texto oficial por número de tema (del boletín)
 * @returns {{ errores: Array<{tema:string, code:string, detail:string}>, ok: string[] }}
 */
function validarPlanEpigrafe(plan, oficiales) {
  const errores = []
  const ok = []
  const ofs = oficiales || {}

  for (const tema of Object.keys(plan || {})) {
    const t = plan[tema] || {}
    const fallos = []

    // 1) los 4 campos, presentes y con contenido
    for (const campo of CAMPOS) {
      if (!t[campo] || !String(t[campo]).trim()) {
        fallos.push({ tema, code: 'campo_faltante', detail: `falta "${campo}" — los 4 campos se escriben juntos (fallo Cantabria 08/07/2026)` })
      }
    }

    // 2) el epígrafe tiene que ser el literal oficial
    const oficial = ofs[tema]
    if (!oficial || !String(oficial).trim()) {
      fallos.push({ tema, code: 'sin_oficial', detail: 'no hay texto oficial para este tema — sin fuente no se escribe' })
    } else if (t.epigrafe && !esLiteral(t.epigrafe, oficial)) {
      fallos.push({ tema, code: 'epigrafe_no_literal', detail: 'el epígrafe propuesto NO coincide con el literal del boletín (regla nuclear: nunca inventar temario)' })
    }

    // 3) coherencia de versión/app entre los campos (misma definición que el detector)
    for (const d of detectDrift(t)) {
      fallos.push({ tema, code: 'display_drift', detail: `${d.type}: ${d.detail}` })
    }

    if (fallos.length) errores.push(...fallos)
    else ok.push(tema)
  }

  return { errores, ok }
}

module.exports = { validarPlanEpigrafe, normalizarLiteral, esLiteral, CAMPOS }
