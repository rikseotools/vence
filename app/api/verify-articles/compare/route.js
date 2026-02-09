import { createClient } from '@supabase/supabase-js'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Normaliza número de artículo para comparación
 * Ej: "55bis" → "55 bis", "4 BIS" → "4 bis", "22 quáter" → "22 quater", "216 bis 2" → "216 bis 2"
 */
function normalizeArticleNumber(num) {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater') // Normalizar variante con acento
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(\s*\d+)?/gi, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Convierte texto de número español a dígito
 * Soporta desde "primero" hasta "trescientos y pico"
 * También soporta sufijos: "bis", "ter", "quater", etc.
 */
function spanishTextToNumber(text) {
  if (!text) return null

  // Eliminar punto final antes de procesar
  text = text.replace(/\.+$/, '').trim()

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  const ordinals = {
    'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5,
    'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9
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
 * Extrae el contenido completo de un artículo específico del BOE
 * Soporta IDs numéricos (id="a5") y textuales (id="aquinto")
 * Soporta formato numérico ("Artículo 207") y texto ("Artículo doscientos siete")
 */
async function fetchArticleFromBOE(boeUrl, articleNumber) {
  try {
    const response = await fetch(boeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!response.ok) return null

    const html = await response.text()

    // Normalizar el número de artículo buscado
    const targetArticle = normalizeArticleNumber(articleNumber)

    // Buscar todos los bloques de artículos y encontrar el que coincida
    // Termina solo al encontrar el siguiente div.bloque o el final del documento
    const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a|art)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

    let match
    while ((match = articleBlockRegex.exec(html)) !== null) {
      const blockContent = match[1]

      let foundArticle = null
      let title = ''

      // Primero intentar formato numérico: "Artículo 207.", "Artículo 4 bis.", "Artículo 22 octies.", "Artículo 216 bis 4."
      // Lista completa de sufijos latinos: bis, ter, quater/quáter, quinquies, sexies, septies, octies, nonies, decies
      // También soporta números adicionales después del sufijo (ej: "216 bis 2", "216 bis 3")
      const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([^<]*)<\/h5>/i)

      if (numericMatch) {
        foundArticle = normalizeArticleNumber(numericMatch[1])
        title = numericMatch[2] ? numericMatch[2].trim().replace(/\.$/, '') : ''
      } else {
        // Intentar formato texto: "Artículo doscientos siete", "Artículo primero"
        const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+([^<]+)<\/h5>/i)
        if (textMatch) {
          let textContent = textMatch[1].trim()

          // Separar número y título si hay punto
          const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
          if (titleSeparatorMatch) {
            textContent = titleSeparatorMatch[1].trim()
            title = titleSeparatorMatch[2].trim().replace(/\.$/, '')
          }

          // Convertir texto a número
          const converted = spanishTextToNumber(textContent)
          if (converted) {
            foundArticle = normalizeArticleNumber(converted)
          }
        }
      }

      if (!foundArticle) continue

      // ¿Es el artículo que buscamos?
      if (foundArticle === targetArticle) {
        let content = blockContent
          .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '') // Quitar el h5
          .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
          .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar notas de modificación
          .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar "Texto añadido, publicado el..."
          .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar enlace "Subir"
          .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '') // Quitar bloques de notas
          .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '') // Quitar formularios
          .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
          .replace(/<span[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
          .replace(/Jurisprudencia/gi, '')
          // Preservar estructura de párrafos
          .replace(/<\/p>/gi, '\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/li>/gi, '\n')
          .replace(/<\/div>/gi, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+/g, ' ')
          .replace(/^ +| +$/gm, '')
          .trim()

        return { title, content }
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching BOE article:', error)
    return null
  }
}

/**
 * GET /api/verify-articles/compare
 * Obtiene el contenido completo de un artículo tanto del BOE como de la BD
 * para mostrar comparación lado a lado
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const articleNumber = searchParams.get('articleNumber')

  if (!lawId || !articleNumber) {
    return Response.json({
      success: false,
      error: 'Se requiere lawId y articleNumber'
    }, { status: 400 })
  }

  try {
    // 1. Obtener la ley y su URL del BOE
    const { data: law, error: lawError } = await getSupabase()
      .from('laws')
      .select('id, short_name, name, boe_url')
      .eq('id', lawId)
      .single()

    if (lawError || !law) {
      return Response.json({
        success: false,
        error: 'Ley no encontrada'
      }, { status: 404 })
    }

    if (!law.boe_url) {
      return Response.json({
        success: false,
        error: 'La ley no tiene URL del BOE configurada'
      }, { status: 400 })
    }

    // 2. Obtener artículo de la BD
    const { data: dbArticle, error: dbError } = await getSupabase()
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', lawId)
      .eq('article_number', articleNumber)
      .single()

    // 3. Obtener contenido del BOE
    const boeData = await fetchArticleFromBOE(law.boe_url, articleNumber)

    return Response.json({
      success: true,
      law: {
        id: law.id,
        short_name: law.short_name,
        name: law.name,
        boe_url: law.boe_url
      },
      boe: boeData ? {
        title: boeData.title,
        content: boeData.content
      } : null,
      db: dbArticle ? {
        id: dbArticle.id,
        title: dbArticle.title,
        content: dbArticle.content
      } : null
    })

  } catch (error) {
    console.error('Error comparando artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
