/**
 * Detección del "tell de longitud" en preguntas tipo test (§2.2-bis del manual
 * `generar-preguntas-con-ia.md`).
 *
 * El riesgo real: si la opción correcta es cita literal larga y los distractores
 * son frases cortas inventadas, se acierta sin saber, eligiendo la más larga.
 *
 * Un ±30% plano sobre las longitudes es MALA calibración: cuando las cuatro
 * opciones son cortas (p.ej. "se organiza en consejerías." vs "…en
 * viceconsejerías."), un ratio 1.3-1.6 es inevitable y NO delata nada, porque
 * el tell solo es explotable cuando la **correcta es la más larga**. Elegir la
 * opción más larga cuando la correcta es la más corta lleva a un distractor.
 * (Falsos positivos reales: Ley 14/1990 arts. 23 y 27, batch gen_t15admin.)
 *
 * Regla calibrada — marca SOLO si se cumple alguna de estas dos:
 *   (P) Patrón prohibido explícito del manual: correcta > 100 ch y algún
 *       distractor < 60 ch.
 *   (T) Tell explotable: la correcta es la opción MÁS LARGA y supera al mayor
 *       de los distractores por más del 30%.
 * En cualquier otro caso (correcta corta o media, o correcta la más larga pero
 * por poco), no hay tell aprovechable.
 */

/**
 * @param {string[]} options 4 opciones [A,B,C,D].
 * @param {number} correctIdx índice 0-3 de la correcta.
 * @returns {{tell:boolean, motivo?:string}}
 */
function analizarLongitud(options, correctIdx) {
  const lens = options.map((o) => String(o).length)
  const lc = lens[correctIdx]
  const distractores = lens.filter((_, i) => i !== correctIdx)
  const maxDist = Math.max(...distractores)
  const minDist = Math.min(...distractores)

  // (P) patrón prohibido del manual: correcta larga + algún distractor diminuto
  if (lc > 100 && minDist < 60) {
    return { tell: true, motivo: `patrón prohibido: correcta ${lc} ch y un distractor de ${minDist} ch` }
  }
  // (T) tell explotable: la correcta destaca por ser la más larga
  if (lc > maxDist && lc > maxDist * 1.3) {
    return { tell: true, motivo: `la correcta (${lc} ch) es la más larga y supera al mayor distractor (${maxDist} ch) en >30%` }
  }
  return { tell: false }
}

module.exports = { analizarLongitud }
