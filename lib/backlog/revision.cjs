// lib/backlog/revision.cjs — la QUINTA espera: «hecho, esperando que una persona lo revise». (T-539)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// El backlog modela cuatro esperas con su campo cada una (persona, tarea, reloj, deploy) y `claim`
// las impide todas. Faltaba la que va a ser MÁS FRECUENTE en cuanto haya trabajadores autónomos:
// el trabajo está hecho, hay un entregable, y no avanza hasta que alguien lo mire.
//
// Hasta hoy se DEDUCÍA del texto de `resume_check` con cinco expresiones regulares
// (`clasificarEspera`), y el propio comentario defendía la heurística diciendo que no hacía falta
// un campo. La primera vuelta del piloto lo desmintió: el trabajador terminó su auditoría, dejó
// una propuesta lista, y no tenía cómo decirlo — acabó en `pause --hasta` con una fecha INVENTADA,
// porque su bloqueo no era el reloj.
//
// Es el mismo patrón corregido dos veces ya en este repo (`snooze_until`, `due_at`): **una
// condición en prosa no es una condición**. Quien escribe «pendiente de que lo mire Manuel» con
// otras palabras se queda fuera de la lista, y quien lo escribe en un título ve cómo envejece.
//
// ── LA NOTA ES OBLIGATORIA, Y NO ES BUROCRACIA ──────────────────────────────────────────────
// Una petición de revisión sin entregable es un «mírame» sin objeto: quien revisa tiene que abrir
// la ficha, reconstruir el contexto y adivinar qué se espera de él. Con varios trabajadores
// entregando a la vez, eso convierte la revisión —el recurso escaso, el tiempo de Manuel— en el
// cuello de botella que el piloto quería evitar. Se exige aquí Y en un CHECK de la tabla.

/** Una nota más corta que esto no dice qué revisar. Mismo espíritu que MOTIVO_MIN de los escapes. */
const ENTREGA_MIN = 20

/** Lo que se teclea para quitarse de encima el requisito, no para explicar un entregable. */
const NO_ES_ENTREGA = new Set(['revisar', 'revision', 'revisión', 'listo', 'hecho', 'ok', 'ver', 'mirar'])

/**
 * ¿Vale este texto como descripción del entregable?
 *
 * @returns {ok, problema}
 */
function validarEntrega(texto) {
  const v = String(texto == null ? '' : texto).trim()
  if (!v) return { ok: false, problema: 'hace falta --entrega "qué hay que revisar y dónde está"' }
  if (NO_ES_ENTREGA.has(v.toLowerCase())) {
    return { ok: false, problema: `«${v}» no dice qué revisar: describe el entregable y dónde está` }
  }
  if (v.length < ENTREGA_MIN) {
    return { ok: false, problema: `la entrega tiene ${v.length} caracteres: di QUÉ hay que mirar (mínimo ${ENTREGA_MIN})` }
  }
  return { ok: true, problema: null }
}

/** ¿Esta tarea está esperando que una persona la revise? */
function esperaRevision(task) {
  return Boolean(task && task.review_requested_at)
}

/**
 * En qué cajón cae una tarea que ya no está en curso.
 *
 * @returns 'revision' | 'decision' | 'verificacion'
 *
 * **La columna MANDA sobre el texto.** La heurística de `resume_check` se conserva solo para las
 * filas de antes de esta migración: sin ese respaldo, las tareas que hoy están en el cajón 🙋 por
 * su redacción se caerían al de «verificar» el día que esto entre, y eso es justo el fallo que se
 * está corrigiendo (una espera que se esconde no se hace).
 *
 * @param task            fila de backlog_tasks
 * @param clasificarTexto la heurística legacy (se inyecta para no duplicar criterio ni crear un ciclo)
 */
function clasificarEsperaTarea(task, clasificarTexto) {
  if (esperaRevision(task)) return 'revision'
  if (typeof clasificarTexto === 'function') return clasificarTexto(task && task.resume_check)
  return 'verificacion'
}

/** Antigüedad legible de la petición: una revisión que lleva días parada es el dato que importa. */
function esperandoDesde(task, ahora = new Date()) {
  if (!esperaRevision(task)) return null
  const ms = new Date(ahora).getTime() - new Date(task.review_requested_at).getTime()
  const h = Math.floor(ms / 3_600_000)
  if (h < 1) return 'hace menos de 1 h'
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} día(s)`
}

/** Línea para `list`/`parte`. Dice qué revisar y desde cuándo espera, no solo que existe. */
function lineaRevision(task, ahora = new Date()) {
  if (!esperaRevision(task)) return null
  const quien = task.review_requested_by ? ` · la dejó ${String(task.review_requested_by).slice(0, 18)}` : ''
  return `   ${task.id}  ${String(task.title || '').slice(0, 62)}\n` +
         `      🙋 esperando revisión ${esperandoDesde(task, ahora)}${quien}\n` +
         `      ▶ ${String(task.review_note || '').slice(0, 200)}`
}

module.exports = {
  ENTREGA_MIN, validarEntrega,
  esperaRevision, clasificarEsperaTarea, esperandoDesde, lineaRevision,
}
