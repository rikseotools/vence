// lib/cron/registroVivo.cjs — ¿quién corre, y quién dice que corre? (T-442)
//
// ── LO QUE PASÓ ──────────────────────────────────────────────────────────────────────────────
// La tabla `cron_runs` lleva **muerta desde el 24/05/2026**: 8.726 filas y ninguna después. Su
// único escritor (`lib/cron/runWithLogging.ts`) no lo llama nadie — los crons se mudaron a los
// `@Cron` del backend, que emiten a `observable_events` con `event_type='cron_run'`. El registro
// no desapareció: **cambió de sitio, y los lectores se quedaron mirando el sitio viejo**.
//
// Dos meses así, y el modo de fallo es el peor de todos: `/api/admin/health` seguía consultando
// la tabla, no encontraba nada, y pintaba **cero crons y cero incidencias** — que se lee igual
// que «todo bien». No falla: finge funcionar. Se descubrió por casualidad, intentando verificar
// otra cosa ([T-162]).
//
// ── LA PREGUNTA QUE NADIE HACÍA ──────────────────────────────────────────────────────────────
// Vigilábamos «¿este cron va retrasado?» y ninguno «¿sigue habiendo ALGUIEN escribiendo aquí?».
// Un registro vacío no significa que todo esté tranquilo: significa que **no se sabe nada**, y
// esas dos cosas no se pueden pintar del mismo color. Por eso `registroMudo` es una comprobación
// aparte y de primera clase, no un caso más.

/** Sin señal en este plazo, un cron que debería latir a diario se da por callado. */
const HORAS_CALLADO = 26

/** Si el REGISTRO ENTERO lleva esto sin una sola fila, no es calma: es que se ha roto. */
const HORAS_REGISTRO_MUDO = 6

/** `status` que los crons emiten al acabar bien. Varía por cron y los tres son legítimos. */
const OK = ['success', 'completed', 'heartbeat']

/**
 * ¿Está vivo este cron?
 *
 * @param nombre        el `endpoint` del evento (es el que traen TODOS; `metadata.cron` falta en algunos)
 * @param ultimaSenal   Date de su último `cron_run`, o `null` si nunca emitió
 * @param status        `metadata.status` de esa última señal
 * @param severity      severidad de esa señal
 * @param horasCallado  umbral, por si un cron tiene cadencia distinta
 *
 * Veredictos: `fallando` (emitió, y mal) · `callado` (no emite desde hace demasiado) ·
 * `nunca` (no ha emitido jamás: o es nuevo, o no está instrumentado) · `vivo`.
 */
function clasificarCron({ nombre, ultimaSenal = null, status = null, severity = null, ahora = new Date(), horasCallado = HORAS_CALLADO } = {}) {
  if (!ultimaSenal) {
    return { nombre, veredicto: 'nunca', gravedad: 'warn', motivo: 'no ha emitido ningún `cron_run`: o es nuevo, o no está instrumentado' }
  }
  const horas = (new Date(ahora).getTime() - new Date(ultimaSenal).getTime()) / 3_600_000
  if (severity === 'error' || (status && !OK.includes(status))) {
    return { nombre, veredicto: 'fallando', gravedad: 'error', horas, motivo: `su última señal dice \`${status || severity}\`` }
  }
  if (horas > horasCallado) {
    return { nombre, veredicto: 'callado', gravedad: 'warn', horas, motivo: `sin señal desde hace ${Math.round(horas)} h` }
  }
  return { nombre, veredicto: 'vivo', gravedad: 'info', horas, motivo: `última señal hace ${Math.round(horas * 60)} min` }
}

/**
 * **La comprobación que faltaba**: ¿sigue escribiendo ALGUIEN en el registro?
 *
 * Va aparte de la salud de cada cron a propósito. Si el registro se rompe, todos los crons salen
 * «callados» a la vez y el informe parece una catástrofe cuando el problema es el termómetro —
 * o, peor, el lector no encuentra filas, no dice nada, y todo se pinta verde. Que fue lo que
 * pasó durante dos meses.
 *
 * @param ultimaFila  Date del último evento del registro, sea de quien sea. `null` = ni una.
 */
function registroMudo(ultimaFila, ahora = new Date(), horas = HORAS_REGISTRO_MUDO) {
  if (!ultimaFila) {
    return { mudo: true, gravedad: 'error', motivo: 'el registro no tiene NI UNA fila: no se sabe nada de ningún cron' }
  }
  const h = (new Date(ahora).getTime() - new Date(ultimaFila).getTime()) / 3_600_000
  if (h > horas) {
    return { mudo: true, gravedad: 'error', horas: h, motivo: `nadie escribe en el registro desde hace ${Math.round(h)} h — el termómetro está roto, no los crons` }
  }
  return { mudo: false, gravedad: 'info', horas: h, motivo: `el registro recibe señales (última hace ${Math.round(h * 60)} min)` }
}

/** Reparto de una barrida, con lo accionable separado del ruido. */
function resumenRegistro(clasificados) {
  const l = clasificados || []
  const fallando = l.filter((c) => c.veredicto === 'fallando')
  const callados = l.filter((c) => c.veredicto === 'callado')
  const nunca = l.filter((c) => c.veredicto === 'nunca')
  return {
    total: l.length,
    vivos: l.filter((c) => c.veredicto === 'vivo').length,
    fallando,
    callados,
    nunca,
    hallazgo: fallando.length > 0 || callados.length > 0,
  }
}

module.exports = {
  clasificarCron, registroMudo, resumenRegistro,
  HORAS_CALLADO, HORAS_REGISTRO_MUDO, OK,
}
