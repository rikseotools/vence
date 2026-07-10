// lib/api/ai-verify/articleSearch.ts
// Búsqueda de artículos relevantes para /api/ai/verify-answer, EXTRAÍDA del route
// para ser testeable (el código real, no una copia del SQL). Agnóstica de proveedor:
// embeddings/OpenAI por puertos compartidos, BD por Drizzle/Postgres (getDb).
import { and, or, eq, ilike } from 'drizzle-orm'
import { generateEmbedding } from '@/lib/chat/domains/search/EmbeddingService'
import { searchArticlesBySimilarity } from '@/lib/chat/domains/search/queries'
import { getDb } from '@/db/client'
import { articles as articlesTable, laws as lawsTable } from '@/db/schema'

// Forma unificada de artículo para el contexto del prompt.
export type CtxArticle = { lawShortName: string; lawName: string; articleNumber: string | null; content: string | null }

/**
 * Artículos relevantes por embedding (pgvector, mismo camino que el chat) con la
 * ley como preferencia SUAVE — replica el comportamiento previo a la migración:
 *   - top semántico SIN filtro duro de ley (no `mentionedLawNames`, que haría match
 *     EXACTO de short_name y forzaría el fallback si fallara → regresión F1),
 *   - si `lawName` aparece por SUBSTRING en name o short_name de algún hit, se
 *     priorizan esos; si no hay match de ley, se usan los top semánticos igualmente,
 *   - solo si NO hay NINGÚN resultado semántico se cae al fallback por keywords.
 */
export async function searchRelevantArticles(searchText: string, lawName?: string | null): Promise<CtxArticle[]> {
  try {
    const { embedding } = await generateEmbedding(searchText)
    const matches = await searchArticlesBySimilarity(embedding, { limit: 10, minSimilarity: 0.5 })

    if (matches.length > 0) {
      let picked = matches
      if (lawName) {
        const ln = lawName.toLowerCase()
        const byLaw = matches.filter(
          a => (a.lawName || '').toLowerCase().includes(ln) || (a.lawShortName || '').toLowerCase().includes(ln),
        )
        if (byLaw.length > 0) picked = byLaw
      }
      return picked.slice(0, 5).map(a => ({
        lawShortName: a.lawShortName,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        content: a.content,
      }))
    }
    return await searchArticlesByKeywords(searchText, lawName)
  } catch (error) {
    console.error('Error en búsqueda semántica:', error)
    return await searchArticlesByKeywords(searchText, lawName)
  }
}

/**
 * Fallback por keywords — Drizzle/Postgres (articles + laws). Replica el AND de
 * hasta 5 keywords del código previo (cada palabra >3 chars como `ILIKE content`),
 * NO una sola (regresión F2). Filtro de ley opcional por substring en name/short_name.
 */
export async function searchArticlesByKeywords(searchText: string, lawName?: string | null): Promise<CtxArticle[]> {
  const keywords = searchText.split(/\s+/).filter(w => w.length > 3).slice(0, 5)
  if (keywords.length === 0) return []
  try {
    const conds = [
      eq(articlesTable.isActive, true),
      ...keywords.map(kw => ilike(articlesTable.content, `%${kw}%`)),
    ]
    if (lawName) {
      const lc = or(ilike(lawsTable.name, `%${lawName}%`), ilike(lawsTable.shortName, `%${lawName}%`))
      if (lc) conds.push(lc)
    }
    const rows = await getDb()
      .select({
        articleNumber: articlesTable.articleNumber,
        content: articlesTable.content,
        lawShortName: lawsTable.shortName,
        lawName: lawsTable.name,
      })
      .from(articlesTable)
      .leftJoin(lawsTable, eq(lawsTable.id, articlesTable.lawId))
      .where(and(...conds))
      .limit(5)
    return rows.map(r => ({
      lawShortName: r.lawShortName ?? '',
      lawName: r.lawName ?? '',
      articleNumber: r.articleNumber,
      content: r.content,
    }))
  } catch (error) {
    console.error('Error en fallback por keywords:', error)
    return []
  }
}
