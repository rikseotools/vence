// lib/flota/salud.cjs — la salud de la FLOTA, para el panel de salud del sistema. (T-486)
//
// ── POR QUÉ ESTO EXISTE ──────────────────────────────────────────────────────────────────────
// Las señales de la flota ya llegaban al panel… **por el catch-all**, que es la red de seguridad y
// no una vista: sirve para que nada capturado quede oculto, no para responder «¿está la flota
// bien?». Para eso había que abrir una terminal y correr `npm run flota`, o sea que la salud de los
// trabajadores era la única que no se podía mirar donde se mira todo lo demás.
//
// ── LO QUE PUEDE SABER UN PANEL, Y LO QUE NO ────────────────────────────────────────────────
// El panel es una página web: **no puede entrar en las máquinas**. Así que aquí no hay «¿está
// ejecutando?» —eso lo sabe `npm run flota` mirando el tmux— sino lo que consta en la base:
// quién late, qué tiene cogido, qué entregó, qué dejó para aprobar y cuántos turnos murieron.
//
// Es menos, y es a propósito: un panel que fingiera saber si un proceso vive estaría inventando.
//
// Sin BD ni red: recibe filas y decide.

/** Sin señal en este rato, una sesión no cuenta como viva. Mismo criterio que el panel de la flota. */
const VIVO_MIN = 15

/** A partir de aquí, la cola de revisión ya no es «unas cuantas»: se acumula más rápido de lo que se mira. */
const COLA_AMBAR = 8

/** Tantos turnos muertos en pocas horas no es azar: algo los está matando en serie. */
const TURNOS_MUERTOS_ROJO = 5

/**
 * @param sesiones   filas de `worktree_sessions` con rol='trabajador' ({ slug, last_signal_at })
 * @param esperados  cuántos trabajadores declara el registro de máquinas
 * @param entregas   [{ review_requested_at }] las que esperan revisión
 * @param borradores cuántos borradores abiertos hay
 * @param turnosMuertos  eventos `flota_turno` con fase='muerto' en las últimas horas
 *
 * @returns {estado, vivos, esperados, entregas, borradores, turnosMuertos, esperaMaxH, detalle}
 */
function saludFlota({
  sesiones = [], esperados = 0, entregas = [], borradores = 0, turnosMuertos = 0, ahora = new Date(),
} = {}) {
  const t = new Date(ahora).getTime()
  const vivos = (sesiones || []).filter(
    (s) => s && s.last_signal_at && (t - new Date(s.last_signal_at).getTime()) / 60000 <= VIVO_MIN,
  ).length

  const esperas = (entregas || [])
    .filter((e) => e && e.review_requested_at)
    .map((e) => (t - new Date(e.review_requested_at).getTime()) / 3_600_000)
  const esperaMaxH = esperas.length ? Math.round(Math.max(...esperas) * 10) / 10 : null

  const base = { vivos, esperados, entregas: (entregas || []).length, borradores, turnosMuertos, esperaMaxH }

  // ── EL VEREDICTO, en orden de gravedad ──────────────────────────────────────────────────
  // Primero lo que significa que la flota NO ESTÁ TRABAJANDO, que es peor que cualquier cola:
  // una flota parada no se nota — sigue apareciendo en el registro y nadie recibe una queja.
  if (esperados > 0 && vivos === 0) {
    return { ...base, estado: 'rojo', detalle: `los ${esperados} trabajadores llevan más de ${VIVO_MIN} min sin dar señal: la flota está parada` }
  }
  if (turnosMuertos >= TURNOS_MUERTOS_ROJO) {
    return { ...base, estado: 'rojo', detalle: `${turnosMuertos} turnos muertos con la tarea cogida: algo los está matando en serie (cuota, un guardarraíl, una tarea fuera de su alcance)` }
  }
  // Y después lo que cuesta TIEMPO DE MANUEL, que es el criterio de fracaso declarado del piloto.
  if (base.entregas >= COLA_AMBAR) {
    return { ...base, estado: 'ambar', detalle: `${base.entregas} entregas esperando revisión${esperaMaxH ? ` (la más vieja, ${esperaMaxH} h)` : ''}: se acumulan más rápido de lo que se revisan` }
  }
  if (borradores > 0) {
    return { ...base, estado: 'ambar', detalle: `${borradores} borrador(es) esperando tu OK — nada de eso se ha enviado` }
  }
  if (esperados > 0 && vivos < esperados) {
    return { ...base, estado: 'ambar', detalle: `${esperados - vivos} de ${esperados} trabajadores sin señal` }
  }
  return {
    ...base,
    estado: 'verde',
    detalle: esperados ? `${vivos}/${esperados} trabajadores dando señal` : 'no hay flota declarada',
  }
}

module.exports = { VIVO_MIN, COLA_AMBAR, TURNOS_MUERTOS_ROJO, saludFlota }
