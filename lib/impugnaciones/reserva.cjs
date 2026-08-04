// lib/impugnaciones/reserva.cjs — cuándo una reserva de la cola vuelve a estar libre. (T-412)
//
// ── EL DILEMA, QUE NO SE ARREGLA CON UN NÚMERO ───────────────────────────────────────────────
// La cola reservaba con un reloj fijo: pasadas 2 h, la reserva se consideraba libre. Con un
// reloj fijo siempre eliges cuál de los dos fallos prefieres, y los dos duelen:
//
//   · plazo CORTO  → protege del ordenador apagado, pero **traiciona a la sesión viva** que lleva
//     tres horas con un caso difícil: pierde la reserva sin enterarse y otra sesión coge el mismo
//     feedback. Pasó el 31/07 con un caso de Sergio.
//   · plazo LARGO  → protege a la sesión lenta, pero si el ordenador se apaga ese feedback queda
//     **bloqueado horas** y nadie puede contestarlo.
//
// ── LA SALIDA: que la reserva no caduque por reloj, sino cuando MUERE SU SESIÓN ──────────────
// La señal ya existe (`worktree_sessions`, el latido de T-296): una sesión viva late, una muerta
// deja de latir. Así los cuatro casos salen bien SIN elegir un número:
//
//   · ordenador apagado / sesión colgada → deja de latir → la reserva se libera sola;
//   · revisión larga pero ACTIVA         → sigue latiendo → conserva su reserva, sin tope de horas;
//   · sesión viva pero callada           → ver el SUELO de abajo;
//   · dueño sin fila de latido           → no se puede afirmar nada → manda el reloj (ver abajo).
//
// Es la misma distinción que en `lib/deploy/estado.cjs`: **la señal de vida es la verdad, la
// antigüedad solo es un recurso cuando no hay señal.**
//
// ── LOS DOS FRENOS, QUE SON LO QUE HACE ESTO SEGURO ──────────────────────────────────────────
// 1. **SUELO.** Por debajo de `MIN_HORAS` la reserva NO se toca, haya latido o no. Así el peor
//    caso posible es el comportamiento de hoy, nunca uno peor: si la señal fallara entera,
//    seguiríamos con el reloj de siempre.
// 2. **Sin fila de latido no se inventa un veredicto.** Un `claimed_by` que no está en
//    `worktree_sessions` (sesión antigua, sid desconocido) no se declara ni vivo ni muerto: se
//    cae al reloj. Inventarse que está muerto libraría trabajo ajeno en curso.

// Cómo se abrevia un sid en pantalla vive en UN solo sitio (T-538): `sid.cjs` es la fuente única
// de identidad desde T-407, y la forma de enseñarla es parte de la identidad.
const { sidCorto } = require('../sessions/sid.cjs')

/** Suelo: una reserva más reciente que esto es intocable, con o sin latido. Es el plazo de hoy. */
const MIN_HORAS = 2

/** Cuánto silencio hace falta para dar una sesión por ida. Generoso: soltar de más duele más. */
const LATIDO_VIVO_MIN = 30

/**
 * ¿Puede OTRA sesión coger esta reserva?
 *
 * @param claimedBy   sid del dueño actual (null = libre)
 * @param claimedAt   cuándo la cogió
 * @param sesiones    filas de `worktree_sessions` ({ sid, last_signal_at })
 * @param sid         quién pregunta (la suya siempre es suya)
 * @returns {libre:boolean, motivo:string}
 */
