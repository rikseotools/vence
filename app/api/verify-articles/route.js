import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Convierte texto de número español a dígito
 * Soporta desde "primero" hasta "trescientos y pico"
 * También soporta sufijos: "bis", "ter", "quater", etc.
 * Ej: "primero" -> "1", "ciento ochenta y siete bis" -> "187 bis"
 */
function spanishTextToNumber(text) {
  if (!text) return null

  // Separar posible sufijo (bis, ter, etc.)
  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i)
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim()
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : ''

  const normalized = mainText.toLowerCase().trim()

  // Mapas base
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

  // Función auxiliar para convertir la parte numérica
  function convertPart(str) {
    str = str.toLowerCase().trim()

    // Ordinales (primero, segundo, etc.)
    if (ordinals[str]) return ordinals[str]

    // Unidades
    if (units[str]) return units[str]

    // Teens (10-19)
    if (teens[str]) return teens[str]

    // Twenties (20-29)
    if (twenties[str]) return twenties[str]

    // Decenas simples
    if (tens[str]) return tens[str]

    // Decenas compuestas: "treinta y uno", "ochenta y siete"
    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i)
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0
      const unitValue = units[tensCompound[2].toLowerCase()] || 0
      if (tenValue && unitValue) return tenValue + unitValue
    }

    // Cien/ciento
    if (hundreds[str]) return hundreds[str]

    return null
  }

  // Intentar conversión directa (números simples: 1-99)
  const directConversion = convertPart(normalized)
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion)
  }

  // Manejar centenas: "ciento uno", "ciento ochenta y dos", "doscientos diez"
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
 * Maneja artículos con y sin título
 * Soporta IDs numéricos (id="a1") y textuales (id="aprimero")
 * Soporta artículos con números en texto ("Artículo primero") o dígitos ("Artículo 1")
 */
function extractArticlesFromBOE(html) {
  const articles = []

  // Regex más flexible: captura cualquier div.bloque con id que empiece por "a"
  // Algunos BOEs usan id="a1", otros id="aprimero", "asegundo", etc.
  // Termina solo al encontrar el siguiente div.bloque o el final del documento
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const blockContent = match[1]

    // Extraer número de artículo del header h5 (más confiable que el ID)
    // Soporta: "Artículo 1.", "Artículo 4 bis.", "Artículo 22 ter."
    // También: "Artículo primero", "Artículo segundo", "Artículo ciento uno"
    let articleNumber = null
    let title = ''

    // Primero intentar formato numérico: "Artículo 1.", "Artículo 4 bis."
    const numericMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+(\d+(?:\s+(?:bis|ter|quater|quinquies|sexies|septies))?)\.?\s*([^<]*)<\/h5>/i)

    if (numericMatch) {
      articleNumber = numericMatch[1].trim().replace(/\s+/g, ' ')
      title = numericMatch[2]?.trim().replace(/\.$/, '') || ''
    } else {
      // Intentar formato texto: "Artículo primero", "Artículo ciento ochenta y cuatro. Título aquí"
      const textMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+([^<]+)<\/h5>/i)
      if (textMatch) {
        let textContent = textMatch[1].trim()

        // Separar número y título si hay un punto seguido de texto
        // Ej: "ciento ochenta y cuatro. Concejales de Municipios..."
        const titleSeparatorMatch = textContent.match(/^(.+?)\.\s+(.+)$/)
        if (titleSeparatorMatch) {
          textContent = titleSeparatorMatch[1].trim()
          title = titleSeparatorMatch[2].trim().replace(/\.$/, '')
        }

        // Intentar convertir el texto a número
        const converted = spanishTextToNumber(textContent)
        if (converted) {
          articleNumber = converted
        }
      }
    }

    if (!articleNumber) {
      // Si no se pudo extraer número de artículo, saltar este bloque
      continue
    }

    // Extraer contenido (todo después del h5, preservando formato de párrafos)
    let content = blockContent
      .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '') // Quitar el h5 del título
      .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
      .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar notas de modificación del BOE
      .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar "Texto añadido, publicado el..."
      .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '') // Quitar enlace "Subir"
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '') // Quitar bloques de notas
      .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '') // Quitar formularios de jurisprudencia
      .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '') // Quitar enlaces de jurisprudencia
      .replace(/<span[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '') // Quitar spans de jurisprudencia
      .replace(/<div[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '') // Quitar divs de jurisprudencia
      .replace(/Jurisprudencia/gi, '') // Quitar texto suelto de "Jurisprudencia"
      // Preservar estructura de párrafos
      .replace(/<\/p>/gi, '\n\n') // Fin de párrafo = doble salto
      .replace(/<br\s*\/?>/gi, '\n') // Salto de línea
      .replace(/<\/li>/gi, '\n') // Fin de item de lista
      .replace(/<\/div>/gi, '\n') // Fin de div
      .replace(/<[^>]*>/g, '') // Quitar resto de tags HTML
      .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos seguidos
      .replace(/[ \t]+/g, ' ') // Normalizar espacios horizontales (no saltos de línea)
      .replace(/^ +| +$/gm, '') // Quitar espacios al inicio/fin de cada línea
      .trim()

    articles.push({
      article_number: articleNumber,
      title: title || null, // null si no tiene título
      content: content
    })
  }

  // Ordenar por número de artículo (soporta "4", "4 bis", "4 ter", etc.)
  const suffixOrder = { '': 0, 'bis': 1, 'ter': 2, 'quater': 3, 'quinquies': 4, 'sexies': 5, 'septies': 6 }
  articles.sort((a, b) => {
    const parseArticle = (num) => {
      const match = num.match(/^(\d+)(?:\s+(\w+))?$/)
      if (!match) return { base: 0, suffix: 0 }
      return {
        base: parseInt(match[1]) || 0,
        suffix: suffixOrder[match[2]?.toLowerCase() || ''] || 0
      }
    }
    const parsedA = parseArticle(a.article_number)
    const parsedB = parseArticle(b.article_number)
    if (parsedA.base !== parsedB.base) return parsedA.base - parsedB.base
    return parsedA.suffix - parsedB.suffix
  })

  return articles
}

