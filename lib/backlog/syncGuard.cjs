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

module.exports = { esOtraTarea, parecido, tokens, UMBRAL }
