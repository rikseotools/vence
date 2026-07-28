'use strict'
//
// anclajeTrasReimportar — ¿qué le ha pasado a la clave de una pregunta cuando el texto de su
// artículo se ha reescrito con el oficial? Decisión PURA: entran los dos veredictos de
// literalidad (contra el texto ANTES y DESPUÉS) y sale qué hacer con la pregunta.
//
// ## Por qué existe (T-192, 28/07/2026)
//
// Al reimportar el RGPD, 72 de sus 99 artículos cambiaron de texto y **207 preguntas** quedaron
// apuntando a una redacción que ya no está. Revisarlas todas por igual es tirar el esfuerzo donde
// no hace falta: la mayoría no se entera del cambio. Lo que hay que separar es una cosa muy
// concreta —**¿la reimportación ROMPIÓ el anclaje de esta clave, o ya estaba roto de antes?**—, y
// eso solo se puede responder si se conserva el texto anterior. Se conserva:
// `article_versions.previous_content`.
//
// La distinción no es cosmética, es de honestidad. Sin ella, un informe diría «207 preguntas sin
// anclar tras la reimportación» y parecería que las hemos roto nosotros, cuando la mayoría ya
// estaban así. Y al revés: las que SÍ hemos roto se perderían entre las demás.
//
//   · `no_aplica`→ el enunciado es de marco INTRUSO («señale la FALSA»): ahí la opción correcta NO
//                  está en el artículo **por diseño**, así que medir su literalidad no dice nada.
//                  Sin esta clase, el informe cuenta como «sin anclar» preguntas perfectamente
//                  sanas y el número deja de significar nada.
//   · `intacta`  → la clave estaba en el texto y sigue estando. Sin trabajo.
//   · `reparada` → NO estaba y ahora SÍ. La reimportación la ha arreglado sola: la clave era buena
//                  y el texto era el que estaba mal. Es la prueba de que el defecto era del texto.
//   · `rota`     → estaba y ha dejado de estar. **La reimportación se la ha llevado por delante:
//                  máxima prioridad.** O la clave se apoyaba en la redacción no oficial, o el
//                  artículo dice ahora otra cosa.
//   · `ya_rota`  → no estaba antes ni está ahora. Hay que mirarla, pero no la hemos causado.
//
// ⚠️ Esto NO decide si la pregunta es correcta: decide DÓNDE MIRAR PRIMERO. Que la clave sea
// subcadena literal del artículo no la hace verdadera, y que no lo sea no la hace falsa (una
// pregunta de estructura o una que parafrasee legítimamente saldrán `ya_rota`). **Nunca auto-flip
// de clave**: lo que no cuadre va a revisión humana.

/** Veredictos de `analizarLiteralidad` que cuentan como «la clave está en el texto». */
const ESTADOS_ANCLADOS = ['LITERAL', 'ORTOGRAFIA', 'ENUMERACION']

/** ¿Este veredicto de literalidad cuenta como anclado? (solo `NO_LITERAL` es defecto duro) */
function estaAnclada(estado) {
  return ESTADOS_ANCLADOS.includes(String(estado || '').toUpperCase())
}

/**
 * @param {string} estadoAntes    veredicto contra `article_versions.previous_content`
 * @param {string} estadoDespues  veredicto contra el `articles.content` actual
 * @param {{marcoIntruso?: boolean}} [opciones]  `resolverMarco(...).marco === 'INTRUSO'`
 * @returns {{clase:'intacta'|'reparada'|'rota'|'ya_rota'|'no_aplica', prioridad:number, motivo:string}}
 *   `prioridad` 0 = no hay nada que hacer · 3 = mírala la primera.
 */
function clasificarAnclaje(estadoAntes, estadoDespues, opciones = {}) {
  // En una pregunta de marco INTRUSO la correcta es, a propósito, lo que el artículo NO dice.
  // Medir su literalidad ahí no informa de nada: ni antes ni después debía estar.
  if (opciones.marcoIntruso) {
    return { clase: 'no_aplica', prioridad: 0, motivo: 'enunciado de marco intruso: la correcta NO está en el artículo por diseño' }
  }
  const antes = estaAnclada(estadoAntes)
  const despues = estaAnclada(estadoDespues)

  if (antes && despues) {
    return { clase: 'intacta', prioridad: 0, motivo: 'la clave seguía y sigue estando en el texto del artículo' }
  }
  if (!antes && despues) {
    return { clase: 'reparada', prioridad: 1, motivo: 'la clave NO estaba en el texto viejo y sí está en el oficial: el defecto era del texto, no de la pregunta' }
  }
  if (antes && !despues) {
    return { clase: 'rota', prioridad: 3, motivo: 'la clave estaba en el texto viejo y ha DEJADO de estar en el oficial: se apoyaba en la redacción no oficial' }
  }
  return { clase: 'ya_rota', prioridad: 2, motivo: 'la clave no estaba anclada ni antes ni ahora: no lo ha causado la reimportación' }
}

/** Reparto de una tanda por clase, para poder decir el número honesto. */
function resumirAnclajes(clases) {
  const por = { intacta: 0, reparada: 0, rota: 0, ya_rota: 0, no_aplica: 0 }
  for (const c of clases) por[c] = (por[c] || 0) + 1
  return por
}

module.exports = { clasificarAnclaje, estaAnclada, resumirAnclajes, ESTADOS_ANCLADOS }