/**
 * Normaliza número de artículo para comparación
 * Ej: "55bis" → "55 bis", "4 BIS" → "4 bis", "22  ter" → "22 ter"
 */
function normalizeArticleNumber(num) {
  if (!num) return ''
  return num
    .toLowerCase()
    .replace(/(\d+)\s*(bis|ter|quater|quinquies|sexies|septies)/gi, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normaliza texto para comparación
 */
function normalizeText(text) {
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
function compareContent(boeContent, dbContent) {
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

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const lawShortName = searchParams.get('law')

  if (!lawId && !lawShortName) {
    return Response.json({
      success: false,
      error: 'Se requiere lawId o law (short_name)'
    }, { status: 400 })
  }

  try {
    // 1. Obtener la ley de la BD
    let lawQuery = supabase
      .from('laws')
      .select('id, short_name, name, boe_url')

    if (lawId) {
      lawQuery = lawQuery.eq('id', lawId)
    } else {
      lawQuery = lawQuery.ilike('short_name', `%${lawShortName}%`)
    }

    const { data: law, error: lawError } = await lawQuery.single()

    if (lawError || !law) {
      return Response.json({
        success: false,
        error: 'Ley no encontrada',
        details: lawError?.message
      }, { status: 404 })
    }

    if (!law.boe_url) {
      return Response.json({
        success: false,
        error: 'La ley no tiene URL del BOE configurada'
      }, { status: 400 })
    }

    // 2. Descargar HTML del BOE
    console.log(`📥 Descargando BOE: ${law.boe_url}`)
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

    // 3. Extraer artículos del BOE (con contenido)
    const boeArticles = extractArticlesFromBOE(boeHtml)
    console.log(`📄 Artículos encontrados en BOE: ${boeArticles.length}`)

    if (boeArticles.length === 0) {
      return Response.json({
        success: false,
        error: `No se pudieron extraer artículos del BOE para "${law.short_name}". Puede que la estructura HTML haya cambiado.`,
        law: {
          id: law.id,
          short_name: law.short_name,
          name: law.name,
          boe_url: law.boe_url
        },
        htmlPreview: boeHtml.substring(0, 1000)
      }, { status: 500 })
    }

    // 4. Obtener artículos de la BD (incluyendo contenido)
    const { data: dbArticles, error: dbError } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', law.id)
      .eq('is_active', true)
      .order('article_number')

    if (dbError) {
      return Response.json({
        success: false,
        error: 'Error obteniendo artículos de la BD',
        details: dbError.message
      }, { status: 500 })
    }

    console.log(`💾 Artículos en BD: ${dbArticles?.length || 0}`)

    // 5. Comparar artículos
    const comparison = {
      law: {
        id: law.id,
        short_name: law.short_name,
        name: law.name,
        boe_url: law.boe_url
      },
      summary: {
        boe_count: boeArticles.length,
        db_count: dbArticles?.length || 0,
        matching: 0,
        title_mismatch: 0,
        content_mismatch: 0,
        missing_in_db: 0,
        extra_in_db: 0
      },
      details: {
        matching: [],
        title_mismatch: [],
        content_mismatch: [],
        missing_in_db: [],
        extra_in_db: []
      }
    }

    // Crear mapas para comparación rápida (normalizando números de artículo)
    const boeMap = new Map(boeArticles.map(a => [normalizeArticleNumber(a.article_number), a]))
    const dbMap = new Map((dbArticles || []).map(a => [normalizeArticleNumber(a.article_number), a]))

    // Verificar artículos del BOE
    for (const [artNum, boeArt] of boeMap) {
      const dbArt = dbMap.get(artNum)

      // Debug: log para artículos específicos
      if (['2', '4', '6'].includes(artNum)) {
        console.log(`🔍 Artículo ${artNum}:`, {
          boeTitle: boeArt.title?.substring(0, 50),
          dbTitle: dbArt?.title?.substring(0, 50),
          hasDbArt: !!dbArt,
          boeContentLength: boeArt.content?.length,
          dbContentLength: dbArt?.content?.length
        })
      }

      if (!dbArt) {
        // Artículo en BOE pero no en BD
        comparison.summary.missing_in_db++
        comparison.details.missing_in_db.push({
          article_number: artNum,
          boe_title: boeArt.title,
          boe_content_preview: boeArt.content?.substring(0, 200) + '...'
        })
      } else {
        // Comparar contenido primero (es lo más importante)
        const contentComparison = compareContent(boeArt.content, dbArt.content)

        // Comparar títulos
        const boeTitleNorm = normalizeText(boeArt.title)
        const dbTitleNorm = normalizeText(dbArt.title)
        const titlesMatch = boeTitleNorm === dbTitleNorm
        const boeHasNoTitle = !boeArt.title || boeArt.title.trim() === ''
        const dbHasTitle = dbArt.title && dbArt.title.trim() !== ''

        // Debug: log de comparación
        if (['2', '4', '6', '11'].includes(artNum)) {
          console.log(`📊 Comparación Art ${artNum}:`, {
            boeTitle: boeArt.title,
            dbTitle: dbArt.title,
            boeTitleNorm,
            dbTitleNorm,
            titlesMatch,
            boeHasNoTitle,
            dbHasTitle,
            contentMatch: contentComparison.match,
            contentSimilarity: contentComparison.similarity,
            condicionOK: titlesMatch || (boeHasNoTitle && dbHasTitle)
          })
        }

        if (contentComparison.match) {
          // Contenido coincide
          if (titlesMatch || (boeHasNoTitle && dbHasTitle) || (boeHasNoTitle && !dbHasTitle)) {
            // Todo OK: títulos coinciden O (BOE sin título - BD puede tener o no)
            comparison.summary.matching++
            comparison.details.matching.push({
              article_number: artNum,
              title: dbArt.title || boeArt.title || '(sin título)',
              db_id: dbArt.id,
              note: boeHasNoTitle && dbHasTitle ? 'BOE sin título, BD tiene título (contenido OK)' : null
            })
          } else {
            // Títulos diferentes pero contenido OK - informativo
            comparison.summary.title_mismatch++
            comparison.details.title_mismatch.push({
              article_number: artNum,
              boe_title: boeArt.title || '(sin título)',
              db_title: dbArt.title || '(sin título)',
              db_id: dbArt.id,
              content_ok: true,
              boe_has_no_title: boeHasNoTitle
            })
          }
        } else {
          // Contenido NO coincide - esto es lo importante, clasificar como content_mismatch
          comparison.summary.content_mismatch++
          comparison.details.content_mismatch.push({
            article_number: artNum,
            title: dbArt.title || boeArt.title || '(sin título)',
            similarity: contentComparison.similarity,
            boe_content_preview: boeArt.content?.substring(0, 300) + '...',
            db_content_preview: dbArt.content?.substring(0, 300) + '...',
            db_id: dbArt.id,
            boe_has_no_title: boeHasNoTitle
          })
        }
      }
    }

    // Verificar artículos extra en BD (no están en BOE)
    for (const [artNum, dbArt] of dbMap) {
      if (!boeMap.has(artNum)) {
        comparison.summary.extra_in_db++
        comparison.details.extra_in_db.push({
          article_number: artNum,
          db_title: dbArt.title,
          db_id: dbArt.id
        })
      }
    }

    // 6. Calcular estado general
    // isOk = true si los artículos que tenemos en BD coinciden con el BOE
    // (no importa si faltan artículos, eso es informativo)
    const isOk = comparison.summary.title_mismatch === 0 &&
                 comparison.summary.content_mismatch === 0

    // 7. Actualizar estado de verificación en la ley (guardar resumen completo)
    const summaryToSave = {
      boe_count: comparison.summary.boe_count,
      db_count: comparison.summary.db_count,
      matching: comparison.summary.matching,
      title_mismatch: comparison.summary.title_mismatch,
      content_mismatch: comparison.summary.content_mismatch || 0,
      extra_in_db: comparison.summary.extra_in_db,
      missing_in_db: comparison.summary.missing_in_db,
      is_ok: isOk,
      verified_at: new Date().toISOString()
    }
    console.log('💾 [VERIFY] Guardando summary para ley:', law.id, summaryToSave)

    const { error: updateError } = await supabase
      .from('laws')
      .update({
        last_checked: new Date().toISOString(),
        last_verification_summary: summaryToSave
      })
      .eq('id', law.id)

    if (updateError) {
      console.error('❌ [VERIFY] Error guardando summary:', updateError)
    } else {
      console.log('✅ [VERIFY] Summary guardado correctamente')
    }

    return Response.json({
      success: true,
      status: isOk ? 'ok' : 'discrepancies',
      comparison,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error verificando artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}
