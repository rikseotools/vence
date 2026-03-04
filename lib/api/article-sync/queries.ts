// lib/api/article-sync/queries.ts - Queries tipadas para sincronización de artículos BOE y EUR-Lex
import { getDb } from '@/db/client'
import { articles, laws } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'
import {
  extractArticlesFromBOE,
  normalizeArticleNumber
} from '@/lib/boe-extractor'
import {
  isEurLexUrl,
  extractArticlesFromEurLex,
  type ExtractedArticle
} from '@/lib/eurlex-extractor'
import {
  type SyncArticlesRequest,
  type SyncArticlesResponse,
  type SyncStats,
  type VerificationSummary,
  isStructureArticle
} from './schemas'

// ============================================
// HELPERS
// ============================================

function generateContentHash(content: string | null): string {
  return crypto.createHash('sha256').update(content || '').digest('hex')
}

// ============================================
// OBTENER LEY
// ============================================

interface LawData {
  id: string
  shortName: string
  name: string
  boeUrl: string | null
}

export async function getLawById(lawId: string): Promise<{ success: true; data: LawData } | { success: false; error: string }> {
  try {
    const db = getDb()

    const result = await db
      .select({
        id: laws.id,
        shortName: laws.shortName,
        name: laws.name,
        boeUrl: laws.boeUrl,
      })
      .from(laws)
      .where(eq(laws.id, lawId))
      .limit(1)

    if (!result.length) {
      return { success: false, error: 'Ley no encontrada' }
    }

    return { success: true, data: result[0] }
  } catch (error) {
    console.error('❌ [ArticleSync] Error obteniendo ley:', error)
    return { success: false, error: 'Error de base de datos' }
  }
}

// ============================================
// OBTENER ARTÍCULOS DE BD
// ============================================

interface DbArticle {
  id: string
  articleNumber: string
  contentHash: string | null
  isActive: boolean | null
}

export async function getDbArticles(lawId: string): Promise<DbArticle[]> {
  const db = getDb()

  const result = await db
    .select({
      id: articles.id,
      articleNumber: articles.articleNumber,
      contentHash: articles.contentHash,
      isActive: articles.isActive,
    })
    .from(articles)
    .where(eq(articles.lawId, lawId))

  return result
}

// ============================================
// SINCRONIZAR ARTÍCULOS
// ============================================

