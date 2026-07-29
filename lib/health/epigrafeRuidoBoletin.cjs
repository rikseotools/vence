'use strict'
/**
 * ¿El texto de un epígrafe se ha traído incrustada la cabecera o el pie del PDF del boletín?
 *
 * ## Por qué existe (T-171)
 *
 * Al importar un temario desde el PDF de un boletín, el pie de página puede colarse **en mitad de
 * la frase**. Caso real en `ordenanza-ayuntamiento-cordoba`, tema 8:
 *
 *   «…Medidas preventivas y pautas de **de la Provincia Este documento es una copia electrónica…
 *    Fima automática 2F177891AA88… Nº 99 p. 7474** actuación ante incendios…»
 *
 * Y el tema 10 arrastraba el pie de firma entero. El barrido bank-wide del 27/07 encontró 4
 * epígrafes afectados; los 4 se corrigieron ese día. **Lo que faltaba es que no vuelva a entrar en
 * silencio**, que es lo que hace este detector.
 *
 * ## Por qué importa más de lo que parece
 *
 * La frecuencia es baja, pero envenena dos cosas caras:
 *   - la **verificación de literalidad** del epígrafe compara contra un texto que ya no es el del
 *     programa oficial, así que su veredicto no vale;
 *   - cualquier **adjudicación epígrafe↔scope por LLM** razona sobre basura, y lo hace en silencio.
 *
 * ## La guarda que no es opcional
 *
 * «Depósito legal» aparece en los pies de los boletines… y también es **materia legítima** en los
 * temarios de biblioteconomía y archivística. Fue la causa de 2 de los 4 «hallazgos» del barrido
 * del 27/07 — es decir, la mitad eran falsos positivos por ese solo término. Por eso aquí **no
 * dispara solo**: exige acompañarse de otro marcador de boletín. Un detector que marca un tema de
 * biblioteconomía por hablar de su materia se desactiva a la semana.
 *
 * Aquí solo vive la DECISIÓN, pura y testeable: quien llama pone los epígrafes.
 */

/**
 * Marcadores INEQUÍVOCOS de cabecera/pie de PDF de boletín. Ninguno de estos puede ser materia de
 * un temario: son artefactos de maquetación y de firma electrónica.
 */
const MARCADORES = [
  /copia electrónica de un documento/i,
  /código seguro de verificación/i,
  /powered by tcpdf/i,
  /\bfir?ma autom[áa]tica\b/i,            // `r?` a propósito: «Fima automática» es el OCR REAL del
                                          // caso de Córdoba, y un patrón que solo casara «firma» lo perdería
  /bolet[íi]n oficial de la provincia/i,
  /\bn[ºo]\s?\d{1,5}\s+p\.\s?\d{1,6}\b/i, // «Nº 99 p. 7474» — número de boletín + página
]

/**
 * Términos que aparecen en los pies de boletín pero que TAMBIÉN son materia legítima. Solo cuentan
 * si van acompañados de un marcador inequívoco.
 */
const AMBIGUOS = [
  /dep[óo]sito legal/i,
]

/**
 * Analiza el texto de un epígrafe.
 * @param {string|null|undefined} texto
 * @returns {{sucio: boolean, marcadores: string[], ambiguosIgnorados: string[]}}
 */
function analizarEpigrafe(texto) {
  const t = typeof texto === 'string' ? texto : ''
  const marcadores = []
  for (const re of MARCADORES) {
    const m = t.match(re)
    if (m) marcadores.push(m[0].trim())
  }
  const ambiguos = []
  for (const re of AMBIGUOS) {
    const m = t.match(re)
    if (m) ambiguos.push(m[0].trim())
  }
  // Los ambiguos SUMAN solo si ya hay un marcador inequívoco; solos, no acusan.
  const sucio = marcadores.length > 0
  return {
    sucio,
    marcadores: sucio ? [...marcadores, ...ambiguos] : [],
    ambiguosIgnorados: sucio ? [] : ambiguos,
  }
}

/**
 * Filtra una lista de epígrafes y devuelve los sucios con su evidencia.
 * @param {Array<{slug?: string, tema?: number|string, epigrafe?: string|null}>} filas
 */
function epigrafesSucios(filas) {
  const out = []
  for (const f of filas ?? []) {
    const r = analizarEpigrafe(f?.epigrafe)
    if (r.sucio) out.push({ ...f, marcadores: r.marcadores })
  }
  return out
}

module.exports = { analizarEpigrafe, epigrafesSucios, MARCADORES, AMBIGUOS }
