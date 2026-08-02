// lib/impugnaciones/puertaCierre.cjs — ¿puede ESTA sesión cerrar ESTE caso? (T-474)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// La cola de impugnaciones/feedback tenía reserva atómica (T-412) y NADA que la exigiera. Los dos
// comandos que de verdad escriben —`cerrar.ts` y `cerrar-feedback.ts`, que mandan el email y
// conceden el euro— no miraban `claimed_by` ni una vez. Medido el 01/08/2026 sobre RDS:
//
//   · 165 impugnaciones cerradas en 14 días → **28 (17 %) nunca pasaron por reserva**
//   · 111 feedbacks cerrados en 14 días     → **58 (52 %) tampoco**
//
// Y en simulación con seis sesiones concurrentes: el claim atómico aguanta (1 ganador de 6), pero
// **la sesión que PERDIÓ el claim cierra la fila igualmente**. O sea: la reserva protegía el
// reparto y no protegía el acto de responder, que es el que le llega al usuario.
//
// Es el principio 8 del runbook de sesiones paralelas —*impedir en el punto de ESCRITURA*— que el
// backlog ya aplica con su `pre-push` y esta cola no aplicaba en ningún sitio.
//
// ── POR QUÉ BLOQUEA TAMBIÉN «SIN RESERVAR», Y NO SOLO «ES DE OTRA» ───────────────────────────
// Bloquear solo el caso «la tiene otra sesión viva» llega TARDE: para cuando cierras, la otra
// sesión ya ha gastado el análisis entero, o peor, ya le ha escrito. El daño se produce cuando
// alguien trabaja SIN reservar, porque entonces `cola.cjs next` le entrega ese mismo caso a la
// siguiente sesión —lo ve libre, y lo está—. Así que la puerta exige lo que evita la colisión:
// tenerla TÚ. Es la misma elección que hizo el push-guard del backlog, que bloquea aunque nadie
// más quisiera la tarea.
//
// Cumple las dos condiciones del principio 5 (bloquear solo lo satisfacible y dañino):
//   · **satisfacible con un comando** — `cola.cjs claim <id>`, que además te dirá al instante si
//     otra sesión estaba en ello. Y quien sigue el flujo del manual **nunca ve la puerta**:
//     `revisar-impugnacion.cjs` ya reserva al abrir el dossier.
//   · **daño irreversible** — un email enviado no se recoge, y un euro concedido tampoco.
//
// ── FAIL-OPEN DONDE NO SE PUEDE AFIRMAR NADA (principio 4) ───────────────────────────────────
// Sin identidad de sesión o sin BD no se bloquea: no se le puede exigir a nadie una reserva que el
// sistema no sabe comprobar. Se avisa y se sigue.

const { estadoReserva } = require('./reserva.cjs')

/**
 * @param {object}  o
 * @param {string?} o.claimedBy   dueño actual de la fila (null = sin reservar)
 * @param {string?} o.claimedAt   cuándo se reservó
 * @param {Array}   o.sesiones    filas de `worktree_sessions` ({ sid, last_signal_at })
 * @param {string?} o.sid         quién quiere cerrar
 * @param {string?} o.igualmente  motivo declarado para saltarse la puerta (escape)
 * @returns {{permitido:boolean, clase:string, motivo:string, comando?:string}}
 *   `clase` es lo que se cuenta en el bus de fricción: sirve para ver si la puerta se está
 *   RODEANDO (principio 7), que es lo que avisa de que ha dejado de servir.
 */
function puedeCerrar({ claimedBy, claimedAt, sesiones, sid, igualmente, ahora = new Date() } = {}) {
  if (!sid) {
    return {
      permitido: true,
      clase: 'sin_identidad',
      motivo: 'no se ha podido resolver el id de sesión: no se puede exigir una reserva que no se sabe comprobar',
    }
  }
  if (typeof igualmente === 'string' && igualmente.trim()) {
    return { permitido: true, clase: 'escape', motivo: igualmente.trim() }
  }
  if (claimedBy && claimedBy === sid) {
    return { permitido: true, clase: 'tuya', motivo: 'la tienes reservada' }
  }

  const estado = estadoReserva({ claimedBy, claimedAt, sesiones, sid, ahora })

  // La tiene otra sesión y su reserva sigue en pie (viva, o dentro del suelo). Este es el caso
  // grave: dos sesiones a la vez sobre el mismo usuario, y el segundo email ya no se retira.
  if (claimedBy && !estado.libre) {
    return {
      permitido: false,
      clase: 'ajena',
      motivo: `la tiene la sesión ${String(claimedBy).slice(0, 12)} — ${estado.motivo}`,
      comando: 'node scripts/impugnaciones/cola.cjs list',
    }
  }

  // Libre (o de una sesión que ya murió): no hay colisión AHORA, pero cerrar sin haber reservado
  // es lo que la CREA — mientras trabajabas, la cola le estaba ofreciendo este mismo caso a otra.
  return {
    permitido: false,
    clase: 'sin_reservar',
    motivo: claimedBy
      ? `figura reservada por ${String(claimedBy).slice(0, 12)}, cuya sesión ya no está (${estado.motivo}), pero no la has cogido tú`
      : 'no la tienes reservada: mientras la trabajabas, la cola se la ofrecía a las demás sesiones',
  }
}

/** El comando exacto que satisface la puerta. Contextual a propósito (principio 10). */
function comandoParaSatisfacer(id) {
  return `node scripts/impugnaciones/cola.cjs claim ${id}`
}

module.exports = { puedeCerrar, comandoParaSatisfacer }
