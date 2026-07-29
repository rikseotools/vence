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
  return v.tieneAjusteInserts
    ? `ya tiene el ajuste de inserts: revisar por qué el autovacuum no llega (¿workers saturados? ¿cost_delay?)`
    : `ALTER TABLE public.${v.relname} SET (autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_vacuum_insert_threshold = 1000)`
}

module.exports = { classifyVisibility, tablasFrias, pctVisible, remedioVisibilidad, VM_MIN_PAGES, VM_WARN_PCT, VM_ERROR_PCT }
