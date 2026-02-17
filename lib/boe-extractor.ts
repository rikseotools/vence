/**
 * Utilidades compartidas para extracción de artículos del BOE
 */

export interface ExtractedArticle {
  article_number: string
  title: string | null
  content: string
}

export interface ExtractionOptions {
  includeDisposiciones?: boolean
}

export interface ContentComparison {
  match: boolean
  similarity: number
}

/**
 * Convierte texto de número español a dígito
 * Soporta desde "primero" hasta "trescientos y pico"
 * También soporta sufijos: "bis", "ter", "quater", etc.
 */
export function spanishTextToNumber(text: string | null | undefined): string | null {
  if (!text) return null

  text = text.replace(/\.+$/, '').trim()

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  const mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  const ordinals: Record<string, number> = {
    'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5,
    'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9,
    'décimo': 10, 'decimo': 10, 'undécimo': 11, 'undecimo': 11,
    'duodécimo': 12, 'duodecimo': 12, 'decimotercero': 13, 'decimocuarto': 14,
    'decimoquinto': 15, 'decimosexto': 16, 'decimoséptimo': 17, 'decimoseptimo': 17,
    'decimooctavo': 18, 'decimonoveno': 19, 'vigésimo': 20, 'vigesimo': 20
  }

  const units: Record<string, number> = {
    'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
  }

  const teens: Record<string, number> = {
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17,
    'dieciocho': 18, 'diecinueve': 19
  }

  const twenties: Record<string, number> = {
    'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22,
    'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28,
    'veintinueve': 29
  }

  const tens: Record<string, number> = {
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
    'setenta': 70, 'ochenta': 80, 'noventa': 90
  }

  const hundreds: Record<string, number> = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
    'trescientos': 300, 'trescientas': 300
  }

  function convertPart(str: string): number | null {
    str = str.toLowerCase().trim()
    if (ordinals[str]) return ordinals[str]
    if (units[str]) return units[str]
    if (teens[str]) return teens[str]
    if (twenties[str]) return twenties[str]
    if (tens[str]) return tens[str]

    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i)
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0
      const unitValue = units[tensCompound[2].toLowerCase()] || 0
      if (tenValue && unitValue) return tenValue + unitValue
    }

    if (hundreds[str]) return hundreds[str]
    return null
  }

  const directConversion = convertPart(normalized)
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion)
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i)
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2])
      if (rest !== null) {
        const total = hundredValue + rest
        return suffix ? `${total} ${suffix}` : String(total)
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue)
  }

  return null
}

/**
 * Extrae los artículos del HTML del BOE (título Y contenido)
 * Soporta múltiples formatos de BOE:
 * - id="a1", id="art1" (estándar)
 * - id="auno", id="ados" (leyes antiguas como Ley 30/1984)
 * - id="regla1", id="regla2" (órdenes/instrucciones)
 * - id="primero", id="segundo" (ordinales)
 * - id="da", id="da-2" (disposiciones adicionales)
 * - id="dt", id="dt-2" (disposiciones transitorias)
 * - id="dd", id="dd-2" (disposiciones derogatorias)
 * - id="df", id="df-2" (disposiciones finales)
 * - id="primera", id="segunda-2" (CE-style ordinales femeninos)
 * - Headers: "Artículo X", "Art. X", "Regla X", "X." (solo número)
 */
