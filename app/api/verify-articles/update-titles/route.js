import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

/**
 * Normaliza número de artículo para comparación
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
 * Extrae el contenido de un artículo específico del BOE
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
 * POST /api/verify-articles/update-titles
 * Actualiza los títulos Y CONTENIDO de artículos en la BD según el BOE
 * y guarda un registro de los cambios
 */
export async function POST(request) {
  try {
    const { lawId, articles } = await request.json()

    if (!lawId || !articles || !Array.isArray(articles) || articles.length === 0) {
      return Response.json({
        success: false,
        error: 'Se requiere lawId y un array de articles con {article_number, boe_title, db_title, db_id}'
      }, { status: 400 })
    }

    // Obtener la URL del BOE de la ley
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('boe_url')
      .eq('id', lawId)
      .single()

    if (lawError || !law?.boe_url) {
      return Response.json({
        success: false,
        error: 'No se pudo obtener la URL del BOE para esta ley'
      }, { status: 400 })
    }

    const results = {
      updated: [],
      errors: [],
      created: []
    }

    for (const article of articles) {
      const { article_number, boe_title, db_title, db_id } = article

      try {
        if (db_id) {
          // Obtener contenido actualizado del BOE
          const boeData = await fetchArticleFromBOE(law.boe_url, article_number)

          // Obtener contenido actual de la BD para el log
          const { data: currentArticle } = await supabase
            .from('articles')
            .select('content')
            .eq('id', db_id)
            .single()

          const updateData = {
            title: boeData?.title || boe_title,
            updated_at: new Date().toISOString()
          }

          // Si obtuvimos contenido del BOE, actualizarlo también
          if (boeData?.content) {
            updateData.content = boeData.content
          }

          const { error: updateError } = await supabase
            .from('articles')
            .update(updateData)
            .eq('id', db_id)

          if (updateError) {
            results.errors.push({
              article_number,
              error: updateError.message
            })
          } else {
            results.updated.push({
              article_number,
              old_title: db_title,
              new_title: updateData.title,
              content_updated: !!boeData?.content,
              db_id
            })

            // Guardar registro del cambio
            await supabase.from('article_update_logs').insert({
              law_id: lawId,
              article_id: db_id,
              article_number,
              old_title: db_title,
              new_title: updateData.title,
              change_type: boeData?.content ? 'full_update' : 'title_update',
              source: 'boe_verification'
            })
          }
        } else {
          results.errors.push({
            article_number,
            error: 'Artículo no tiene ID en BD - no se puede actualizar'
          })
        }
      } catch (err) {
        results.errors.push({
          article_number,
          error: err.message
        })
      }
    }

    return Response.json({
      success: true,
      results,
      summary: {
        total: articles.length,
        updated: results.updated.length,
        errors: results.errors.length
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error actualizando artículos:', error)
    return Response.json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * GET /api/verify-articles/update-titles
 * Obtiene el historial de actualizaciones de una ley
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')

  if (!lawId) {
    return Response.json({
      success: false,
      error: 'Se requiere lawId'
    }, { status: 400 })
  }

  try {
    const { data: logs, error } = await supabase
      .from('article_update_logs')
      .select('*')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      // Si la tabla no existe, devolver array vacío
      if (error.code === '42P01') {
        return Response.json({
          success: true,
          logs: [],
          message: 'Tabla de logs no existe aún'
        })
      }
      throw error
    }

    return Response.json({
      success: true,
      logs: logs || []
    })

  } catch (error) {
    console.error('Error obteniendo logs:', error)
    return Response.json({
      success: false,
      error: 'Error obteniendo historial',
      details: error.message
    }, { status: 500 })
  }
}
