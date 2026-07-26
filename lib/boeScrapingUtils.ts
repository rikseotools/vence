/**
 * Utilidades para scraping del BOE
 * Extraídas de /app/api/verify-articles/route.js para testing
 */

interface CompareResult {
  match: boolean
  similarity: number
}

interface ExtractedArticle {
  article_number: string
  title: string | null
  content: string
}

interface ParsedArticle {
  base: number
  suffix: number
  subnum: number
}

/**
 * Convierte texto de número español a dígito. Ej: "primero" -> "1",
 * "ciento ochenta y siete bis" -> "187 bis".
 *
 * La implementación vive en `lib/laws/spanishNumber.js` (JS plano) para que puedan
 * compartirla TAMBIÉN los scripts `.cjs`, que no pueden importar un `.ts`. Antes esta
 * función estaba copiada en cuatro sitios y las copias se separaron: esta llegaba solo
 * hasta "trescientos", y por eso la LOPJ —713 artículos en palabras, hasta "setecientos
 * trece"— quedaba fuera de las auditorías contra el BOE (T-132, 26/07/2026).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const spanishTextToNumber: (text: string | null | undefined) => string | null =
  require('./laws/spanishNumber').spanishTextToNumber

/**
 * Normaliza número de artículo para comparación
 * Ej: "55bis" → "55 bis", "4 BIS" → "4 bis", "22 quáter" → "22 quater", "216 bis 2" → "216 bis 2"
 */
export function normalizeArticleNumber(num: string | null | undefined): string {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater') // Normalizar variante con acento
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(\s*\d+)?/gi, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza texto para comparación
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[.,;:()"\-]/g, '') // Quitar puntuación
    .replace(/\s+/g, ' ') // Normalizar espacios
    .trim()
}

/**
 * Compara dos textos de contenido y determina si son similares
 * Usa un umbral de similitud para permitir pequeñas diferencias
 */
export function compareContent(boeContent: string, dbContent: string): CompareResult {
  const boeNorm = normalizeText(boeContent)
  const dbNorm = normalizeText(dbContent)

  if (boeNorm === dbNorm) {
    return { match: true, similarity: 100 }
  }

  // Calcular similitud básica (porcentaje de palabras comunes)
  const boeWords = new Set(boeNorm.split(' ').filter(w => w.length > 2))
  const dbWords = new Set(dbNorm.split(' ').filter(w => w.length > 2))

  if (boeWords.size === 0 || dbWords.size === 0) {
    return { match: false, similarity: 0 }
  }

  let commonWords = 0
  for (const word of boeWords) {
    if (dbWords.has(word)) commonWords++
  }

  const similarity = Math.round((commonWords / Math.max(boeWords.size, dbWords.size)) * 100)

  // Consideramos "match" si la similitud es > 95%
  return {
    match: similarity > 95,
    similarity
  }
}

/**
 * Extrae los artículos del HTML del BOE (título Y contenido)
 */
export function extractArticlesFromBOE(html: string): ExtractedArticle[] {
  const articles: ExtractedArticle[] = []

  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a|art)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]

    let articleNumber: string | null = null
    let title = ''

    // Formato numérico: "Artículo 1.", "Art. 1.", "Artículo 4 bis.", etc.
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([^<]*)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      title = numericMatch[2]?.trim().replace(/\.$/, '') || ''
    } else {
      // Formato texto: "Artículo primero", "Art. primero", etc.
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+([^<]+)<\/h5>/i)
      if (textMatch) {
        let textContent = textMatch[1].trim()

        const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
        if (titleSeparatorMatch) {
          textContent = titleSeparatorMatch[1].trim()
          title = titleSeparatorMatch[2].trim().replace(/\.$/, '')
        }

        const converted = spanishTextToNumber(textContent)
        if (converted) {
          articleNumber = converted
        }
      }
    }

    if (!articleNumber) {
      continue
    }

    // Extraer contenido
    const content = blockContent
      .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '')
      .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '')
      .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '')
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
      .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<span[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
      .replace(/<div[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/Jurisprudencia/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^ +| +$/gm, '')
      .trim()

    articles.push({
      article_number: articleNumber,
      title: title || null,
      content: content
    })
  }

  // Ordenar por número de artículo
  const suffixOrder: Record<string, number> = { '': 0, 'bis': 1, 'ter': 2, 'quater': 3, 'quinquies': 4, 'sexies': 5, 'septies': 6, 'octies': 7, 'nonies': 8, 'decies': 9 }
  articles.sort((a, b) => {
    const parseArticle = (num: string): ParsedArticle => {
      const norm = num.replace(/quáter/gi, 'quater')
      const m = norm.match(/^(\d+)(?:\s+([a-z]+))?(?:\s+(\d+))?$/i)
      if (!m) return { base: 0, suffix: 0, subnum: 0 }
      return {
        base: parseInt(m[1]) || 0,
        suffix: suffixOrder[m[2]?.toLowerCase() || ''] || 0,
        subnum: parseInt(m[3]) || 0
      }
    }
    const parsedA = parseArticle(a.article_number)
    const parsedB = parseArticle(b.article_number)
    if (parsedA.base !== parsedB.base) return parsedA.base - parsedB.base
    if (parsedA.suffix !== parsedB.suffix) return parsedA.suffix - parsedB.suffix
    return parsedA.subnum - parsedB.subnum
  })

  return articles
}
