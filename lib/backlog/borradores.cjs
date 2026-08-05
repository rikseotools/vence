// lib/backlog/borradores.cjs — un borrador por destinatario. (T-486)
//
// ── EL DEFECTO, MEDIDO AL ESTRENARLO ─────────────────────────────────────────────────────────
// Los primeros diez borradores de la flota traían **tres pares duplicados**: dos trabajadores
// distintos habían analizado la misma impugnación y cada uno dejó el suyo. `1aac9e3c` con dos,
// `71a15cae` con dos, `968b0a9d` con dos.
//
// No es que el claim de la cola falle: funciona. Lo que pasa es que un trabajador **suelta** la
// fila al terminar —hace bien, no puede cerrarla— y entonces vuelve al pool, así que el siguiente
// la coge y la vuelve a analizar desde cero. El claim protege el trabajo SIMULTÁNEO; nada protegía
// el trabajo YA HECHO.
//
// El coste no es solo la cuota gastada dos veces: es que Manuel abre la cola y tiene que decidir
// cuál de los dos borradores manda, que es exactamente el trabajo que la flota venía a ahorrarle.
//
// ── CÓMO SE RECONOCE «EL MISMO DESTINATARIO» ────────────────────────────────────────────────
// Por el identificador, no por el texto: los trabajadores escriben el destinatario con su propia
// prosa («impugnación 1aac9e3c (LO 3/2007 art.12…)» vs «impugnación 1aac9e3c (otro/tema_incorrecto…)»)
// y comparar cadenas no los emparejaría. Lo que sí comparten es el id.

/** El identificador dentro de un destinatario escrito a mano. Un UUID o su prefijo (≥8 hex). */
const ID = /\b([0-9a-f]{8})(?:[0-9a-f-]*)\b/i

/**
 * Saca la clave por la que dos borradores son «del mismo caso».
 *
 * Devuelve `null` cuando no hay identificador — y entonces NO se deduplica, a propósito: un
 * destinatario sin id («la lista de inscritos», «Marta») puede ser legítimamente distinto de otro
 * parecido, y bloquear por parecido textual impediría escribir el segundo borrador de verdad.
 */
function claveDe(destinatario) {
  const m = String(destinatario || '').match(ID)
  return m ? m[1].toLowerCase() : null
}

/**
 * ¿Ya hay un borrador abierto para este destinatario?
 *
 * @param destinatario  el `--para` que se está escribiendo
 * @param abiertos      [{ id, draft_target, sid }] los borradores con `status='open'`
 * @returns {duplicado, existente, motivo}
 */
function yaHayUno(destinatario, abiertos = []) {
  const clave = claveDe(destinatario)
  if (!clave) return { duplicado: false, existente: null, motivo: null }
  const existente = (abiertos || []).find((b) => claveDe(b.draft_target) === clave)
  if (!existente) return { duplicado: false, existente: null, motivo: null }
  return {
    duplicado: true,
    existente,
    motivo: `ya hay un borrador abierto para ${clave} (#${existente.id}, lo dejó ${String(existente.sid || '?').slice(0, 12)})`,
  }
}

/**
 * Lo que se le dice a quien iba a duplicarlo. **Ofrece la salida buena antes que el escape**: si
 * de verdad tiene algo mejor, que lo diga sobre el que ya existe en vez de dejar dos.
 */
function mensajeDuplicado(v) {
  return [
    `⛔ ${v.motivo}.`,
    '',
    '   No dejes un segundo: Manuel tendría que decidir cuál de los dos mandar, que es justo el',
    '   trabajo que veníamos a ahorrarle.',
    '',
    '   LÉELO PRIMERO:  node scripts/backlog.cjs preguntas',
    '   · si el que hay ya dice lo tuyo → no hagas nada, suelta la fila y sigue con otra cosa.',
    '   · si has encontrado algo que le falta → añádelo como pregunta citando su número,',
    '     no como borrador nuevo.',
    '',
    '   Si aun así hace falta uno aparte (destinatario distinto), dilo explícito:  --igualmente',
  ].join('\n')
}

module.exports = { claveDe, yaHayUno, mensajeDuplicado }
