// lib/backlog/preguntas.cjs — el EMBUDO de preguntas de las sesiones a Manuel. PURO. (T-493)
//
// ── QUÉ PROBLEMA RESUELVE ────────────────────────────────────────────────────────────────────
// Con 2-10 sesiones a la vez, Manuel no puede entrar en cada terminal a ver si alguien le
// necesita. Hasta hoy una duda moría en la terminal de la sesión, o se colaba en el `resume_check`
// de una tarea pausada, donde `clasificarEspera` la buscaba con cinco expresiones regulares — y si
// la sesión no escribía la palabra correcta, **la pregunta desaparecía de la lista**.
//
// ── LO QUE SE DECIDE AQUÍ (y no en el CLI) ──────────────────────────────────────────────────
// Todo el juicio: qué es una pregunta contestable, cómo se ordenan las pendientes cuando hay
// varias, y qué respuestas tiene que ver una sesión al volver. Sin BD ni red, para poder
// calibrarlo con tests en vez de a ojo.

/** Una pregunta que no se puede contestar sin abrir la sesión no es una pregunta: es una alerta. */
const MINIMO = 15

/**
 * ¿Está la pregunta en condiciones de ser contestada por alguien que NO está en esa sesión?
 *
 * Se comprueba en el punto de ESCRITURA (misma decisión que el `--esfuerzo` obligatorio de
 * `reserve`): una pregunta mal formulada obliga a Manuel a pedir contexto, y entonces el embudo
 * cuesta más que entrar en la sesión, que es justo lo que venía a evitar.
 */
function validarPregunta({ question, context, blocking } = {}) {
  const q = String(question || '').trim()
  const problemas = []
  if (q.length < MINIMO) problemas.push(`la pregunta tiene ${q.length} caracteres: di QUÉ decides, no «¿sigo?»`)
  // Sin alternativas, contestar obliga a investigar. Con ellas, se contesta en una línea.
  const tieneOpciones = /\bo\b|\?|\ba\)|\b1\)|vs\b|opci/i.test(q + ' ' + String(context || ''))
  if (q.length >= MINIMO && !tieneOpciones) {
    problemas.push('no se ve la decisión: pon las opciones («¿hago A o B?»), no solo el problema')
  }
  if (blocking && !String(context || '').trim()) {
    // Si además bloquea, el contexto no es un lujo: es lo que permite desbloquear sin ida y vuelta.
    problemas.push('si BLOQUEA, el contexto es obligatorio: qué has mirado ya y qué te falta')
  }
  return { ok: problemas.length === 0, problemas }
}

/**
 * Orden del embudo. Lo que decide no es la antigüedad sola:
 *
 *  1. **lo que BLOQUEA** va primero — hay una sesión parada de verdad;
 *  2. dentro de cada grupo, **lo más viejo primero**, porque una pregunta vieja ya ha costado
 *     tiempo y seguirá costándolo.
 *
 * Ordenar solo por antigüedad enterraría una sesión bloqueada hace diez minutos detrás de cinco
 * dudas cómodas de ayer.
 */
function ordenarEmbudo(preguntas) {
  return [...(preguntas || [])]
    .filter((p) => p && p.status === 'open')
    .sort((a, b) => {
      if (!!b.blocking !== !!a.blocking) return b.blocking ? 1 : -1
      return new Date(a.asked_at).getTime() - new Date(b.asked_at).getTime()
    })
}

/**
 * Las respuestas que ESTA sesión todavía no ha leído.
 *
 * `seen_at` existe para que el aviso se imprima una vez y no para siempre: un aviso que se repite
 * indefinidamente se vuelve indistinguible del ruido y se aprende a saltarlo, que es como
 * murieron tres guardarraíles de este repo en un solo día.
 */
function respuestasSinLeer(preguntas, sid) {
  if (!sid) return []
  return (preguntas || []).filter((p) => p && p.sid === sid && p.status === 'answered' && !p.seen_at)
}

/** Horas que lleva esperando. Redondeado a la baja: exagerar la espera resta credibilidad. */
function esperaHoras(p, ahora = new Date()) {
  return Math.max(0, Math.floor((new Date(ahora).getTime() - new Date(p.asked_at).getTime()) / 3_600_000))
}

/**
 * El embudo tal y como lo lee Manuel: una línea por pregunta, lo que bloquea marcado, y **cuánto
 * lleva esperando**, que es el dato que convierte «hay preguntas» en «hay una sesión parada desde
 * hace 6 horas».
 */
function formatearEmbudo(preguntas, { ahora = new Date(), limite = 12 } = {}) {
  const abiertas = ordenarEmbudo(preguntas)
  if (!abiertas.length) return []
  const bloqueadas = abiertas.filter((p) => p.blocking).length
  const cab = `🙋 ${abiertas.length} PREGUNTA(S) PARA TI` + (bloqueadas ? ` — ${bloqueadas} con la sesión PARADA` : '')
  const filas = abiertas.slice(0, limite).map((p) => {
    const h = esperaHoras(p, ahora)
    const espera = h >= 1 ? `${h}h` : '<1h'
    const marca = p.blocking ? '⛔' : '  '
    const tarea = p.task_id ? ` [${p.task_id}]` : ''
    return `  ${marca} #${p.id}${tarea} (${espera}) ${String(p.question).replace(/\s+/g, ' ').slice(0, 110)}`
  })
  const cola = abiertas.length > limite ? [`     …y ${abiertas.length - limite} más`] : []
  return [cab, ...filas, ...cola, '     responder:  node scripts/backlog.cjs responder <id> "…"']
}

module.exports = {
  MINIMO,
  validarPregunta,
  ordenarEmbudo,
  respuestasSinLeer,
  esperaHoras,
  formatearEmbudo,
}
