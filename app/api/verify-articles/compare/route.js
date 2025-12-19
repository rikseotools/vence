import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Normaliza número de artículo para comparación
 * Ej: "55bis" → "55 bis", "4 BIS" → "4 bis"
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
 * Extrae el contenido completo de un artículo específico del BOE
 * Soporta IDs numéricos (id="a5") y textuales (id="aquinto")
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
    const articleBlockRegex = /<div[^>]*class="bloque"[^>]*id="a[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="bloque"|<p[^>]*class="linkSubir"|$)/gi

    let match
    while ((match = articleBlockRegex.exec(html)) !== null) {
      const blockContent = match[1]

      // Extraer número de artículo del header
      const headerMatch = blockContent.match(/<h5[^>]*class="articulo"[^>]*>Artículo\s+(\d+(?:\s+(?:bis|ter|quater|quinquies|sexies|septies))?)\.?\s*([^<]*)<\/h5>/i)

      if (!headerMatch) continue

      const foundArticle = normalizeArticleNumber(headerMatch[1])

      // ¿Es el artículo que buscamos?
      if (foundArticle === targetArticle) {
        const title = headerMatch[2] ? headerMatch[2].trim().replace(/\.$/, '') : ''

        let content = blockContent
          .replace(/<h5[^>]*class="articulo"[^>]*>[\s\S]*?<\/h5>/gi, '') // Quitar el h5
          .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
          .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '') // Quitar formularios de jurisprudencia
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

    // 2. Obtener artículo de la BD
    const { data: dbArticle, error: dbError } = await supabase
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
