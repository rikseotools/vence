// lib/teoria/detectReflowedTable.cjs
//
// Tablas aplanadas que además se han RE-FLUIDO: el punto ciego de `detectFlattenedTable`.
//
// ── EL CHOQUE QUE LO MOTIVA (T-505, 03/08/2026) ────────────────────────────────────────────
// `detectFlattenedTable` busca **rachas de líneas cortas**, porque asume la salida cruda de
// `pdftotext` (cada celda en su renglón). Pero el manual de generación manda **RE-FLUIR** el
// texto del PDF antes de insertarlo —«un renglón físico no es un párrafo»—, porque si no la
// teoría se sirve a renglones sueltos. Al re-fluir, las celdas se pegan en un párrafo largo y
// desaparecen las líneas cortas: **el camino que el manual recomienda hace invisible el defecto
// que el detector persigue**. Medido con un caso real (Anexo I.2 de la Orden de 21/07/2026, la
// tabla de zonas y superficies de los centros de mayores): `detected:false` sobre el texto
// aplanado, que sin embargo era ilegible y no se podía preguntar sin adivinar filas.
//
// ── QUÉ MIRA ESTE NÚCLEO, Y POR QUÉ ESO ────────────────────────────────────────────────────
// Una tabla re-fluida conserva dos huellas que la prosa normativa no tiene:
//   1. **Cabeceras de columna en MAYÚSCULAS metidas dentro del párrafo** (`ESTANCIA`,
//      `ESPECIFICACIONES`, `SUPERFICIE MÍNIMA`, `OBSERVACIONES`…). En prosa de boletín las
//      mayúsculas sostenidas aparecen en rúbricas (TÍTULO, CAPÍTULO, ANEXO) o en siglas, no
//      encajadas a mitad de frase.
//   2. **La cabecera REPETIDA** dentro del mismo bloque: es lo que deja el salto de página de un
//      boletín, que reimprime la fila de encabezados en cada página de la tabla. Una rúbrica no
//      se repite; una cabecera de tabla larga, sí.
// La repetición es la señal fuerte y por eso pesa más que el simple recuento de mayúsculas.
//
// NO decide si la tabla está bien o mal reconstruida: dice que ESE TEXTO ERA UNA TABLA y hoy se
// sirve como párrafo. La reparación (reconstruirla con su rejilla) es humana, y la atribución de
// cada celda a su fila se hace por coordenadas del PDF, nunca a ojo.

/** Rúbricas de estructura y siglas frecuentes: mayúsculas que NO son cabecera de tabla. */
const RUBRICA = /^(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N|ANEXO|LIBRO|DISPOSICI[OÓ]N|PREÁMBULO|PREAMBULO)$/
const SIGLA_CORTA = 4 // por debajo de esto es sigla (BOE, IVA, ESO, RD…), no cabecera

/**
 * Palabras que, en mayúsculas y dentro de un párrafo, delatan una rejilla de tabla.
 *
 * ⚠️ LA LISTA SE PODÓ DESPUÉS DE MEDIR, y ese es el trabajo de verdad. La primera versión incluía
 * ZONA/ZONAS, PERSONAL, TOTAL, GRUPO y NIVEL, y su hallazgo de más impacto (78 preguntas servidas)
 * era un FALSO POSITIVO: un texto de esterilización que escribe en mayúsculas «ZONA SUCIA», «ZONA
 * LIMPIA» y «ZONA ESTÉRIL» por ÉNFASIS, no por ser columnas. Una palabra que la prosa usa igual que
 * una cabecera no sirve como señal, por muy tabular que suene.
 */
const CABECERA_TIPICA = /^(ESTANCIA|ESTANCIAS|ESPECIFICACIONES|ESPECIFICACI[OÓ]N|SUPERFICIE|OBSERVACIONES|EXCEPCIONES|CONCEPTOS|IMPORTES|CUANT[IÍ]A|GRUPOS|NIVELES|DENOMINACI[OÓ]N|CATEGOR[IÍ]A|CATEGOR[IÍ]AS|TIPOLOG[IÍ]A|RATIO)$/

/** Extrae los tokens en mayúsculas sostenidas de ≥ SIGLA_CORTA letras. */
function mayusculas(texto) {
  const out = []
  const re = /\b[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ]{2,}\b/g
  let m
  while ((m = re.exec(String(texto || ''))) !== null) {
    const t = m[0]
    if (t.length >= SIGLA_CORTA && !RUBRICA.test(t)) out.push(t)
  }
  return out
}

/**
 * @param {string|null|undefined} content
 * @returns {{detected: boolean, motivo: string|null, cabeceras: string[], repetidas: string[], parrafo: string|null}}
 */
function detectReflowedTable(content) {
  const nada = { detected: false, motivo: null, cabeceras: [], repetidas: [], parrafo: null }
  if (!content || !content.trim()) return nada
  // Si ya tiene rejilla markdown, está reconstruida: no es este defecto.
  if (/^\s*\|.*\|\s*$/m.test(content)) return nada

  const parrafos = content
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 200) // una cabecera suelta no es un párrafo-tabla

  for (const p of parrafos) {
    const may = mayusculas(p)
    if (!may.length) continue
    const tipicas = [...new Set(may.filter((t) => CABECERA_TIPICA.test(t)))]
    const cuenta = may.reduce((acc, t) => ((acc[t] = (acc[t] || 0) + 1), acc), {})
    const repetidas = Object.keys(cuenta).filter((t) => cuenta[t] >= 2 && CABECERA_TIPICA.test(t))

    // Señal FUERTE: la cabecera se repite dentro del mismo bloque → salto de página de la tabla.
    if (repetidas.length >= 2 && tipicas.length >= 2) {
      return { detected: true, motivo: 'la cabecera de la tabla se repite dentro del párrafo (salto de página del boletín)', cabeceras: tipicas, repetidas, parrafo: p.slice(0, 300) }
    }
    // Señal normal: varias cabeceras de columna encajadas en mitad de un párrafo largo.
    if (tipicas.length >= 3) {
      return { detected: true, motivo: 'varias cabeceras de columna en mayúsculas dentro de un párrafo corrido', cabeceras: tipicas, repetidas, parrafo: p.slice(0, 300) }
    }
  }
  return nada
}

module.exports = { detectReflowedTable, mayusculas, CABECERA_TIPICA }
