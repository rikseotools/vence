import { createClient } from '@supabase/supabase-js'
import {
  extractArticlesFromBOE,
  normalizeArticleNumber,
  normalizeText,
  compareContent
} from '@/lib/boe-extractor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
      const isDocPhp = law.boe_url.includes('doc.php')
      const now = new Date().toISOString()

      // Si es doc.php (sin texto consolidado), es normal que no haya artículos
      if (isDocPhp) {
        const summaryToSave = {
          boe_count: 0,
          db_count: 0,
          matching: 0,
          title_mismatch: 0,
          content_mismatch: 0,
          extra_in_db: 0,
          missing_in_db: 0,
          is_ok: true,
          no_consolidated_text: true,
          verified_at: now,
          message: 'Ley sin texto consolidado en BOE (solo documento original)'
        }

        await supabase
          .from('laws')
          .update({
            last_checked: now,
            last_verification_summary: summaryToSave
          })
          .eq('id', law.id)

        return Response.json({
          success: true,
          status: 'ok',
          comparison: {
            law: {
              id: law.id,
              short_name: law.short_name,
              name: law.name,
              boe_url: law.boe_url
            },
            summary: {
              boe_count: 0,
              db_count: 0,
              matching: 0,
              title_mismatch: 0,
              content_mismatch: 0,
              missing_in_db: 0,
              extra_in_db: 0,
              no_consolidated_text: true
            },
            details: {
              matching: [],
              title_mismatch: [],
              content_mismatch: [],
              missing_in_db: [],
              extra_in_db: []
            },
            message: 'Ley sin texto consolidado en BOE (solo documento original)'
          },
          timestamp: now
        })
      }

      // Si es act.php pero no encontró artículos, es un error
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

        if (contentComparison.match) {
          // Contenido coincide
          if (titlesMatch || (boeHasNoTitle && dbHasTitle) || (boeHasNoTitle && !dbHasTitle)) {
            comparison.summary.matching++
            comparison.details.matching.push({
              article_number: artNum,
              title: dbArt.title || boeArt.title || '(sin título)',
              db_id: dbArt.id,
              note: boeHasNoTitle && dbHasTitle ? 'BOE sin título, BD tiene título (contenido OK)' : null
            })
          } else {
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
    // isOk solo si no hay discrepancias de ningún tipo
    const isOk = comparison.summary.title_mismatch === 0 &&
                 comparison.summary.content_mismatch === 0 &&
                 comparison.summary.extra_in_db === 0 &&
                 comparison.summary.missing_in_db === 0

    // 7. Actualizar estado de verificación en la ley
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