export function extractArticlesFromBOE(html: string, options: ExtractionOptions = {}): ExtractedArticle[] {
  const { includeDisposiciones = false } = options
  const articles: ExtractedArticle[] = []

  // Regex flexible para capturar TODOS los bloques de artículos
  // Disposiciones estándar: da, da-2, dt, dt-3, dd, dd-2, df, df-5
  // Disposiciones CE: primera, segunda-2, tercera, cuarta-2, quinta, etc. (ordinales con sufijo)
  const disposicionPatternStd = includeDisposiciones ? '|da(?:-\\d+)?|dt(?:-\\d+)?|dd(?:-\\d+)?|df(?:-\\d+)?' : ''
  const disposicionPatternOrdinals = includeDisposiciones ? '|primera(?:-\\d+)?|segunda(?:-\\d+)?|tercera(?:-\\d+)?|cuarta(?:-\\d+)?|quinta(?:-\\d+)?|sexta(?:-\\d+)?|s[eé]ptima(?:-\\d+)?|octava(?:-\\d+)?|novena(?:-\\d+)?|d[eé]cima(?:-\\d+)?' : ''

  const articleBlockRegex = new RegExp(
    `<div[^>]*class="bloque"[^>]*id="(a[a-z0-9]+|regla\\d+|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo${disposicionPatternStd}${disposicionPatternOrdinals})[^"]*"[^>]*>([\\s\\S]*?)(?=<div[^>]*class="bloque"|$)`,
    'gi'
  )

  let match: RegExpExecArray | null
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockId = match[1]
    const blockContent = match[2]
    let articleNumber: string | null = null
    let title = ''

    // Patrón 0 (Disposiciones): "Disposición adicional primera. Título"
    // Soporta IDs estándar (da, dt, dd, df) y CE-style (primera, segunda-2, etc.)
    const isDisposicionIdStd = /^d[aftd](?:-\d+)?$/i.test(blockId)
    const isDisposicionIdOrdinal = /^(primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima)(?:-\d+)?$/i.test(blockId)

    if (includeDisposiciones && (isDisposicionIdStd || isDisposicionIdOrdinal)) {
      // Patrón con ordinal: "Disposición adicional primera. Título"
      const dispMatchWithOrdinal = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Disposici[oó]n\s+(adicional|transitoria|derogatoria|final)\s+([\s\S]*?)<\/h5>/i)
      // Patrón sin ordinal: "Disposición derogatoria." o "Disposición final."
      const dispMatchWithoutOrdinal = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Disposici[oó]n\s+(derogatoria|final)\.?<\/h5>/i)

      if (dispMatchWithOrdinal) {
        const dispType = dispMatchWithOrdinal[1].toLowerCase()
        const restText = dispMatchWithOrdinal[2].replace(/<[^>]*>/g, '').trim()

        // Separar ordinal del título
        const titleSep = restText.match(/^(.+?)\.\s+(.+?)\.?$/)
        let ordinalText: string
        if (titleSep) {
          ordinalText = titleSep[1].trim()
          title = titleSep[2].trim().replace(/\.$/, '')
        } else {
          ordinalText = restText.replace(/\.$/, '').trim()
          title = ''
        }

        // Convertir ordinal a código
        const ordinalToNumber: Record<string, string> = {
          'primera': '1', 'segunda': '2', 'tercera': '3', 'cuarta': '4',
          'quinta': '5', 'sexta': '6', 'séptima': '7', 'septima': '7',
          'octava': '8', 'novena': '9', 'décima': '10', 'decima': '10',
          'única': 'unica'
        }
        const ordinalClean = ordinalText.toLowerCase().trim()
        const ordinalNum = ordinalToNumber[ordinalClean] || ordinalClean.replace(/\s+/g, '_')

        // Códigos: DA1, DA2 (adicionales), DT1, DT2 (transitorias), DD (derogatoria), DF (final)
        const typeCode = dispType === 'adicional' ? 'DA' :
                         dispType === 'transitoria' ? 'DT' :
                         dispType === 'derogatoria' ? 'DD' :
                         dispType === 'final' ? 'DF' : 'D'

        articleNumber = `${typeCode}${ordinalNum}`
      } else if (dispMatchWithoutOrdinal) {
        // Disposición sin ordinal (derogatoria o final única)
        const dispType = dispMatchWithoutOrdinal[1].toLowerCase()
        const typeCode = dispType === 'derogatoria' ? 'DD' : 'DF'
        articleNumber = typeCode // Sin número: DD, DF
        title = `Disposición ${dispType}`
      }
    }

    // Patrón 1: "Artículo X", "Art. X", "Regla X" con número
    if (!articleNumber) {
      const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?|Regla)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([\s\S]*?)<\/h5>/i)

      if (numericMatch) {
        articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
        title = (numericMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
      }
    }

    // Patrón 2: Solo número "1.", "2. Título"
    if (!articleNumber) {
      const simpleMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(\d+)\.?\s*([\s\S]*?)<\/h5>/i)
      if (simpleMatch) {
        articleNumber = simpleMatch[1].trim()
        title = (simpleMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
      }
    }

    // Patrón 3: Texto "Artículo primero", "Artículo ciento uno"
    if (!articleNumber) {
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?|Regla)\s+([\s\S]*?)<\/h5>/i)
      if (textMatch) {
        let textContent = textMatch[1].replace(/<[^>]*>/g, '').trim()
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

    // Patrón 4: Ordinales sin "Artículo"
    if (!articleNumber) {
      const ordinalMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(Primero|Segundo|Tercero|Cuarto|Quinto|Sexto|S[ée]ptimo|Octavo|Noveno|D[ée]cimo|Und[ée]cimo|Duod[ée]cimo|Decimotercero|Decimocuarto|Decimoquinto|Decimosexto|Decimos[ée]ptimo|Decimooctavo|Decimonoveno|Vig[ée]simo)\.?\s*([\s\S]*?)<\/h5>/i)
      if (ordinalMatch) {
        const converted = spanishTextToNumber(ordinalMatch[1])
        if (converted) {
          articleNumber = converted
          title = (ordinalMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
        }
      }
    }

    if (!articleNumber) continue

    // Extraer y limpiar contenido
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

    // Filtrar artículos suprimidos
    if (content.includes('(Suprimido)') || content.includes('(SUPRIMIDO)')) {
      continue
    }

    articles.push({
      article_number: articleNumber,
      title: title || null,
      content: content
    })
  }

  // Ordenar por número de artículo
  const suffixOrder: Record<string, number> = { '': 0, 'bis': 1, 'ter': 2, 'quater': 3, 'quinquies': 4, 'sexies': 5, 'septies': 6, 'octies': 7, 'nonies': 8, 'decies': 9 }
  const dispTypeOrder: Record<string, number> = { 'adicional': 1, 'transitoria': 2, 'derogatoria': 3, 'final': 4 }
  const feminineOrdinals: Record<string, number> = {
    'unica': 1, 'única': 1,
    'primera': 1, 'segunda': 2, 'tercera': 3, 'cuarta': 4, 'quinta': 5,
    'sexta': 6, 'septima': 7, 'séptima': 7, 'octava': 8, 'novena': 9,
    'decima': 10, 'décima': 10, 'undecima': 11, 'undécima': 11,
    'duodecima': 12, 'duodécima': 12, 'decimotercera': 13, 'decimocuarta': 14,
    'decimoquinta': 15, 'decimosexta': 16, 'decimoseptima': 17, 'decimoséptima': 17,
    'decimoctava': 18, 'decimooctava': 18, 'decimonovena': 19,
    'vigesima': 20, 'vigésima': 20,
    'vigesimoprimera': 21, 'vigesimosegunda': 22, 'vigesimotercera': 23
  }
  const feminineTens: Record<string, number> = {
    'vigesima': 20, 'vigésima': 20, 'trigesima': 30, 'trigésima': 30,
    'cuadragesima': 40, 'cuadragésima': 40
  }

  const feminineOrdinalToNumber = (text: string): number => {
    const clean = text.replace(/_/g, ' ').toLowerCase().trim()
    if (feminineOrdinals[clean]) return feminineOrdinals[clean]
    const parts = clean.split(' ')
    if (parts.length === 2 && feminineTens[parts[0]] && feminineOrdinals[parts[1]]) {
      return feminineTens[parts[0]] + feminineOrdinals[parts[1]]
    }
    return 999
  }

  articles.sort((a, b) => {
    const isDispA = a.article_number.startsWith('DA') || a.article_number.startsWith('DT') ||
                    a.article_number.startsWith('DD') || a.article_number.startsWith('DF')
    const isDispB = b.article_number.startsWith('DA') || b.article_number.startsWith('DT') ||
                    b.article_number.startsWith('DD') || b.article_number.startsWith('DF')

    if (!isDispA && !isDispB) {
      const parseArticle = (num: string) => {
        const normalized = num.replace(/quáter/gi, 'quater')
        const match = normalized.match(/^(\d+)(?:\s+([a-z]+))?(?:\s+(\d+))?$/i)
        if (!match) return { base: 0, suffix: 0, subnum: 0 }
        return {
          base: parseInt(match[1]) || 0,
          suffix: suffixOrder[match[2]?.toLowerCase() || ''] || 0,
          subnum: parseInt(match[3]) || 0
        }
      }
      const parsedA = parseArticle(a.article_number)
      const parsedB = parseArticle(b.article_number)
      if (parsedA.base !== parsedB.base) return parsedA.base - parsedB.base
      if (parsedA.suffix !== parsedB.suffix) return parsedA.suffix - parsedB.suffix
      return parsedA.subnum - parsedB.subnum
    }

    if (!isDispA && isDispB) return -1
    if (isDispA && !isDispB) return 1

    // Ambas disposiciones: ordenar por tipo, luego por ordinal
    const parseDisp = (num: string) => {
      const match = num.match(/^(DA|DT|DD|DF)(.+)$/)
      if (!match) return { type: 0, ordinal: 0 }
      const typeOrder: Record<string, number> = { 'DA': 1, 'DT': 2, 'DD': 3, 'DF': 4 }
      const ordNum = parseInt(match[2]) || feminineOrdinalToNumber(match[2])
      return {
        type: typeOrder[match[1]] || 0,
        ordinal: ordNum
      }
    }
    const parsedA = parseDisp(a.article_number)
    const parsedB = parseDisp(b.article_number)
    if (parsedA.type !== parsedB.type) return parsedA.type - parsedB.type
    return parsedA.ordinal - parsedB.ordinal
  })

  // Deduplicar
  const seen = new Map<string, ExtractedArticle>()
  for (const article of articles) {
    const existing = seen.get(article.article_number)
    if (!existing || (article.content || '').length > (existing.content || '').length) {
      seen.set(article.article_number, article)
    }
  }

  return [...seen.values()]
}

/**
 * Normaliza número de artículo para comparación
 */
export function normalizeArticleNumber(num: string | null | undefined): string {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater')
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:()"\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Compara dos textos de contenido
 */
export function compareContent(boeContent: string, dbContent: string): ContentComparison {
  const boeNorm = normalizeText(boeContent)
  const dbNorm = normalizeText(dbContent)

  if (boeNorm === dbNorm) {
    return { match: true, similarity: 100 }
  }

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

  return {
    match: similarity > 95,
    similarity
  }
}
