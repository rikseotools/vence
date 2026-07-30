'use strict'
// lib/db/visibilityMap.cjs
// ¿El mapa de visibilidad de una tabla está lo bastante caliente para que sus index-only scans
// lo sean de verdad?
//
// ## Por qué existe (T-275, 29/07/2026)
//
// Cuando el mapa de visibilidad se enfría, Postgres NO deja de usar el índice: sigue diciendo
// «Index Only Scan» en el plan, pero baja al heap fila por fila para comprobar visibilidad. La
// consulta devuelve el resultado correcto; solo que tarda cien veces más.
//
// **Ningún indicador lo veía.** El panel de salud mide 5xx y latencia, y esto no es un error: es
// una respuesta correcta que llega tarde — exactamente el punto ciego de [T-254].
//
// El caso que lo destapó: `test_questions` al **67,5%** de páginas visibles hacía que la consulta
// de `theme-stats` diera **72.695 heap fetches** y tardara **17.809 ms**, de los cuales 17.372 ms
// eran I/O. Tras calentar el mapa: **0 heap fetches y 145 ms** (122×). El opositor veía sus
// estadísticas vacías porque el cliente corta a los 8 s.
//
// ## La trampa que hay que entender antes de tocar umbrales
//
// Esas tablas PARECEN bien configuradas: tienen `autovacuum_vacuum_scale_factor` afinado. Pero ese
// parámetro mira **filas MUERTAS**, y una tabla de INSERTS no genera ninguna (`test_questions`:
// 3,6 M inserts contra 40 k updates), así que **no dispara jamás**. El que aplica es
// `autovacuum_vacuum_insert_scale_factor`, que por defecto es 0.2 → cientos de miles de inserts
// por vacuum. Medido: 4 de 9 tablas afectadas eran insert-only puras (0 updates) y llevaban
// **25 días** sin vacuum.
//
// Aquí solo vive la DECISIÓN, pura y testeable. Quien llama pone la consulta a `pg_class`.


/**
 * Tablas por debajo de este tamaño no se miran. En una tabla pequeña el heap fetch es barato
 * (cabe en caché) y el ruido no compensa: el daño medido aparece cuando hay decenas de miles de
 * páginas que traer de disco.
 */
const VM_MIN_PAGES = 5_000

/**
 * Umbrales de cobertura. Calibrados sobre el caso real: `test_questions` dolía al **67,5%**, y las
 * peores de la tanda estaban al **46-48%**. Por encima del 95% el mapa se considera caliente —no
 * se exige 100% porque siempre hay páginas recién escritas.
 */
const VM_WARN_PCT = 90
const VM_ERROR_PCT = 70

/** Cobertura en %, o `null` si la tabla no tiene páginas (nada que juzgar). */
function pctVisible(t) {
  if (!Number.isFinite(t?.relpages) || t.relpages <= 0) return null
  return Math.round((100 * t.relallvisible) / t.relpages * 10) / 10
}

/**
 * Clasifica UNA tabla. Las pequeñas salen `ok` a propósito: no es que estén bien, es que no duelen,
 * y un detector que las liste enseña a ignorar la lista.
 */
function classifyVisibility(t) {
  const pct = pctVisible(t) ?? 100
  let status = 'ok'
  if (t.relpages >= VM_MIN_PAGES) {
    if (pct < VM_ERROR_PCT) status = 'error'
    else if (pct < VM_WARN_PCT) status = 'warn'
  }
  return {
    ...t,
    pctVisible: pct,
    status,
    paginasFrias: Math.max(0, t.relpages - t.relallvisible),
  }
}

/**
 * Las que hay que mirar, peor primero. Ordena por PÁGINAS FRÍAS y no por porcentaje: una tabla de
 * 8 GB al 80% arrastra mucho más I/O que una de 40 MB al 46%, y el porcentaje solo las hace
 * parecer iguales.
 */
function tablasFrias(tablas) {
  return (tablas ?? [])
    .map(classifyVisibility)
    .filter(v => v.status !== 'ok')
    .sort((a, b) => b.paginasFrias - a.paginasFrias)
}

/**
 * El remedio concreto de una tabla fría, para que el hallazgo no obligue a recordar el porqué.
 * Si le falta el ajuste de inserts, eso es la causa probable y el arreglo es durable; si ya lo
 * tiene, el mapa se enfrió por otra vía y toca mirar el autovacuum de verdad.
 */
function remedioVisibilidad(v) {
  if (!v.tieneAjusteInserts) {
    return `ALTER TABLE public.${v.relname} SET (autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_vacuum_insert_threshold = 1000)`
  }
  // Ya tiene el ajuste y sigue fría: eso NO es «espera un poco», es que **no va a arreglarse sola**.
  // Caso real (`questions`, 30/07): 7.394 filas muertas contra un umbral de 8.083 (scale 0.05 sobre
  // 159.671 vivas) y **0 inserts pendientes** — por debajo de los DOS disparadores a la vez, así que
  // podía quedarse al 78,5% indefinidamente. Decir solo «revisa el autovacuum» obligaba a
  // diagnosticarlo a mano; el hallazgo debe traer la causa.
  const vivas = Number(v.vivas) || 0
  const muertas = Number(v.muertas) || 0
  const ins = Number(v.insPendientes) || 0
  const scale = Number(v.scaleFactorMuertas) || 0.2
  const umbralMuertas = Math.round(100 + scale * vivas)
  if (vivas > 0 && muertas < umbralMuertas && ins === 0) {
    return `NO se arreglará sola: ${muertas} filas muertas contra un umbral de ${umbralMuertas} (scale ${scale}) y 0 inserts pendientes — por debajo de los dos disparadores. Hace falta VACUUM (ANALYZE) manual + bajar autovacuum_vacuum_scale_factor de esta tabla`
  }
  return `tiene el ajuste de inserts pero sigue fría: mirar si el autovacuum llega (workers saturados, cost_delay) — ${muertas} muertas / umbral ~${umbralMuertas}, ${ins} inserts pendientes`
}


/**
 * Tablas grandes SIN el ajuste de autovacuum por inserts — aunque hoy estén calientes.
 *
 * ## Por qué esto y no solo el detector de frías (30/07)
 *
 * El detector de arriba avisa cuando una tabla YA se ha enfriado, y eso llega tarde: el 29/07 se
 * aplicó el ajuste a las 13 que estaban frías **en ese momento** y a la mañana siguiente
 * `observable_events` —la tabla más grande, ~3 GB, y encima aquella contra la que se lanzan todas
 * las consultas de diagnóstico— había caído al 85,9% porque no estaba en aquella lista.
 *
 * Perseguirlas de una en una garantiza que siempre haya alguna esperando a enfriarse. Esto es la
 * otra mitad: marcar la tabla ANTES, por no tener la protección puesta.
 */
function tablasSinAjuste(tablas) {
  return (tablas ?? [])
    .filter(t => t && Number(t.relpages) >= VM_MIN_PAGES && !t.tieneAjusteInserts)
    .map(t => ({ ...classifyVisibility(t), motivo: 'sin_ajuste_inserts' }))
    .sort((a, b) => b.relpages - a.relpages)
}

module.exports = {
  tablasSinAjuste, classifyVisibility, tablasFrias, pctVisible, remedioVisibilidad, VM_MIN_PAGES, VM_WARN_PCT, VM_ERROR_PCT }
