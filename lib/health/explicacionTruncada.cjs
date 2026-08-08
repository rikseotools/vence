'use strict'
/**
 * Explicaciones que terminan EN SECO, cortadas a mitad de frase: «…los miembros del Cuerpo Nacional
 * de», «…optar por la vecindad civil del otro», «…tres años de».
 *
 * ## Por qué hizo falta calibrar antes de contar (T-250)
 *
 * El defecto es real y visible —se encontró de refilón revisando el cubo de apelotonadas: 4 de 73
 * preguntas de alta exposición— pero **la heurística obvia no sirve**. Medido sobre las 136.304
 * activas con explicación:
 *
 * - «no acaba en signo de cierre» → **11.965**
 * - limpiando markdown de cierre (`**`) y espacio duro → **8.938**
 *
 * Y la inmensa mayoría de esas 8.938 son explicaciones CORRECTAS: las que cierran con la referencia
 * de la fuente sin punto («*Constitución Española, Art. 147»), las que acaban en una URL, y las que
 * simplemente están mal puntuadas pero dicen una frase entera («…de las personas con discapacidad»).
 * Cablear eso llenaría la bandeja de aciertos y mataría el detector, que es exactamente lo que la
 * ficha quería evitar.
 *
 * ## El discriminante NO es la puntuación, es la GRAMÁTICA
 *
 * Una frase mal puntuada está completa; una frase cortada **pide continuación**. Por eso se mira la
 * ÚLTIMA PALABRA y no el último signo:
 *
 * - `coma_final` — termina en coma. La enumeración o la subordinada se quedaron a medias.
 * - `palabra_funcional` — termina en una palabra que no puede cerrar una oración: preposición
 *   («de», «en», «para»), conjunción («y», «o», «que»), determinante («la», «los», «su») o
 *   relativo. Ninguna de ellas aparece nunca al final de un texto bien terminado.
 *
 * Medido con este criterio: **115 activas**, frente a las 8.938 de la heurística obvia. Sobre una
 * muestra aleatoria de 20 juzgada a mano: 18 cortes claros, 1 dudoso y 1 falso positivo — el que
 * motiva la tercera exclusión de abajo. Precisión ≈ 95%, por encima del ~90% que la ficha exige
 * para poder cablearlo.
 *
 * ## Las tres exclusiones son lo que sostiene esa precisión
 *
 * 1. **URLs.** Media docena de explicaciones cierran con un enlace que termina en `?sequence=4&
 *    isAllowed=y`. Esa `y` final no es la conjunción: es el valor de un parámetro.
 * 2. **Locuciones de cierre** («entre otros», «etc»). Cierran legítimamente una enumeración abierta,
 *    aunque «otros» sea un indefinido de la lista.
 * 3. **Letra suelta en MAYÚSCULA.** El falso positivo de la muestra era una tabla de coordenadas que
 *    acababa en «0° a -90° S O»: ahí la «O» es Oeste, no la conjunción. Una conjunción real va en
 *    minúscula salvo al principio de la oración, que nunca es el final del texto.
 */

/** Palabras que NO pueden cerrar una oración en español: si el texto acaba ahí, falta lo que sigue. */
const FUNCIONALES = new Set(
  (
    // preposiciones
    'a ante bajo cabe con contra de desde durante en entre hacia hasta mediante para por segun según sin so sobre tras ' +
    // conjunciones y nexos
    'y e o u ni que pero sino aunque porque si como cuando donde mientras pues ' +
    // determinantes y posesivos
    'el la los las un una unos unas del al lo su sus mi mis tu tus este esta estos estas ese esa esos esas ' +
    'aquel aquella aquellos aquellas cuyo cuya cuyos cuyas ' +
    // relativos, cuantificadores e indefinidos
    'quien quienes cual cuales cuanto cuanta cuantos cuantas muy mas más menos tan tanto ' +
    'todo toda todos todas otro otra otros otras cada cualquier cualesquiera'
  ).split(' '),
)

/** Signos con los que un texto SÍ puede terminar legítimamente. */
const CIERRE = /[.!?…»"”')\]:]\s*$/

/** Locuciones que cierran una enumeración abierta y no dejan la frase coja. */
const LOCUCION_DE_CIERRE = /\b(entre otr[oa]s|etc)\s*$/i

/** Quita el markdown de cierre y el espacio duro, que ocultan el verdadero final del texto. */
function colaLimpia(texto) {
  return String(texto || '')
    .replace(/(\*\*|__|\*|`)+\s*$/, '')
    .replace(/ /g, ' ')
    .replace(/\s+$/, '')
}

/** ¿El texto acaba dentro de un enlace? Entonces su último carácter no dice nada de la gramática. */
function acabaEnUrl(texto) {
  const ultimoToken = texto.split(/\s/).pop() || ''
  return /(https?:\/\/|www\.)/.test(ultimoToken) || /[/?=&]/.test(ultimoToken)
}

/**
 * @param {{explanation?: string|null}} q
 * @returns {{truncada: boolean, motivo: string|null, cola: string}}
 */
function clasificaTruncada(q) {
  const limpia = colaLimpia(q && q.explanation)
  const cola = limpia.slice(-90)
  if (!limpia) return { truncada: false, motivo: null, cola: '' }
  if (acabaEnUrl(limpia) || LOCUCION_DE_CIERRE.test(limpia)) return { truncada: false, motivo: null, cola }

  if (/,\s*$/.test(limpia)) return { truncada: true, motivo: 'coma_final', cola }
  if (CIERRE.test(limpia)) return { truncada: false, motivo: null, cola }

  const ultima = (limpia.match(/([\wáéíóúñüÁÉÍÓÚÑÜ]+)\s*$/) || [])[1]
  if (!ultima) return { truncada: false, motivo: null, cola }
  // Una letra suelta en mayúscula es un símbolo (punto cardinal, inicial), no una conjunción.
  if (ultima.length === 1 && ultima !== ultima.toLowerCase()) return { truncada: false, motivo: null, cola }
  if (FUNCIONALES.has(ultima.toLowerCase())) return { truncada: true, motivo: 'palabra_funcional', cola }

  return { truncada: false, motivo: null, cola }
}

/**
 * ANCLAS ([T-718]) — preguntas REALES del banco, leídas a mano el 08/08/2026.
 *
 * Aquí las negativas son las dos EXCLUSIONES que sostienen la precisión de este detector, y sin
 * las cuales se dispara: el criterio «no acaba en signo de cierre» daba **8.938 de 136.310**
 * activas, casi todas correctas, frente a las **112** del criterio gramatical. Cada negativa
 * fija una de las razones por las que aquel corte era inservible:
 *   · una explicación que termina en una URL (el final del enlace no es una preposición colgada);
 *   · una que cierra con una locución («entre otros/otras»), que es una frase COMPLETA.
 */
const ANCLAS = {
  positivos: [{
    id: '033d6acf-1d83-4db6-94fd-a5ec71678a82',
    porque: 'acaba en «…Derechos Económicos, Sociales y Culturales,» — coma final: falta lo que venía detrás',
  }],
  negativos: [
    {
      id: '002b5b10-79ab-4ea1-931f-7e357c6a4cc1',
      porque: 'termina en una URL: el final del enlace no es una palabra que pida continuación (exclusión medida)',
    },
    {
      id: '77862ba2-6a24-481b-9df5-d2770509a28f',
      porque: 'cierra con la locución «entre otras.»: es una frase completa, no un corte a mitad',
    },
  ],
}

module.exports = { clasificaTruncada, FUNCIONALES, ANCLAS }
