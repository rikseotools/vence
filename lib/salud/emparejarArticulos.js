/**
 * Núcleo PURO — emparejar los artículos de dos filas de `laws` que son la MISMA
 * norma, para consolidarlas (T-127).
 *
 * POR QUÉ NO VALE COMPARAR EL NÚMERO A PELO
 * -----------------------------------------
 * El `article_number` es TEXTO libre y cada importación escribió el suyo. Caso
 * real (RDL 670/1987, Clases Pasivas): una fila llama al artículo **"37 quater"**
 * y la otra **"37 quáter"** — un acento de diferencia, el mismo precepto, los
 * mismos 1.227 caracteres de contenido. Un emparejamiento por igualdad exacta lo
 * da por inexistente y aborta la consolidación entera; peor sería que alguien
 * "arreglara" eso a mano en producción.
 *
 * Qué se normaliza, y por qué solo esto: acentos, mayúsculas, espacios repetidos
 * y puntuación de relleno. **No** se normalizan los ordinales (bis/ter/quater no
 * se tocan) ni los números: "37 bis" y "37 ter" son artículos DISTINTOS y
 * confundirlos movería preguntas a un precepto que no es el suyo. La
 * normalización agresiva es exactamente el error que este módulo evita.
 *
 * AMBIGÜEDAD = NO EMPAREJAR. Si dos artículos de la fila viva normalizan a la
 * misma clave, no hay forma de saber cuál es el bueno: se marcan como ambiguos y
 * el llamante decide. Adivinar aquí es mover contenido a ciegas.
 */

/**
 * Clave de comparación de un `article_number`.
 * @param {string} n
 * @returns {string}
 */
function claveNumero(n) {
  return String(n || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes/diéresis, no letras
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Empareja artículos de la fila muerta contra los de la superviviente.
 *
 * @param {Array<{id:string, article_number:string}>} muerta
 * @param {Array<{id:string, article_number:string}>} viva
 * @returns {{
 *   mapeo: Array<{de:object, a:object, exacto:boolean}>,
 *   soloEnMuerta: Array<object>,
 *   ambiguos: Array<{articulo:object, candidatos:Array<object>}>
 * }}
 *   - `mapeo.exacto=false` marca los emparejados SOLO tras normalizar: hay que
 *     enseñarlos, porque son los que un humano querría revisar.
 *   - `soloEnMuerta`: sin pareja. No es necesariamente un error — puede ser un
 *     artículo que la otra importación no trajo (p.ej. el preámbulo) y que
 *     conviene re-parentar en lugar de abortar.
 */
function emparejarArticulos(muerta, viva) {
  const porClave = new Map()
  for (const a of viva) {
    const k = claveNumero(a.article_number)
    if (!porClave.has(k)) porClave.set(k, [])
    porClave.get(k).push(a)
  }

  const mapeo = []
  const soloEnMuerta = []
  const ambiguos = []
  for (const a of muerta) {
    const k = claveNumero(a.article_number)
    const cand = porClave.get(k) || []
    if (cand.length === 0) {
      soloEnMuerta.push(a)
    } else if (cand.length > 1) {
      ambiguos.push({ articulo: a, candidatos: cand })
    } else {
      mapeo.push({ de: a, a: cand[0], exacto: a.article_number === cand[0].article_number })
    }
  }
  return { mapeo, soloEnMuerta, ambiguos }
}

module.exports = { claveNumero, emparejarArticulos }
