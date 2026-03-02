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
 * Artículo extraído de un Protocolo anexo a TUE/TFUE
 */
export interface ExtractedProtocolArticle extends ExtractedArticle {
  protocol_number: number
  protocol_name: string
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
 * - <p class="ti-art">Artículo X</p> - encabezado del artículo (TUE/TFUE consolidado)
 * - <p class="oj-ti-art">Artículo X</p> - encabezado del artículo (Reglamentos/Decisiones DOUE)
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
  // Soporta tanto class="ti-art" (TUE/TFUE) como class="oj-ti-art" (Reglamentos DOUE)
  // Captura: id del elemento, número de artículo, contenido hasta el siguiente artículo
  const articleRegex = /<p\s+id="([^"]+)"[^>]*class="(?:oj-)?ti-art"[^>]*>Artículo\s+(\d+)[^<]*<\/p>([\s\S]*?)(?=<p\s+id="[^"]+"\s+class="(?:oj-)?ti-art"[^>]*>Artículo\s+\d+|<p[^>]*class="ti-section-\d"[^>]*>|$)/gi

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

// ============================================
// EXTRACCIÓN DE PROTOCOLOS
// ============================================

/**
 * Mapeo de números de documento EUR-Lex a números de protocolo
 * Los protocolos en EUR-Lex tienen IDs como "d1e123-201-1" donde 201 = Protocolo 1
 * Offset: docNumber - 200 = número de protocolo
 */
const PROTOCOL_DOC_OFFSET = 200

/**
 * Nombres de los protocolos más relevantes anexos a TUE/TFUE
 */
const PROTOCOL_NAMES: Record<number, string> = {
  1: 'Protocolo sobre el cometido de los Parlamentos nacionales en la UE',
  2: 'Protocolo sobre la aplicación de los principios de subsidiariedad y proporcionalidad',
  3: 'Protocolo sobre el Estatuto del Tribunal de Justicia de la Unión Europea',
  4: 'Protocolo sobre los Estatutos del SEBC y del BCE',
  5: 'Protocolo sobre los Estatutos del Banco Europeo de Inversiones',
  6: 'Protocolo sobre la fijación de las sedes de las instituciones',
  7: 'Protocolo sobre los privilegios e inmunidades de la UE',
  // Añadir más según necesidad
}

/**
 * Extrae artículos de los Protocolos anexos a TUE/TFUE desde HTML de EUR-Lex
 *
 * EUR-Lex estructura los protocolos así:
 * - Todos los protocolos tienen IDs con "-201-1" (sección de protocolos)
 * - Cada protocolo empieza con: <p class="doc-ti">PROTOCOLO (Nº X)</p>
 * - Los artículos tienen class="ti-art"
 *
 * @param html - HTML del documento EUR-Lex consolidado (TUE + TFUE + Protocolos)
 * @param options - Opciones de extracción
 * @param options.protocols - Lista de números de protocolo a extraer (ej: [3, 6]). Si no se especifica, extrae todos.
 * @returns Array de artículos de protocolos con su número de protocolo
 */
