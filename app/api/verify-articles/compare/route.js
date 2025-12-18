import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Extrae el contenido completo de un artículo específico del BOE
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

    // Buscar el artículo específico
    // Estructura: <div class="bloque" id="aX">...</div>
    const articleRegex = new RegExp(
      `<div[^>]*id="a${articleNumber}"[^>]*>[\\s\\S]*?<h5[^>]*class="articulo"[^>]*>([\\s\\S]*?)</h5>([\\s\\S]*?)(?=<div[^>]*class="bloque"|<p[^>]*class="linkSubir"|$)`,
      'i'
    )

    const match = html.match(articleRegex)

    if (match) {
      const title = match[1].replace(/<[^>]*>/g, '').trim()
        .replace(/^Artículo\s+\d+\.?\s*/, '') // Quitar "Artículo X. "
        .replace(/\.$/, '') // Quitar punto final

      let content = match[2]
        .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '') // Quitar [Bloque X: #aX]
        // Preservar estructura de párrafos
        .replace(/<\/p>/gi, '\n\n') // Fin de párrafo = doble salto
        .replace(/<br\s*\/?>/gi, '\n') // Salto de línea
        .replace(/<\/li>/gi, '\n') // Fin de item de lista
        .replace(/<\/div>/gi, '\n') // Fin de div
        .replace(/<[^>]*>/g, '') // Quitar resto de tags HTML
        .replace(/\n{3,}/g, '\n\n') // Máximo 2 saltos seguidos
        .replace(/[ \t]+/g, ' ') // Normalizar espacios horizontales
        .replace(/^ +| +$/gm, '') // Quitar espacios al inicio/fin de cada línea
        .trim()

      return { title, content }
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
