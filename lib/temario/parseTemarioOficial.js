'use strict'
/**
 * parseTemarioOficial.js — NÚCLEO PURO: partir el texto de un boletín en {nº de tema → epígrafe}.
 *
 * Lo usaba `scripts/verify-epigrafe-literality.cjs` (subcomando `dump`) con la función metida
 * dentro del script. Se saca aquí porque su salida alimenta una GUARDA —`epigrafeApply.js` exige
 * que el epígrafe propuesto sea **literalmente** el del boletín— y una guarda que se compara con
 * un parser sin tests solo es tan buena como el parser.
 *
 * ── EL FALLO QUE LO MOTIVA (30/07/2026) ─────────────────────────────────────
 * El marcador se localizaba con `\bTema\s+(\d{1,2})\b` y el cuerpo se cortaba justo después del
 * número. En los boletines que escriben «TEMA 22**.-** La Ley 9/2017…» —BORM, BOJA y la mayoría—
 * eso dejaba el separador pegado al principio del epígrafe:
 *
 *     oficial = ".- La Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público. …"
 *
 * Consecuencia: el texto oficial NUNCA coincidía con el texto que se quería escribir, así que la
 * guarda rechazaba la reescritura **de la oposición entera** con `epigrafe_no_literal`. El único
 * modo de avanzar era declarar los 24 temas como fuente «a mano» (`--fuente-manual`), que es
 * justo la vía reservada a los boletines que NO se pueden parsear: la acreditación automática se
 * degradaba a autocertificación por un artefacto de dos caracteres. Medido en Auxiliar
 * Administrativo del SMS: 21 de 24 temas rechazados, los 3 restantes solo porque ya venían por la
 * vía manual (arrastraban además el pie de página del BORM).
 *
 * ── LO QUE ESTE MÓDULO SÍ LIMPIA, Y LO QUE NO ───────────────────────────────
 * Limpia el **separador del marcador** (`.-`, `.–`, `:`, `-`, `.`), que es un artefacto de la
 * numeración y nunca contenido: ningún epígrafe empieza por un guion. NO intenta quitar pies de
 * página ni cabeceras de bloque («Parte específica», «NPE: A-071021-6104», «www.borm.es»), porque
 * son distintos en cada boletín y adivinarlos sí podría comerse texto real. Para eso está la vía
 * `oficial_manual` + `source_url`, que deja constancia de que la literalidad se acreditó a mano.
 */

/** Separadores que un boletín puede poner entre el número de tema y su enunciado. */
const SEPARADOR_INICIAL = /^[\s.\-–—:;)]+/

/**
 * Quita el separador que sigue al marcador «Tema N».
 * @param {string} cuerpo texto inmediatamente posterior al marcador
 * @returns {string}
 */
function limpiarSeparador(cuerpo) {
  return String(cuerpo == null ? '' : cuerpo).replace(SEPARADOR_INICIAL, '').trim()
}

/**
 * Parsea el temario oficial de un boletín ya convertido a texto plano.
 *
 * Cada tema va desde su marcador hasta el siguiente; el último se corta a 1200 caracteres para no
 * arrastrar el resto del documento. Si un mismo número aparece varias veces (índice + cuerpo, muy
 * común), gana el cuerpo MÁS LARGO, que es el desarrollado.
 *
 * @param {string} text texto del boletín
 * @returns {Object<number, string>} epígrafe por número de tema ({} si no parece un temario)
 */
function parseTemas(text) {
  const temas = {}
  const src = String(text == null ? '' : text)
  const markers = [...src.matchAll(/\bTema\s+(\d{1,2})\b/gi)]
  // Menos de 3 marcadores no es un temario, es una mención suelta a «tema».
  if (markers.length < 3) return temas
  for (let i = 0; i < markers.length; i++) {
    const n = parseInt(markers[i][1], 10)
    const start = markers[i].index + markers[i][0].length
    const end = i + 1 < markers.length ? markers[i + 1].index : Math.min(start + 1200, src.length)
    const body = limpiarSeparador(src.slice(start, end).replace(/\s+/g, ' ')).slice(0, 1000)
    if (!temas[n] || body.length > temas[n].length) temas[n] = body
  }
  return temas
}

module.exports = { parseTemas, limpiarSeparador, SEPARADOR_INICIAL }
