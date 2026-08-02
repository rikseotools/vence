// lib/sessions/parte.cjs — el PARTE: qué está haciendo cada sesión y quién está parado. PURO.
// (T-494, 02/08/2026)
//
// ── LA PREGUNTA QUE NADIE CONTESTABA ─────────────────────────────────────────────────────────
// Manuel (02/08): *«un resumen muy corto de lo que va haciendo cada sesión, para ver si están
// paradas»*. Los datos existían los tres repartidos —`worktree_sessions` (quién vive),
// `backlog_tasks` (quién tiene qué) y `observable_events` (fricción)— pero **ninguno contesta
// «¿quién está PARADO?»**, porque eso no vive en ninguna tabla: es el CRUCE de dos.
//
//   `list` pinta la tarea como cogida.  ·  `latidos` pinta la sesión como dormida.
//   Nadie ataba los dos cabos, y había que hacerlo a ojo cada vez.
//
// ── QUÉ ES ESTAR PARADO, DICHO CON PRECISIÓN ────────────────────────────────────────────────
// Una tarea `in_progress` cuya sesión **lleva rato sin dar señal**. Y hay tres formas distintas
// de estarlo, que NO son la misma y por eso no se mezclan:
//
//   · `parada`      — la sesión existe y calla. Alguien tiene que mirar si sigue viva.
//   · `desaparecida`— la sesión NUNCA latió (no hay fila). No se puede afirmar que muriera:
//                     puede ser una versión vieja del CLI que no late. Se dice, no se supone.
//   · `lease_vencido` — además el arriendo caducó, así que `reap` ya puede segarla.
//
// Y una sesión viva con su tarea es lo normal: no sale como problema.
//
// Sin BD ni red: recibe las filas y decide. El resumen en prosa lo pone quien lo lea — los hechos
// son deterministas y no hacen falta juicios de un modelo para saber quién calla.

const { clasificarSenal, formatearAntiguedad } = require('./latido.js')

/** A partir de aquí, una sesión con tarea cogida y sin señal merece que alguien mire. */
const CALLADA_MIN = 45

/**
 * Cruza tareas en curso con sesiones vivas.
 *
 * @param tareas    filas de `backlog_tasks` con `status='in_progress'` ({ id, title, claimed_by, claimed_at, lease_until })
 * @param sesiones  filas de `worktree_sessions` ({ sid, slug, host, last_signal_at })
 * @returns {trabajando, paradas} — paradas ordenadas por lo que más lleva callado.
 */
function cruzarTrabajo(tareas, sesiones, { ahora = new Date(), calladaMin = CALLADA_MIN } = {}) {
  const porSid = new Map((sesiones || []).filter((s) => s && s.sid).map((s) => [s.sid, s]))
  const trabajando = []
  const paradas = []

  for (const t of tareas || []) {
    if (!t || !t.claimed_by) continue
    const ses = porSid.get(t.claimed_by) || null
    const senal = ses ? clasificarSenal(ses.last_signal_at, ahora) : { estado: 'sin_senales', minutos: null }
    const leaseVencido = !!t.lease_until && new Date(t.lease_until).getTime() < new Date(ahora).getTime()
    const fila = {
      id: t.id,
      title: t.title,
      sid: t.claimed_by,
      slug: ses ? ses.slug : null,
      host: ses ? ses.host : null,
      minutosCallada: senal.minutos,
      antiguedad: formatearAntiguedad(senal.minutos),
      leaseVencido,
    }

    if (!ses) {
      // NUNCA latió. No se puede afirmar que muriera: puede ser un CLI viejo que no late. Se
      // etiqueta distinto a propósito — convertir un desconocido en veredicto es el error que
      // este andamiaje evita en todas sus piezas.
      paradas.push({ ...fila, motivo: 'desaparecida', detalle: 'esa sesión nunca ha dado señal' })
    } else if (senal.minutos != null && senal.minutos >= calladaMin) {
      paradas.push({
        ...fila,
        motivo: leaseVencido ? 'lease_vencido' : 'parada',
        detalle: leaseVencido
          ? `calla desde ${formatearAntiguedad(senal.minutos)} y el lease ya venció: \`reap --apply\` la devuelve al pool`
          : `calla desde ${formatearAntiguedad(senal.minutos)}`,
      })
    } else {
      trabajando.push(fila)
    }
  }

  const orden = (x) => (x.minutosCallada == null ? Number.MAX_SAFE_INTEGER : x.minutosCallada)
  paradas.sort((a, b) => orden(b) - orden(a))
  trabajando.sort((a, b) => (a.minutosCallada ?? 0) - (b.minutosCallada ?? 0))
  return { trabajando, paradas }
}

/** Sesiones vivas que NO tienen ninguna tarea cogida: brazos libres, o alguien sin reclamar. */
function sesionesOciosas(tareas, sesiones, { ahora = new Date() } = {}) {
  const conTarea = new Set((tareas || []).map((t) => t && t.claimed_by).filter(Boolean))
  return (sesiones || [])
    .filter((s) => s && s.sid && !conTarea.has(s.sid))
    .filter((s) => clasificarSenal(s.last_signal_at, ahora).estado === 'viva')
    .map((s) => ({ sid: s.sid, slug: s.slug, host: s.host }))
}

/**
 * El veredicto de una línea, que es lo que Manuel lee primero.
 *
 * **No dice «todo bien» cuando no se ha podido mirar.** Si no hay ninguna sesión con señal, eso no
 * es calma: es que no se sabe — y decirlo verde sería la peor mentira posible en un parte.
 */
function veredicto({ paradas, trabajando, preguntas, sesionesConSenal }) {
  if (!sesionesConSenal) return { icono: '⚪', frase: 'ninguna sesión ha dado señal: no se puede afirmar nada' }
  const bloqueantes = (preguntas || []).filter((p) => p.blocking && p.status === 'open').length
  if (bloqueantes) return { icono: '🔴', frase: `${bloqueantes} sesión(es) PARADAS esperando que contestes` }
  if (paradas.length) return { icono: '🟠', frase: `${paradas.length} tarea(s) sin señal de su sesión` }
  const abiertas = (preguntas || []).filter((p) => p.status === 'open').length
  if (abiertas) return { icono: '🟡', frase: `${abiertas} pregunta(s) esperándote, nadie parado` }
  return { icono: '🟢', frase: `${trabajando.length} sesión(es) trabajando, nada que decidir` }
}

module.exports = { CALLADA_MIN, cruzarTrabajo, sesionesOciosas, veredicto }