export function extractProtocolsFromEurLex(
  html: string,
  options: { protocols?: number[] } = {}
): ExtractedProtocolArticle[] {
  const { protocols: targetProtocols } = options
  const articles: ExtractedProtocolArticle[] = []

  // Paso 1: Encontrar todas las posiciones de los encabezados de protocolo
  // Formato: <p class="doc-ti" id="...">PROTOCOLO (N<span class="super">o</span> X)</p>
  // También soporta: PROTOCOLO (Nº X) o PROTOCOLO (N° X)
  const protocolHeaderRegex = /<p[^>]*class="doc-ti"[^>]*>PROTOCOLO\s*\(N(?:<span[^>]*>o<\/span>|[°oº])\s*(\d+)\)<\/p>/gi
  const protocolPositions: Array<{ number: number; start: number; end: number }> = []

  let headerMatch
  while ((headerMatch = protocolHeaderRegex.exec(html)) !== null) {
    const protocolNum = parseInt(headerMatch[1])
    protocolPositions.push({
      number: protocolNum,
      start: headerMatch.index,
      end: 0 // Se calcula después
    })
  }

  // Calcular el final de cada protocolo (inicio del siguiente)
  for (let i = 0; i < protocolPositions.length; i++) {
    if (i < protocolPositions.length - 1) {
      protocolPositions[i].end = protocolPositions[i + 1].start
    } else {
      protocolPositions[i].end = html.length
    }
  }

  // Paso 2: Para cada protocolo de interés, extraer sus artículos
  for (const proto of protocolPositions) {
    // Filtrar por protocolos específicos si se indicaron
    if (targetProtocols && !targetProtocols.includes(proto.number)) {
      continue
    }

    const protocolHtml = html.substring(proto.start, proto.end)
    const seenArticles = new Set<string>()

    // Buscar artículos dentro de este protocolo
    // Soporta: "Artículo 1", "Artículo único", "Artículo primero"
    const articleRegex = /<p[^>]*class="ti-art"[^>]*>Artículo\s+([\wúÚ]+)<\/p>([\s\S]*?)(?=<p[^>]*class="ti-art"[^>]*>Artículo\s+[\wúÚ]+<\/p>|<p[^>]*class="doc-ti"[^>]*>|<p[^>]*class="ti-section-\d"[^>]*>|$)/gi

    let articleMatch
    while ((articleMatch = articleRegex.exec(protocolHtml)) !== null) {
      let articleNumber = articleMatch[1]
      const blockContent = articleMatch[2]

      // Normalizar "único" a "único" (artículo único)
      if (articleNumber.toLowerCase() === 'único') {
        articleNumber = 'único'
      }

      // Evitar duplicados
      if (seenArticles.has(articleNumber)) continue
      seenArticles.add(articleNumber)

      // Extraer título si existe
      let title: string | null = null
      const titleMatch = blockContent.match(/<p[^>]*class="sti-art"[^>]*>([\s\S]*?)<\/p>/i)
      if (titleMatch) {
        title = cleanHtmlText(titleMatch[1])
          .replace(/\(antiguo[^)]+\)/gi, '')
          .replace(/^\s*\(\d+\)\s*$/, '')
          .trim()
        if (!title || title.length < 3) title = null
      }

      // Extraer contenido
      let content = blockContent
        .replace(/<p[^>]*class="sti-art"[^>]*>[\s\S]*?<\/p>/gi, '')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/^ +| +$/gm, '')
        .trim()

      content = decodeHtmlEntities(content)

      if (content.length > 10) {
        articles.push({
          article_number: articleNumber,
          title,
          content,
          protocol_number: proto.number,
          protocol_name: PROTOCOL_NAMES[proto.number] || `Protocolo nº ${proto.number}`
        })
      }
    }
  }

  // Ordenar por protocolo y luego por artículo
  articles.sort((a, b) => {
    if (a.protocol_number !== b.protocol_number) {
      return a.protocol_number - b.protocol_number
    }
    return (parseInt(a.article_number) || 0) - (parseInt(b.article_number) || 0)
  })

  return articles
}

/**
 * Extrae artículos de protocolos desde una URL de EUR-Lex
 *
 * @param url - URL del documento consolidado EUR-Lex
 * @param protocols - Lista de protocolos a extraer (ej: [3, 6] para Estatuto TJUE y Sedes)
 */
export async function fetchAndExtractProtocolsFromEurLex(
  url: string,
  protocols?: number[]
): Promise<{
  success: boolean
  articles?: ExtractedProtocolArticle[]
  summary?: Record<number, number>
  error?: string
}> {
  try {
    console.log(`📥 [EurLex/Protocolos] Descargando desde: ${url}`)

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
    const articles = extractProtocolsFromEurLex(html, { protocols })

    // Generar resumen por protocolo
    const summary: Record<number, number> = {}
    for (const art of articles) {
      summary[art.protocol_number] = (summary[art.protocol_number] || 0) + 1
    }

    console.log(`📄 [EurLex/Protocolos] Artículos extraídos: ${articles.length}`)
    for (const [pNum, count] of Object.entries(summary)) {
      console.log(`   - Protocolo ${pNum}: ${count} artículos`)
    }

    return {
      success: true,
      articles,
      summary
    }

  } catch (error) {
    console.error('❌ [EurLex/Protocolos] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
