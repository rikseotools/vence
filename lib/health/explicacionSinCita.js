'use strict'
/**
 * explicacionSinCita.js — NÚCLEO PURO: una explicación estructurada SIN cita es el rastro de que el
 * artículo no responde a la pregunta.
 *
 * ## Por qué existe (T-342, 30/07/2026)
 *
 * El esquema de `explanation_data` hace `cita` **opcional**, así que una explicación sin ella pasa
 * todos los gates: el validador de lote, el aplicador y el barrido de citas no literales. Pero un
 * agente que leyó el artículo y **no encontró una frase que sostuviera la respuesta** deja
 * exactamente esa huella.
 *
 * Medido el 30/07 sobre las 737 preguntas de la campaña de T-291: **687 con cita literal, 0 citas
 * inventadas y 50 sin anclar**. Al abrir las 50 a mano, algunas eran omisión del agente (el artículo
 * SÍ lo decía) y otras huecos reales del temario — por ejemplo una pregunta de Windows 11 sobre
 * copias de seguridad automáticas cuya expresión «copia de seguridad» no aparece ni una vez en los
 * 53.930 caracteres del artículo.
 *
 * No es un detector de formato: es un detector de **huecos de temario**, y sale de una query, sin
 * LLM y sin fetch.
 *
 * ## Las dos exenciones NO son cosmética
 *
 * Sin ellas el detector grita en falso, y por el mismo motivo por el que gritaba el de atajos:
 *
 * - **Preguntas de NEGACIÓN** («¿cuál NO es…?», «señale la INCORRECTA», «excepto»). Ahí la opción
 *   correcta es justamente la que el artículo NO contiene, así que no poder citarla es lo esperado.
 * - **Meta-opciones** («todas las respuestas son correctas», «ninguna es correcta», «A y B»). No
 *   afirman ningún contenido propio que anclar.
 *
 * El criterio de literalidad NO se reimplementa: se importa `citaNoLiteral` del validador de
 * impugnaciones, que es la única definición del proyecto (con trinquete en `criterioCitaUnico`).
 */

/**
 * Va SIN distinguir mayúsculas a propósito: en los enunciados de examen la negación se resalta
 * precisamente escribiéndola en mayúsculas («señale la respuesta INCORRECTA»), que es el caso que se
 * escapaba cuando este patrón era sensible a la caja.
 */
const NEGACION = /\b(?:no\s+(?:es|son|será|corresponde|figura|forma|pertenece|incluye|constituye|se\s+considera)|se[ñn]ale\s+la\s+(?:incorrecta|falsa)|cu[áa]l\s+.{0,30}\bno\b|excepto|salvo|incorrecta|falsa)/i

/** La negación enfatizada en mayúsculas dentro de un enunciado en minúsculas: «¿cuál NO procede?». */
const NEGACION_ENFATICA = /\bNO\b/

const META_OPCION = /^\s*(?:todas|ninguna|ning[úu]n|las\s+(?:dos|tres|anteriores)|[abcd]\s*y\s*[abcd]\b|son\s+correctas)/i

/** ¿El enunciado pide la opción que NO cumple? Entonces no poder citarla es lo correcto. */
function esNegacion(enunciado) {
  const t = String(enunciado || '')
  return NEGACION.test(t) || NEGACION_ENFATICA.test(t)
}

/** ¿La opción marcada es una meta-opción, sin contenido propio que anclar? */
function esMetaOpcion(textoClave) {
  return META_OPCION.test(String(textoClave || ''))
}

/**
 * Clasifica una pregunta.
 *
 * @param {object} q
 * @param {object|null} q.explanationData  el `explanation_data` de la pregunta
 * @param {string} q.enunciado
 * @param {string} q.textoClave            el texto de la opción marcada como correcta
 * @param {string} q.contenidoArticulo
 * @param {(cita:string, art:string) => object|null} citaNoLiteral  el criterio ÚNICO, inyectado
 * @returns {{estado: string, cita: string|null}}
 *
 * Estados: `sin_estructura` · `exento_negacion` · `exento_meta` · `con_cita_literal` ·
 *          `cita_no_literal` · `sin_cita`
 */
function clasificar(q, citaNoLiteral) {
  const ed = q.explanationData
  if (!ed || typeof ed !== 'object') return { estado: 'sin_estructura', cita: null }

  const cita = ed.cita ? String(ed.cita.bloque || ed.cita.texto || '').trim() : ''

  // Las exenciones se comprueban ANTES de reclamar la cita: en esas preguntas su ausencia no
  // significa nada. Pero si la cita existe igualmente, se sigue comprobando que sea literal —
  // una cita inventada es un defecto tenga la pregunta la forma que tenga.
  if (cita) {
    return { estado: citaNoLiteral(cita, q.contenidoArticulo) === null ? 'con_cita_literal' : 'cita_no_literal', cita }
  }
  if (esNegacion(q.enunciado)) return { estado: 'exento_negacion', cita: null }
  if (esMetaOpcion(q.textoClave)) return { estado: 'exento_meta', cita: null }
  return { estado: 'sin_cita', cita: null }
}

/**
 * ¿Este estado es un hallazgo DE ESTE detector? **Solo `sin_cita`.**
 *
 * `cita_no_literal` se calcula igualmente porque hace falta para distinguirlo de «no hay cita», pero
 * NO se reporta aquí: ese terreno ya lo cubre el barrido de citas (kind `cita_no_literal`), que tiene
 * su propia calibración —solo reporta las citas **ajenas**, con solape < 0,5, porque las «retocadas»
 * (mismo contenido, distinto formateo) no son defecto—. Medido el 30/07 sobre las 7.037 activas con
 * estructura: 3.925 salen «no literales» en bruto y reportarlas todas sería un badge gritando. La
 * novedad de este detector es la otra columna, la que nadie miraba.
 */
function esHallazgo(estado) {
  return estado === 'sin_cita'
}

module.exports = { clasificar, esNegacion, esMetaOpcion, esHallazgo, NEGACION, NEGACION_ENFATICA, META_OPCION }
