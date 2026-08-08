/**
 * ¿El contenido de un artículo (de una ley VIRTUAL: contenedor temático sin BOE detrás) es un
 * placeholder — un marcador tipo «⏳ Teoría pendiente…» — o texto real de temario?
 *
 * Fuente ÚNICA del umbral (T-374, 07/08/2026). Antes solo vivía inline en el guardarraíl
 * `__tests__/integration/placeholderTemarioGuard.test.ts` (`length(a.content) < 120`), que
 * DETECTA la regresión después de que ya ha pasado — y el 08/07/2026 pasó de largo: 7.202
 * preguntas de enfermería (`import-aulaplus-clinico.cjs`) se colgaron de artículos con
 * `content = '⏳ Teoría pendiente (contenedor enfermería).'` (44 caracteres) porque ningún
 * import comprobaba el artículo antes de vincular. El gate de CI que debía frenarlo llevaba
 * días en rojo por un secret que faltaba ([T-370]) — «no es que no verificara, es que dejó de
 * frenar» — así que subió sin que nada avisara.
 *
 * Esta función es la misma pregunta hecha en el momento de ESCRIBIR (import), no solo al
 * MEDIR (CI): detector y puerta de entrada comparten el mismo criterio para que no puedan
 * discrepar, igual que `lib/teoria/encabezadoArticulo.ts` hace para el render.
 */

/** Mismo umbral que el ratchet. Cambiarlo aquí lo cambia en los dos sitios a la vez. */
const UMBRAL_PLACEHOLDER = 120

/**
 * @param {string | null | undefined} content
 * @returns {boolean}
 */
function esContenidoPlaceholder(content) {
  return (content ?? '').trim().length < UMBRAL_PLACEHOLDER
}

module.exports = { UMBRAL_PLACEHOLDER, esContenidoPlaceholder }
