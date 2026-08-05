'use strict'
/**
 * Distingue «este kind del barrido de salud se evaluó y dio 0» de «nadie lo ha mirado» (T-529).
 *
 * ## El problema
 *
 * `content_health_findings` guarda lo que se ENCUENTRA. La ausencia de filas de un kind significa
 * a la vez «vigilado y limpio» y «nadie lo miró», y hoy se leen igual. Salió tropezando TRES veces
 * el mismo día (04/08/2026): [T-406] y la mitad psicotécnica de [T-384] no se podían cerrar porque
 * un 0 no se podía afirmar, y [T-501] estuvo a punto de dar una falsa alarma leyendo `cron_runs`
 * (tabla muerta desde el 24/05) en vez de la señal de vida real.
 *
 * ## El arreglo
 *
 * `content-health-sweep.service.ts` (el `@Cron` real) y su gemelo CLI registran, cada pasada, un
 * resumen `kind → nº de sujetos mirados` (`kindsEvaluados`) en el `cron_run` que ya emiten a
 * `observable_events`. Este módulo NO toca esa escritura — solo LEE el historial de esos eventos
 * (ya parseado a JS) y responde: ¿qué kinds llevan sin aparecer más de lo esperado?
 *
 * ## Por qué NO hace falta una lista estática de "todos los kinds que deberían existir"
 *
 * Mantener una TERCERA copia del universo de kinds (además del script CLI y el `@Cron`, ya
 * "MANTENER EN SYNC" entre sí) es justo el tipo de carga que este proyecto evita a propósito. En
 * su lugar, el criterio es AUTORREFERENCIAL: un kind que apareció en `kindsEvaluados` de alguna
 * pasada reciente y luego DEJA de aparecer en pasadas posteriores (mientras esas pasadas SÍ
 * completaron, es decir `status !== 'partial'`) es la señal — no hace falta saber de antemano
 * cuántos kinds "debería" haber. Un kind gateado por un feature flag apagado (p.ej.
 * `shuffle_encendido_sin_efecto`) sale del radar solo, porque nunca aparece en el historial
 * mientras el flag está OFF — no hay falso positivo que excluir a mano.
 */

/**
 * @typedef {{ts: string|number|Date, status: 'success'|'partial'|'failure', kindsEvaluados: Record<string, number>|null|undefined}} PasadaSweep
 */

/** Milisegundos desde epoch de un timestamp que puede venir como string/Date/number. */
function aMs(ts) {
  if (ts instanceof Date) return ts.getTime()
  if (typeof ts === 'number') return ts
  const d = new Date(ts)
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN
}

/**
 * Une los `kindsEvaluados` de una lista de pasadas (más reciente primero o en cualquier orden) y
 * devuelve, por kind, la última vez que apareció (ms epoch) y con cuántos sujetos.
 * @param {PasadaSweep[]} pasadas
 * @returns {Map<string, {ultimaVezMs: number, sujetos: number}>}
 */
function ultimaAparicionPorKind(pasadas) {
  const out = new Map()
  for (const p of pasadas || []) {
    const ms = aMs(p && p.ts)
    if (!Number.isFinite(ms)) continue
    const kinds = (p && p.kindsEvaluados) || {}
    for (const [kind, n] of Object.entries(kinds)) {
      const prev = out.get(kind)
      if (!prev || ms > prev.ultimaVezMs) out.set(kind, { ultimaVezMs: ms, sujetos: n })
    }
  }
  return out
}

/**
 * ¿Qué kinds llevan sin evaluarse más de `umbralDias`? Un kind entra en la lista si:
 *   - apareció en AL MENOS una pasada dentro de la ventana `ventanaDias` (así se sabe que el
 *     detector existe y en algún momento corrió — evita que un kind recién nacido, aún sin su
 *     primer deploy, se lea como "regresión"), Y
 *   - su última aparición tiene más de `umbralDias` de antigüedad respecto a `ahoraMs`.
 *
 * @param {PasadaSweep[]} pasadas Historial de pasadas del barrido (cron_run de content-health-sweep).
 * @param {number} ahoraMs Reloj de referencia (ms epoch) — inyectado, no `Date.now()`, para que el
 *   cálculo sea determinista y testeable.
 * @param {{umbralDias?: number, ventanaDias?: number}} [opts]
 * @returns {Array<{kind: string, diasSinEvaluar: number, ultimaVez: string, sujetos: number}>}
 *   Ordenado de más a menos días sin evaluar.
 */
function kindsSinEvaluar(pasadas, ahoraMs, opts) {
  const umbralDias = (opts && opts.umbralDias) ?? 2
  const ventanaDias = (opts && opts.ventanaDias) ?? 14
  const ventanaMs = ventanaDias * 24 * 60 * 60 * 1000
  const enVentana = (pasadas || []).filter((p) => {
    const ms = aMs(p && p.ts)
    return Number.isFinite(ms) && ahoraMs - ms <= ventanaMs
  })
  const ultima = ultimaAparicionPorKind(enVentana)
  const out = []
  for (const [kind, info] of ultima) {
    const diasSinEvaluar = (ahoraMs - info.ultimaVezMs) / (24 * 60 * 60 * 1000)
    if (diasSinEvaluar > umbralDias) {
      out.push({
        kind,
        diasSinEvaluar: Math.round(diasSinEvaluar * 10) / 10,
        ultimaVez: new Date(info.ultimaVezMs).toISOString(),
        sujetos: info.sujetos,
      })
    }
  }
  out.sort((a, b) => b.diasSinEvaluar - a.diasSinEvaluar)
  return out
}

/**
 * Estado de un kind concreto — lo que responde a "¿se evaluó psicotecnico_integridad en la última
 * pasada, y con cuántos sujetos?" (la pregunta exacta que [T-406]/[T-384] no podían contestar).
 * @param {PasadaSweep[]} pasadas
 * @param {string} kind
 * @returns {{evaluado: boolean, ultimaVez: string|null, sujetos: number|null}}
 */
function estadoDeKind(pasadas, kind) {
  const ultima = ultimaAparicionPorKind(pasadas)
  const info = ultima.get(kind)
  if (!info) return { evaluado: false, ultimaVez: null, sujetos: null }
  return { evaluado: true, ultimaVez: new Date(info.ultimaVezMs).toISOString(), sujetos: info.sujetos }
}

module.exports = { ultimaAparicionPorKind, kindsSinEvaluar, estadoDeKind }
