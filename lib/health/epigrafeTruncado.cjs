'use strict'
/**
 * ¿El epígrafe de un tema se corta a mitad de frase, prometiendo una lista de materias que no
 * llega a traer?
 *
 * ## Por qué existe (T-625)
 *
 * Al importar un temario por lotes, la continuación del epígrafe (la enumeración de materias que
 * sigue a los dos puntos) se pierde y el campo se queda cortado en seco:
 *
 *   «La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público:»
 *   «Régimen Jurídico del Sector Público (I):»
 *   «La contratación del sector público (II):»
 *
 * El epígrafe anuncia que va a enumerar las materias del tema y no enumera ninguna.
 *
 * ## Por qué importa más de lo que parece
 *
 * El epígrafe es la VARA DE MEDIR de todo el sistema de temario: con él se decide qué artículos
 * entran en el `topic_scope` (Paso 2), se verifica su literalidad contra el boletín (Paso 1) y se
 * adjudican los recortes de sobre-inclusión. Un epígrafe truncado no se puede contrastar con NADA
 * — cualquier scope le encaja, porque no dice nada. Es un falso verde por construcción, y de los
 * peores: las herramientas no fallan, simplemente no tienen contra qué comparar.
 *
 * Caso origen: al trabajar [T-518], 12 temas escopaban el Capítulo III de la Ley 40/2015 sin que
 * su epígrafe lo pidiera. 11 se pudieron recortar; el 12.º (`auxiliar_administrativo_sermas` T9)
 * hubo que dejarlo fuera porque su epígrafe está cortado — no hay forma honesta de decidir si el
 * Capítulo III entra o no. Medido el 06/08/2026 contra RDS: 14 de 3.799 temas activos con epígrafe.
 *
 * ## El criterio, y por qué es tan estrecho
 *
 * Terminar en `:` (tras recortar espacios) es señal fuerte porque en estos epígrafes el colon
 * SIEMPRE promete continuación — pero NO es la única forma de truncamiento posible, y hay
 * epígrafes legítimos con `:` EN MEDIO de la frase («La Constitución Española de 1978: estructura
 * y contenido»). Por eso este detector marca SOLO el final, anclado con `$`. Ampliar el patrón
 * (por ejemplo a comas o conjunciones finales) exige medir antes contra datos reales — no se hace
 * aquí a ojo.
 *
 * Aquí solo vive la DECISIÓN, pura y testeable: quien llama pone los epígrafes.
 */

/** Termina en dos puntos, con o sin espacio detrás, tras recortar espacios. */
const TERMINA_EN_DOS_PUNTOS = /:\s*$/

/**
 * Analiza el texto de un epígrafe.
 * @param {string|null|undefined} texto
 * @returns {{truncado: boolean}}
 */
function analizarEpigrafeTruncado(texto) {
  const t = typeof texto === 'string' ? texto.trim() : ''
  if (!t) return { truncado: false }
  return { truncado: TERMINA_EN_DOS_PUNTOS.test(t) }
}

/**
 * Filtra una lista de epígrafes y devuelve los truncados.
 * @param {Array<{slug?: string, tema?: number|string, epigrafe?: string|null}>} filas
 */
function epigrafesTruncados(filas) {
  const out = []
  for (const f of filas ?? []) {
    if (analizarEpigrafeTruncado(f?.epigrafe).truncado) out.push({ ...f })
  }
  return out
}

module.exports = { analizarEpigrafeTruncado, epigrafesTruncados, TERMINA_EN_DOS_PUNTOS }
