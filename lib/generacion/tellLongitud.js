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
 * Regla calibrada — marca SOLO si se cumple alguna de estas tres:
 *   (P) Patrón prohibido explícito del manual: correcta > 100 ch y algún
 *       distractor < 60 ch.
 *   (T) Tell explotable: la correcta es la opción MÁS LARGA y supera al mayor
 *       de los distractores por más del 30%.
 *   (I) Tell INVERTIDO: la correcta es la MÁS CORTA y hasta el distractor más
 *       breve la supera en más del 30%. Aquí no se explota eligiendo "la más
 *       larga" sino "la rara": tres frases con ropaje narrativo y una respuesta
 *       desnuda destacan igual. Añadida el 25/07/2026 tras verlo cazado por
 *       auditoría ciega SIETE veces en dos lotes seguidos (gen_atc_t202: arts.
 *       4.1 y 12.1 LGT; gen_atc_t214: arts. 215.1, 222.2, 223.4, 231.1 y 245.2)
 *       — el patrón aparece cuando el artículo responde con una remisión o una
 *       enumeración breve ("En Pleno, en Salas y de forma unipersonal.", 42 ch,
 *       frente a distractores de 95-98).
 *
 * El umbral de (I) se mide sobre el distractor MÁS CORTO, no sobre el más
 * largo: basta que UNO se acerque a la correcta para que deje de destacar. Eso
 * es lo que preserva los falsos positivos ya calibrados (Ley 14/1990 art. 27:
 * correcta 27 ch, distractores 31/43/37 → el más corto la supera solo en un
 * 15%, sigue sin haber tell).
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
  // (I) tell invertido: la correcta destaca por ser la más corta con diferencia
  if (lc < minDist && minDist > lc * 1.3) {
    return { tell: true, motivo: `TELL INVERTIDO: la correcta (${lc} ch) es la más corta y hasta el distractor más breve (${minDist} ch) la supera en >30% — acorta los distractores, no alargues la correcta (rompería la literalidad §2.2)` }
  }
  return { tell: false }
}

module.exports = { analizarLongitud }
