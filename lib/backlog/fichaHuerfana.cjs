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
 * ## Por qué NO bastaba mirar el historial LOCAL (T-427, 31/07/2026)
 *
 * Lo de arriba se construyó el 29/07 y **estaba en `main` dos días antes del incidente que tenía
 * que cazar** — y no lo cazó: el commit `a9797ae3a` borró cinco fichas ajenas de `main` y el `sync`
 * las anunció como *«ℹ️ sin ficha aquí todavía (otra sesión sin pushear): T-414, T-416, T-422…»*.
 * O sea, el aviso existía, corrió, y dio la respuesta TRANQUILIZADORA.
 *
 * El motivo es estructural y no se ve leyendo el código: `git log -S` solo recorre lo que alcanza
 * **el HEAD local**, y una sesión trabaja en un worktree nacido de `origin/main` en un instante T0.
 * Cualquier ficha que otra sesión pushee DESPUÉS de T0 es invisible desde ahí. Y ésas son
 * exactamente las que este detector existe para proteger: **las ajenas**. Comprobado sobre el
 * incidente real — desde `e0adb142a^` (el commit anterior a la ficha de T-418) el pickaxe devuelve
 * vacío, así que la ficha borrada de `main` se clasificaba como sana.
 *
 * La prueba de que una ficha existió no está en mi rama: está en **`origin/main`**, que es lo único
 * que comparten las 2-10 sesiones. Con eso aparece además un tercer caso que antes se disfrazaba de
 * `sin_pushear` y no se parece en nada: la ficha **está en `origin/main` ahora mismo** y lo que pasa
 * es que **mi rama va por detrás**. Ahí no hay nada roto ni nada que recuperar — hay que actualizar.
 *
 * Y un cuarto, que es el que impide que esto vuelva a mentir: si `origin/main` **no se puede
 * consultar**, no se contesta `sin_pushear`. Se dice `no_verificable`. Un detector que ante la duda
 * responde «todo bien» es peor que no tenerlo, porque además calla.
 *
 * Aquí vive solo la DECISIÓN, pura. Quien la llama pone los hechos de git y quien imprime, el
 * formato.
 */

/**
 * Motivos posibles, de más a menos accionable.
 *  · `borrada`        — REGRESIÓN: la ficha existió y ya no está. Hay que recuperarla.
 *  · `no_verificable` — no se pudo mirar `origin/main`: no se puede afirmar que esté sana.
 *  · `desactualizada` — está en `origin/main`; mi rama va por detrás. Actualizar.
 *  · `sin_pushear`    — nunca existió en `origin/main`: otra sesión la lleva en su worktree.
 */
const MOTIVOS = /** @type {const} */ (['borrada', 'no_verificable', 'desactualizada', 'sin_pushear'])

/**
 * @typedef {Object} HechosDeOrigin
 * @property {boolean} consultable  ¿se pudo leer `origin/main`? Si no, no se opina.
 * @property {boolean} estaAhora    ¿aparece la ficha en el markdown de `origin/main` HOY?
 * @property {boolean} estuvo       ¿aparece en algún commit de `origin/main` (`git log -S`)?
 */

/**
 * @param {{id: string, estuvoEnElMarkdown?: boolean, origen?: HechosDeOrigin}} huerfana
 *   `estuvoEnElMarkdown` = historial de MI rama. Sirve para cazar el caso local (me llevé la ficha
 *   por delante en un commit que aún no he pusheado), pero NO puede descartar nada: ver arriba.
 * @returns {{id: string, motivo: 'borrada'|'no_verificable'|'desactualizada'|'sin_pushear', esRegresion: boolean, alcance: 'origin'|'local'|'ninguno'}}
 */
function clasificarHuerfana(huerfana) {
  if (!huerfana || typeof huerfana.id !== 'string' || !huerfana.id) {
    throw new TypeError('clasificarHuerfana: hace falta un id')
  }
  const { id } = huerfana
  const enLocal = huerfana.estuvoEnElMarkdown === true
  const origen = huerfana.origen

  // El historial es la única prueba de que la ficha EXISTIÓ. No se infiere de la antigüedad de la
  // tarea: una tarea puede llevar días viva en la tabla y tener su ficha sin pushear todavía, y
  // otra puede haberse creado hace diez minutos y perder la ficha en el commit siguiente.
  if (origen && origen.consultable) {
    if (origen.estaAhora) return v(id, 'desactualizada', false, 'origin')
    if (origen.estuvo) return v(id, 'borrada', true, 'origin')
    // No está ni estuvo en origin. Todavía puede ser una regresión MÍA, sin pushear.
    return enLocal ? v(id, 'borrada', true, 'local') : v(id, 'sin_pushear', false, 'origin')
  }

  // Sin `origin/main` delante, lo único afirmable es lo que se ve en mi propia rama. Una ficha que
  // estuvo aquí y ya no está sigue siendo una regresión; lo demás es un «no lo sé» y se dice.
  if (enLocal) return v(id, 'borrada', true, 'local')
  return v(id, 'no_verificable', false, 'ninguno')
}

function v(id, motivo, esRegresion, alcance) {
  return { id, motivo, esRegresion, alcance }
}

/**
 * Clasifica el lote y lo separa por lo que hay que HACER con cada grupo: `borradas` se arregla hoy,
 * `noVerificables` se mira a mano, `desactualizadas` se resuelve actualizando la rama y `sinPushear`
 * es el día normal y va en una línea para no tapar a las otras.
 * @param {Array<{id: string, estuvoEnElMarkdown?: boolean, origen?: HechosDeOrigin}>} huerfanas
 */
function clasificarHuerfanas(huerfanas) {
  const todas = (huerfanas || []).map(clasificarHuerfana)
  const de = (m) => todas.filter(h => h.motivo === m).map(h => h.id)
  return {
    todas,
    borradas: de('borrada'),
    noVerificables: de('no_verificable'),
    desactualizadas: de('desactualizada'),
    sinPushear: de('sin_pushear'),
  }
}

module.exports = { clasificarHuerfana, clasificarHuerfanas, MOTIVOS }