function estadoReserva({ claimedBy, claimedAt, sesiones, sid, ahora = new Date(),
                         minHoras = MIN_HORAS, latidoMin = LATIDO_VIVO_MIN } = {}) {
  if (!claimedBy) return { libre: true, motivo: 'sin reservar' }
  if (sid && claimedBy === sid) return { libre: true, motivo: 'es tuya' }
  if (!claimedAt) return { libre: true, motivo: 'reservada sin fecha (dato roto)' }

  const horas = (new Date(ahora).getTime() - new Date(claimedAt).getTime()) / 3_600_000
  if (horas < minHoras) {
    return { libre: false, motivo: `reservada hace ${horas.toFixed(1)} h (suelo de ${minHoras} h)` }
  }

  const duena = (sesiones || []).find((x) => x && x.sid === claimedBy)
  if (!duena || !duena.last_signal_at) {
    // No se puede afirmar que esté viva NI muerta. Manda el reloj, que es lo que había.
    return { libre: true, motivo: `${horas.toFixed(1)} h y su sesión no publica latido — no se puede confirmar` }
  }
  const minutos = (new Date(ahora).getTime() - new Date(duena.last_signal_at).getTime()) / 60_000
  if (minutos <= latidoMin) {
    // El caso que motivó todo: revisión larga pero VIVA. Antes perdía la reserva a las 2 h.
    return { libre: false, motivo: `lleva ${horas.toFixed(1)} h pero su sesión sigue viva (latido hace ${Math.round(minutos)} min)` }
  }
  return { libre: true, motivo: `${horas.toFixed(1)} h y su sesión no late desde hace ${Math.round(minutos)} min` }
}

/**
 * El MISMO criterio como fragmento SQL, para que el claim siga siendo ATÓMICO.
 *
 * No es una copia del de arriba por capricho: la reserva tiene que decidirse **dentro** del
 * `UPDATE … FOR UPDATE SKIP LOCKED`, o dos sesiones que lean «libre» a la vez se la llevarían
 * las dos — que es exactamente lo que esta cola existe para impedir. La versión JS es la que se
 * puede testear y explicar; ésta es la que se ejecuta. El guardarraíl de paridad
 * (`__tests__/impugnaciones/reserva.test.ts`) comprueba que los dos hablan de los mismos campos
 * y los mismos umbrales.
 *
 * @param col  prefijo de la tabla (p.ej. 'f.' o '') para calificar las columnas
 * @param p    marcador del sid de quien pregunta (p.ej. '$1')
 */
function sqlReservaLibre(col = '', p = '$1') {
  return `(${col}claimed_by IS NULL
        OR ${col}claimed_by = ${p}
        OR (${col}claimed_at < now() - interval '${MIN_HORAS} hours'
            AND NOT EXISTS (
              SELECT 1 FROM public.worktree_sessions ws
               WHERE ws.sid = ${col}claimed_by
                 AND ws.last_signal_at > now() - interval '${LATIDO_VIVO_MIN} minutes')))`
}

/**
 * Cómo se PINTA una reserva en `cola.cjs list`, decidido por el MISMO criterio que la concede.
 *
 * Existe porque el panel tenía criterio propio —el reloj de 2 h a secas— mientras la puerta
 * decidía por señal de vida, y eso hace que el panel MIENTA justo en el caso que importa: una
 * fila reservada hace 3 h por una sesión que sigue trabajando salía como «🟡 claim viejo (libre)»,
 * así que otra sesión la leía libre y se ponía con ella. Medido en simulación el 01/08/2026: 1 de
 * 5 casos divergía, y era ese. Dos puertas al mismo recurso con criterios distintos no protegen,
 * se contradicen (T-375 en el backlog, misma lección).
 */
function etiquetaReserva({ claimedBy, claimedAt, sesiones, sid, ahora = new Date() } = {}) {
  if (!claimedBy) return '🟢 libre'
  const { libre, motivo } = estadoReserva({ claimedBy, claimedAt, sesiones, sid, ahora })
  if (sid && claimedBy === sid) return '🙋 TUYA'
  // Se dice la RELACIÓN («otra sesión»), no solo el identificador (T-538). El icono ya distinguía,
  // pero al lado imprimía `imp-04ag` —el prefijo a 8 caracteres, idéntico al de quien miraba— y lo
  // que se lee es el nombre, no el emoji: un candado junto a tu propio nombre se lee «cerrada por
  // ti». El 04/08 eso hizo pasar por propias OCHO filas ajenas. Ahora la palabra lo dice, y el sid
  // se abrevia por segmento (`imp-04ago-b`), que es lo único que no colisiona.
  return libre ? `🟢 libre — ${motivo}` : `🔒 otra sesión (${sidCorto(claimedBy)}) — ${motivo}`
}

module.exports = { estadoReserva, etiquetaReserva, sqlReservaLibre, MIN_HORAS, LATIDO_VIVO_MIN }
