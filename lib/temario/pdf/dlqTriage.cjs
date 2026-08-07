// lib/temario/pdf/dlqTriage.cjs — ¿este PDF fallido lo arregla un reintento, o no lo arregla nunca?
// (T-648, 07/08/2026)
//
// ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────────────────────
// El canario de la cola de PDFs dispara con **cualquier** job en `failed`, y lleva días en crítico
// cada 15 minutos. Al mirar qué había dentro, no era una avería: eran **dos cosas distintas
// metidas en el mismo cajón**.
//
//   · **112 `oposicion_desconocida`**, todas del 31/07 al 06/08 — o sea, del defecto que [T-648]
//     ya arregló. **Cero desde el arreglo.** Son cadáveres: reintentarlos ahora funcionaría, pero
//     nadie los va a reintentar y mientras estén ahí el canario denuncia una avería que ya no
//     existe.
//   · **50 `tema_no_encontrado`**, todas de hoy — el fallo LEGÍTIMO previsto: una oposición
//     personalizada cuyo dueño nunca llegó a montar temas. **Ningún reintento lo arregla**: no hay
//     nada que renderizar hasta que el usuario cree el tema.
//
// **Un canario que grita algo que nadie puede resolver es un canario que se aprende a ignorar**, y
// entonces deja de avisar del día en que la cola SÍ se rompa. Por eso la pregunta no es «¿hay
// fallidos?» sino «¿hay fallidos que un reintento arreglaría?».
//
// ── LO QUE ESTE MÓDULO **NO** HACE ───────────────────────────────────────────────────────────
// No esconde nada. Lo irrecuperable **se sigue contando y se sigue publicando** en la metadata del
// canario; lo único que cambia es que no PAGINA. Un fallo que nadie mira es peor que un fallo que
// grita, así que la salida separa los dos números en vez de restarlos.
//
// ⚠️ Y no crece solo: la lista es CERRADA. Un motivo nuevo cuenta como **reintentable** por
// defecto —o sea, sigue paginando— porque el silencio se gana declarándolo, no por omisión. Es la
// misma regla que `benignSignals`: para callar un aviso hay que decir por qué.

'use strict'

/**
 * Motivos por los que un reintento NO puede cambiar nada, con el porqué.
 * Añadir uno exige saber que el trabajo es imposible, no solo que molesta.
 */
const IRRECUPERABLES = {
  tema_no_encontrado:
    'el tema no existe: una oposición personalizada sin temas montados. Hasta que su dueño cree ' +
    'el tema no hay nada que renderizar, y eso no lo arregla la cola (es contenido, ver [T-604]).',
}

/**
 * ¿Un reintento podría cambiar el resultado de este job?
 *
 * @param {string|null} lastError  el `last_error` de la fila
 * @returns {{reintentable: boolean, motivo: string|null}}
 */
function clasificarFallo(lastError) {
  const e = String(lastError || '').trim()
  for (const [clave, porque] of Object.entries(IRRECUPERABLES)) {
    // `includes` y no igualdad: el worker escribe el motivo con contexto detrás
    // (`tema_no_encontrado: personalizada_f228…`), y comparar exacto no casaría ninguno.
    if (e.includes(clave)) return { reintentable: false, motivo: porque }
  }
  return { reintentable: true, motivo: null }
}

/**
 * Reparte los fallidos en los dos cubos que el canario necesita distinguir.
 *
 * @param {Array<{last_error?: string|null}>} fallidos
 * @returns {{reintentables: number, irrecuperables: number, total: number}}
 */
function triarDlq(fallidos) {
  let reintentables = 0
  let irrecuperables = 0
  for (const f of fallidos || []) {
    if (clasificarFallo(f && f.last_error).reintentable) reintentables++
    else irrecuperables++
  }
  return { reintentables, irrecuperables, total: reintentables + irrecuperables }
}

/** El mismo criterio en SQL, para el canario del backend (que no puede importar esto). */
const SQL_IRRECUPERABLE = Object.keys(IRRECUPERABLES)
  .map((k) => `last_error LIKE '%${k}%'`)
  .join(' OR ')

module.exports = { clasificarFallo, triarDlq, IRRECUPERABLES, SQL_IRRECUPERABLE }
