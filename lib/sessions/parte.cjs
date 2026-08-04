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

// ── EVIDENCIA: «verde porque lo comprobé» ≠ «verde porque estoy ciego» (T-539, pieza 3) ──────
//
// El parte dice quién trabaja y quién calla. Lo que no podía decir es si lo que ve es de FIAR:
// una sesión que no alcanza la BD de coordinación aparece igual que una sana —de hecho aparece
// MENOS, porque ni siquiera late— y los guardarraíles que dependen de esa BD la dejan pasar sin
// comprobar nada. Medido el 04/08 en un clon sin `.env.local`: tres protecciones apagadas y nada
// que lo dijera.
//
// Desde [T-539] hay dos datos nuevos con los que contestarlo: el `rol` que viaja en el latido y
// el veredicto que deja `sesion_preflight` en el bus. Cruzarlos es todo lo que hace falta.
//
// **La asimetría es deliberada.** Que una PERSONA no haya corrido el preflight es lo normal y no
// se marca: si esto ladrara a todo el mundo, se dejaría de mirar en una tarde — la lección de los
// tres guardarraíles que murieron el 31/07. Que un TRABAJADOR no lo haya corrido es justo lo que
// hay que ver, porque significa que está trabajando sin que nadie sepa si puede.

/** Cuánto vale un preflight antes de considerarse viejo: un veredicto de ayer no dice nada de hoy. */
const EVIDENCIA_VALIDA_MIN = 120

/**
 * Estado de evidencia de cada sesión con señal.
 *
 * @param sesiones    [{ sid, slug, rol, last_signal_at }]
 * @param preflights  [{ sid, veredicto, ts }] — el ÚLTIMO por sid, tal cual sale del bus
 * @returns [{ sid, slug, rol, estado, veredicto, alarma }]
 *
 * `estado`:
 *   · `verificada`    — pasó el preflight hace poco y salió completa
 *   · `incompleta`    — lo pasó y NO estaba completa (sabemos que trabaja a ciegas)
 *   · `sin_evidencia` — no hay preflight reciente: **no se sabe**, que no es lo mismo que «mal»
 *
 * `alarma` es lo único que se pinta en rojo, y solo se enciende para un TRABAJADOR sin evidencia
 * o incompleto. Un `estado` no es un juicio; `alarma` sí.
 */
function evidenciaSesiones(sesiones, preflights, { ahora = new Date(), validaMin = EVIDENCIA_VALIDA_MIN } = {}) {
  const limite = new Date(ahora).getTime() - validaMin * 60_000
  const ultimo = new Map()
  for (const p of preflights || []) {
    if (!p || !p.sid || !p.ts) continue
    if (new Date(p.ts).getTime() <= limite) continue          // viejo: no cuenta como evidencia
    const prev = ultimo.get(p.sid)
    if (!prev || new Date(p.ts) > new Date(prev.ts)) ultimo.set(p.sid, p)
  }

  return (sesiones || []).filter((s) => s && s.sid).map((s) => {
    const p = ultimo.get(s.sid)
    const esTrabajador = s.rol === 'trabajador'
    const estado = !p ? 'sin_evidencia' : p.veredicto === 'completo' ? 'verificada' : 'incompleta'
    return {
      sid: s.sid,
      slug: s.slug || null,
      rol: esTrabajador ? 'trabajador' : 'persona',
      estado,
      veredicto: p ? p.veredicto : null,
      alarma: esTrabajador && estado !== 'verificada',
    }
  })
}

/**
 * Una línea para el parte. Dice qué pasa Y qué hacer, que es lo que distingue un aviso de un ruido.
 *
 * Lleva el sid corto además del slug a propósito: el slug sale del NOMBRE DEL DIRECTORIO, así que
 * dos sesiones en el mismo árbol se ven con la misma etiqueta — y con la del árbol ajeno si una se
 * mudó. Al avisar de que alguien trabaja a ciegas hay que poder decir QUIÉN sin ambigüedad.
 */
function etiqueta(e) {
  const corto = String(e.sid || '').slice(0, 14)
  return e.slug ? `${e.slug} (${corto}…)` : corto
}

function diagnosticoEvidencia(e) {
  if (e.alarma && e.estado === 'sin_evidencia') {
    return `🔴 ${etiqueta(e)}: TRABAJADOR sin preflight reciente — nadie sabe si puede trabajar. Corre: VENCE_SESSION_ROLE=trabajador npm run sesion:preflight`
  }
  if (e.alarma) {
    return `🔴 ${etiqueta(e)}: TRABAJADOR que pasó el preflight INCOMPLETO (${e.veredicto}) — está trabajando a ciegas.`
  }
  if (e.estado === 'incompleta') {
    return `🟠 ${etiqueta(e)}: preflight incompleto — trabaja pero NO está en el reparto.`
  }
  return null                                                  // lo normal no se pinta
}

module.exports = {
  CALLADA_MIN, cruzarTrabajo, sesionesOciosas, veredicto,
  EVIDENCIA_VALIDA_MIN, evidenciaSesiones, diagnosticoEvidencia,
}
