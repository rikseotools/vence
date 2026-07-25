/**
 * Coherencia de la CABECERA de la explicación con la clave (§8.1 del manual
 * `generar-preguntas-con-ia.md`).
 *
 * El formato canónico §8.1 es:
 *
 *     > **Art. X.Y Ley Z**
 *     > "…cita literal…"
 *
 *     **Por qué C es correcta:** …
 *
 *     **Por qué las demás son incorrectas:**
 *     - **A)** …
 *
 * es decir, la cabecera va DESPUÉS del blockquote de la cita. Comprobarla con
 * `explanation.startsWith('**Por qué C es correcta:**')` daba rojo en el 100% de
 * los batches bien formados (medido sobre `gen_atc_t217_2026-07-24`, 34/34 en
 * rojo pese a estar doblemente auditado y aprobado). Un gate que siempre falla
 * no se lee: se ignora, y con él se ignoran los fallos de verdad.
 *
 * Lo que importa es que la cabecera EXISTA y nombre la MISMA letra que
 * `correct_option` — y que no haya otra cabecera nombrando una letra distinta
 * (residuo típico de re-permutar la posición de la correcta tocando solo
 * `correct_option` y olvidando la explicación, §2.2-ter "Recordatorio de
 * coherencia").
 */

const RE_CABECERA = /\*\*Por qué ([ABCD]) es correcta:\*\*/g

/**
 * @param {string} explanation Texto de la explicación tal cual está en BD.
 * @param {number} correctIdx Índice 0-3 de la opción correcta.
 * @returns {{ok:boolean, motivo?:string, letras?:string[]}}
 */
function analizarCabecera(explanation, correctIdx) {
  const letra = 'ABCD'[correctIdx]
  if (letra === undefined) return { ok: false, motivo: `correct_option fuera de rango: ${correctIdx}` }

  const letras = [...String(explanation || '').matchAll(RE_CABECERA)].map((m) => m[1])

  if (letras.length === 0) {
    return { ok: false, motivo: 'la explicación no lleva cabecera "**Por qué <LETRA> es correcta:**"' }
  }
  const ajenas = [...new Set(letras.filter((l) => l !== letra))]
  if (ajenas.length) {
    return {
      ok: false,
      motivo: `la cabecera nombra ${ajenas.join('/')} y la clave es ${letra}`,
      letras,
    }
  }
  return { ok: true, letras }
}

module.exports = { analizarCabecera }
