import { NextRequest, NextResponse } from 'next/server'
import {
  extractArticlesFromBOE,
  normalizeArticleNumber,
  normalizeText,
  compareContent,
} from '@/lib/boe-extractor'
import {
  isEurLexUrl,
  extractArticlesFromEurLex,
} from '@/lib/eurlex-extractor'
import { isStructureArticle } from '@/lib/api/article-sync'
import {
  getLawById,
  getLawByShortName,
  getActiveArticlesByLaw,
  updateLawVerification,
} from '@/lib/api/verify-articles/queries'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lawId = searchParams.get('lawId')
  const lawShortName = searchParams.get('law')
  const includeDisposiciones = searchParams.get('includeDisposiciones') === 'true'

  if (!lawId && !lawShortName) {
    return NextResponse.json(
      { success: false, error: 'Se requiere lawId o law (short_name)' },
      { status: 400 }
    )
  }

  try {
    const law = lawId ? await getLawById(lawId) : await getLawByShortName(lawShortName!)
    if (!law) {
      return NextResponse.json({ success: false, error: 'Ley no encontrada' }, { status: 404 })
    }
    if (!law.boeUrl) {
      return NextResponse.json({ success: false, error: 'La ley no tiene URL del BOE configurada' }, { status: 400 })
    }

    const isEurLex = isEurLexUrl(law.boeUrl)
    const sourceName = isEurLex ? 'EUR-Lex' : 'BOE'

    console.log(`📥 Descargando ${sourceName}: ${law.boeUrl}`)
    const response = await fetch(law.boeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)', 'Accept': 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' },
    })
    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Error descargando ${sourceName}: ${response.status}` }, { status: 500 })
    }

    const html = await response.text()
    const boeArticles = isEurLex
      ? extractArticlesFromEurLex(html)
      : extractArticlesFromBOE(html, { includeDisposiciones })
    console.log(`📄 Artículos encontrados en ${sourceName}: ${boeArticles.length}`)

    if (boeArticles.length === 0) {
      const isDocPhp = law.boeUrl.includes('doc.php')
      const now = new Date().toISOString()

      if (isDocPhp && !isEurLex) {
        const summaryToSave = { boe_count: 0, db_count: 0, matching: 0, title_mismatch: 0, content_mismatch: 0, extra_in_db: 0, missing_in_db: 0, is_ok: true, no_consolidated_text: true, verified_at: now, message: 'Ley sin texto consolidado en BOE (solo documento original)' }
        await updateLawVerification(law.id, summaryToSave)

        return NextResponse.json({
          success: true, status: 'ok',
          comparison: {
            law: { id: law.id, short_name: law.shortName, name: law.name, boe_url: law.boeUrl },
            summary: { boe_count: 0, db_count: 0, matching: 0, title_mismatch: 0, content_mismatch: 0, missing_in_db: 0, extra_in_db: 0, no_consolidated_text: true },
            details: { matching: [], title_mismatch: [], content_mismatch: [], missing_in_db: [], extra_in_db: [] },
            message: 'Ley sin texto consolidado en BOE (solo documento original)',
          },
          timestamp: now,
        })
      }

      return NextResponse.json({
        success: false,
        error: `No se pudieron extraer artículos de ${sourceName} para "${law.shortName}". Puede que la estructura HTML haya cambiado.`,
        law: { id: law.id, short_name: law.shortName, name: law.name, boe_url: law.boeUrl },
        htmlPreview: html.substring(0, 1000),
      }, { status: 500 })
    }

    const dbArticles = await getActiveArticlesByLaw(law.id)
    console.log(`💾 Artículos en BD: ${dbArticles.length}`)

    const comparison = {
      law: { id: law.id, short_name: law.shortName, name: law.name, boe_url: law.boeUrl },
      summary: { boe_count: boeArticles.length, db_count: dbArticles.length, matching: 0, title_mismatch: 0, content_mismatch: 0, missing_in_db: 0, extra_in_db: 0, structure_articles: 0 },
      details: { matching: [] as Record<string, unknown>[], title_mismatch: [] as Record<string, unknown>[], content_mismatch: [] as Record<string, unknown>[], missing_in_db: [] as Record<string, unknown>[], extra_in_db: [] as Record<string, unknown>[] },
    }

    const boeMap = new Map(boeArticles.map(a => [normalizeArticleNumber(a.article_number), a]))
    const dbMap = new Map(dbArticles.map(a => [normalizeArticleNumber(a.articleNumber), a]))

    for (const [artNum, boeArt] of boeMap) {
      const dbArt = dbMap.get(artNum)
      if (!dbArt) {
        comparison.summary.missing_in_db++
        comparison.details.missing_in_db.push({ article_number: artNum, boe_title: boeArt.title, boe_content_preview: boeArt.content?.substring(0, 200) + '...' })
      } else {
        const contentComparison = compareContent(boeArt.content || '', dbArt.content || '')
        const boeTitleNorm = normalizeText(boeArt.title)
        const dbTitleNorm = normalizeText(dbArt.title)
        const titlesMatch = boeTitleNorm === dbTitleNorm
        const boeHasNoTitle = !boeArt.title || boeArt.title.trim() === ''
        const dbHasTitle = dbArt.title && dbArt.title.trim() !== ''

        if (contentComparison.match) {
          if (titlesMatch || (boeHasNoTitle && dbHasTitle) || (boeHasNoTitle && !dbHasTitle)) {
            comparison.summary.matching++
            comparison.details.matching.push({ article_number: artNum, title: dbArt.title || boeArt.title || '(sin título)', db_id: dbArt.id, note: boeHasNoTitle && dbHasTitle ? 'BOE sin título, BD tiene título (contenido OK)' : null })
          } else {
            comparison.summary.title_mismatch++
            comparison.details.title_mismatch.push({ article_number: artNum, boe_title: boeArt.title || '(sin título)', db_title: dbArt.title || '(sin título)', db_id: dbArt.id, content_ok: true, boe_has_no_title: boeHasNoTitle })
          }
        } else {
          comparison.summary.content_mismatch++
          comparison.details.content_mismatch.push({ article_number: artNum, title: dbArt.title || boeArt.title || '(sin título)', similarity: contentComparison.similarity, boe_content_preview: boeArt.content?.substring(0, 300) + '...', db_content_preview: dbArt.content?.substring(0, 300) + '...', db_id: dbArt.id, boe_has_no_title: boeHasNoTitle })
        }
      }
    }

    let structureArticlesCount = 0
    for (const [artNum, dbArt] of dbMap) {
      if (!boeMap.has(artNum)) {
        if (isStructureArticle(dbArt.articleNumber)) { structureArticlesCount++; continue }
        if (!includeDisposiciones && dbArt.articleNumber.startsWith('DA_')) { structureArticlesCount++; continue }
        comparison.summary.extra_in_db++
        comparison.details.extra_in_db.push({ article_number: artNum, db_title: dbArt.title, db_id: dbArt.id })
      }
    }
    comparison.summary.structure_articles = structureArticlesCount

    const isOk = comparison.summary.title_mismatch === 0 && comparison.summary.content_mismatch === 0 && comparison.summary.extra_in_db === 0 && comparison.summary.missing_in_db === 0

    const summaryToSave = {
      boe_count: comparison.summary.boe_count, db_count: comparison.summary.db_count,
      matching: comparison.summary.matching, title_mismatch: comparison.summary.title_mismatch,
      content_mismatch: comparison.summary.content_mismatch || 0, extra_in_db: comparison.summary.extra_in_db,
      missing_in_db: comparison.summary.missing_in_db, structure_articles: comparison.summary.structure_articles || 0,
      is_ok: isOk, verified_at: new Date().toISOString(),
    }
    console.log('💾 [VERIFY] Guardando summary para ley:', law.id, summaryToSave)
    await updateLawVerification(law.id, summaryToSave)

    return NextResponse.json({ success: true, status: isOk ? 'ok' : 'discrepancies', comparison, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('Error verificando artículos:', error)
    return NextResponse.json({ success: false, error: 'Error interno del servidor', details: (error as Error).message }, { status: 500 })
  }
}
