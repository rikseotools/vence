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

/**
 * El MISMO criterio, como fragmento SQL, para que la COLA no reparta lo que ya tiene borrador.
 *
 * ── POR QUÉ NO BASTA CON EL GUARD DE ARRIBA ────────────────────────────────────────────────
 * `yaHayUno` corta al FINAL: el trabajador ya ha leído la impugnación, la ha contrastado contra
 * el BOE y ha escrito la respuesta — y entonces se le dice que no, que ya había una. El turno
 * entero está gastado, y como un `claude -p` muere al acabar, ese trabajo no se recupera.
 *
 * Lo que hay que impedir es que se la ENTREGUEN. La cola decide «libre» mirando el claim
 * (`sqlReservaLibre`), y ese criterio no puede ver esto: el trabajador SUELTA la fila al terminar
 * —hace bien, no puede cerrarla, eso lo aprueba una persona— así que entre «borrador escrito» y
 * «Manuel lo aprueba» la impugnación se ve intacta. Con la cola parada horas esperando ese OK,
 * esa ventana es casi todo el tiempo. Medido el 05/08: `744f0db0` con CINCO borradores abiertos.
 *
 * Va aquí, junto a `claveDe`, y no en `reserva.cjs`, a propósito: es el mismo criterio de
 * identidad («qué borradores son del mismo caso») y partirlo en dos sitios es como divergen.
 *
 * @param col  prefijo de la tabla en la consulta (p.ej. 'd.' o '')
 */
function sqlSinBorradorPendiente(col = '') {
  // Se compara por el prefijo de 8 hex — la misma clave que `claveDe`, porque el destinatario lo
  // escribe el trabajador con su prosa («impugnación 744f0db0 (cita errónea 27.3…)») y lo único
  // que comparten dos borradores del mismo caso es el id.
  return `NOT EXISTS (
            SELECT 1 FROM public.session_questions q
             WHERE q.kind = 'borrador' AND q.status = 'open'
               AND q.draft_target ILIKE '%' || left(${col}id::text, 8) || '%')`
}

module.exports = { claveDe, yaHayUno, mensajeDuplicado, sqlSinBorradorPendiente }
