'use strict'
//
// Núcleo puro (sin red ni BD) del TERCER marco contradictorio de T-219 — el INVERSO de los
// otros dos que ya tenía la ficha: la cabecera «Por qué las demás [opciones] son correctas»
// está BIEN (marco negativo: las opciones no marcadas SÍ son ciertas/están contempladas en la
// norma), pero CADA viñeta debajo dice «esta opción NO es correcta» — contradiciendo la
// cabecera que las agrupa, y contradiciendo el propio artículo (que sí las contiene). Caso
// raíz: `8d8b8e01` (art. 117 EAAnd), que la ficha original dejó como «posible explicación
// truncada, mirar aparte».
//
// Patrón de PLANTILLA, no de contenido: dos variantes de la MISMA frase repetida en cada
// viñeta, con una contradicción interna en una de ellas —
//   «Esta opción no es correcta PORQUE SÍ está contemplada en la normativa aplicable.»
// («no es correcta» y «sí está contemplada» en la MISMA frase no pueden ser ambas ciertas) —
// y la otra variante, sin el «sí» pero igual de invertida:
//   «... - No es correcta según lo establecido en la normativa aplicable.»
//
// VERIFICADO CONTRA EL ARTÍCULO (no contra la ficha) en 9/9 casos del universo medido el
// 06/08/2026: en cada uno, las opciones "las demás" SÍ aparecen literalmente en el artículo
// (o están explícitamente incluidas/excluidas por él) y la clave es la única que NO encaja —
// confirma que el defecto vive en la POLARIDAD de la viñeta, no en la clave ni en el
// contenido. Detalle caso a caso: ficha T-219 en docs/roadmap/tareas-pendientes.md.
//
// SOLO actúa cuando TODAS las viñetas del bloque dicen «no es correcta»/«es incorrecta»: si
// alguna viñeta SÍ afirma que la opción es cierta (mezcla), el bloque es más complejo que un
// bug de plantilla plano —p.ej. una opción "todas las anteriores" que es un distractor
// genuinamente falso por sí misma, o un bloque que YA es coherente— y queda fuera, para
// lectura humana (medido: 17 casos así el 06/08, aparte de estos 9; ampliar a lo bruto
// repetiría el error que la propia T-219 ya midió con `cuál … no` insensible a mayúsculas).
//
// NO toca la clave, ni el enunciado, ni las opciones, ni el párrafo «Por qué X es correcta».
// Solo invierte la polaridad DENTRO de cada viñeta del bloque «las demás».

const RE_HEAD = /(\*\*)?Por qué las demás( opciones)?( son)? correctas:?(\*\*)?/i
// Divide el bloque en viñetas por el patrón "- **<algo>" (mismo separador que usa
// reparar-demas-incorrecta.cjs para leer el bloque simétrico).
const RE_VINETA_SPLIT = /\n-\s*\*\*/
// «no es correcta» / «es incorrecta» / «no es cierta», en cualquier mayúscula/minúscula.
const RE_NEGATIVA = /\b(no es (correcta|cierta|correcto|verdad)|es incorrecta|es incorrecto)\b/i
// «sí es correcta»/«es correcta» (sin negación cerca) — señal de que la viñeta YA afirma lo
// contrario en algún punto (mezcla), o de que el bloque ya es coherente.
const RE_POSITIVA = /\b(sí es (correcta|cierta|correcto)|es correcta\b(?!.{0,3}(no|,? no))|es cierta\b)/i

/** ¿La viñeta (texto completo, incluida la letra) afirma que la opción NO es correcta? */
function esNegativa(vineta) {
  return RE_NEGATIVA.test(vineta)
}

/** ¿La viñeta afirma en algún punto que la opción SÍ es correcta/cierta? */
function esPositiva(vineta) {
  return RE_POSITIVA.test(vineta) && !esNegativa(vineta)
}

/**
 * Invierte SOLO la polaridad de «no es correcta»/«es incorrecta» dentro de una viñeta,
 * preservando el resto de la frase (incluida la mayúscula inicial si la tenía). Solo
 * reemplaza la PRIMERA aparición de cada forma — el patrón medido nunca repite la negación
 * dos veces en la misma viñeta, y limitarlo evita tocar una segunda mención legítima.
 */
function invertirVineta(vineta) {
  return vineta
    .replace(/\bNo es (correcta|cierta|correcto|verdad)\b/, (_, w) => `Sí es ${w}`)
    .replace(/\bno es (correcta|cierta|correcto|verdad)\b/i, (_, w) => `sí es ${w}`)
    .replace(/\bEs incorrecta\b/, 'Es correcta')
    .replace(/\bes incorrecta\b/i, 'es correcta')
    .replace(/\bEs incorrecto\b/, 'Es correcto')
    .replace(/\bes incorrecto\b/i, 'es correcto')
}

/**
 * Repara UNA explicación si (y solo si) su bloque «las demás son correctas» tiene TODAS las
 * viñetas en polaridad negativa, sin ninguna mezcla.
 *
 * @param {string} explanation texto completo de `questions.explanation`.
 * @returns {string|null} el texto reparado, o `null` si no aplica (sin cabecera, bloque de
 *   una sola viñeta, ya coherente, o mezcla que exige lectura humana).
 */
function reparar(explanation) {
  const texto = String(explanation || '')
  const m = texto.match(RE_HEAD)
  if (!m) return null
  const inicioBloque = texto.indexOf(m[0]) + m[0].length
  // El bloque de viñetas se corta en el siguiente "\n\n**" (otra sección) o al final del texto.
  const resto = texto.slice(inicioBloque)
  const finBloque = resto.search(/\n\n\*\*/)
  const bloque = finBloque === -1 ? resto : resto.slice(0, finBloque)
  const cola = finBloque === -1 ? '' : resto.slice(finBloque)

  const partes = bloque.split(RE_VINETA_SPLIT)
  const preambulo = partes[0]
  const vinetas = partes.slice(1)
  if (vinetas.length < 2) return null // un bloque de 1 viñeta no da señal de patrón sistemático

  if (!vinetas.every((v) => esNegativa(v))) return null // alguna ya coherente → mezcla, no tocar
  if (vinetas.some((v) => esPositiva(v))) return null // "sí es X" a la vez que "no es Y": ambigua

  // El split se come el "- **" que precede a cada viñeta salvo la primera pieza (preámbulo);
  // se reconstruye anteponiendo "\n- **" a cada viñeta reparada, igual que el original.
  return texto.slice(0, inicioBloque) + preambulo +
    vinetas.map((v) => '\n- **' + invertirVineta(v)).join('') + cola
}

module.exports = { reparar, esNegativa, esPositiva, invertirVineta, RE_HEAD }
