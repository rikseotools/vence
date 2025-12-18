import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae los artículos del HTML del BOE (título Y contenido)
 * Maneja artículos con y sin título
 */
function extractArticlesFromBOE(html) {
  const articles = []

  // Regex más flexible para capturar artículos con o sin título
  // Estructura: <div class="bloque" id="aX">...<h5 class="articulo">Artículo X. [Título opcional]</h5>...contenido...</div>
  const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|<p[^>]*class="linkSubir"|$)/gi

  let match
  while ((match = articleBlockRegex.exec(html)) !== null) {
    const articleNumber = match[1]
    const blockContent = match[2]

    // Extraer título del h5
    const titleMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+\d+\.?\s*([^<]*)<\/h5>/i)
    let title = ''
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim().replace(/\.$/, '') // Quitar punto final
    }

    // Extraer contenido (todo después del h5, preservando formato de párrafos)
    let content = blockContent
      .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '') // Quitar el h5 del título
      .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
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

  // Ordenar por número de artículo
  articles.sort((a, b) => {
    const numA = parseInt(a.article_number) || 0
    const numB = parseInt(b.article_number) || 0
    return numA - numB
  })

  return articles
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
        error: 'No se pudieron extraer artículos del BOE. Puede que la estructura HTML haya cambiado.',
        htmlPreview: boeHtml.substring(0, 500)
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

    // Crear mapas para comparación rápida
    const boeMap = new Map(boeArticles.map(a => [a.article_number, a]))
    const dbMap = new Map((dbArticles || []).map(a => [a.article_number, a]))

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
        if (['2', '4', '6'].includes(artNum)) {
          console.log(`📊 Comparación Art ${artNum}:`, {
            titlesMatch,
            contentMatch: contentComparison.match,
            contentSimilarity: contentComparison.similarity,
            classification: contentComparison.match
              ? (titlesMatch ? 'MATCHING' : 'TITLE_MISMATCH')
              : (titlesMatch ? 'CONTENT_MISMATCH' : 'TITLE_MISMATCH')
          })
        }

        if (contentComparison.match) {
          // Contenido coincide
          if (titlesMatch || (boeHasNoTitle && dbHasTitle)) {
            // Todo OK: títulos coinciden O (BOE sin título pero BD tiene título y contenido OK)
            comparison.summary.matching++
            comparison.details.matching.push({
              article_number: artNum,
              title: dbArt.title || boeArt.title || '(sin título)',
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
          // Contenido NO coincide
          if (!titlesMatch) {
            // Título Y contenido diferentes
            comparison.summary.title_mismatch++
            comparison.details.title_mismatch.push({
              article_number: artNum,
              boe_title: boeArt.title || '(sin título)',
              db_title: dbArt.title || '(sin título)',
              db_id: dbArt.id,
              content_ok: false,
              content_similarity: contentComparison.similarity,
              boe_has_no_title: boeHasNoTitle,
              boe_content_preview: boeArt.content?.substring(0, 200) + '...'
            })
          } else {
            // Solo contenido diferente (títulos coinciden)
            comparison.summary.content_mismatch++
            comparison.details.content_mismatch.push({
              article_number: artNum,
              title: boeArt.title || '(sin título)',
              similarity: contentComparison.similarity,
              boe_content_preview: boeArt.content?.substring(0, 300) + '...',
              db_content_preview: dbArt.content?.substring(0, 300) + '...',
              db_id: dbArt.id
            })
          }
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
    const isOk = comparison.summary.missing_in_db === 0 &&
                 comparison.summary.extra_in_db === 0 &&
                 comparison.summary.title_mismatch === 0 &&
                 comparison.summary.content_mismatch === 0

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
