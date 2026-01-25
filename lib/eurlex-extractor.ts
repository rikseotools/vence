/**
 * lib/eurlex-extractor.ts
 * Extractor de artículos desde EUR-Lex (legislación europea)
 *
 * Soporta:
 * - TUE (Tratado de la Unión Europea)
 * - TFUE (Tratado de Funcionamiento de la Unión Europea)
 * - Otros documentos consolidados de EUR-Lex
 */

export interface ExtractedArticle {
  article_number: string
  title: string | null
  content: string
}

/**
 * Detecta si una URL es de EUR-Lex
 */
export function isEurLexUrl(url: string): boolean {
  return url.includes('eur-lex.europa.eu')
}

/**
 * Extrae los artículos del HTML de EUR-Lex
 *
 * Estructura típica de EUR-Lex:
 * - <p class="ti-art">Artículo X</p> - encabezado del artículo
 * - <p class="sti-art"> - subtítulo/referencia antiguo artículo
 * - <div id="XXX.YYY"> - apartados numerados
 * - <p class="normal"> - contenido
 *
 * @param html - HTML del documento EUR-Lex
 * @param options - Opciones de extracción
 * @param options.mainDocumentOnly - Si true, solo extrae artículos del documento principal (no protocolos)
 */
export function extractArticlesFromEurLex(
  html: string,
  options: { mainDocumentOnly?: boolean } = {}
): ExtractedArticle[] {
  const { mainDocumentOnly = true } = options
  const articles: ExtractedArticle[] = []
  const seenArticles = new Set<string>()

  // Regex para encontrar bloques de artículos con su ID
  // Captura: id del elemento, número de artículo, contenido hasta el siguiente artículo
  const articleRegex = /<p\s+id="([^"]+)"[^>]*class="ti-art"[^>]*>Artículo\s+(\d+)<\/p>([\s\S]*?)(?=<p\s+id="[^"]+"\s+class="ti-art"[^>]*>Artículo\s+\d+<\/p>|<p[^>]*class="ti-section-\d"[^>]*>|$)/gi

  let match
  while ((match = articleRegex.exec(html)) !== null) {
    const elementId = match[1]
    const articleNumber = match[2]
    const blockContent = match[3]

    // Filtrar protocolos si mainDocumentOnly está activo
    // Los IDs del documento principal terminan en "-1-1" (ej: d1e1102-1-1)
    // Los protocolos tienen otros números (ej: d1e113-201-1 para protocolo 1)
    if (mainDocumentOnly) {
      const idParts = elementId.split('-')
      if (idParts.length >= 3) {
        const docNumber = idParts[idParts.length - 2]
        if (docNumber !== '1') {
          // Es un protocolo, saltarlo
          continue
        }
      }
    }

    // Evitar duplicados (mismo número de artículo)
    if (seenArticles.has(articleNumber)) {
      continue
    }
    seenArticles.add(articleNumber)

    // Extraer título si existe (está en sti-art después del número)
    let title: string | null = null
    const titleMatch = blockContent.match(/<p[^>]*class="sti-art"[^>]*>([\s\S]*?)<\/p>/i)
    if (titleMatch) {
      // El título puede contener "(antiguo artículo X TUE)" o "(antiguos artículos...)" - lo limpiamos
      title = cleanHtmlText(titleMatch[1])
        .replace(/\(antiguo[^)]+\)/gi, '')
        .replace(/^\s*\(\d+\)\s*$/, '') // Eliminar referencias como "(2)"
        .trim()

      // Si solo era la referencia antigua o muy corto, no hay título real
      if (!title || title.length < 3) {
        title = null
      }
    }

    // Extraer contenido
    let content = blockContent
      // Eliminar el subtítulo (ya lo procesamos)
      .replace(/<p[^>]*class="sti-art"[^>]*>[\s\S]*?<\/p>/gi, '')
      // Convertir párrafos a saltos de línea
      .replace(/<\/p>/gi, '\n\n')
      // Convertir divs de apartados a saltos de línea
      .replace(/<\/div>/gi, '\n')
      // Eliminar otras etiquetas HTML
      .replace(/<[^>]*>/g, '')
      // Limpiar espacios múltiples
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/^ +| +$/gm, '')
      .trim()

    // Decodificar entidades HTML
    content = decodeHtmlEntities(content)

    // Solo añadir si tiene contenido significativo
    if (content.length > 10) {
      articles.push({
        article_number: articleNumber,
        title,
        content
      })
    }
  }

  // Ordenar por número de artículo
  articles.sort((a, b) => {
    const numA = parseInt(a.article_number) || 0
    const numB = parseInt(b.article_number) || 0
    return numA - numB
  })

  return articles
}

/**
 * Limpia texto HTML eliminando etiquetas y espacios extra
 */
function cleanHtmlText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Decodifica entidades HTML comunes
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&ndash;': '–',
    '&mdash;': '—',
    '&laquo;': '«',
    '&raquo;': '»',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&deg;': '°',
    '&sup2;': '²',
    '&sup3;': '³',
    '&frac12;': '½',
    '&frac14;': '¼',
    '&frac34;': '¾',
  }

  let result = text
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char)
  }

  // Decodificar entidades numéricas (&#123; o &#x1F;)
  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)))
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))

  return result
}

/**
 * Normaliza número de artículo para comparación
 */
export function normalizeArticleNumber(num: string): string {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extrae artículos de una URL de EUR-Lex
 * Wrapper que descarga el HTML y extrae los artículos
 */
export async function fetchAndExtractFromEurLex(url: string): Promise<{
  success: boolean
  articles?: ExtractedArticle[]
  error?: string
}> {
  try {
    console.log(`📥 [EurLex] Descargando desde: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Error HTTP ${response.status}: ${response.statusText}`
      }
    }

    const html = await response.text()
    const articles = extractArticlesFromEurLex(html)

    console.log(`📄 [EurLex] Artículos extraídos: ${articles.length}`)

    return {
      success: true,
      articles
    }

  } catch (error) {
    console.error('❌ [EurLex] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