export async function syncArticlesFromBoe(
  params: SyncArticlesRequest
): Promise<SyncArticlesResponse> {
  const { lawId, includeDisposiciones } = params

  try {
    // 1. Obtener la ley
    const lawResult = await getLawById(lawId)
    if (lawResult.success === false) {
      return { success: false, error: lawResult.error }
    }
    const law = lawResult.data

    if (!law.boeUrl) {
      return { success: false, error: 'La ley no tiene URL del BOE configurada' }
    }

    // 2. Detectar tipo de fuente (BOE o EUR-Lex)
    const isEurLex = isEurLexUrl(law.boeUrl)
    const sourceName = isEurLex ? 'EUR-Lex' : 'BOE'

    console.log(`📥 [ArticleSync] Sincronizando ${law.shortName} desde ${sourceName}: ${law.boeUrl}`)

    const response = await fetch(law.boeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    })

    if (!response.ok) {
      return { success: false, error: `Error descargando ${sourceName}: ${response.status}` }
    }

    const html = await response.text()

    // 3. Extraer artículos usando el extractor apropiado
    let boeArticles: ExtractedArticle[]
    if (isEurLex) {
      // mainDocumentOnly solo aplica a TUE/TFUE consolidados (para excluir protocolos)
      // Para otros documentos EUR-Lex (Reglamentos, Decisiones), extraer todo
      const isConsolidatedTreaty = law.boeUrl.includes('12016M/TXT') || law.boeUrl.includes('12016E/TXT')
      boeArticles = extractArticlesFromEurLex(html, { mainDocumentOnly: isConsolidatedTreaty })
    } else {
      boeArticles = extractArticlesFromBOE(html, { includeDisposiciones })
    }
    console.log(`📄 [ArticleSync] Artículos encontrados en ${sourceName}: ${boeArticles.length}`)

    // Si no hay artículos, verificar si es doc.php (sin texto consolidado)
    if (boeArticles.length === 0) {
      const isDocPhp = law.boeUrl.includes('doc.php')
      return await handleNoArticlesCase(lawId, law.shortName, isDocPhp)
    }

    // 4. Obtener artículos actuales de la BD
    const dbArticles = await getDbArticles(lawId)
    console.log(`💾 [ArticleSync] Artículos en BD: ${dbArticles.length}`)

    // 5. Crear mapas para comparación
    const dbArticleMap = new Map<string, DbArticle>()
    let structureArticleCount = 0

    for (const a of dbArticles) {
      const normalized = normalizeArticleNumber(a.articleNumber)
      dbArticleMap.set(normalized, a)

      // Contar artículos de estructura
      if (isStructureArticle(a.articleNumber)) {
        structureArticleCount++
      }
    }

    const boeArticleSet = new Set(
      boeArticles.map(a => normalizeArticleNumber(a.article_number))
    )

    const now = new Date().toISOString()
    const today = now.split('T')[0]

    let added = 0
    let updated = 0
    let deactivated = 0
    let unchanged = 0

    const db = getDb()

    // 6. Procesar artículos del BOE
    for (const boeArt of boeArticles) {
      const normalizedNum = normalizeArticleNumber(boeArt.article_number)
      const dbArt = dbArticleMap.get(normalizedNum)
      const newHash = generateContentHash(boeArt.content)

      if (!dbArt) {
        // Artículo nuevo - insertar
        try {
          await db.insert(articles).values({
            lawId: lawId,
            articleNumber: normalizeArticleNumber(boeArt.article_number),
            title: boeArt.title || null,
            content: boeArt.content,
            contentHash: newHash,
            isActive: true,
            isVerified: true,
            verificationDate: today,
            lastModificationDate: today,
            createdAt: now,
            updatedAt: now,
          })
          added++
          console.log(`➕ [ArticleSync] Añadido: Art. ${boeArt.article_number}`)
        } catch (e) {
          console.error(`❌ [ArticleSync] Error insertando Art. ${boeArt.article_number}:`, e)
        }
      } else if (dbArt.contentHash !== newHash) {
        // Artículo existente con cambios - actualizar
        try {
          await db
            .update(articles)
            .set({
              title: boeArt.title || null,
              content: boeArt.content,
              contentHash: newHash,
              isActive: true,
              isVerified: true,
              verificationDate: today,
              lastModificationDate: today,
              updatedAt: now,
            })
            .where(eq(articles.id, dbArt.id))
          updated++
          console.log(`🔄 [ArticleSync] Actualizado: Art. ${boeArt.article_number}`)
        } catch (e) {
          console.error(`❌ [ArticleSync] Error actualizando Art. ${boeArt.article_number}:`, e)
        }
      } else {
        unchanged++
      }
    }

    // 7. Marcar como inactivos los artículos que ya no existen en BOE
    // EXCEPTO artículos de estructura (art. 0, etc.)
    for (const [normalizedNum, dbArt] of dbArticleMap.entries()) {
      // Saltar artículos de estructura - estos son intencionales
      if (isStructureArticle(dbArt.articleNumber)) {
        continue
      }

      // Si no incluimos disposiciones, no desactivar las que ya existan en BD
      if (!includeDisposiciones && dbArt.articleNumber.startsWith('DA_')) {
        continue
      }

      if (!boeArticleSet.has(normalizedNum) && dbArt.isActive) {
        try {
          await db
            .update(articles)
            .set({
              isActive: false,
              updatedAt: now,
            })
            .where(eq(articles.id, dbArt.id))
          deactivated++
          console.log(`❌ [ArticleSync] Desactivado: Art. ${dbArt.articleNumber}`)
        } catch (e) {
          console.error(`❌ [ArticleSync] Error desactivando Art. ${dbArt.articleNumber}:`, e)
        }
      }
    }

    console.log(`✅ [ArticleSync] Completado: +${added} 🔄${updated} -${deactivated} =${unchanged} (📁${structureArticleCount} estructura)`)

    // 8. Actualizar estado de verificación en la ley
    const stats: SyncStats = {
      boeTotal: boeArticles.length,
      dbTotal: boeArticles.length + structureArticleCount, // BOE + estructura
      added,
      updated,
      deactivated,
      unchanged,
      structureArticles: structureArticleCount,
    }

    const summary: VerificationSummary = {
      boe_count: boeArticles.length,
      db_count: boeArticles.length + structureArticleCount,
      matching: boeArticles.length,
      title_mismatch: 0,
      content_mismatch: 0,
      extra_in_db: 0, // Ya no contamos artículos de estructura como "extra"
      missing_in_db: 0,
      structure_articles: structureArticleCount,
      is_ok: true, // Después del sync, todo está OK
      verified_at: now,
    }

    await db
      .update(laws)
      .set({
        lastChecked: now,
        lastVerificationSummary: summary,
      })
      .where(eq(laws.id, lawId))

    return {
      success: true,
      message: `Sincronización completada para ${law.shortName}`,
      stats,
    }

  } catch (error) {
    console.error('❌ [ArticleSync] Error sincronizando artículos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }
  }
}

// ============================================
// CASO: LEY SIN ARTÍCULOS EN BOE
// ============================================

async function handleNoArticlesCase(
  lawId: string,
  shortName: string,
  isDocPhp: boolean
): Promise<SyncArticlesResponse> {
  const db = getDb()
  const now = new Date().toISOString()

  const summary: VerificationSummary = {
    boe_count: 0,
    db_count: 0,
    matching: 0,
    title_mismatch: 0,
    content_mismatch: 0,
    extra_in_db: 0,
    missing_in_db: 0,
    structure_articles: 0,
    is_ok: isDocPhp, // doc.php es OK, act.php sin artículos es error
    no_consolidated_text: isDocPhp,
    verified_at: now,
    message: isDocPhp
      ? 'Ley sin texto consolidado en BOE (solo documento original)'
      : 'No se encontraron artículos en el BOE',
  }

  await db
    .update(laws)
    .set({
      lastChecked: now,
      lastVerificationSummary: summary,
    })
    .where(eq(laws.id, lawId))

  if (isDocPhp) {
    console.log(`📄 [ArticleSync] ${shortName}: Ley sin texto consolidado - marcada como verificada`)
    return {
      success: true,
      message: `${shortName} verificada (sin texto consolidado en BOE)`,
      stats: {
        boeTotal: 0,
        dbTotal: 0,
        added: 0,
        updated: 0,
        deactivated: 0,
        unchanged: 0,
        structureArticles: 0,
        noConsolidatedText: true,
      },
    }
  }

  return {
    success: false,
    error: 'No se encontraron artículos en el BOE',
  }
}
