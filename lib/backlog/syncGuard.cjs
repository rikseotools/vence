'use strict'
/**
 * ¿El título que la tabla tiene para un id y el que trae el markdown son de la MISMA tarea?
 *
 * ## Por qué existe (28/07/2026)
 *
 * `backlog.cjs sync` ya paraba ante ids duplicados… **dentro del markdown**. Pero el choque real
 * entre sesiones no se ve ahí: la otra sesión reservó T-225 en la BD a las 09:17 y su ficha aún no
 * estaba pusheada, así que en MI copia del markdown el id aparecía UNA sola vez —el mío— y el
 * detector no tenía nada que comparar. El `sync` lo reconcilió como un `↻` de aspecto inofensivo y
 * le pisó el título a la tarea ajena. Es literalmente el fallo que el comentario de ese detector
 * dice evitar, con la mitad que no cubría.
 *
 * La comparación honesta es contra la BD, que es la fuente de verdad de los ids (igual que para el
 * claim). Aquí solo vive la DECISIÓN, pura y testeable; el `sync` pone la BD y el aviso.
 *
 * ## Por qué por parecido y no por igualdad
 *
 * Retitular una ficha es legítimo y pasa a menudo (`reserve` deja un título provisional que el
 * primer `sync` sustituye por el real, y a veces se afina la redacción). Exigir igualdad exacta
 * convertiría el guardarraíl en ruido, y un guardarraíl que grita por todo se acaba saltando. Se
 * compara el vocabulario: dos redacciones de la misma tarea comparten casi todas las palabras con
 * carga; dos tareas distintas no comparten casi ninguna.
 */

const PLACEHOLDER = /^RESERVADA\b/i

// Palabras sin carga: si contaran, dos títulos largos cualesquiera parecerían parientes.
const VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'un', 'una', 'unos', 'unas', 'y', 'o', 'en', 'que', 'al',
  'por', 'para', 'con', 'sin', 'se', 'su', 'sus', 'no', 'es', 'son', 'lo', 'a', 'ya', 'como', 'mas',
  'pero', 'sobre', 'entre', 'cuando', 'donde', 'the',
])

/** Palabras con carga de un título, sin acentos, sin puntuación y sin adornos de markdown. */
function tokens(titulo) {
  return String(titulo || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 3 && !VACIAS.has(w))
}

/** Jaccard del vocabulario con carga. 1 = mismas palabras; 0 = ninguna en común. */
function parecido(a, b) {
  const A = new Set(tokens(a))
  const B = new Set(tokens(b))
  if (!A.size && !B.size) return 1
  if (!A.size || !B.size) return 0
  let comunes = 0
  for (const w of A) if (B.has(w)) comunes++
  return comunes / (A.size + B.size - comunes)
}

/**
 * Umbral. Calibrado con los dos extremos REALES del 28/07:
 *   · colisión (T-225): «La FAQ que ingiere Google…» vs «El pre-commit no corre typecheck…» → 0,00
 *   · retitulado legítimo: el título provisional de `reserve` vs el definitivo → placeholder, exento
 * Entre medias no hay casos reales, así que se deja holgado hacia el lado de NO molestar: por
 * debajo de 0,25 de vocabulario común no es una reescritura, es otra tarea.
 */
const UMBRAL = 0.25

/**
 * ¿Hay que PARAR antes de reconciliar este título?
 *
 * @param {string|null|undefined} tituloBd  el que ya tiene la fila en `backlog_tasks`
 * @param {string|null|undefined} tituloMd  el que trae la ficha del markdown
 * @returns {boolean} true si son tareas DISTINTAS (el sync pisaría la de otra sesión)
 */
function esOtraTarea(tituloBd, tituloMd) {
  const bd = String(tituloBd || '').trim()
  const md = String(tituloMd || '').trim()
  if (!bd || !md) return false            // sin material para juzgar, no se estorba
  if (bd === md) return false
  if (PLACEHOLDER.test(bd)) return false  // `reserve` dejó hueco a propósito: rellenarlo es su función
  return parecido(bd, md) < UMBRAL
}

/**
 * ¿Es una COLISIÓN de verdad, o solo un retitulado a fondo de MI PROPIA ficha?
 *
 * ## Por qué hizo falta (29/07/2026)
 *
 * `esOtraTarea` compara vocabulario, y eso basta para el caso que la creó (T-225: dos sesiones
 * distintas usando el mismo id). Pero produce un FALSO POSITIVO en algo que pasa a menudo:
 * retitular una ficha cuando el trabajo cambia lo que se sabe de ella. Dos casos reales el mismo
 * día, con diez minutos de diferencia:
 *
 *   - **T-219**: BD decía *«308 preguntas de «señale la INCORRECTA»…»* y el markdown
 *     *«El marco contradictorio de las preguntas de tipo NEGATIVO»*. Misma tarea: la propia ficha
 *     dice *«El cubo NO eran 308: era más del TRIPLE»*, o sea, el título viejo se quedó corto y se
 *     reescribió. Ni una palabra en común → el guardarraíl la dio por ajena.
 *   - **T-089**: *«POC whole-stack OK y gate de PICO SUPERADO»* → *«A3 RESUELTO: ya no queda
 *     bloqueo técnico»*. Otra vez la misma tarea, otro retitulado, otro falso positivo.
 *
 * Y el precio no lo paga quien retitula: el `sync` **aborta para TODAS las sesiones**, y de paso se
 * lleva por delante los avisos que van detrás. Ese aborto es justo lo que ocultó durante horas que
 * las fichas de T-251 y T-254 se habían borrado de `main`.
 *
 * ## El discriminante
 *
 * No es el parecido de los títulos, es **si esa ficha ha existido alguna vez en ESTE fichero**:
 *
 *   - Si el id ya aparecía en el historial del markdown → la ficha es NUESTRA y lo que ha cambiado
 *     es su título. Reconciliar es lo correcto.
 *   - Si el id NUNCA estuvo → otra sesión lo reservó en la tabla y su ficha aún no ha llegado.
 *     Reconciliar le PISARÍA el título. Hay que parar. (Es exactamente el caso T-225: la ficha era
 *     nueva en ese markdown, así que el historial no la tenía.)
 *
 * Aquí solo vive la decisión. Quien llama pone el dato del historial (`git log -S`).
 *
 * @param {{tituloBd: string|null, tituloMd: string|null, estuvoEnElHistorial: boolean}} caso
 */
function esColisionReal(caso) {
  const { tituloBd, tituloMd, estuvoEnElHistorial } = caso || {}
  if (!esOtraTarea(tituloBd, tituloMd)) return false
  // Los títulos no se parecen. Solo es colisión si la ficha NO es nuestra de antes.
  //
  // El historial se acepta como FUNCIÓN además de como booleano, y no es un capricho: quien
  // llama lo resuelve con `git log -S` sobre un markdown de 2 MB, que cuesta ~1 s POR FICHA.
  // Mientras el guard solo miraba 32 ids el coste pasaba desapercibido; al pasar a mirar las
  // 177 vivas (T-382) el `sync` se iba a más de dos minutos y había que matarlo. Como esta
  // comprobación solo hace falta cuando los títulos YA difieren —un puñado de casos—, pasarla
  // perezosa deja el coste en el orden de las divergencias reales, no del tamaño del backlog.
  const estuvo = typeof estuvoEnElHistorial === 'function' ? estuvoEnElHistorial() : estuvoEnElHistorial
  return !estuvo
}

module.exports = { esOtraTarea, esColisionReal, parecido, tokens, UMBRAL }
