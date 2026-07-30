/**
 * lib/laws/contadorArticulos.ts — NÚCLEO PURO: ¿se puede enseñar este número de artículos?
 *
 * ## Por qué existe (30/07/2026, caso Manolo García)
 *
 * En la pantalla de una ley, el filtro del test anunciaba **«798 artículos disponibles»**
 * para la LO 3/2007, que tiene **134**. No era un desajuste de cálculo: `LawTestConfigurator`
 * rellenaba `articles_with_questions` con `lawStats.totalQuestions`, o sea, ponía el número
 * de PREGUNTAS en el hueco de los artículos. Cualquiera que abriese el selector veía 136
 * casillas debajo de un rótulo que prometía 798.
 *
 * Nadie lo detectó porque no era un error: era un número plausible en el sitio equivocado,
 * y ningún tipo lo impedía (los dos campos son `number`). Lo mismo que el 405 de esta
 * semana, con otra cara.
 *
 * Por eso la decisión de pintarlo pasa por aquí, con dos reglas:
 *
 *  1. **Sin dato no se inventa.** Si el contador no viene (por ejemplo, una respuesta
 *     cacheada con la forma anterior), no se enseña nada. Un hueco es honesto; un número
 *     equivocado hace que la persona desconfíe de todo lo demás.
 *  2. **Un número imposible no se enseña.** No puede haber más artículos con preguntas que
 *     preguntas: cada artículo que cuenta aporta al menos una. Si eso pasa, alguien ha
 *     vuelto a cruzar los campos, y se emite señal en vez de pintarlo.
 */

export type MotivoContador = 'ok' | 'sin_dato' | 'no_entero' | 'negativo' | 'mas_articulos_que_preguntas'

export interface DecisionContador {
  /** Si se pinta el «N artículos disponibles». */
  mostrar: boolean
  /** El número a pintar, o null si no se puede. */
  n: number | null
  motivo: MotivoContador
  /** true cuando el dato es contradictorio (no simplemente ausente): merece señal. */
  sospechoso: boolean
}

/**
 * @param articulosConPreguntas  artículos DISTINTOS de la ley que tienen alguna pregunta activa
 * @param totalPreguntas         preguntas activas de la ley (cota superior de lo anterior)
 */
export function decidirContadorArticulos(
  articulosConPreguntas: number | null | undefined,
  totalPreguntas: number | null | undefined,
): DecisionContador {
  if (articulosConPreguntas === null || articulosConPreguntas === undefined) {
    return { mostrar: false, n: null, motivo: 'sin_dato', sospechoso: false }
  }
  if (!Number.isFinite(articulosConPreguntas) || !Number.isInteger(articulosConPreguntas)) {
    return { mostrar: false, n: null, motivo: 'no_entero', sospechoso: true }
  }
  if (articulosConPreguntas < 0) {
    return { mostrar: false, n: null, motivo: 'negativo', sospechoso: true }
  }
  // La comprobación que habría cazado el caso real: 798 artículos con 799 preguntas es
  // aritméticamente posible, pero 798 artículos donde el total de preguntas es 798 y el
  // selector enseña 136 casillas no lo es. La cota dura y verificable es esta.
  if (
    typeof totalPreguntas === 'number' &&
    Number.isFinite(totalPreguntas) &&
    articulosConPreguntas > totalPreguntas
  ) {
    return { mostrar: false, n: null, motivo: 'mas_articulos_que_preguntas', sospechoso: true }
  }
  return { mostrar: true, n: articulosConPreguntas, motivo: 'ok', sospechoso: false }
}

/** Texto ya concordado en singular/plural, o null si no hay nada que decir. */
export function textoContadorArticulos(d: DecisionContador): string | null {
  if (!d.mostrar || d.n === null) return null
  return d.n === 1 ? '1 artículo disponible' : `${d.n} artículos disponibles`
}
