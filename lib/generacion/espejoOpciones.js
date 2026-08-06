'use strict'
//
// Detección del PAR ESPEJO (T-153): la clave y un distractor son el MISMO texto salvo
// por un único término (o la negación) invertido — superior/inferior, dentro/fuera,
// «se interrumpe»/«no se interrumpe»… Cuando el precepto ofrece una regla y su inversa,
// sale natural poner como distractor la inversión exacta de la clave — y quien detecta
// la simetría resuelve el ítem a 50/50 sin abrir la norma, sin necesidad de conocer la
// materia. Es un problema de VALIDEZ (mide reconocer un patrón textual, no la
// institución), no un *tell* de forma como los de [T-150].
//
// Localizado en 3 preguntas de `gen_atc_t204_2026-07-26_s26c` (arts. 122.2, 37.1 y
// parcialmente 120.3).
//
// Solo se compara la CLAVE contra cada DISTRACTOR (no distractor-contra-distractor):
// un par de distractores opuestos no revela nada por sí solo, porque los dos son
// incorrectos — el atajo solo existe cuando uno de los dos extremos es la respuesta.
//
// CÓMO SE DECIDE «un único término invertido»: no por `replace()` de texto plano —eso
// falla con la negación española, donde el «no» va DELANTE del clítico y no pegado al
// verbo («no SE interrumpe», no «se NO interrumpe»)— sino por DIFF a nivel de palabra:
// se recorta el prefijo y el sufijo comunes de las dos opciones y se mira qué queda en
// medio. Si lo que queda es exactamente un «no» insertado en un lado (negación simple)
// o un par de `PARES_INVERTIDOS` (antónimo), es espejo.

/** Minúsculas, sin tildes, espacio único — mismo criterio que `absolutosOpcion.js`. */
function normalizar(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function palabrasDe(t) {
  return t.split(' ').filter(Boolean)
}

// Pares de antónimos frecuentes en redacción legal/administrativa que NO son una simple
// negación con «no» (esos los cubre la regla genérica de abajo). En forma normalizada
// (sin tildes), para casar con `normalizar()`.
const PARES_INVERTIDOS = [
  ['superior', 'inferior'],
  ['mayor', 'menor'],
  ['dentro', 'fuera'],
  ['antes', 'despues'],
  ['anterior', 'posterior'],
  ['valido', 'nulo'],
  ['valida', 'nula'],
  ['afirmativo', 'negativo'],
  ['afirmativa', 'negativa'],
  ['aumenta', 'disminuye'],
  ['aumento', 'disminucion'],
]

/**
 * Recorta el prefijo y el sufijo comunes (a nivel de PALABRA) de dos textos y devuelve
 * lo que queda en medio de cada uno — el tramo donde de verdad difieren.
 *
 * @returns {{spanA:string, spanB:string}}
 */
function tramoDivergente(wa, wb) {
  let ini = 0
  while (ini < wa.length && ini < wb.length && wa[ini] === wb[ini]) ini++
  let finA = wa.length - 1
  let finB = wb.length - 1
  while (finA >= ini && finB >= ini && wa[finA] === wb[finB]) { finA--; finB-- }
  return {
    spanA: wa.slice(ini, finA + 1).join(' '),
    spanB: wb.slice(ini, finB + 1).join(' '),
  }
}

/**
 * ¿Son `a` y `b` un PAR ESPEJO? Mismo texto salvo una única negación («no») insertada o
 * un único par de `PARES_INVERTIDOS`.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function sonEspejo(a, b) {
  const wa = palabrasDe(normalizar(a))
  const wb = palabrasDe(normalizar(b))
  if (!wa.length || !wb.length) return false

  const { spanA, spanB } = tramoDivergente(wa, wb)
  if (!spanA && !spanB) return false // idénticos

  // Negación simple: un lado no añade nada, el otro añade exactamente "no".
  if ((spanA === '' && spanB === 'no') || (spanB === '' && spanA === 'no')) return true

  // Antónimo catalogado, en cualquiera de las dos direcciones.
  return PARES_INVERTIDOS.some(([x, y]) => (spanA === x && spanB === y) || (spanA === y && spanB === x))
}

/**
 * ¿La CLAVE de la pregunta tiene un distractor que es su par espejo?
 *
 * @param {string[]} options 4 opciones [A,B,C,D].
 * @param {number} correctIdx índice 0-3 de la correcta.
 * @returns {{esEspejo:boolean, distractorIdx?:number}}
 */
function claveTieneDistractorEspejo(options, correctIdx) {
  const clave = options[correctIdx]
  for (let i = 0; i < options.length; i++) {
    if (i === correctIdx) continue
    if (sonEspejo(clave, options[i])) return { esEspejo: true, distractorIdx: i }
  }
  return { esEspejo: false }
}

module.exports = { sonEspejo, claveTieneDistractorEspejo, PARES_INVERTIDOS, normalizar }
