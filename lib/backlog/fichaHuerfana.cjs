'use strict'
/**
 * Una tarea VIVA en `backlog_tasks` sin ficha en el markdown, ¿es una regresión o trabajo en vuelo?
 *
 * ## Por qué existe (29/07/2026)
 *
 * `sync` ya avisaba de «VIVA en BD pero SIN ficha en el markdown»… y ese aviso valía poco, por dos
 * motivos independientes:
 *
 *  1. **Se imprimía al final**, después de dos `process.exit(2)`. El 29/07 el sync abortaba por una
 *     colisión de id ajena (T-219) y nunca llegaba a publicarlo. Mientras tanto un commit de tests
 *     (`4127f3e17`) había subido una copia RANCIA del markdown y **borrado las fichas de T-251 y
 *     T-254 de `main`**: las tareas seguían vivas en la tabla, `list` las ofrecía por su título, y
 *     detrás no había nada que leer. Eso se arregla moviendo la comprobación al principio.
 *
 *  2. **No distinguía los dos casos**, que no se parecen en nada:
 *     - `borrada` — el id SÍ estuvo en el markdown y ya no está → **regresión**, alguien se llevó
 *       la ficha por delante. Hay que recuperarla del historial.
 *     - `sin_pushear` — el id NUNCA estuvo en esta rama → otra sesión reservó el id y su ficha aún
 *       viaja en su worktree. Con 2-10 sesiones en paralelo esto es **lo normal**, no un fallo.
 *
 * Sin la distinción, el aviso se enciende a diario por trabajo ajeno perfectamente sano y se acaba
 * ignorando — el mismo desenlace que ya tuvo el aviso de huérfanas cuando incluía a las CERRADAS
 * (T-033/T-039/T-046). Un guardarraíl que grita cada día no es un guardarraíl.
 *
 * Aquí vive solo la DECISIÓN, pura. Quien la llama pone el dato de si el id aparece en el historial
 * del fichero (`git log -S'### [T-NNN]' -- <markdown>`) y quien imprime pone el formato.
 */

/** Motivos posibles. `borrada` es accionable YA; `sin_pushear` es informativo. */
const MOTIVOS = /** @type {const} */ (['borrada', 'sin_pushear'])

/**
 * @param {{id: string, estuvoEnElMarkdown: boolean}} huerfana
 * @returns {{id: string, motivo: 'borrada'|'sin_pushear', esRegresion: boolean}}
 */
function clasificarHuerfana(huerfana) {
  if (!huerfana || typeof huerfana.id !== 'string' || !huerfana.id) {
    throw new TypeError('clasificarHuerfana: hace falta un id')
  }
  // El historial es la única prueba de que la ficha EXISTIÓ. No se infiere de la antigüedad de la
  // tarea: una tarea puede llevar días viva en la tabla y tener su ficha sin pushear todavía, y
  // otra puede haberse creado hace diez minutos y perder la ficha en el commit siguiente.
  const motivo = huerfana.estuvoEnElMarkdown ? 'borrada' : 'sin_pushear'
  return { id: huerfana.id, motivo, esRegresion: motivo === 'borrada' }
}

/**
 * Clasifica el lote y lo separa. `borradas` es lo que hay que arreglar hoy; `sinPushear` se informa
 * en una sola línea para que no tape a las otras.
 * @param {Array<{id: string, estuvoEnElMarkdown: boolean}>} huerfanas
 */
function clasificarHuerfanas(huerfanas) {
  const todas = (huerfanas || []).map(clasificarHuerfana)
  return {
    todas,
    borradas: todas.filter(h => h.esRegresion).map(h => h.id),
    sinPushear: todas.filter(h => !h.esRegresion).map(h => h.id),
  }
}

module.exports = { clasificarHuerfana, clasificarHuerfanas, MOTIVOS }
