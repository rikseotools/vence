'use strict'
// lib/backlog/marcarFicha.cjs — transforma la CABECERA de una ficha al cerrarla/reabrirla. [T-532]
//
// Por qué hace falta: desde que «una ficha = un fichero» (T-532), la sección de una ficha en el
// índice generado (`## Abiertas` / `## Hechas`) la decide SU PROPIA CABECERA (el ✅, ver
// `parseMarkdown.cjs` y `fichasDir.cjs` → `estaCerrada`), no dónde vive el texto. Antes de esto,
// `done`/`reopen` solo actualizaban la BD e imprimían «ahora mueve tu ficha a mano» — instrucción
// que, con un fichero por ficha, ya no dice dónde: no hay dos sitios entre los que mover nada, hay
// UNA cabecera que editar. Este módulo hace esa edición, para que `done`/`reopen` la apliquen
// solos y el índice nazca ya consistente (nunca hace falta el paso manual ni el aviso).
//
// Deliberadamente NO intenta reproducir cada anotación que un humano haya escrito a mano con el
// tiempo («· falta desplegar», «· abierta 30/07»…) — medido: de 336 cabeceras cerradas, la
// mayoría son solo «✅ [HECHA dd/mm] título», y las que llevan algo más lo añadió una persona
// DESPUÉS, con contexto que el comando no tiene. Escribir la forma mínima y correcta es seguro;
// adivinar la forma "bonita" no lo es.

const RE_PREFIJO = /^(###\s*\[T-\d+\]\s*)/
const RE_EMOJI_PRIORIDAD = /^[🔴🟠🟡🟢⬜]\s*/u
const RE_TICK = /^✅\s*/
const RE_CORCHETE = /^\[[^\]]*\]\s*/

/** Separa una cabecera en {prefijo, resto-sin-emoji-ni-corchete-ni-tick, título}. */
function analizarCabecera(primeraLinea) {
  const m = RE_PREFIJO.exec(primeraLinea)
  if (!m) return null
  const prefijo = m[1]
  let resto = primeraLinea.slice(prefijo.length)
  resto = resto.replace(RE_TICK, '')
  resto = resto.replace(RE_EMOJI_PRIORIDAD, '')
  resto = resto.replace(RE_CORCHETE, '')
  return { prefijo, titulo: resto }
}

/**
 * Cierra la cabecera de una ficha: `🔴 [ABIERTO dd/mm] Título` → `✅ [HECHA dd/mm] Título`.
 * @param {string} texto contenido completo del fichero de la ficha
 * @param {string} fecha `dd/mm` (o el formato que se le pase; no se valida aquí)
 * @returns {string} el texto con la primera línea reescrita; el resto, intacto
 */
function cerrarCabecera(texto, fecha) {
  const t = String(texto ?? '')
  const fin = t.indexOf('\n')
  const primeraLinea = fin === -1 ? t : t.slice(0, fin)
  const resto = fin === -1 ? '' : t.slice(fin)
  const partes = analizarCabecera(primeraLinea)
  if (!partes) return t // cabecera irreconocible: no tocar nada, que lo cace el guardarraíl
  const nueva = `${partes.prefijo}✅ [HECHA ${fecha}] ${partes.titulo}`
  return nueva + resto
}

/**
 * Reabre la cabecera de una ficha: `✅ [HECHA dd/mm] Título` → `<emoji> [ABIERTO dd/mm] Título`.
 * @param {string} texto contenido completo del fichero de la ficha
 * @param {string} fecha `dd/mm`
 * @param {string} emoji prioridad a restaurar (🔴🟠🟡🟢⬜) — la decide quien llama, normalmente
 *   la `priority` que ya vive en `backlog_tasks` (no se puede recuperar del propio fichero: el
 *   cierre la borró).
 */
function reabrirCabecera(texto, fecha, emoji) {
  const t = String(texto ?? '')
  const fin = t.indexOf('\n')
  const primeraLinea = fin === -1 ? t : t.slice(0, fin)
  const resto = fin === -1 ? '' : t.slice(fin)
  const partes = analizarCabecera(primeraLinea)
  if (!partes) return t
  const pref = emoji ? `${emoji} ` : ''
  const nueva = `${partes.prefijo}${pref}[ABIERTO ${fecha}] ${partes.titulo}`
  return nueva + resto
}

module.exports = { analizarCabecera, cerrarCabecera, reabrirCabecera }
