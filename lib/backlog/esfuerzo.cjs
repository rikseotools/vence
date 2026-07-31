// lib/backlog/esfuerzo.cjs — el esfuerzo declarado, y el contraste con lo que costó. (T-414)
//
// ── POR QUÉ CAJONES Y NO HORAS ───────────────────────────────────────────────────────────────
// Una estimación en horas se convierte en ficción: todo el mundo escribe «2h», nadie la revisa y
// envejece sola — el mismo final que tuvieron las fechas escritas en los títulos de las fichas
// (T-252). Lo que de verdad cambia una DECISIÓN son cuatro cajones, y sobre todo el último: si
// necesita sesión propia, no la encajas al final de la que tienes.
//
// ── Y POR QUÉ ESTO SOLO VALE SI SE PUEDE DESMENTIR ───────────────────────────────────────────
// Un campo que nadie puede contrastar se rellena a ojo y muere. Por eso el esfuerzo llega JUNTO
// con la medición (`worked_seconds`): a las pocas semanas se puede decir «declaraste rato y
// fueron seis horas» con datos, en vez de discutir opiniones. Antes de esto había **0 tareas con
// duración medible**, porque cerrar borraba `claimed_at`.

/** Los cajones, en orden ascendente de coste. El orden ES la funcionalidad. */
const CAJONES = ['minutos', 'rato', 'larga', 'sesion_propia']

/** Qué significa cada uno, en términos de la decisión que habilita. */
const DESCRIPCION = {
  minutos: 'se cierra ya — encaja al final de cualquier sesión',
  rato: 'una hora larga; cabe en una sesión con otras cosas',
  larga: 'media sesión: ya no cabe junto a otra tarea grande',
  sesion_propia: 'necesita una sesión entera para ella sola',
}

/** Techo orientativo de cada cajón, en horas. Sirve para CONTRASTAR, no para estimar. */
const TECHO_HORAS = { minutos: 0.5, rato: 2, larga: 5, sesion_propia: Infinity }

const esValido = (e) => CAJONES.includes(e)

/**
 * Peso para ordenar. Lo DESCONOCIDO va al final de su prioridad, nunca al principio: no se puede
 * afirmar que algo sea rápido si nadie lo ha mirado, y colarlo delante llenaría la cabeza de la
 * lista de tareas que no se cierran en un rato — que es justo lo que este campo evita.
 */
function pesoEsfuerzo(effort) {
  const i = CAJONES.indexOf(effort)
  return i < 0 ? CAJONES.length : i
}

/**
 * Orden de ataque: primero lo importante, y a igualdad de importancia **lo más corto** — que es
 * la preferencia expresada por Manuel («de tareas cortas a largas, no solo por prioridad»).
 * A igualdad de las dos, por id, para que el orden sea determinista con 2-10 sesiones leyéndolo.
 */
function ordenarPorPrioridadYEsfuerzo(tareas, pesoPrioridad) {
  return [...(tareas || [])].sort((a, b) =>
    pesoPrioridad(a.priority) - pesoPrioridad(b.priority) ||
    pesoEsfuerzo(a.effort) - pesoEsfuerzo(b.effort) ||
    String(a.id).localeCompare(String(b.id)))
}

/**
 * ¿Se pareció lo declarado a lo que costó? Es la razón de ser del campo: sin esto, la estimación
 * no se puede desmentir y acaba siendo decorativa.
 *
 * NO opina si la tarea apenas se trabajó (unos minutos de reloj no dicen nada) ni si no había
 * estimación — «no sé» tiene que poder decirse, como en el resto del andamiaje.
 *
 * @returns {veredicto:'sin_datos'|'acertada'|'pasada'|'corta', horas, techo}
 */
function contrastar({ effort, workedSeconds, minimoSegundos = 300 } = {}) {
  const horas = (Number(workedSeconds) || 0) / 3600
  if (!esValido(effort) || !workedSeconds || workedSeconds < minimoSegundos) {
    return { veredicto: 'sin_datos', horas, techo: null }
  }
  const techo = TECHO_HORAS[effort]
  const suelo = effort === 'minutos' ? 0 : TECHO_HORAS[CAJONES[CAJONES.indexOf(effort) - 1]]
  if (horas > techo) return { veredicto: 'pasada', horas, techo }
  if (horas < suelo / 2) return { veredicto: 'corta', horas, techo }
  return { veredicto: 'acertada', horas, techo }
}

/** «3h 12m» — para imprimir sin que nadie tenga que dividir entre 3600 mentalmente. */
function formatearDuracion(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

module.exports = {
  CAJONES, DESCRIPCION, TECHO_HORAS,
  esValido, pesoEsfuerzo, ordenarPorPrioridadYEsfuerzo, contrastar, formatearDuracion,
}
