// lib/laws/sourceExtractor.ts
//
// Extractor del INVENTARIO de artículos de un documento-fuente (BOE o boletín
// autonómico BOCYL/DOGV/DOG/BOJA/BOCM…), para la Capa 3 del sistema de
// completitud de leyes. Es la lógica PURA (sin fetch): recibe el texto ya
// descargado (de un PDF vía pdftotext, o HTML crudo sin tags) y devuelve el
// conjunto de números de artículo presentes.
//
// FUENTE ÚNICA del criterio. `scripts/verify-law-source.cjs` lleva un mirror
// inline (self-contained); mantener EN SYNC — el test fija las fixtures.
//
// Formatos que reconoce (heterogeneidad real de boletines):
//   "Artículo 29.–"  "Artículo. 43.–"  "Artículo. 43. Bis.–"
//   "Artículo 63 bis.–"  "Artículo 47. "  "Artículo 18 ter.-"

const ART_RE = /Artículo\.?\s+(\d+)\.?\s*([Bb]is|[Tt]er)?\.?\s*[–.-]/g

/** Normaliza un número de artículo para comparar (BD vs fuente). */
export function normalizeArticleNumber(s: string | null | undefined): string {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Extrae el conjunto de números de artículo presentes en el texto-fuente. */
export function extractArticleNumbers(text: string | null | undefined): Set<string> {
  const nums = new Set<string>()
  if (!text) return nums
  ART_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ART_RE.exec(text)) !== null) {
    nums.add((m[1] + (m[2] ? ' ' + m[2].toLowerCase() : '')).trim())
  }
  return nums
}

export interface SourceComparison {
  srcCount: number
  dbCount: number
  /** números presentes en la fuente que faltan en BD */
  missing: string[]
  verdict: 'verified' | 'incomplete'
  /** true si la fuente NO parece un articulado (no se puede juzgar por artículos) */
  unparseable: boolean
}

/**
 * Compara el inventario de la fuente contra los números de artículo en BD.
 * Determinista y puro. `MIN_ARTICLES` evita juzgar textos sin articulado
 * (planes, estrategias, protocolos) como "incompletos" — se marcan unparseable.
 */
export function compareSourceToDb(
  sourceText: string | null | undefined,
  dbArticleNumbers: Array<string | null | undefined>,
  MIN_ARTICLES = 3,
): SourceComparison {
  const src = extractArticleNumbers(sourceText)
  const db = new Set(dbArticleNumbers.map(normalizeArticleNumber).filter(Boolean))
  if (src.size < MIN_ARTICLES) {
    return { srcCount: src.size, dbCount: db.size, missing: [], verdict: 'verified', unparseable: true }
  }
  const missing = [...src].filter((n) => !db.has(normalizeArticleNumber(n)))
  return {
    srcCount: src.size,
    dbCount: db.size,
    missing,
    verdict: missing.length > 0 ? 'incomplete' : 'verified',
    unparseable: false,
  }
}
