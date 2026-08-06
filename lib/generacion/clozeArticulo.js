'use strict'
//
// Detección del formato CLOZE (T-153): el enunciado termina citando LITERALMENTE un
// tramo del artículo, y la clave es justo la CONTINUACIÓN verbatim de ese tramo. El
// ítem deja de preguntar por la institución y pasa a ser un relleno de huecos: se
// acierta reconociendo la letra siguiente del texto memorizado, no comprendiendo la
// figura. Es un problema de VALIDEZ, no un *tell* como los de [T-150] — no permite
// "adivinar" mirando las opciones, pero mide otra cosa que la que dice medir.
//
// Medido en `gen_atc_t204_2026-07-26_s26c` (14 preguntas, LGT): las dos auditorías
// ciegas lo señalaron por su cuenta — 7/14 (auditor estricto) y 12/14 (auditor-opositor).
//
// Ejemplo del patrón: enunciado "…respetarán, en todo caso, los siguientes principios:"
// (cita literal del arranque del artículo) + clave = el texto que sigue en el artículo
// tal cual. La salida NO es aflojar la literalidad de la clave (eso rompe la garantía
// de verificabilidad contra el BOE) sino construir los DISTRACTORES con reglas reales
// de apartados o instituciones hermanas y dejar que el enunciado PREGUNTE en vez de
// empezar una frase.

/** Colapsa espacios/saltos de línea y recorta. */
function normalizarEspacios(t) {
  return String(t || '').replace(/\s+/g, ' ').trim()
}

// Por debajo de esto la "cola" del enunciado es demasiado genérica para que coincidir
// con el artículo signifique algo (evita falsos positivos con frases de trámite cortas).
const MIN_COLA = 20
// Cuánto de la clave tiene que seguir coincidiendo con lo que viene después en el
// artículo para que sea, de verdad, "la clave completa la frase" y no una coincidencia
// de las primeras palabras.
const MIN_SOLAPE_CONTINUACION = 12
// Máximo de palabras de la cola que se busca literalmente en el artículo — una cola más
// larga no añade precisión y complica el recorte de puntuación variable.
const PALABRAS_COLA = 12

/** Últimas `PALABRAS_COLA` palabras del enunciado, sin la puntuación de cierre (":", "?"…). */
function colaDelEnunciado(enunciado) {
  const limpio = normalizarEspacios(enunciado).replace(/[:¿?.,;]+$/, '')
  const palabras = limpio.split(' ')
  return palabras.slice(-PALABRAS_COLA).join(' ')
}

/**
 * ¿Es esta pregunta un CLOZE? El enunciado cita literalmente un tramo del artículo Y la
 * clave es la continuación verbatim de ese mismo tramo.
 *
 * @param {string} articulo `articles.content` del artículo de la pregunta.
 * @param {string} enunciado `question_text`.
 * @param {string} clave texto de la opción marcada correcta.
 * @returns {boolean}
 */
function esCloze(articulo, enunciado, clave) {
  const art = normalizarEspacios(articulo)
  const cola = colaDelEnunciado(enunciado)
  const cl = normalizarEspacios(clave)
  if (!art || !cl || cola.length < MIN_COLA) return false

  const idx = art.toLowerCase().indexOf(cola.toLowerCase())
  if (idx === -1) return false

  const despues = art.slice(idx + cola.length).replace(/^[\s,:;]+/, '')
  if (!despues) return false

  const tramo = Math.min(cl.length, despues.length, 40)
  if (tramo < MIN_SOLAPE_CONTINUACION) return false

  return despues.slice(0, tramo).toLowerCase() === cl.slice(0, tramo).toLowerCase()
}

module.exports = { esCloze, colaDelEnunciado, normalizarEspacios, MIN_COLA, MIN_SOLAPE_CONTINUACION }
