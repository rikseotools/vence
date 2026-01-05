/**
 * Utilidades compartidas para extracción de artículos del BOE
 */

/**
 * Convierte texto de número español a dígito
 * Soporta desde "primero" hasta "trescientos y pico"
 * También soporta sufijos: "bis", "ter", "quater", etc.
 */
export function spanishTextToNumber(text) {
  if (!text) return null

  text = text.replace(/\.+$/, '').trim()

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  const ordinals = {
    'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5,
    'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9,
    'décimo': 10, 'decimo': 10, 'undécimo': 11, 'undecimo': 11,
    'duodécimo': 12, 'duodecimo': 12, 'decimotercero': 13, 'decimocuarto': 14,
    'decimoquinto': 15, 'decimosexto': 16, 'decimoséptimo': 17, 'decimoseptimo': 17,
    'decimooctavo': 18, 'decimonoveno': 19, 'vigésimo': 20, 'vigesimo': 20
  }

  const units = {
    'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5,
    'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9
  }

  const teens = {
    'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14,
    'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17,
    'dieciocho': 18, 'diecinueve': 19
  }

  const twenties = {
    'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22,
    'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25,
    'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28,
    'veintinueve': 29
  }

  const tens = {
    'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60,
    'setenta': 70, 'ochenta': 80, 'noventa': 90
  }

  const hundreds = {
    'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200,
    'trescientos': 300, 'trescientas': 300
  }

  function convertPart(str) {
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
 * - Headers: "Artículo X", "Art. X", "Regla X", "X." (solo número)
 */
export function extractArticlesFromBOE(html) {
  const articles = []

  // Regex flexible para capturar todos los formatos de ID de artículo
  // Incluye: a1, art1, auno, aprimero, regla1, primero, decimotercero, etc.
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a(?:\d|rt|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinti|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo|decimotercero|decimocuarto|decimoquinto|decimosexto|decimos[eé]ptimo|decimooctavo|decimonoveno|vig[eé]simo)|regla\d+|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo|duod[eé]cimo|decimotercero|decimocuarto|decimoquinto)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]
    let articleNumber = null
    let title = ''

    // Patrón 1: "Artículo X", "Art. X", "Regla X" con número
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?|Regla)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([\s\S]*?)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      title = (numericMatch[2] || '').replace(/<[^>]*>/g, '').trim().replace(/\.$/, '') || ''
    }

    // Patrón 2: Solo número "1.", "2. Título" (algunas órdenes)
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

    // Patrón 4: Ordinales sin "Artículo" - "Primero.", "Segundo.", "Decimotercero."
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
    let content = blockContent
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
  const suffixOrder = { '': 0, 'bis': 1, 'ter': 2, 'quater': 3, 'quinquies': 4, 'sexies': 5, 'septies': 6, 'octies': 7, 'nonies': 8, 'decies': 9 }
  articles.sort((a, b) => {
    const parseArticle = (num) => {
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
  })

  return articles
}

/**
 * Normaliza número de artículo para comparación
 */
export function normalizeArticleNumber(num) {
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
export function normalizeText(text) {
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
export function compareContent(boeContent, dbContent) {
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
