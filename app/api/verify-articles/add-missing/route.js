import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Convierte texto de número español a dígito
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
 * Extrae los artículos del HTML del BOE
 */
function extractArticlesFromBOE(html) {
  const articles = []
  // Soporta tanto id="a1" como id="art1" (algunos BOEs usan uno u otro)
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="(?:a|art)[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]
    let articleNumber = null
    let title = ''

    // Soporta tanto "Artículo 1." como "Art. 1." (algunos BOEs usan formato abreviado)
    // También maneja títulos con HTML interno (ej: links a otras leyes)
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>(?:Artículo|Art\.?)\s+(\d+(?:\s+(?:bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?(?:\s+\d+)?)\.?\s*([\s\S]*?)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      // Limpiar HTML del título (puede contener <a>, <span>, etc.)
      let rawTitle = numericMatch[2] || ''
      rawTitle = rawTitle.replace(/<[^>]*>/g, '').trim().replace(/\.$/, '')
      title = rawTitle || ''
    } else {
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

    if (!articleNumber) continue

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
function normalizeArticleNumber(num) {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/quáter/gi, 'quater')
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies|octies|nonies|decies)(\s*\d+)?/gi, '$1 $2$3')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Genera hash de contenido
 */
function generateContentHash(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { lawId, articleNumbers } = body

    if (!lawId) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId'
      }, { status: 400 })
    }

    if (!articleNumbers || !Array.isArray(articleNumbers) || articleNumbers.length === 0) {
      return Response.json({
        success: false,
        error: 'Se requiere array de articleNumbers'
      }, { status: 400 })
    }

    // 1. Obtener la ley
    const { data: law, error: lawError } = await supabase
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

    // 2. Descargar HTML del BOE
    console.log(`📥 Descargando BOE para añadir artículos: ${law.boe_url}`)
    const boeResponse = await fetch(law.boe_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!boeResponse.ok) {
      return Response.json({
        success: false,
        error: `Error descargando BOE: ${boeResponse.status}`
      }, { status: 500 })
    }

    const boeHtml = await boeResponse.text()

    // 3. Extraer artículos del BOE
    const boeArticles = extractArticlesFromBOE(boeHtml)
    console.log(`📄 Artículos encontrados en BOE: ${boeArticles.length}`)

    // 4. Filtrar solo los artículos solicitados
    const normalizedRequested = new Set(articleNumbers.map(n => normalizeArticleNumber(n)))
    const articlesToAdd = boeArticles.filter(a =>
      normalizedRequested.has(normalizeArticleNumber(a.article_number))
    )

    console.log(`🎯 Artículos a añadir: ${articlesToAdd.length}`)

    if (articlesToAdd.length === 0) {
      return Response.json({
        success: false,
        error: 'No se encontraron los artículos solicitados en el BOE'
      }, { status: 404 })
    }

    // 5. Verificar que no existan ya en BD
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('article_number')
      .eq('law_id', lawId)
      .eq('is_active', true)

    const existingNumbers = new Set((existingArticles || []).map(a =>
      normalizeArticleNumber(a.article_number)
    ))

    const newArticles = articlesToAdd.filter(a =>
      !existingNumbers.has(normalizeArticleNumber(a.article_number))
    )

    if (newArticles.length === 0) {
      return Response.json({
        success: true,
        message: 'Todos los artículos ya existen en la base de datos',
        added: 0,
        skipped: articlesToAdd.length
      })
    }

    // 6. Preparar artículos para insertar
    const now = new Date().toISOString()
    const today = now.split('T')[0]

    const articlesToInsert = newArticles.map(art => ({
      law_id: lawId,
      article_number: art.article_number,
      title: art.title || null,
      content: art.content,
      content_hash: generateContentHash(art.content),
      is_active: true,
      is_verified: true,
      verification_date: today,
      last_modification_date: today,
      created_at: now,
      updated_at: now
    }))

    // 7. Insertar en la BD
    const { data: inserted, error: insertError } = await supabase
      .from('articles')
      .insert(articlesToInsert)
      .select('id, article_number, title')

    if (insertError) {
      console.error('❌ Error insertando artículos:', insertError)
      return Response.json({
        success: false,
        error: 'Error insertando artículos',
        details: insertError.message
      }, { status: 500 })
    }

    console.log(`✅ Artículos insertados: ${inserted.length}`)

    return Response.json({
      success: true,
      message: `Se añadieron ${inserted.length} artículos`,
      added: inserted.length,
      skipped: articlesToAdd.length - newArticles.length,
      articles: inserted.map(a => ({
        article_number: a.article_number,
        title: a.title
      }))
    })

  } catch (error) {
    console.error('Error añadiendo artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
