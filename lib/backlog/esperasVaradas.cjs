// lib/backlog/esperasVaradas.cjs — la SEGUNDA mirada a las esperas de deploy. (T-711, 08/08/2026)
//
// ── QUÉ HUECO CUBRE ──────────────────────────────────────────────────────────────────────────
// [T-620] impide pausar contra un sha INALCANZABLE, y hace bien. Pero deja pasar —a propósito— el
// caso `sin_pushear`: pausar con un commit que aún solo está en tu HEAD es un orden legítimo y muy
// común. El agujero está en lo que pasa DESPUÉS: si esa rama nunca se fusiona a `main`, el sha no
// llega jamás a `origin/main`, `deployed` no puede despertarla, y la tarea duerme para siempre.
//
// **Y no sale en ninguna pantalla.** Medido el 08/08: T-408, T-564, T-600 y T-613 llevaban entre
// uno y dos días así. No están entregadas (no aparecen en la cola de revisión), no tienen
// veredicto (no aparecen en la de merge), y `list` las pinta «esperando deploy» — exactamente
// igual que una espera sana. Tres de ellas se pausaron el 07/08 y nadie las echó de menos.
//
// Es el mismo modo de fallo de [T-700] una capa más arriba: allí una cola sin salida, aquí una
// ESPERA sin salida. Un guardarraíl en el punto de escritura no basta cuando la condición puede
// volverse imposible más tarde, por algo que hace otra persona (o que nadie hace).
//
// ── POR QUÉ NO REUSA `clasificarShaEspera` TAL CUAL ─────────────────────────────────────────
// Sí lo reusa: este módulo NO decide qué es alcanzable — eso lo dice `clasificarShaEspera`, y el
// criterio sigue viviendo allí. Lo único propio de aquí es *cuándo* preguntarlo (después, sobre
// lo ya guardado) y cómo contarlo. Dos criterios sobre lo mismo acabarían divergiendo.

'use strict'

const { clasificarShaEspera } = require('./esperaDeploy.cjs')

/**
 * De las tareas que esperan un deploy, ¿cuáles esperan algo que no puede llegar?
 *
 * No toca git: recibe los hechos ya medidos, igual que su hermano, para poder probarse sin
 * repositorio.
 *
 * @param {Array<{id:string,title?:string,wake_on_deploy_sha:string}>} tareas
 * @param {(sha:string)=>{existe?:boolean,enOriginMain?:boolean,enHead?:boolean}} medir
 * @param {(sha:string)=>string[]} [ramas]  ramas remotas que contienen el sha, para poder decir
 *   DÓNDE está en vez de «no lo alcanza nadie» — que es falso y manda a buscar donde no hay nada.
 * @returns {Array<{id,title,wake_on_deploy_sha,estado,donde}>} solo las varadas
 */
function esperasVaradas(tareas, medir, ramas) {
  const fuera = []
  for (const t of tareas || []) {
    if (!t || !t.wake_on_deploy_sha) continue
    let hechos
    try { hechos = medir(t.wake_on_deploy_sha) } catch { hechos = {} }
    const v = clasificarShaEspera(hechos || {})

    // `desplegable` es la espera sana. `desconocido` NO se acusa: si git no pudo contestar, lo
    // que no se sabe no se denuncia — el resto del andamiaje falla abierto por lo mismo.
    if (v.estado === 'desplegable' || v.estado === 'desconocido') continue

    fuera.push({
      id: t.id,
      title: t.title || '',
      wake_on_deploy_sha: t.wake_on_deploy_sha,
      estado: v.estado,
      donde: ubicacion(t.wake_on_deploy_sha, v.estado, ramas),
    })
  }
  return fuera
}

/**
 * Dónde está ese commit, dicho con precisión.
 *
 * `clasificarShaEspera` llama `inalcanzable` a todo lo que no esté en `origin/main` ni en tu HEAD,
 * y para PAUSAR eso basta. Pero para ARREGLARLO no: un commit que vive en `origin/flota/T-600-…`
 * no es un sha perdido, es **una rama sin fusionar**, y el arreglo es mergearla. Decir «no lo
 * alcanza nadie» manda a buscar donde no hay nada — pasó al estrenar esto, con cuatro tareas cuyos
 * commits existían perfectamente.
 */
function ubicacion(sha, estado, ramas) {
  let remotas = []
  if (typeof ramas === 'function') {
    try { remotas = (ramas(sha) || []).filter((r) => r && r.startsWith('origin/')) } catch { remotas = [] }
  }
  if (remotas.length) {
    const r = remotas.filter((x) => x !== 'origin/main')[0] || remotas[0]
    return `vive en \`${r}\`, SIN fusionar a main — el arreglo es mergear esa rama`
  }
  if (estado === 'sin_pushear') return 'commiteado en tu HEAD y sin publicar: empújalo y fusiónalo'
  return 'no está en `origin/main` ni en ninguna rama publicada: repunta la espera al sha bueno'
}

module.exports = { esperasVaradas }
