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

/**
 * Qué fracción del disparador de inserts hay que llevar recorrida para decir que el autovacuum
 * **está a mitad de ciclo** (o sea, que va a entrar), en vez de que no llega.
 *
 * ⚠️ Esto sustituye a un umbral de RELOJ («autovacuum hace < 60 min»), que se probó primero y era
 * frágil de una forma que solo se ve con los datos: el outbox se autovacuuma aproximadamente cada
 * hora, así que el mensaje del hallazgo cambiaba según el minuto en que corriera el barrido. La
 * aritmética del propio Postgres no tiene ese problema: `insert_threshold + insert_scale × vivas`
 * es exactamente cuándo va a disparar, y comparar los inserts pendientes con eso no depende del
 * reloj ni de cuándo se mire.
 */
const VM_CICLO_INSERTS_FRACCION = 0.5

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
  // ── RÉGIMEN DE ROTACIÓN ALTA: el autovacuum ACABA de pasar y la tabla sigue fría (30/07) ──
  //
  // Caso medido: `test_questions_outbox` al **84,2%** con **208 autovacuums** y el último **hace 6
  // minutos**, 2.839 filas muertas contra un umbral de 6.940 y el ajuste de inserts puesto. O sea:
  // la maquinaria funciona perfectamente. Sigue «fría» porque es una **cola**: se llena y se vacía
  // sin parar (508 MB para 34.202 filas vivas), así que siempre hay páginas recién escritas que no
  // pueden estar marcadas como todo-visibles. **Eso es su régimen, no abandono** — y decirle a
  // quien triaje «revisa por qué el autovacuum no llega» cuando llegó hace seis minutos es
  // mandarlo a buscar un problema que no existe.
  //
  // ⚠️ DOS HIPÓTESIS REFUTADAS, no las repitas:
  //
  //   1. **Exentar por ratio de borrado** (una cola borra lo que recibe). Medido sobre las 23 tablas
  //      grandes: **`test_questions` —la tabla del incidente— tiene ratio 0,709, MÁS ALTO que el
  //      0,680 del outbox**. Habría silenciado justo el caso a cazar.
  //   2. **Exentar por «autovacuum hace menos de una hora»**. El outbox se autovacuuma ~cada hora,
  //      así que el veredicto cambiaba según el minuto en que corriese el barrido.
  //
  // Lo que sí distingue: **cuánto le falta al propio disparador de Postgres**. `insert_threshold +
  // insert_scale × vivas` es el punto exacto en el que el autovacuum entra, y los inserts pendientes
  // dicen cuánto se lleva recorrido. En el outbox: 1.333 pendientes de 1.342 — el 99% del camino, o
  // sea que el siguiente vacuum es inminente. En el incidente: **0 pendientes y muertas por debajo
  // del umbral**, es decir ninguno de los dos disparadores se iba a alcanzar nunca.
  const vivas = Number(v.vivas) || 0
  const muertas = Number(v.muertas) || 0
  const ins = Number(v.insPendientes) || 0
  const scale = Number(v.scaleFactorMuertas) || 0.2
  const umbralMuertas = Math.round(100 + scale * vivas)
  // Defaults de Postgres si la tabla no los declara (los declara: el ajuste es 1000 / 0.01).
  const insThreshold = Number.isFinite(Number(v.insertThreshold)) ? Number(v.insertThreshold) : 1000
  const insScale = Number.isFinite(Number(v.insertScaleFactor)) ? Number(v.insertScaleFactor) : 0.2
  const umbralInserts = Math.round(insThreshold + insScale * vivas)
  if (umbralInserts > 0 && ins >= VM_CICLO_INSERTS_FRACCION * umbralInserts && muertas < umbralMuertas) {
    return `régimen de rotación alta, NO abandono: el autovacuum está A MITAD DE CICLO (${ins} inserts pendientes de los ${umbralInserts} que lo disparan) y las muertas (${muertas}) están por debajo de su umbral (${umbralMuertas}) — la maquinaria funciona y la tabla se vuelve a enfriar porque se llena y se vacía sin parar (típico de una cola). Solo importa si alguna consulta suya depende de index-only scans; si no, no hay nada que arreglar`
  }
  // Ya tiene el ajuste y sigue fría: eso NO es «espera un poco», es que **no va a arreglarse sola**.
  // Caso real (`questions`, 30/07): 7.394 filas muertas contra un umbral de 8.083 (scale 0.05 sobre
  // 159.671 vivas) y **0 inserts pendientes** — por debajo de los DOS disparadores a la vez, así que
  // podía quedarse al 78,5% indefinidamente. Decir solo «revisa el autovacuum» obligaba a
  // diagnosticarlo a mano; el hallazgo debe traer la causa.
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
  tablasSinAjuste, classifyVisibility, tablasFrias, pctVisible, remedioVisibilidad,
  VM_MIN_PAGES, VM_WARN_PCT, VM_ERROR_PCT, VM_CICLO_INSERTS_FRACCION }
