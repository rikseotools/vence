// lib/backlog/archivo.cjs — el ÚLTIMO escalón del ciclo de una tarea: `done` ≠ archivada. (T-392 F2/F3)
//
// ── EL HUECO QUE CIERRA ──────────────────────────────────────────────────────────────────────
// La Fase 1 (31/07, `verificacionGate.cjs`) ya impide cerrar una tarea cuyo código servido
// todavía no está desplegado. Pero "desplegado" y "verificado" no son lo mismo: el encargo
// original de Manuel pedía la mitad que Fase 1 no cubre — *«la última fase la verificación en
// producción, y cuando está verificada y todo correcto ponerle estado archivado»*. Hoy `done` es
// terminal, así que esa distinción se pierde: no hay forma de decir «esto se cerró y ADEMÁS
// alguien lo vio funcionar en producción», frente a «esto se cerró porque el deploy ya lo incluye».
//
// ── LAS TRES REGLAS QUE LO SALVAN DE SER UN SELLO ───────────────────────────────────────────────
// 1. Exención AUTOMÁTICA: si la tarea no toca superficie servida, no hay nada que ver funcionar
//    en producción — se archiva sola en el mismo `done` (ver `MOTIVO_AUTO`).
// 2. Archivar EXIGE evidencia: no basta "ok"/"listo", igual que ya exige `revision`/`due`.
// 3. El cubo de "cerradas sin archivar" tiene que SALIR en algún sitio, o el problema que
//    resuelve reaparece un nivel más arriba (`pendienteDeArchivar` + `lineaPendienteArchivar`).

/** Una evidencia más corta que esto no dice qué se comprobó. Mismo umbral que `revision.cjs`. */
const EVIDENCIA_MIN = 20

/** Lo que se teclea para quitarse de encima el requisito, no para describir una comprobación. */
const NO_ES_EVIDENCIA = new Set([
  'ok', 'okay', 'correcto', 'funciona', 'verificado', 'listo', 'hecho', 'bien', 'si', 'sí',
  'ninguno', 'ninguna', 'nada', 'perfecto', 'todo bien', 'todo ok', 'todo correcto',
])

/**
 * ¿Vale este texto como evidencia de que se comprobó en producción?
 *
 * Mismo criterio que `lib/backlog/revision.cjs` (`validarEntrega`): longitud mínima + lista de
 * vocabulario vacío. Se duplica el UMBRAL a propósito y no la función, porque el mensaje de error
 * es distinto («qué revisar» vs «qué comprobaste») y mezclar los dos módulos por un número los
 * acopla sin necesidad.
 *
 * @returns {ok, problema}
 */
function validarEvidencia(texto) {
  const v = String(texto == null ? '' : texto).trim()
  if (!v) return { ok: false, problema: 'hace falta --evidencia "qué comprobaste en producción y con qué datos"' }
  if (NO_ES_EVIDENCIA.has(v.toLowerCase())) {
    return { ok: false, problema: `«${v}» no es evidencia: di QUÉ viste funcionar y con qué dato (mínimo ${EVIDENCIA_MIN} caracteres)` }
  }
  if (v.length < EVIDENCIA_MIN) {
    return { ok: false, problema: `la evidencia tiene ${v.length} caracteres: describe la comprobación (mínimo ${EVIDENCIA_MIN})` }
  }
  return { ok: true, problema: null }
}

/** Texto fijo del archivado automático — regla 1: sin superficie servida no hay nada que ver en producción. */
const MOTIVO_AUTO = 'Sin superficie servida (docs/tooling/datos): archivada automáticamente al cerrar — regla 1 de T-392.'

/** Texto fijo de la migración de las ~350 tareas cerradas antes de este ciclo (T-392 F3). */
const MOTIVO_MIGRACION = 'Migración T-392: cerrada antes del ciclo de archivado explícito — no se re-verifica retroactivamente; el ciclo aplica desde su estreno en adelante.'

/** sid sintético usado por escrituras que no vienen de una sesión concreta (auto-archivo, migración). */
const SID_AUTO = 'auto-t392'
const SID_MIGRACION = 'migracion-t392'

/**
 * ¿Esta tarea cerrada está esperando que alguien confirme, con evidencia, que funciona en
 * producción? SOLO el campo manda — nunca se deduce de texto (mismo principio que `revision.cjs`
 * aplicó a la quinta espera): `requiere_archivo` se fija UNA vez, en `done`, a partir del mismo
 * análisis de superficie servida que ya usa la Fase 1.
 */
function pendienteDeArchivar(task) {
  return Boolean(task && task.status === 'done' && !task.archived_at && task.requiere_archivo === true)
}

/** Días desde que se cerró — antigüedad, no gravedad calculada; el CLI decide el emoji. */
function diasCerrada(task, ahora = new Date()) {
  if (!task || !task.closed_at) return null
  const ms = new Date(ahora).getTime() - new Date(task.closed_at).getTime()
  return Math.floor(ms / 86_400_000)
}

/** Umbral a partir del cual una espera de archivado se pinta con más urgencia (regla 3 de la ficha). */
const DIAS_URGENTE = 3

/** Línea para `list`: qué tarea, desde cuándo cerrada, y el recordatorio de cómo cerrar el ciclo. */
function lineaPendienteArchivar(task, ahora = new Date()) {
  if (!pendienteDeArchivar(task)) return null
  const dias = diasCerrada(task, ahora)
  const antiguedad = dias == null ? '' : dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`
  const urgente = dias != null && dias >= DIAS_URGENTE
  return `   ${urgente ? '🔴' : '·'} ${task.id}  ${String(task.title || '').slice(0, 58)}\n` +
         `      cerrada ${antiguedad} · sin confirmar en producción`
}

module.exports = {
  EVIDENCIA_MIN, NO_ES_EVIDENCIA, validarEvidencia,
  MOTIVO_AUTO, MOTIVO_MIGRACION, SID_AUTO, SID_MIGRACION,
  pendienteDeArchivar, diasCerrada, DIAS_URGENTE, lineaPendienteArchivar,
}
